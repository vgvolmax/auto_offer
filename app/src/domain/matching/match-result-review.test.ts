import { describe, expect, it } from "vitest";
import { getReasonCodeLabel } from "./match-result-labels";
import { buildMatchResultReviewView } from "./match-result-review";

describe("match result review", () => {
  it("preserves semantic decisions and resolves offers from the local catalog", () => {
    const catalog: any = {
      recordId: "record-1", catalogId: "local-catalog", sourceSha256: "local-sha", sourceFileName: "catalog.xlsx",
      bundle: { items: [
        { source: { raw_name: "Проверенный товар" }, catalog_item: { source_item_id: "valid", annotation: { status: "validated" } } },
        { source: { raw_name: "Ручной товар" }, catalog_item: { source_item_id: "manual", annotation: { status: "needs_review" } } },
      ] },
    };
    const decisions = ["exact", "equivalent", "alternative"].map((match_level, index) => ({
      line_id: `offer-${index}`, decision: "offer", offer_ref: { catalog_record_id: "record-1", source_item_id: index === 2 ? "manual" : "valid" },
      match_level, rationale_ru: `Обоснование ${index}`, differences_ru: ["Отличие"],
    }));
    const diagnostic = ["no_offer", "reroute_required", "request_review_required", "request_invalid", "request_unsupported"].map((decision) => ({
      line_id: decision, decision, reason_code: decision === "reroute_required" ? "ROUTING_INSUFFICIENT" : "NO_ELIGIBLE_OFFER", rationale_ru: "Диагностика",
    }));
    const all = [...decisions, ...diagnostic];
    const run: any = { id: "run", sessionId: "session", sessionRevision: 0, createdAt: "now", runKind: "semantic", result: { package_fingerprint: "fp", lines: all } };
    const session: any = { requestBundle: { request_document: { lines: all.map((line) => ({ line_id: line.line_id, raw_text: line.line_id })) } } };
    const selectionState: any = { matchRunId: "run", sessionId: "session", inputFingerprint: "fp", decisions: {}, feedback: {} };

    const view = buildMatchResultReviewView({ session, catalogs: [catalog], run, selectionState, current: true });
    expect(view.lines.map((line) => line.resolution)).toEqual([
      "single_exact", "equivalent_only", "alternative_only", "no_match", "reroute_required", "request_review_required", "request_invalid", "request_unsupported",
    ]);
    expect(view.lines[0].candidates[0]).toMatchObject({
      offerRef: { catalog_id: "local-catalog", source_sha256: "local-sha" }, availability: "eligible",
      semanticRationaleRu: "Обоснование 0", semanticDifferencesRu: ["Отличие"], checks: [], differences: [],
    });
    expect(view.lines[2].candidates[0]).toMatchObject({ availability: "eligible", annotationStatus: "needs_review" });
    expect(view.lines.slice(0, 3).map((line) => line.candidates[0].suggested)).toEqual([
      true,
      true,
      true,
    ]);
    expect(view.lines[3]).toMatchObject({ semanticRecommendation: "no_offer", semanticReasonCode: "NO_ELIGIBLE_OFFER", semanticRationaleRu: "Диагностика" });
    expect(view.lines[4]).toMatchObject({ candidates: [], canSelectCandidate: false, canMarkNoOffer: false, hasDecision: false });
    expect(view.undecidedCount).toBe(all.length);
  });
  it(
    "builds a safe review model from source metadata and full offer references",
    () => {
      const ref = { catalog_record_id: "record-1", catalog_id: "catalog-1", source_sha256: "sha", source_item_id: "SKU-001" };
      const missing = { ...ref, source_item_id: "SKU-missing" };
      const session: any = { requestBundle: { request_document: { lines: [{ line_id: "line-1", raw_text: "Кран", class_id: "valve.ball", quantity: { value: 1, unit: "piece" } }] } } };
      const catalog: any = { recordId: "record-1", catalogId: "catalog-1", sourceSha256: "sha", sourceFileName: "catalog.xlsx", bundle: { items: [{ source: { raw_name: "Кран шаровой латунный 1/2" }, catalog_item: { source_item_id: "SKU-001", class_id: "valve.ball", identity: { brand: "Volmax" } } }] } };
      const result: any = { input_fingerprint: "fingerprint", lines: [{ line_id: "line-1", resolution: "single_exact", candidates: [
        { offer_ref: ref, match_level: "exact", availability: "eligible", checks: [{ scope: "class", target: "class_id", outcome: "pass", effect: "include", code: "CLASS_MATCH" }], differences: [] },
        { offer_ref: missing, match_level: "alternative", availability: "eligible", checks: [], differences: [] },
      ], excluded_candidates: [{ offer_ref: ref, match_level: "exact", availability: "eligible", checks: [], differences: [], exclusion_codes: ["BRAND_EXCLUDED"] }], rejection_summary: [] }] };
      const run: any = { id: "run-1", sessionId: "session-1", sessionRevision: 0, createdAt: "2026-01-01", result };
      const state: any = { schemaVersion: "1.0.0", matchRunId: run.id, sessionId: run.sessionId, inputFingerprint: result.input_fingerprint, revision: 1, decisions: { "line-1": { kind: "selected_offer", offerRef: ref, confirmedAt: "2026-01-01" } }, createdAt: "2026-01-01", updatedAt: "2026-01-01" };
      const snapshots = [session, catalog, run, state].map((value) => structuredClone(value));

      const view = buildMatchResultReviewView({ session, catalogs: [catalog], run, selectionState: state, current: true });
      const [selected, absent] = view.lines[0].candidates;
      expect(selected).toMatchObject({ productLabel: "Кран шаровой латунный 1/2", brand: "Volmax", offerRef: ref, selected: true, suggested: true });
      expect(view.lines[0].candidates.map((x) => x.sourceItemId)).toEqual(["SKU-001", "SKU-missing"]);
      expect(absent).toMatchObject({ productLabel: "Товар не найден в сохранённой версии каталога", selected: false, suggested: false, selectable: false });
      expect(view.diagnostics).toContainEqual(expect.objectContaining({ code: "CATALOG_ITEM_REFERENCE_MISSING" }));
      expect(view.lines[0].excludedCandidates[0].selectable).toBe(false);
      expect([session, catalog, run, state]).toEqual(snapshots);

      const reasonCodes = ["CLASS_MATCH", "CLASS_MISMATCH", "IDENTITY_MATCH", "IDENTITY_DIFFERENCE", "IDENTITY_EXCLUDED", "ATTRIBUTE_MATCH", "ATTRIBUTE_DIFFERENCE", "ATTRIBUTE_CONSTRAINT_FAILED", "PORT_MATCH", "PORT_ROLE_MISSING", "PORT_CONSTRAINT_FAILED", "CATALOG_VALUE_MISSING", "CATALOG_ITEM_INVALID", "CATALOG_ITEM_NEEDS_REVIEW", "REQUEST_REVIEW_REQUIRED", "BRAND_NOT_INCLUDED", "BRAND_EXCLUDED", "BRAND_UNKNOWN_EXCLUDED", "CATALOG_NOT_SELECTED", "MATCH_LEVEL_NOT_ALLOWED", "EQUIVALENT_RULE_APPLIED", "ALTERNATIVE_RULE_APPLIED"];
      for (const code of reasonCodes) expect(getReasonCodeLabel(code)).not.toBe(`Неизвестная причина: ${code}`);
      expect(getReasonCodeLabel("FUTURE_REASON")).toBe("Неизвестная причина: FUTURE_REASON");
    },
  );
});
