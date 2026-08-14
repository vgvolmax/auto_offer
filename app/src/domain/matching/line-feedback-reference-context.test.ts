import { describe, expect, it } from "vitest";
import catalogFixture from "../../../../tests/fixtures/matching/golden/shared/catalog-main.json";
import { createCatalogRecord, type CatalogBundle } from "../catalog";
import { buildLineFeedbackReferenceContext } from "./line-feedback-reference-context";

describe("buildLineFeedbackReferenceContext", () => {
  it("materializes only the resolved semantic baseline offer as a feedback candidate", () => {
    const catalog = createCatalogRecord(structuredClone(catalogFixture) as CatalogBundle);
    const sourceItemId = catalog.bundle.items[0].catalog_item!.source_item_id;
    const context = buildLineFeedbackReferenceContext({
      runKind: "semantic",
      line: { decision: "offer", offer_ref: { catalog_record_id: catalog.recordId, source_item_id: sourceItemId } },
      catalogs: [catalog],
    });
    expect(context.candidates).toEqual([{ offer_ref: {
      catalog_record_id: catalog.recordId,
      catalog_id: catalog.catalogId,
      source_sha256: catalog.sourceSha256,
      source_item_id: sourceItemId,
    } }]);
    expect(context.excludedCandidates).toEqual([]);
  });

  it("does not invent candidates for semantic non-offer results or unresolved refs", () => {
    expect(buildLineFeedbackReferenceContext({ runKind: "semantic", line: { decision: "request_unsupported" }, catalogs: [] })).toEqual({ candidates: [], excludedCandidates: [] });
    expect(buildLineFeedbackReferenceContext({ runKind: "semantic", line: { decision: "offer", offer_ref: { catalog_record_id: "foreign", source_item_id: "foreign" } }, catalogs: [] })).toEqual({ candidates: [], excludedCandidates: [] });
  });

  it("preserves Pilot candidate and excluded-candidate lists", () => {
    const candidates = [{ offer_ref: { source_item_id: "candidate" } }];
    const excludedCandidates = [{ offer_ref: { source_item_id: "excluded" } }];
    expect(buildLineFeedbackReferenceContext({ runKind: "pilot", line: { candidates, excluded_candidates: excludedCandidates }, catalogs: [] })).toEqual({ candidates, excludedCandidates });
  });
});
