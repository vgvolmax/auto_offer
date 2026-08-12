import type { OfferRef } from "./offer-ref";
import type { LineFeedback } from "./line-feedback";
export const SELECTION_STATE_SCHEMA_VERSION = "1.1.0" as const;

export interface SelectedOfferDecision {
  kind: "selected_offer";
  offerRef: OfferRef;
  confirmedAt: string;
}
export interface NoOfferDecision { kind: "no_offer"; confirmedAt: string }
export type LineDecision = SelectedOfferDecision | NoOfferDecision;

export interface SelectionStateRecord {
  schemaVersion: typeof SELECTION_STATE_SCHEMA_VERSION;
  matchRunId: string;
  sessionId: string;
  inputFingerprint: string;
  revision: number;
  decisions: Record<string, LineDecision>;
  feedback: Record<string, LineFeedback>;
  createdAt: string;
  updatedAt: string;
}
export type StoredSelectionStateRecord = SelectionStateRecord | (Omit<SelectionStateRecord, "schemaVersion" | "feedback" | "decisions"> & {
  schemaVersion: "1.0.0"; decisions: Record<string, SelectedOfferDecision>;
});

export function normalizeSelectionStateRecord(record: StoredSelectionStateRecord): SelectionStateRecord {
  const decisions: Record<string, LineDecision> = {};
  for (const [lineId, decision] of Object.entries(record.decisions)) {
    if (!decision || (decision.kind !== "selected_offer" && decision.kind !== "no_offer"))
      throw new SelectionError(`Повреждено решение строки ${lineId}`, "SELECTION_STATE_RUN_MISMATCH");
    decisions[lineId] = decision.kind === "selected_offer"
      ? { ...decision, offerRef: { ...decision.offerRef } }
      : { ...decision };
  }
  return { ...record, schemaVersion: SELECTION_STATE_SCHEMA_VERSION, decisions, feedback: record.schemaVersion === "1.0.0" ? {} : { ...record.feedback } };
}

export type SelectionErrorCode =
  | "SESSION_NOT_FOUND"
  | "MATCH_RUN_NOT_FOUND"
  | "MATCH_RUN_REPLACED"
  | "MATCH_RUN_STALE"
  | "SELECTION_STATE_RUN_MISMATCH"
  | "LINE_NOT_FOUND"
  | "DUPLICATE_LINE_IDS"
  | "LINE_HAS_CANDIDATES"
  | "LINE_ALREADY_DECIDED"
  | "CANDIDATE_NOT_FOUND"
  | "CANDIDATE_NOT_SELECTABLE"
  | "STALE_SELECTION_STATE"
  | "SELECTION_PERSIST_FAILED"
  | "SESSION_CONFIRMED";

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
    schemaVersion: SELECTION_STATE_SCHEMA_VERSION,
    matchRunId: run.id,
    sessionId: run.sessionId,
    inputFingerprint: run.result.input_fingerprint,
    revision: 0,
    decisions: {},
    feedback: {},
    createdAt: now,
    updatedAt: now,
  };
}
