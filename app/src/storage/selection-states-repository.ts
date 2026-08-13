import { matchRunFingerprint, normalizeMatchRunRecord } from "../domain/matching/match-run";
import type { MatchRunRecord } from "../domain/matching/match-run";
import {
  createSelectionState,
  normalizeSelectionStateRecord,
  SelectionError,
  type LineDecision,
  type SelectionStateRecord,
} from "../domain/matching/selection-state";
import { normalizeLineFeedback, type LineFeedback } from "../domain/matching/line-feedback";
import { offerRefKey } from "../domain/matching/offer-ref";
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
    decision: LineDecision | null;
  }): Promise<SelectionStateRecord>;
  saveNoOfferDecisions(input: {
    sessionId: string;
    matchRunId: string;
    expectedRevision: number;
    lineIds: string[];
  }): Promise<SelectionStateRecord>;
  saveFeedback(input: { sessionId: string; matchRunId: string; expectedRevision: number; lineId: string; feedback: LineFeedback | null }): Promise<SelectionStateRecord>;
  deleteForRun(matchRunId: string): Promise<void>;
  deleteForSession(sessionId: string): Promise<void>;
}
export const selectionStatesRepository: SelectionStatesRepository = {
  async get(id) {
    const value = await (await getDatabase()).get("selectionStates", id);
    return value && normalizeSelectionStateRecord(value);
  },
  async getOrCreateForRun(run) {
    const db = await getDatabase();
    const tx = db.transaction("selectionStates", "readwrite");
    const stored = await tx.store.get(run.id);
    const existing = stored && normalizeSelectionStateRecord(stored);
    if (existing) {
      if (
        existing.sessionId !== run.sessionId ||
        existing.inputFingerprint !== matchRunFingerprint(normalizeMatchRunRecord(run))
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
      if (session.status === "confirmed") throw new SelectionError("Подтверждённый результат доступен только для просмотра", "SESSION_CONFIRMED");
      if (session.latestMatchRunId !== input.matchRunId)
        throw new SelectionError("Запуск заменён", "MATCH_RUN_REPLACED");
      const run = await tx.objectStore("matchRuns").get(input.matchRunId);
      if (!run)
        throw new SelectionError("Запуск не найден", "MATCH_RUN_NOT_FOUND");
      if (run.sessionRevision !== session.matchingRevision)
        throw new SelectionError("Запуск устарел", "MATCH_RUN_STALE");
      const storedState = await tx
        .objectStore("selectionStates")
        .get(input.matchRunId);
      if (!storedState)
        throw new SelectionError(
          "SelectionState не найден",
          "SELECTION_STATE_RUN_MISMATCH",
        );
      const state = normalizeSelectionStateRecord(storedState);
      if (state.revision !== input.expectedRevision)
        throw new StaleSelectionStateError();
      const old = state.decisions[input.lineId];
      const same = input.decision === null ? old === undefined : old?.kind === input.decision.kind && old.confirmedAt === input.decision.confirmedAt && (old.kind !== "selected_offer" || (input.decision.kind === "selected_offer" && offerRefKey(old.offerRef) === offerRefKey(input.decision.offerRef)));
      if (same) { await tx.done; return state; }
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
      await tx.done.catch(() => undefined);
      throw e;
    }
  },
  async saveNoOfferDecisions(input) {
    if (!input.lineIds.length)
      throw new SelectionError("Не выбраны строки", "LINE_NOT_FOUND");
    if (new Set(input.lineIds).size !== input.lineIds.length)
      throw new SelectionError("Строки не должны повторяться", "DUPLICATE_LINE_IDS");
    const db = await getDatabase();
    const tx = db.transaction(["sessions", "matchRuns", "selectionStates"], "readwrite");
    try {
      const storedSession = await tx.objectStore("sessions").get(input.sessionId);
      if (!storedSession) throw new SelectionError("Сессия не найдена", "SESSION_NOT_FOUND");
      const session = normalizeSessionRecord(storedSession);
      if (session.status === "confirmed") throw new SelectionError("Подтверждённый результат доступен только для просмотра", "SESSION_CONFIRMED");
      if (session.latestMatchRunId !== input.matchRunId) throw new SelectionError("Запуск заменён", "MATCH_RUN_REPLACED");
      const run = await tx.objectStore("matchRuns").get(input.matchRunId);
      if (!run) throw new SelectionError("Запуск не найден", "MATCH_RUN_NOT_FOUND");
      if (run.sessionRevision !== session.matchingRevision) throw new SelectionError("Запуск устарел", "MATCH_RUN_STALE");
      const storedState = await tx.objectStore("selectionStates").get(input.matchRunId);
      if (!storedState) throw new SelectionError("SelectionState не найден", "SELECTION_STATE_RUN_MISMATCH");
      const state = normalizeSelectionStateRecord(storedState);
      if (state.sessionId !== run.sessionId || state.inputFingerprint !== matchRunFingerprint(normalizeMatchRunRecord(run)))
        throw new SelectionError("SelectionState не соответствует запуску", "SELECTION_STATE_RUN_MISMATCH");
      if (state.revision !== input.expectedRevision) throw new StaleSelectionStateError();
      const resultLines = Array.isArray(run.result.lines) ? run.result.lines : [];
      for (const lineId of input.lineIds) {
        const line = resultLines.find((value: any) => value && typeof value === "object" && value.line_id === lineId) as any;
        if (!line) throw new SelectionError("Строка не найдена", "LINE_NOT_FOUND");
        if (!Array.isArray(line.candidates) || line.candidates.length > 0)
          throw new SelectionError("У строки есть предложения", "LINE_HAS_CANDIDATES");
        if (state.decisions[lineId])
          throw new SelectionError("По строке уже принято решение", "LINE_ALREADY_DECIDED");
      }
      const timestamp = new Date().toISOString();
      const decisions = { ...state.decisions };
      for (const lineId of input.lineIds)
        decisions[lineId] = { kind: "no_offer", confirmedAt: timestamp };
      const next: SelectionStateRecord = { ...state, decisions, revision: state.revision + 1, updatedAt: timestamp };
      await tx.objectStore("selectionStates").put(next);
      await tx.done;
      return next;
    } catch (error) {
      tx.abort();
      await tx.done.catch(() => undefined);
      throw error;
    }
  },
  async saveFeedback(input) {
    const normalized = input.feedback ? normalizeLineFeedback(input.feedback) : undefined;
    const db = await getDatabase();
    const tx = db.transaction(["sessions", "matchRuns", "selectionStates"], "readwrite");
    try {
      const storedSession = await tx.objectStore("sessions").get(input.sessionId);
      if (!storedSession) throw new SelectionError("Сессия не найдена", "SESSION_NOT_FOUND");
      const session = normalizeSessionRecord(storedSession);
      if (session.status === "confirmed") throw new SelectionError("Подтверждённый результат доступен только для просмотра", "SESSION_CONFIRMED");
      if (session.latestMatchRunId !== input.matchRunId) throw new SelectionError("Запуск заменён", "MATCH_RUN_REPLACED");
      const run = await tx.objectStore("matchRuns").get(input.matchRunId);
      if (!run) throw new SelectionError("Запуск не найден", "MATCH_RUN_NOT_FOUND");
      if (run.sessionRevision !== session.matchingRevision) throw new SelectionError("Запуск устарел", "MATCH_RUN_STALE");
      const storedState = await tx.objectStore("selectionStates").get(input.matchRunId);
      if (!storedState) throw new SelectionError("SelectionState не найден", "SELECTION_STATE_RUN_MISMATCH");
      const state = normalizeSelectionStateRecord(storedState);
      if (state.revision !== input.expectedRevision) throw new StaleSelectionStateError();
      const current = state.feedback[input.lineId];
      if (JSON.stringify(current) === JSON.stringify(normalized)) { await tx.done; return state; }
      const feedback = { ...state.feedback };
      if (normalized) feedback[input.lineId] = normalized; else delete feedback[input.lineId];
      const next: SelectionStateRecord = { ...state, feedback, revision: state.revision + 1, updatedAt: new Date().toISOString() };
      await tx.objectStore("selectionStates").put(next);
      await tx.done;
      return next;
    } catch (error) { tx.abort(); await tx.done.catch(() => undefined); throw error; }
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
