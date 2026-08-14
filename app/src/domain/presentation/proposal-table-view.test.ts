import { describe, expect, it } from "vitest";
import type { CandidateReviewView, MatchLineReviewView, MatchResultReviewView } from "../matching/match-result-review";
import { buildProposalTableView } from "./proposal-table-view";

const candidate = (overrides: Partial<CandidateReviewView> = {}): CandidateReviewView => ({ key: "offer", offerRef: { catalog_record_id: "record", catalog_id: "catalog", source_sha256: "sha", source_item_id: "item" }, catalogLabel: "Каталог", sourceItemId: "item", productLabel: "Товар A", matchLevel: "exact", availability: "eligible", checks: [], differences: [], selected: false, suggested: true, selectable: true, resultPosition: 1, ...overrides });
const line = (overrides: Partial<MatchLineReviewView> = {}): MatchLineReviewView => ({ lineId: "line-1", position: 1, requestText: "Запрос", resolution: "no_match", candidates: [], excludedCandidates: [], rejectionSummary: [], hasDecision: false, hasSelection: false, selectable: true, canSelectCandidate: true, canMarkNoOffer: true, ...overrides });
const view = (lines: MatchLineReviewView[]): MatchResultReviewView => ({ runId: "run", current: true, lines, selectedCount: 0, selectableLineCount: 0, unresolvedSelectableCount: 0, lineCount: lines.length, decidedCount: 0, undecidedCount: lines.length, noOfferCount: 0, feedbackCount: 0, diagnostics: [] });

describe("buildProposalTableView", () => {
  it.each([
    ["recommended_no_offer", line({ semanticRecommendation: "no_offer" })],
    ["reroute", line({ resolution: "reroute_required", semanticRecommendation: "reroute_required" })],
    ["request_review", line({ resolution: "request_review_required" })],
    ["request_invalid", line({ resolution: "request_invalid" })],
    ["request_unsupported", line({ resolution: "request_unsupported" })],
    ["undecided", line()],
  ] as const)("maps %s independently", (kind, input) => expect(buildProposalTableView({ review: view([input]), runKind: "semantic" }).rows[0].offer.kind).toBe(kind));

  it("shows a recommendation without creating a decision", () => {
    const source = line({ candidates: [candidate()] });
    const result = buildProposalTableView({ review: view([source]), runKind: "semantic" }).rows[0];
    expect(result.offer.kind).toBe("recommended_offer");
    expect(result.offer.recommendationSource).toBe("ai");
    expect(result.offer.productLabel).toBe("Товар A");
    expect(result.statusLabel).toBe("Не подтверждено");
    expect(result.hasDecision).toBe(false);
    expect(source.hasDecision).toBe(false);
  });

  it("labels a suggested Pilot candidate as a local recommendation", () => {
    const result = buildProposalTableView({ review: view([line({ candidates: [candidate()] })]), runKind: "pilot" }).rows[0];
    expect(result.offer.kind).toBe("recommended_offer");
    expect(result.offer.recommendationSource).toBe("local");
  });

  it("does not promote the first Pilot candidate when none is suggested", () => {
    const candidates = [candidate({ productLabel: "A", suggested: false }), candidate({ key: "b", productLabel: "B", suggested: false })];
    const result = buildProposalTableView({ review: view([line({ candidates })]), runKind: "pilot" });
    expect(result.rows[0].offer.kind).toBe("undecided");
    expect(result.rows[0].offer.productLabel).toBeUndefined();
    expect(result.rows[0].statusLabel).toBe("Не подтверждено");
    expect(result.summary.withOffer).toBe(0);
    expect(result.rows[0].source.candidates).toEqual(candidates);
  });

  it("gives an operator-selected offer precedence over the recommendation", () => {
    const recommended = candidate({ key: "a", productLabel: "A", suggested: true });
    const selected = candidate({ key: "b", productLabel: "B", suggested: false, selected: true });
    const result = buildProposalTableView({ review: view([line({ candidates: [recommended, selected], decisionKind: "selected_offer", hasDecision: true })]), runKind: "semantic" }).rows[0];
    expect(result.offer.kind).toBe("selected_offer");
    expect(result.offer.productLabel).toBe("B");
  });

  it("gives operator no-offer precedence over a recommendation", () => {
    const result = buildProposalTableView({ review: view([line({ candidates: [candidate()], decisionKind: "no_offer", hasDecision: true })]), runKind: "semantic" }).rows[0];
    expect(result.offer.kind).toBe("operator_no_offer");
    expect(result.statusLabel).toBe("Без предложения");
  });

  it("marks manual-only recommendations for attention", () => {
    const result = buildProposalTableView({ review: view([line({ candidates: [candidate({ availability: "manual_only" })] })]), runKind: "semantic" });
    expect(result.rows[0].statusTone).toBe("warning");
    expect(result.summary.attention).toBe(1);
  });
});
