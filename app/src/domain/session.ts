import type { CatalogRecord } from "./catalog";
import {
  createDefaultSessionMatchingSettings,
  normalizeSessionMatchingSettings,
  type SessionMatchingSettings,
} from "./matching/session-policy";

export interface RequestBundle {
  taxonomy_version: string;
  source: { source_file_name: string; line_count: number };
  request_document: {
    request_id: string;
    lines: Array<{
      line_id: string;
      raw_text: string;
      quantity?: { value: number; unit: string };
      class_id?: string;
      annotation?: { status?: string };
    }>;
  };
  [key: string]: unknown;
}
export type SessionStatus = "draft" | "confirmed";
export interface SessionConfirmation {
  schemaVersion: "1.0.0";
  matchRunId: string;
  inputFingerprint: string;
  matchingRevision: number;
  selectionStateRevision: number;
  lineCount: number;
  selectedOfferCount: number;
  noOfferCount: number;
  feedbackCount: number;
  confirmedAt: string;
}
interface SessionRecordBase {
  sessionId: string;
  name: string;
  comment: string;
  requestId: string;
  requestFileName: string;
  requestBundle: RequestBundle;
  lineCount: number;
  validatedCount: number;
  needsReviewCount: number;
  catalogRefs: Array<{
    recordId: string;
    catalogId: string;
    sourceSha256: string;
  }>;
  catalogRecordIds: string[];
  matchingSettings: SessionMatchingSettings;
  matchingRevision: number;
  latestMatchRunId: string | null;
  createdAt: string;
  updatedAt: string;
}
export interface DraftSessionRecord extends SessionRecordBase { status: "draft"; confirmation?: undefined }
export interface ConfirmedSessionRecord extends SessionRecordBase { status: "confirmed"; confirmation: SessionConfirmation }
export type SessionRecord = DraftSessionRecord | ConfirmedSessionRecord;
export class SessionRecordError extends Error {
  constructor(message: string, public readonly code: "INVALID_SESSION_CONFIRMATION") { super(message); this.name = "SessionRecordError"; }
}
export type StoredSessionRecord = Omit<
  SessionRecordBase,
  | "catalogRecordIds"
  | "matchingSettings"
  | "matchingRevision"
  | "latestMatchRunId"
> &
  Partial<
    Pick<
      SessionRecord,
      | "catalogRecordIds"
      | "matchingSettings"
      | "matchingRevision"
      | "latestMatchRunId"
    >
  > & { status?: SessionStatus; confirmation?: SessionConfirmation };

function normalizeConfirmation(value: unknown): SessionConfirmation {
  const confirmation = value as Record<string, unknown> | null;
  const strings = ["matchRunId", "inputFingerprint", "confirmedAt"];
  const numbers = ["matchingRevision", "selectionStateRevision", "lineCount", "selectedOfferCount", "noOfferCount", "feedbackCount"];
  if (!confirmation || confirmation.schemaVersion !== "1.0.0" || strings.some((key) => typeof confirmation[key] !== "string") || numbers.some((key) => typeof confirmation[key] !== "number" || !Number.isInteger(confirmation[key]) || (confirmation[key] as number) < 0))
    throw new SessionRecordError("Некорректные данные подтверждения сессии", "INVALID_SESSION_CONFIRMATION");
  return { ...(confirmation as unknown as SessionConfirmation) };
}

export function normalizeSessionRecord(
  record: StoredSessionRecord,
): SessionRecord {
  const catalogRecordIds = record.catalogRecordIds
    ? [...record.catalogRecordIds]
    : record.catalogRefs.map((ref) => ref.recordId);
  const base = {
    ...record,
    catalogRecordIds,
    matchingSettings: normalizeSessionMatchingSettings(
      record.matchingSettings,
      catalogRecordIds,
    ),
    matchingRevision: record.matchingRevision ?? 0,
    latestMatchRunId: record.latestMatchRunId ?? null,
  };
  if (record.status === "confirmed") return { ...base, status: "confirmed", confirmation: normalizeConfirmation(record.confirmation) };
  return { ...base, status: "draft", confirmation: undefined };
}

export function createDraftSession(
  bundle: RequestBundle,
  catalogs: CatalogRecord[],
  name: string,
  comment = "",
  now = new Date().toISOString(),
): DraftSessionRecord {
  const statuses = bundle.request_document.lines.map(
    (line) => line.annotation?.status,
  );
  const catalogRecordIds = catalogs.map((catalog) => catalog.recordId);
  return {
    sessionId: crypto.randomUUID(),
    name: name.trim(),
    comment: comment.trim(),
    status: "draft",
    requestId: bundle.request_document.request_id,
    requestFileName: bundle.source.source_file_name,
    requestBundle: bundle,
    lineCount: bundle.request_document.lines.length,
    validatedCount: statuses.filter((status) => status === "validated").length,
    needsReviewCount: statuses.filter((status) => status === "needs_review")
      .length,
    catalogRefs: catalogs.map(({ recordId, catalogId, sourceSha256 }) => ({
      recordId,
      catalogId,
      sourceSha256,
    })),
    catalogRecordIds,
    matchingSettings: createDefaultSessionMatchingSettings(catalogRecordIds),
    matchingRevision: 0,
    latestMatchRunId: null,
    createdAt: now,
    updatedAt: now,
  };
}
