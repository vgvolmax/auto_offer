import type { CatalogRecord } from "../catalog";
import { resolveSemanticOffer } from "./resolve-semantic-offer";

type Obj = Record<string, unknown>;

export interface LineFeedbackReferenceContext {
  candidates: readonly unknown[];
  excludedCandidates: readonly unknown[];
}

/** Builds the authoritative set of offers that feedback may reference for one result line. */
export function buildLineFeedbackReferenceContext(input: {
  runKind: "pilot" | "semantic";
  line: Obj;
  catalogs: readonly CatalogRecord[];
}): LineFeedbackReferenceContext {
  if (input.runKind === "pilot") {
    return {
      candidates: Array.isArray(input.line.candidates) ? input.line.candidates : [],
      excludedCandidates: Array.isArray(input.line.excluded_candidates) ? input.line.excluded_candidates : [],
    };
  }

  if (input.line.decision !== "offer") return { candidates: [], excludedCandidates: [] };
  const ref = input.line.offer_ref;
  if (!ref || typeof ref !== "object" || Array.isArray(ref)) return { candidates: [], excludedCandidates: [] };
  const catalogRecordId = (ref as Obj).catalog_record_id;
  const sourceItemId = (ref as Obj).source_item_id;
  if (typeof catalogRecordId !== "string" || typeof sourceItemId !== "string") return { candidates: [], excludedCandidates: [] };
  const resolved = resolveSemanticOffer({ catalog_record_id: catalogRecordId, source_item_id: sourceItemId }, input.catalogs);
  return {
    candidates: resolved ? [{ offer_ref: resolved.offerRef }] : [],
    excludedCandidates: [],
  };
}
