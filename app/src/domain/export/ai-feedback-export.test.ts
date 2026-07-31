import { describe, expect, it } from "vitest";
import { AiFeedbackExportError, buildAiFeedbackExport } from "./ai-feedback-export";
import { createDefaultSessionMatchingSettings, buildSessionMatchingPolicy } from "../matching/session-policy";
import { pilotPolicyRegistry } from "../matching/pilot-config";
const ref = { catalog_record_id: "record", catalog_id: "catalog", source_sha256: "sha", source_item_id: "sku" };
function fixture(decision: unknown = { kind: "no_offer", confirmedAt: "2026-07-31T09:00:00.000Z" }) {
  const requestBundle: any = { taxonomy_version: "1", source: { source_file_name: "request.xlsx", line_count: 1 }, request_document: { request_id: "request", lines: [{ line_id: "line", raw_text: "Кран" }] } };
  const matchingSettings = createDefaultSessionMatchingSettings([]);
  const result: any = { input_fingerprint: "fingerprint", request_id: "request", catalog_refs: [], policy: buildSessionMatchingPolicy({ sessionId: "session", catalogRecordIds: [], settings: matchingSettings, policyRegistryVersion: pilotPolicyRegistry.policy_version }), lines: [{ line_id: "line", resolution: "single_exact", candidates: [{ offer_ref: ref }], excluded_candidates: [] }] };
  const session: any = { sessionId: "session", name: "Тест", comment: "", status: "draft", requestId: "request", requestFileName: "request.xlsx", requestBundle, catalogRefs: [], catalogRecordIds: [], matchingSettings, matchingRevision: 2, latestMatchRunId: "run", createdAt: "created", updatedAt: "updated" };
  const run: any = { id: "run", sessionId: "session", sessionRevision: 2, createdAt: "created", result };
  const selectionState: any = { schemaVersion: "1.1.0", matchRunId: "run", sessionId: "session", inputFingerprint: "fingerprint", revision: 1, decisions: decision ? { line: decision } : {}, feedback: {}, createdAt: "created", updatedAt: "updated" };
  return { session, run, selectionState, catalogs: [], current: true, exportedAt: "2026-07-31T09:00:00.000Z" };
}
describe("AI feedback export", () => {
  it("is deterministic, complete, and records missing referenced snapshots", () => {
    const input = fixture(); const before = structuredClone(input);
    const first = buildAiFeedbackExport(input);
    expect(JSON.stringify(first)).toBe(JSON.stringify(buildAiFeedbackExport(input)));
    expect(first).toMatchObject({ schema_version: "1.1.0", export_type: "auto_offer_ai_feedback", session: { status: "draft" }, operator_review: { decided_count: 1, no_offer_count: 1 } });
    expect(first.referenced_catalog_items).toEqual([expect.objectContaining({ offer_ref: ref, missing: true })]);
    expect(input).toEqual(before);
  });
  it("reports exact missing lines and blocks stale runs", () => {
    try { buildAiFeedbackExport(fixture(null)); throw new Error("expected"); } catch (error) { expect(error).toBeInstanceOf(AiFeedbackExportError); expect(error).toMatchObject({ code: "AI_EXPORT_INCOMPLETE", missingLineIds: ["line"] }); }
    expect(() => buildAiFeedbackExport({ ...fixture(), current: false })).toThrow(expect.objectContaining({ code: "AI_EXPORT_NOT_CURRENT" }));
  });
  it("rejects selected offers that do not belong to the same line", () => {
    const input = fixture({ kind: "selected_offer", offerRef: { ...ref, source_item_id: "foreign" }, confirmedAt: "now" });
    expect(() => buildAiFeedbackExport(input)).toThrow(expect.objectContaining({ code: "AI_EXPORT_RESULT_INCONSISTENT" }));
  });
  it("rejects duplicate, missing, and extra result lines", () => {
    const duplicate = fixture();
    duplicate.run.result.lines.push(structuredClone(duplicate.run.result.lines[0]));
    expect(() => buildAiFeedbackExport(duplicate)).toThrow(expect.objectContaining({ code: "AI_EXPORT_RESULT_INCONSISTENT" }));
    const missing = fixture(); missing.run.result.lines = [];
    expect(() => buildAiFeedbackExport(missing)).toThrow(expect.objectContaining({ code: "AI_EXPORT_RESULT_INCONSISTENT" }));
    const extra = fixture(); extra.run.result.lines.push({ line_id: "extra", candidates: [], excluded_candidates: [] });
    expect(() => buildAiFeedbackExport(extra)).toThrow(expect.objectContaining({ code: "AI_EXPORT_RESULT_INCONSISTENT" }));
  });
  it("rejects foreign and outcome-incompatible feedback references", () => {
    const foreign = fixture();
    foreign.selectionState.feedback.line = { outcome: "other_outcome", relatedOfferRef: { ...ref, catalog_id: "altered" } };
    expect(() => buildAiFeedbackExport(foreign)).toThrow(expect.objectContaining({ code: "AI_EXPORT_RESULT_INCONSISTENT" }));
    const incompatible = fixture();
    incompatible.selectionState.feedback.line = { outcome: "correct_candidate_excluded", relatedOfferRef: ref };
    expect(() => buildAiFeedbackExport(incompatible)).toThrow(expect.objectContaining({ code: "AI_EXPORT_RESULT_INCONSISTENT" }));
  });
  it("rejects unknown decision and feedback line ids", () => {
    const decision = fixture(); decision.selectionState.decisions.unknown = decision.selectionState.decisions.line;
    expect(() => buildAiFeedbackExport(decision)).toThrow(expect.objectContaining({ code: "AI_EXPORT_RESULT_INCONSISTENT" }));
    const feedback = fixture(); feedback.selectionState.feedback.unknown = { comment: "x" };
    expect(() => buildAiFeedbackExport(feedback)).toThrow(expect.objectContaining({ code: "AI_EXPORT_RESULT_INCONSISTENT" }));
  });
  it("exports an immutable confirmed snapshot even when the live run is not current", () => {
    const input: any = fixture();
    input.session.status = "confirmed";
    input.session.confirmation = { matchRunId: "run", inputFingerprint: "fingerprint", matchingRevision: 2, selectionStateRevision: 1, lineCount: 1, selectedOfferCount: 0, noOfferCount: 1, feedbackCount: 0, confirmedAt: "2026-07-31T09:00:00.000Z" };
    input.current = false;
    const before = structuredClone(input);
    const output = buildAiFeedbackExport(input);
    expect(output).toMatchObject({ schema_version: "1.1.0", session: { status: "confirmed", confirmation: expect.any(Object) } });
    expect(output.session.confirmation).not.toBe(input.session.confirmation);
    expect(output.referenced_catalog_items).toEqual([expect.objectContaining({ missing: true })]);
    expect(input).toEqual(before);
  });
  it.each(["selectionStateRevision", "matchRunId", "lineCount"])("rejects confirmed snapshots with wrong %s", (field) => {
    const input: any = fixture();
    input.session.status = "confirmed";
    input.session.confirmation = { matchRunId: "run", inputFingerprint: "fingerprint", matchingRevision: 2, selectionStateRevision: 1, lineCount: 1, selectedOfferCount: 0, noOfferCount: 1, feedbackCount: 0, confirmedAt: "2026-07-31T09:00:00.000Z", [field]: "matchRunId" === field ? "other" : 999 };
    input.current = false;
    expect(() => buildAiFeedbackExport(input)).toThrow(expect.objectContaining({ code: "AI_EXPORT_STATE_MISMATCH" }));
  });
});
