import { getReasonCodeLabel } from "../matching/match-result-labels";
import type { CandidateReviewView, MatchLineReviewView, MatchResultReviewView } from "../matching/match-result-review";
import { buildRequestLineDisplay } from "./request-line-display";

export type ProposalOfferKind = "selected_offer" | "recommended_offer" | "operator_no_offer" | "recommended_no_offer" | "reroute" | "request_review" | "request_invalid" | "request_unsupported" | "undecided";
export type ProposalStatusTone = "success" | "info" | "warning" | "danger" | "muted";

export interface ProposalRowView {
  lineId: string;
  position: number;
  source: MatchLineReviewView;
  request: { primary: string; secondary?: string; raw: string; quantity?: string };
  offer: {
    kind: ProposalOfferKind;
    productLabel?: string;
    brand?: string;
    catalogLabel?: string;
    matchLevel?: CandidateReviewView["matchLevel"];
    availability?: CandidateReviewView["availability"];
    rationale?: string;
    differences?: string[];
    reasonLabel?: string;
    recommendationSource?: "ai" | "local";
    candidate?: CandidateReviewView;
  };
  statusLabel: string;
  statusTone: ProposalStatusTone;
  hasDecision: boolean;
  operatorOverride?: boolean;
}

export interface ProposalTableView {
  rows: ProposalRowView[];
  summary: { total: number; withOffer: number; noOffer: number; attention: number; unconfirmed: number };
}

function productOffer(kind: "selected_offer" | "recommended_offer", candidate: CandidateReviewView, recommendationSource?: "ai" | "local") {
  return { kind, productLabel: candidate.productLabel, brand: candidate.brand, catalogLabel: candidate.catalogLabel, matchLevel: candidate.matchLevel, availability: candidate.availability, rationale: candidate.semanticRationaleRu, differences: candidate.semanticDifferencesRu, recommendationSource, candidate } as const;
}

function buildRow(line: MatchLineReviewView, runKind: "pilot" | "semantic"): ProposalRowView {
  const display = buildRequestLineDisplay({ rawText: line.requestText });
  const common = { lineId: line.lineId, position: line.position, source: line, request: { ...display, raw: line.requestText, quantity: line.quantityLabel }, hasDecision: line.hasDecision, operatorOverride: runKind === "semantic" && line.effectiveOutcome?.kind !== "unresolved" && line.effectiveOutcome?.source === "operator" };
  const legacySelected = line.selectedOfferRef ?? line.candidates.find((candidate) => candidate.selected)?.offerRef;
  const outcome = line.effectiveOutcome ?? (line.decisionKind === "selected_offer" && legacySelected
    ? { kind: "selected_offer" as const, offerRef: legacySelected, source: "operator" as const }
    : line.decisionKind === "no_offer" ? { kind: "no_offer" as const, source: "operator" as const } : undefined);
  const selected = outcome?.kind === "selected_offer"
    ? (line.effectiveOutcome ? line.candidates.find((candidate) => equalRefs(candidate.offerRef, outcome.offerRef)) : line.candidates.find((candidate) => candidate.selected))
    : undefined;
  if (outcome?.kind === "selected_offer" && selected)
    return { ...common, offer: productOffer(outcome.source === "ai" ? "recommended_offer" : "selected_offer", selected, outcome.source === "ai" ? "ai" : undefined), statusLabel: "Готово", statusTone: "success" };
  if (outcome?.kind === "no_offer" && outcome.source === "operator")
    return { ...common, offer: { kind: "operator_no_offer" }, statusLabel: "Готово", statusTone: "success" };
  const recommended = line.candidates.find((candidate) => candidate.suggested);
  if (recommended)
    return { ...common, offer: productOffer("recommended_offer", recommended, runKind === "semantic" ? "ai" : "local"), statusLabel: recommended.availability === "manual_only" ? "Требует проверки" : "Не подтверждено", statusTone: "warning" };
  if (runKind === "semantic" && line.semanticRecommendation === "no_offer")
    return { ...common, offer: { kind: "recommended_no_offer", recommendationSource: "ai", rationale: line.semanticRationaleRu, reasonLabel: line.semanticReasonCode ? getReasonCodeLabel(line.semanticReasonCode) : undefined }, statusLabel: "Готово", statusTone: "success" };
  if (line.semanticRecommendation === "reroute_required" || line.resolution === "reroute_required")
    return { ...common, offer: { kind: "reroute", rationale: line.semanticRationaleRu, reasonLabel: line.semanticReasonCode ? getReasonCodeLabel(line.semanticReasonCode) : undefined }, statusLabel: "Требуется уточнение", statusTone: "warning" };
  const problem = ({ request_review_required: ["request_review", "Требуется проверить заявку"], request_invalid: ["request_invalid", "Ошибка в строке заявки"], request_unsupported: ["request_unsupported", "Не поддерживается"] } as const)[line.resolution as "request_review_required" | "request_invalid" | "request_unsupported"];
  if (problem) return { ...common, offer: { kind: problem[0] }, statusLabel: line.resolution === "request_unsupported" ? "Готово" : "Требует внимания", statusTone: line.resolution === "request_unsupported" ? "success" : "danger" };
  return { ...common, offer: { kind: "undecided" }, statusLabel: "Не подтверждено", statusTone: "muted" };
}

function equalRefs(left: CandidateReviewView["offerRef"], right?: CandidateReviewView["offerRef"]): boolean {
  return Boolean(right) && left.catalog_record_id === right!.catalog_record_id && left.catalog_id === right!.catalog_id && left.source_sha256 === right!.source_sha256 && left.source_item_id === right!.source_item_id;
}

export function buildProposalTableView(input: { review: MatchResultReviewView; runKind: "pilot" | "semantic" }): ProposalTableView {
  const rows = input.review.lines.map((line) => buildRow(line, input.runKind));
  const rowWithOffer = rows.filter((row) => row.offer.kind === "selected_offer" || row.offer.kind === "recommended_offer").length;
  const rowNoOffer = rows.filter((row) => row.offer.kind === "operator_no_offer" || row.offer.kind === "recommended_no_offer").length;
  const rowAttention = rows.filter((row) => ["reroute", "request_review", "request_invalid", "request_unsupported"].includes(row.offer.kind) || row.offer.availability === "manual_only").length;
  return { rows, summary: {
    total: rows.length,
    withOffer: input.runKind === "semantic" ? (input.review.effectiveSelectedCount ?? rowWithOffer) : rowWithOffer,
    noOffer: input.runKind === "semantic" ? (input.review.effectiveNoOfferCount ?? rowNoOffer) : rowNoOffer,
    attention: input.runKind === "semantic" ? (input.review.effectiveUnresolvedCount ?? rowAttention) : rowAttention,
    unconfirmed: rows.filter((row) => !row.hasDecision).length,
  } };
}
