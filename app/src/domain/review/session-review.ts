import type { ConfirmedSessionRecord, DraftSessionRecord } from "../session";
import type { AppRepositories } from "../../storage/repositories";

export type SessionReviewErrorCode = "SESSION_NOT_FOUND" | "SESSION_NOT_DRAFT" | "SESSION_NOT_CONFIRMED" | "MATCH_RUN_NOT_FOUND" | "MATCH_RUN_REPLACED" | "CATALOG_RECORD_MISSING" | "SELECTION_STATE_NOT_FOUND" | "SELECTION_REVISION_CHANGED" | "REVIEW_NOT_CURRENT" | "REVIEW_STATE_MISMATCH" | "REVIEW_INCOMPLETE" | "REVIEW_RESULT_INCONSISTENT" | "REVIEW_CONFIRMATION_MISMATCH" | "SESSION_REVIEW_PERSIST_FAILED";
export class SessionReviewError extends Error {
  constructor(message: string, public readonly code: SessionReviewErrorCode, public readonly lineIds: string[] = [], options?: { cause?: unknown }) { super(message, options); this.name = "SessionReviewError"; }
}
export async function confirmSessionReview(input: { sessionId: string; matchRunId: string; expectedSelectionRevision: number; repositories: AppRepositories }): Promise<ConfirmedSessionRecord> {
  return input.repositories.sessionReview.confirm(input);
}
export async function reopenSessionReview(input: { sessionId: string; expectedConfirmedAt: string; repositories: AppRepositories }): Promise<DraftSessionRecord> {
  return input.repositories.sessionReview.reopen(input);
}
