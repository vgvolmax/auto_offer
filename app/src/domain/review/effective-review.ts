import type { CatalogRecord } from "../catalog";
import { normalizeMatchRunRecord, type MatchRunRecord } from "../matching/match-run";
import { equalOfferRefs, type OfferRef } from "../matching/offer-ref";
import { resolveSemanticOffer } from "../matching/resolve-semantic-offer";
import type { SelectionStateRecord } from "../matching/selection-state";

export type EffectiveUnresolvedReason =
  | "undecided"
  | "reroute_required"
  | "request_review_required"
  | "request_invalid"
  | "manual_only"
  | "invalid_offer";

export type EffectiveLineOutcome =
  | { kind: "selected_offer"; offerRef: OfferRef; source: "ai" | "operator" }
  | { kind: "no_offer"; source: "ai" | "operator" | "unsupported" }
  | { kind: "unresolved"; reason: EffectiveUnresolvedReason };

export interface EffectiveReviewLine {
  lineId: string;
  outcome: EffectiveLineOutcome;
  hasOperatorOverride: boolean;
  semanticDecision?: string;
}

export interface EffectiveReview {
  lines: EffectiveReviewLine[];
  lineCount: number;
  readyCount: number;
  unresolvedCount: number;
  selectedOfferCount: number;
  noOfferCount: number;
  operatorOverrideCount: number;
}

type Raw = Record<string, unknown>;
const object = (value: unknown): value is Raw =>
  typeof value === "object" && value !== null && !Array.isArray(value);

function pilotOutcome(raw: unknown, decision: SelectionStateRecord["decisions"][string]): EffectiveLineOutcome {
  if (!decision) return { kind: "unresolved", reason: "undecided" };
  if (decision.kind === "no_offer") return { kind: "no_offer", source: "operator" };
  const candidates = object(raw) && Array.isArray(raw.candidates) ? raw.candidates : [];
  const belongs = candidates.some((candidate) => {
    if (!object(candidate) || !object(candidate.offer_ref)) return false;
    return equalOfferRefs(candidate.offer_ref as unknown as OfferRef, decision.offerRef);
  });
  return belongs
    ? { kind: "selected_offer", offerRef: decision.offerRef, source: "operator" }
    : { kind: "unresolved", reason: "invalid_offer" };
}

function semanticOutcome(
  raw: Raw,
  decision: SelectionStateRecord["decisions"][string],
  catalogs: readonly CatalogRecord[],
): EffectiveLineOutcome {
  const semanticDecision = String(raw.decision ?? "request_invalid");
  if (["reroute_required", "request_review_required", "request_invalid"].includes(semanticDecision))
    return { kind: "unresolved", reason: semanticDecision as Exclude<EffectiveUnresolvedReason, "undecided" | "manual_only" | "invalid_offer"> };
  if (semanticDecision === "request_unsupported")
    return decision?.kind === "no_offer"
      ? { kind: "no_offer", source: "operator" }
      : { kind: "no_offer", source: "unsupported" };
  const resolved = semanticDecision === "offer" && object(raw.offer_ref)
    ? resolveSemanticOffer(raw.offer_ref as { catalog_record_id: string; source_item_id: string }, catalogs)
    : undefined;
  if (decision) {
    if (decision.kind === "no_offer") return { kind: "no_offer", source: "operator" };
    if (resolved && equalOfferRefs(resolved.offerRef, decision.offerRef))
      return { kind: "selected_offer", offerRef: decision.offerRef, source: "operator" };
    return { kind: "unresolved", reason: "invalid_offer" };
  }
  if (semanticDecision === "no_offer") return { kind: "no_offer", source: "ai" };
  if (!resolved) return { kind: "unresolved", reason: "invalid_offer" };
  if (resolved.availability === "manual_only") return { kind: "unresolved", reason: "manual_only" };
  return { kind: "selected_offer", offerRef: resolved.offerRef, source: "ai" };
}

/** Derives review state without mutating or persisting any input. */
export function buildEffectiveReview(input: {
  run: MatchRunRecord;
  catalogs: readonly CatalogRecord[];
  selectionState: SelectionStateRecord;
}): EffectiveReview {
  const run = normalizeMatchRunRecord(input.run);
  const lines = (run.result.lines as unknown[]).map((raw, index): EffectiveReviewLine => {
    const lineId = object(raw) && typeof raw.line_id === "string" ? raw.line_id : `__invalid_${index}`;
    const operatorDecision = input.selectionState.decisions[lineId];
    return {
      lineId,
      outcome: run.runKind === "semantic"
        ? semanticOutcome(raw as Raw, operatorDecision, input.catalogs)
        : pilotOutcome(raw, operatorDecision),
      hasOperatorOverride: Boolean(operatorDecision),
      semanticDecision: run.runKind === "semantic" && object(raw) && typeof raw.decision === "string" ? raw.decision : undefined,
    };
  });
  const selectedOfferCount = lines.filter((line) => line.outcome.kind === "selected_offer").length;
  const noOfferCount = lines.filter((line) => line.outcome.kind === "no_offer").length;
  return {
    lines,
    lineCount: lines.length,
    readyCount: selectedOfferCount + noOfferCount,
    unresolvedCount: lines.length - selectedOfferCount - noOfferCount,
    selectedOfferCount,
    noOfferCount,
    operatorOverrideCount: lines.filter((line) => line.hasOperatorOverride).length,
  };
}
