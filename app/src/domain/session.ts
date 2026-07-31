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
export interface SessionRecord {
  sessionId: string;
  name: string;
  comment: string;
  status: "draft";
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
export type StoredSessionRecord = Omit<
  SessionRecord,
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
  >;

export function normalizeSessionRecord(
  record: StoredSessionRecord,
): SessionRecord {
  const catalogRecordIds = record.catalogRecordIds
    ? [...record.catalogRecordIds]
    : record.catalogRefs.map((ref) => ref.recordId);
  return {
    ...record,
    catalogRecordIds,
    matchingSettings: normalizeSessionMatchingSettings(
      record.matchingSettings,
      catalogRecordIds,
    ),
    matchingRevision: record.matchingRevision ?? 0,
    latestMatchRunId: record.latestMatchRunId ?? null,
  };
}

export function createDraftSession(
  bundle: RequestBundle,
  catalogs: CatalogRecord[],
  name: string,
  comment = "",
  now = new Date().toISOString(),
): SessionRecord {
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
