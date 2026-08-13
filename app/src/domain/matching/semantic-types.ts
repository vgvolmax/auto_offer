export interface SemanticSelectionPolicy {
  max_match_level: "exact" | "equivalent" | "alternative";
  catalog_needs_review: "exclude" | "manual_only";
  brands: { include: string[]; exclude: string[]; preferred: string[]; unknown: "allow" | "exclude" };
  catalog_priority: string[];
}
export interface SemanticOfferRef { catalog_record_id: string; source_item_id: string }
export type SemanticMatchLine =
  | { line_id: string; decision: "offer"; offer_ref: SemanticOfferRef; match_level: "exact" | "equivalent" | "alternative"; rationale_ru: string; differences_ru: string[]; candidates?: never }
  | { line_id: string; decision: "no_offer" | "reroute_required"; reason_code: string; rationale_ru: string }
  | { line_id: string; decision: "request_review_required" | "request_invalid" | "request_unsupported" };
export interface SemanticMatchResult {
  /** Compatibility access only; semantic persistence never adds legacy fields. */
  input_fingerprint?: never; policy?: never; catalog_refs?: never; kind: "semantic_match_result"; schema_version: "1.0.0"; taxonomy_version: string; request_id: string; package_fingerprint: string; lines: SemanticMatchLine[] }
export interface SemanticMatchingCatalog {
  kind: "semantic_matching_catalog"; schema_version: "1.0.0"; taxonomy_version: string; request_id: string;
  selection_policy: SemanticSelectionPolicy; package_fingerprint: string;
  catalog_refs: Array<{catalog_record_id:string;catalog_id:string;source_sha256:string;semantic_revision:number}>;
  items: unknown[]; summary: {catalog_count:number;request_class_count:number;item_count:number};
}
