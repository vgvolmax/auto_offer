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
});
