import type { FeedbackOutcome } from "./line-feedback";
import { equalOfferRefs, type OfferRef } from "./offer-ref";

type ObjectValue = Record<string, unknown>;
const isObject = (value: unknown): value is ObjectValue =>
  typeof value === "object" && value !== null && !Array.isArray(value);

function readOfferRef(value: unknown): OfferRef | undefined {
  if (!isObject(value)) return undefined;
  const candidate = isObject(value.offer_ref) ? value.offer_ref : value;
  const fields = [
    candidate.catalog_record_id,
    candidate.catalog_id,
    candidate.source_sha256,
    candidate.source_item_id,
  ];
  return fields.every((field) => typeof field === "string")
    ? (candidate as unknown as OfferRef)
    : undefined;
}

export function getAllowedRelatedOfferSource(input: {
  outcome?: FeedbackOutcome;
  relatedOfferRef?: OfferRef;
  candidates: readonly unknown[];
  excludedCandidates: readonly unknown[];
}): "candidate" | "excluded" | undefined {
  if (!input.relatedOfferRef) return undefined;
  const contains = (values: readonly unknown[]) =>
    values.some((value) => {
      const offerRef = readOfferRef(value);
      return Boolean(offerRef && equalOfferRefs(offerRef, input.relatedOfferRef!));
    });
  const candidate = contains(input.candidates);
  const excluded = contains(input.excludedCandidates);
  if (input.outcome === "correct_candidate_ranked_low")
    return candidate ? "candidate" : undefined;
  if (input.outcome === "correct_candidate_excluded")
    return excluded ? "excluded" : undefined;
  if (
    input.outcome === "suggested_candidate_incorrect" ||
    input.outcome === "other_outcome"
  )
    return candidate ? "candidate" : excluded ? "excluded" : undefined;
  return undefined;
}
