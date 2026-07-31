import { describe, expect, it } from "vitest";
import { buildSessionMatchingPolicy, createDefaultSessionMatchingSettings } from "../matching/session-policy";
import { pilotPolicyRegistry } from "../matching/pilot-config";
import { CompletedReviewError, validateCompletedReview } from "./completed-review";

function fixture() {
  const settings = createDefaultSessionMatchingSettings([]);
  const session: any = { status: "draft", sessionId: "s", requestId: "q", latestMatchRunId: "r", matchingRevision: 1, matchingSettings: settings, catalogRecordIds: [], requestBundle: { request_document: { lines: [{ line_id: "a" }, { line_id: "b" }] } } };
  const run: any = { id: "r", sessionId: "s", sessionRevision: 1, result: { request_id: "q", input_fingerprint: "fp", catalog_refs: [], policy: buildSessionMatchingPolicy({ sessionId: "s", catalogRecordIds: [], settings, policyRegistryVersion: pilotPolicyRegistry.policy_version }), lines: [{ line_id: "a", candidates: [], excluded_candidates: [] }, { line_id: "b", candidates: [], excluded_candidates: [] }] } };
  const selectionState: any = { matchRunId: "r", sessionId: "s", inputFingerprint: "fp", revision: 2, decisions: { a: { kind: "no_offer" }, b: { kind: "no_offer" } }, feedback: { a: { comment: "ok" } } };
  return { session, run, selectionState, catalogs: [] };
}
describe("validateCompletedReview", () => {
  it("returns deterministic counts without mutating inputs", () => { const input = fixture(); const before = structuredClone(input); expect(validateCompletedReview({ ...input, mode: "current_draft" })).toMatchObject({ lineCount: 2, noOfferCount: 2, feedbackCount: 1, selectionStateRevision: 2 }); expect(input).toEqual(before); });
  it("reports incomplete line ids in request order", () => { const input = fixture(); delete input.selectionState.decisions.a; delete input.selectionState.decisions.b; try { validateCompletedReview({ ...input, mode: "current_draft" }); } catch (error) { expect(error).toBeInstanceOf(CompletedReviewError); expect(error).toMatchObject({ code: "REVIEW_INCOMPLETE", lineIds: ["a", "b"] }); } });
  it.each([
    ["duplicate request line", (x: any) => x.session.requestBundle.request_document.lines.push({ line_id: "a" })],
    ["duplicate result line", (x: any) => x.run.result.lines.push(structuredClone(x.run.result.lines[0]))],
    ["missing result line", (x: any) => x.run.result.lines.pop()],
    ["unknown decision line", (x: any) => { x.selectionState.decisions.unknown = { kind: "no_offer" }; }],
  ])("rejects inconsistent review topology: %s", (_name, mutate) => {
    const input = fixture(); mutate(input);
    expect(() => validateCompletedReview({ ...input, mode: "current_draft" })).toThrow(expect.objectContaining({ code: "REVIEW_RESULT_INCONSISTENT" }));
  });
  it("rejects selected offers from another line or excluded candidates", () => {
    const input = fixture();
    const ref = { catalog_record_id: "r", catalog_id: "c", source_sha256: "h", source_item_id: "one" };
    input.run.result.lines[0].candidates = [{ offer_ref: ref }];
    input.run.result.lines[1].excluded_candidates = [{ offer_ref: { ...ref, source_item_id: "excluded" } }];
    input.selectionState.decisions.a = { kind: "selected_offer", offerRef: { ...ref, source_item_id: "excluded" } };
    expect(() => validateCompletedReview({ ...input, mode: "current_draft" })).toThrow(expect.objectContaining({ code: "REVIEW_RESULT_INCONSISTENT" }));
  });
  it.each(["selectionStateRevision", "lineCount"])("rejects a confirmed snapshot with wrong %s", (field) => {
    const input: any = fixture();
    const summary = validateCompletedReview({ ...input, mode: "current_draft" });
    input.session.status = "confirmed";
    input.session.confirmation = { ...summary, confirmedAt: "2026-07-31T09:00:00.000Z", [field]: 999 };
    expect(() => validateCompletedReview({ ...input, mode: "confirmed_snapshot" })).toThrow(expect.objectContaining({ code: "REVIEW_CONFIRMATION_MISMATCH" }));
  });
});
