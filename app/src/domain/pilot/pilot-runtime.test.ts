import { describe, expect, it } from "vitest";
import { buildPilotRuntimeInfo, PILOT_RELEASE_ID } from "./pilot-runtime";

const session = {
  sessionId: "session", name: "Pilot", comment: "", status: "draft", requestId: "request",
  requestFileName: "request.json", requestBundle: { taxonomy_version: "1.0.0", source: { source_file_name: "request.json", line_count: 0 }, request_document: { request_id: "request", lines: [] } },
  lineCount: 0, validatedCount: 0, needsReviewCount: 0,
  catalogRefs: [{ recordId: "a", catalogId: "primary", sourceSha256: "sha" }, { recordId: "missing", catalogId: "secondary", sourceSha256: "sha2" }],
  catalogRecordIds: ["a", "missing"], matchingSettings: { catalogPriority: ["a", "missing"], brandPolicy: { mode: "prefer_requested" } },
  matchingRevision: 2, latestMatchRunId: "run", createdAt: "2026-01-01", updatedAt: "2026-01-01",
} as any;

describe("buildPilotRuntimeInfo", () => {
  it("reports authoritative versions and preserves session catalog order, including missing records", () => {
    const catalog = { recordId: "a", catalogId: "primary", taxonomyVersion: "1.0.0" } as any;
    const before = JSON.stringify(session);
    const info = buildPilotRuntimeInfo({ session, catalogs: [catalog], run: { result: { input_fingerprint: "fp" } } as any, selectionState: { revision: 7 } as any, current: true });
    expect(info).toMatchObject({ pilotReleaseId: PILOT_RELEASE_ID, storage: { databaseName: "auto-offer", databaseVersion: 3 }, session: { inputFingerprint: "fp", selectionStateRevision: 7 } });
    expect(info.taxonomy.catalogVersions.map((item) => item.recordId)).toEqual(["a", "missing"]);
    expect(info.taxonomy.consistent).toBe(false);
    expect(JSON.stringify(session)).toBe(before);
  });
});
