import { describe, expect, it } from "vitest";
import { buildEffectiveReview } from "./effective-review";

const catalog = (status: "validated" | "needs_review" = "validated"): any => ({
  recordId: "catalog-record", catalogId: "catalog", sourceSha256: "sha", semanticRevision: 0,
  bundle: { items: [{ catalog_item: { source_item_id: "item", annotation: { status } } }] },
});
const run = (decision: any): any => ({ id: "run", sessionId: "session", sessionRevision: 0, runKind: "semantic", result: { lines: [{ line_id: "line", ...decision }] } });
const selection = (decision?: any): any => ({ matchRunId: "run", sessionId: "session", revision: 0, decisions: decision ? { line: decision } : {}, feedback: {} });

describe("buildEffectiveReview", () => {
  it("treats an eligible AI offer as ready without materializing a decision", () => {
    const state = selection();
    const before = structuredClone(state);
    const review = buildEffectiveReview({ run: run({ decision: "offer", offer_ref: { catalog_record_id: "catalog-record", source_item_id: "item" } }), catalogs: [catalog()], selectionState: state });
    expect(review).toMatchObject({ readyCount: 1, selectedOfferCount: 1, unresolvedCount: 0 });
    expect(review.lines[0].outcome).toMatchObject({ kind: "selected_offer", source: "ai" });
    expect(state).toEqual(before);
  });

  it.each(["no_offer", "request_unsupported"])("resolves %s as commercial no-offer", (decision) => {
    const review = buildEffectiveReview({ run: run({ decision }), catalogs: [], selectionState: selection() });
    expect(review).toMatchObject({ readyCount: 1, noOfferCount: 1, unresolvedCount: 0 });
  });

  it.each(["reroute_required", "request_review_required", "request_invalid"])("keeps %s unresolved", (decision) => {
    expect(buildEffectiveReview({ run: run({ decision }), catalogs: [], selectionState: selection() }).unresolvedCount).toBe(1);
  });

  it("requires explicit approval for manual-only and lets an operator override win", () => {
    const semanticRun = run({ decision: "offer", offer_ref: { catalog_record_id: "catalog-record", source_item_id: "item" } });
    expect(buildEffectiveReview({ run: semanticRun, catalogs: [catalog("needs_review")], selectionState: selection() }).lines[0].outcome).toMatchObject({ kind: "unresolved", reason: "manual_only" });
    const ref = { catalog_record_id: "catalog-record", catalog_id: "catalog", source_sha256: "sha", source_item_id: "item" };
    expect(buildEffectiveReview({ run: semanticRun, catalogs: [catalog("needs_review")], selectionState: selection({ kind: "selected_offer", offerRef: ref }) }).lines[0].outcome).toMatchObject({ kind: "selected_offer", source: "operator" });
    expect(buildEffectiveReview({ run: semanticRun, catalogs: [catalog()], selectionState: selection({ kind: "no_offer" }) }).lines[0].outcome).toEqual({ kind: "no_offer", source: "operator" });
  });

  it("keeps Pilot dependent on operator decisions", () => {
    const pilot: any = { ...run({}), runKind: "pilot", result: { lines: [{ line_id: "line", candidates: [] }] } };
    expect(buildEffectiveReview({ run: pilot, catalogs: [], selectionState: selection() }).unresolvedCount).toBe(1);
  });

  it("derives 500 ready lines synchronously without writes", () => {
    const semanticRun = run({ decision: "no_offer" });
    semanticRun.result.lines = Array.from({ length: 500 }, (_, index) => ({ line_id: `line-${index}`, decision: "no_offer" }));
    expect(buildEffectiveReview({ run: semanticRun, catalogs: [], selectionState: selection() })).toMatchObject({ readyCount: 500, noOfferCount: 500, operatorOverrideCount: 0 });
  });
});
