import { validateCompletedReview, CompletedReviewError } from "../domain/review/completed-review";
import { SessionReviewError } from "../domain/review/session-review";
import { normalizeSelectionStateRecord } from "../domain/matching/selection-state";
import { normalizeSessionRecord, type ConfirmedSessionRecord, type DraftSessionRecord, type SessionConfirmation } from "../domain/session";
import { getDatabase } from "./database";

export interface SessionReviewRepository {
  confirm(input: { sessionId: string; matchRunId: string; expectedSelectionRevision: number }): Promise<ConfirmedSessionRecord>;
  reopen(input: { sessionId: string; expectedConfirmedAt: string }): Promise<DraftSessionRecord>;
}
const error = (message: string, code: ConstructorParameters<typeof SessionReviewError>[1]): never => { throw new SessionReviewError(message, code); };
export function createSessionReviewRepository(dependencies: { now?: () => string } = {}): SessionReviewRepository {
  const now = dependencies.now ?? (() => new Date().toISOString());
  return {
    async confirm(input) {
      const db = await getDatabase();
      const tx = db.transaction(["catalogs", "sessions", "matchRuns", "selectionStates"], "readwrite");
      try {
        const raw = await tx.objectStore("sessions").get(input.sessionId);
        if (!raw) error("Сессия не найдена", "SESSION_NOT_FOUND");
        const session = normalizeSessionRecord(raw!);
        if (session.status === "confirmed") {
          if (session.confirmation.matchRunId === input.matchRunId && session.confirmation.selectionStateRevision === input.expectedSelectionRevision) { await tx.done; return session; }
          error("Сессия уже подтверждена", "REVIEW_CONFIRMATION_MISMATCH");
        }
        if (session.latestMatchRunId !== input.matchRunId) error("Запуск заменён", "MATCH_RUN_REPLACED");
        const run = await tx.objectStore("matchRuns").get(input.matchRunId);
        if (!run) error("Запуск не найден", "MATCH_RUN_NOT_FOUND");
        const rawState = await tx.objectStore("selectionStates").get(input.matchRunId);
        if (!rawState) error("SelectionState не найден", "SELECTION_STATE_NOT_FOUND");
        const selectionState = normalizeSelectionStateRecord(rawState!);
        if (selectionState.revision !== input.expectedSelectionRevision) error("Решения изменились", "SELECTION_REVISION_CHANGED");
        const catalogs = [];
        for (const id of session.catalogRecordIds) { const catalog = await tx.objectStore("catalogs").get(id); if (!catalog) error(`Каталог ${id} не найден`, "CATALOG_RECORD_MISSING"); catalogs.push(catalog!); }
        let summary;
        try { summary = validateCompletedReview({ session, catalogs, run: run!, selectionState, mode: "current_draft" }); }
        catch (cause) { if (cause instanceof CompletedReviewError) throw new SessionReviewError(cause.message, cause.code, cause.lineIds, { cause }); throw cause; }
        const timestamp = now();
        const confirmation: SessionConfirmation = { schemaVersion: "1.0.0", ...summary, confirmedAt: timestamp };
        const confirmed: ConfirmedSessionRecord = { ...session, status: "confirmed", confirmation, updatedAt: timestamp };
        await tx.objectStore("sessions").put(confirmed);
        await tx.done;
        return confirmed;
      } catch (cause) { tx.abort(); await tx.done.catch(() => undefined); if (cause instanceof SessionReviewError) throw cause; throw new SessionReviewError("Не удалось подтвердить результат", "SESSION_REVIEW_PERSIST_FAILED", [], { cause }); }
    },
    async reopen(input) {
      const db = await getDatabase();
      const tx = db.transaction(["sessions", "matchRuns", "selectionStates"], "readwrite");
      try {
        const raw = await tx.objectStore("sessions").get(input.sessionId);
        if (!raw) error("Сессия не найдена", "SESSION_NOT_FOUND");
        const session = normalizeSessionRecord(raw!);
        if (session.status !== "confirmed") error("Сессия не подтверждена", "SESSION_NOT_CONFIRMED");
        const confirmed = session as ConfirmedSessionRecord;
        if (confirmed.confirmation.confirmedAt !== input.expectedConfirmedAt) error("Подтверждение изменилось", "REVIEW_CONFIRMATION_MISMATCH");
        const run = await tx.objectStore("matchRuns").get(confirmed.confirmation.matchRunId);
        if (!run) error("Запуск не найден", "MATCH_RUN_NOT_FOUND");
        const rawState = await tx.objectStore("selectionStates").get(run!.id);
        if (!rawState) error("SelectionState не найден", "SELECTION_STATE_NOT_FOUND");
        const state = normalizeSelectionStateRecord(rawState!);
        if (run!.result.input_fingerprint !== confirmed.confirmation.inputFingerprint || state.inputFingerprint !== confirmed.confirmation.inputFingerprint || state.revision !== confirmed.confirmation.selectionStateRevision) error("Подтверждённые данные изменились", "REVIEW_CONFIRMATION_MISMATCH");
        const draft: DraftSessionRecord = { ...confirmed, status: "draft", confirmation: undefined, updatedAt: now() };
        await tx.objectStore("sessions").put(draft); await tx.done; return draft;
      } catch (cause) { tx.abort(); await tx.done.catch(() => undefined); if (cause instanceof SessionReviewError) throw cause; throw new SessionReviewError("Не удалось вернуть результат", "SESSION_REVIEW_PERSIST_FAILED", [], { cause }); }
    },
  };
}
export const sessionReviewRepository = createSessionReviewRepository();
