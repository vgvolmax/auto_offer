import { describe, expect, it } from "vitest";
import { getReasonCodeLabel } from "./match-result-labels";
import { buildMatchResultReviewView } from "./match-result-review";

describe("match result review", () => {
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
