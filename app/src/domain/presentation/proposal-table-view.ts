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
    candidate?: CandidateReviewView;
  };
  statusLabel: string;
  statusTone: ProposalStatusTone;
  hasDecision: boolean;
}

export interface ProposalTableView {
  rows: ProposalRowView[];
  summary: { total: number; withOffer: number; noOffer: number; attention: number; unconfirmed: number };
}

function productOffer(kind: "selected_offer" | "recommended_offer", candidate: CandidateReviewView) {
  return { kind, productLabel: candidate.productLabel, brand: candidate.brand, catalogLabel: candidate.catalogLabel, matchLevel: candidate.matchLevel, availability: candidate.availability, rationale: candidate.semanticRationaleRu, differences: candidate.semanticDifferencesRu, candidate } as const;
}

function buildRow(line: MatchLineReviewView): ProposalRowView {
  const display = buildRequestLineDisplay({ rawText: line.requestText });
  const common = { lineId: line.lineId, position: line.position, source: line, request: { ...display, raw: line.requestText, quantity: line.quantityLabel }, hasDecision: line.hasDecision };
  const selected = line.candidates.find((candidate) => candidate.selected);
  if (line.decisionKind === "selected_offer" && selected)
    return { ...common, offer: productOffer("selected_offer", selected), statusLabel: "Выбрано", statusTone: "success" };
  if (line.decisionKind === "no_offer")
    return { ...common, offer: { kind: "operator_no_offer" }, statusLabel: "Без предложения", statusTone: "success" };
  const recommended = line.candidates.find((candidate) => candidate.suggested) ?? line.candidates[0];
  if (recommended)
    return { ...common, offer: productOffer("recommended_offer", recommended), statusLabel: "Не подтверждено", statusTone: recommended.availability === "manual_only" ? "warning" : "info" };
  if (line.semanticRecommendation === "no_offer")
    return { ...common, offer: { kind: "recommended_no_offer", rationale: line.semanticRationaleRu, reasonLabel: line.semanticReasonCode ? getReasonCodeLabel(line.semanticReasonCode) : undefined }, statusLabel: "Рекомендация ИИ", statusTone: "info" };
  if (line.semanticRecommendation === "reroute_required" || line.resolution === "reroute_required")
    return { ...common, offer: { kind: "reroute", rationale: line.semanticRationaleRu, reasonLabel: line.semanticReasonCode ? getReasonCodeLabel(line.semanticReasonCode) : undefined }, statusLabel: "Требуется уточнение", statusTone: "warning" };
  const problem = ({ request_review_required: ["request_review", "Требуется проверить заявку"], request_invalid: ["request_invalid", "Ошибка в строке заявки"], request_unsupported: ["request_unsupported", "Не поддерживается"] } as const)[line.resolution as "request_review_required" | "request_invalid" | "request_unsupported"];
  if (problem) return { ...common, offer: { kind: problem[0] }, statusLabel: "Требует внимания", statusTone: "danger" };
  return { ...common, offer: { kind: "undecided" }, statusLabel: "Не подтверждено", statusTone: "muted" };
}

export function buildProposalTableView(view: MatchResultReviewView): ProposalTableView {
  const rows = view.lines.map(buildRow);
  return { rows, summary: {
    total: rows.length,
    withOffer: rows.filter((row) => row.offer.kind === "selected_offer" || row.offer.kind === "recommended_offer").length,
    noOffer: rows.filter((row) => row.offer.kind === "operator_no_offer" || row.offer.kind === "recommended_no_offer").length,
    attention: rows.filter((row) => ["reroute", "request_review", "request_invalid", "request_unsupported"].includes(row.offer.kind) || row.offer.availability === "manual_only").length,
    unconfirmed: rows.filter((row) => !row.hasDecision).length,
  } };
}
