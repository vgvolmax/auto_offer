import type { MatchRunRecord } from "../domain/matching/match-run";
import {
  createSelectionState,
  SelectionError,
  type SelectedOfferDecision,
  type SelectionStateRecord,
} from "../domain/matching/selection-state";
import { normalizeSessionRecord } from "../domain/session";
import { getDatabase } from "./database";
export class StaleSelectionStateError extends Error {
  readonly code = "STALE_SELECTION_STATE";
}
export interface SelectionStatesRepository {
  get(matchRunId: string): Promise<SelectionStateRecord | undefined>;
  getOrCreateForRun(run: MatchRunRecord): Promise<SelectionStateRecord>;
  saveDecision(input: {
    sessionId: string;
    matchRunId: string;
    expectedRevision: number;
    lineId: string;
    decision: SelectedOfferDecision | null;
  }): Promise<SelectionStateRecord>;
  deleteForRun(matchRunId: string): Promise<void>;
  deleteForSession(sessionId: string): Promise<void>;
}
export const selectionStatesRepository: SelectionStatesRepository = {
  async get(id) {
    return (await getDatabase()).get("selectionStates", id);
  },
  async getOrCreateForRun(run) {
    const db = await getDatabase();
    const tx = db.transaction("selectionStates", "readwrite");
    const existing = await tx.store.get(run.id);
    if (existing) {
      if (
        existing.sessionId !== run.sessionId ||
        existing.inputFingerprint !== run.result.input_fingerprint
      ) {
        tx.abort();
        throw new SelectionError(
          "SelectionState не соответствует запуску",
          "SELECTION_STATE_RUN_MISMATCH",
        );
      }
      await tx.done;
      return existing;
    }
    const state = createSelectionState(run);
    await tx.store.add(state);
    await tx.done;
    return state;
  },
  async saveDecision(input) {
    const db = await getDatabase();
    const tx = db.transaction(
      ["sessions", "matchRuns", "selectionStates"],
      "readwrite",
    );
    try {
      const stored = await tx.objectStore("sessions").get(input.sessionId);
      if (!stored)
        throw new SelectionError("Сессия не найдена", "SESSION_NOT_FOUND");
      const session = normalizeSessionRecord(stored);
      if (session.latestMatchRunId !== input.matchRunId)
        throw new SelectionError("Запуск заменён", "MATCH_RUN_REPLACED");
      const run = await tx.objectStore("matchRuns").get(input.matchRunId);
      if (!run)
        throw new SelectionError("Запуск не найден", "MATCH_RUN_NOT_FOUND");
      if (run.sessionRevision !== session.matchingRevision)
        throw new SelectionError("Запуск устарел", "MATCH_RUN_STALE");
      const state = await tx
        .objectStore("selectionStates")
        .get(input.matchRunId);
      if (!state)
        throw new SelectionError(
          "SelectionState не найден",
          "SELECTION_STATE_RUN_MISMATCH",
        );
      if (state.revision !== input.expectedRevision)
        throw new StaleSelectionStateError();
      const decisions = { ...state.decisions };
      if (input.decision) decisions[input.lineId] = input.decision;
      else delete decisions[input.lineId];
      const next = {
        ...state,
        decisions,
        revision: state.revision + 1,
        updatedAt: new Date().toISOString(),
      };
      await tx.objectStore("selectionStates").put(next);
      await tx.done;
      return next;
    } catch (e) {
      tx.abort();
      throw e;
    }
  },
  async deleteForRun(id) {
    await (await getDatabase()).delete("selectionStates", id);
  },
  async deleteForSession(id) {
    const db = await getDatabase();
    const tx = db.transaction("selectionStates", "readwrite");
    for (const key of await tx.store.index("by-session").getAllKeys(id))
      await tx.store.delete(key);
    await tx.done;
  },
};
