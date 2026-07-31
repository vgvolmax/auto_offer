import type { OfferRef } from "./offer-ref";

export interface SelectedOfferDecision {
  kind: "selected_offer";
  offerRef: OfferRef;
  confirmedAt: string;
}

export interface SelectionStateRecord {
  schemaVersion: "1.0.0";
  matchRunId: string;
  sessionId: string;
  inputFingerprint: string;
  revision: number;
  decisions: Record<string, SelectedOfferDecision>;
  createdAt: string;
  updatedAt: string;
}

export type SelectionErrorCode =
  | "SESSION_NOT_FOUND"
  | "MATCH_RUN_NOT_FOUND"
  | "MATCH_RUN_REPLACED"
  | "MATCH_RUN_STALE"
  | "SELECTION_STATE_RUN_MISMATCH"
  | "LINE_NOT_FOUND"
  | "CANDIDATE_NOT_FOUND"
  | "CANDIDATE_NOT_SELECTABLE"
  | "STALE_SELECTION_STATE"
  | "SELECTION_PERSIST_FAILED";

export class SelectionError extends Error {
  constructor(
    message: string,
    public readonly code: SelectionErrorCode,
    options?: { cause?: unknown },
  ) {
    super(message, options);
    this.name = "SelectionError";
  }
}

export function createSelectionState(
  run: { id: string; sessionId: string; result: { input_fingerprint: string } },
  now = new Date().toISOString(),
): SelectionStateRecord {
  return {
    schemaVersion: "1.0.0",
    matchRunId: run.id,
    sessionId: run.sessionId,
    inputFingerprint: run.result.input_fingerprint,
    revision: 0,
    decisions: {},
    createdAt: now,
    updatedAt: now,
  };
}
