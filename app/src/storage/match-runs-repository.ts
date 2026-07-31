import type { MatchResult } from "../domain/matching";
import type { MatchRunRecord } from "../domain/matching/match-run";
import { normalizeSessionRecord } from "../domain/session";
import { getDatabase } from "./database";
import { createSelectionState } from "../domain/matching/selection-state";
export class StaleMatchRunError extends Error {
  code = "STALE_MATCH_RUN" as const;
}
export class ConfirmedSessionWriteError extends Error { readonly code = "SESSION_CONFIRMED"; }
export interface MatchRunRepository {
  get(id: string): Promise<MatchRunRecord | undefined>;
  getLatestForSession(sessionId: string): Promise<MatchRunRecord | undefined>;
  saveLatest(input: {
    sessionId: string;
    expectedSessionRevision: number;
    result: MatchResult;
  }): Promise<MatchRunRecord>;
  deleteForSession(sessionId: string): Promise<void>;
}
export function createMatchRunsRepository(dependencies: {
  createId?: () => string;
  now?: () => string;
  createSelectionStateForRun?: typeof createSelectionState;
} = {}): MatchRunRepository {
  const createId = dependencies.createId ?? (() => crypto.randomUUID());
  const now = dependencies.now ?? (() => new Date().toISOString());
  const createSelectionStateForRun = dependencies.createSelectionStateForRun ?? createSelectionState;
  return {
  async get(id) {
    return (await getDatabase()).get("matchRuns", id);
  },
  async getLatestForSession(sessionId) {
    const db = await getDatabase();
    const session = await db.get("sessions", sessionId);
    return session?.latestMatchRunId
      ? db.get("matchRuns", session.latestMatchRunId)
      : undefined;
  },
  async saveLatest(input) {
    const db = await getDatabase();
    const tx = db.transaction(
      ["sessions", "matchRuns", "selectionStates"],
      "readwrite",
    );
    try {
      const stored = await tx.objectStore("sessions").get(input.sessionId);
      if (!stored) throw new Error("SESSION_NOT_FOUND");
      const session = normalizeSessionRecord(stored);
      if (session.status === "confirmed") throw new ConfirmedSessionWriteError("Подтверждённый результат доступен только для просмотра");
      if (session.matchingRevision !== input.expectedSessionRevision)
        throw new StaleMatchRunError();
      const previous = session.latestMatchRunId;
      const id = createId();
      const createdAt = now();
      const record = {
        id,
        sessionId: input.sessionId,
        sessionRevision: session.matchingRevision,
        createdAt,
        result: input.result,
      };
      await tx.objectStore("matchRuns").put(record);
      await tx.objectStore("selectionStates").put(createSelectionStateForRun(record));
      await tx
        .objectStore("sessions")
        .put({ ...session, latestMatchRunId: id, updatedAt: createdAt });
      if (previous && previous !== id) {
        await tx.objectStore("selectionStates").delete(previous);
        await tx.objectStore("matchRuns").delete(previous);
      }
      await tx.done;
      return record;
    } catch (error) {
      tx.abort();
      await tx.done.catch(() => undefined);
      throw error;
    }
  },
  async deleteForSession(sessionId) {
    const db = await getDatabase();
    const tx = db.transaction("matchRuns", "readwrite");
    for (const key of await tx.store.index("by-session").getAllKeys(sessionId))
      await tx.store.delete(key);
    await tx.done;
  },
  };
}
export const matchRunsRepository = createMatchRunsRepository();
