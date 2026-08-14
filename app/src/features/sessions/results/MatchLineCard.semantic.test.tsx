import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { MatchLineReviewView } from "../../../domain/matching/match-result-review";
import { MatchLineCard } from "./MatchLineCard";
import { MemoryRouter } from "react-router-dom";

const renderLine = (overrides: Partial<MatchLineReviewView>) => {
  const line: MatchLineReviewView = {
    lineId: "line", position: 1, requestText: "Товар", resolution: "no_match", candidates: [], excludedCandidates: [], rejectionSummary: [],
    hasDecision: false, hasSelection: false, selectable: false, canSelectCandidate: false, canMarkNoOffer: true, ...overrides,
  };
  render(<MemoryRouter><MatchLineCard line={line} expanded feedbackOpen={false} disabled={false} saving={false} onToggle={vi.fn()} onSelect={vi.fn()} onClear={vi.fn()} onNoOffer={vi.fn()} onFeedbackOpenChange={vi.fn()} onSaveFeedback={vi.fn()} onClearFeedback={vi.fn()} /></MemoryRouter>);
};

describe("MatchLineCard semantic review", () => {
  it("renders an offer rationale and differences separately from matcher checks", () => {
    renderLine({ candidates: [{ key: "offer", offerRef: { catalog_record_id: "r", catalog_id: "c", source_sha256: "s", source_item_id: "i" }, catalogLabel: "catalog", sourceItemId: "i", productLabel: "Товар", matchLevel: "exact", availability: "eligible", checks: [], differences: [], selected: false, suggested: true, selectable: true, resultPosition: 1, semanticRationaleRu: "Подходит по назначению", semanticDifferencesRu: ["Другой цвет"] }] });
    expect(screen.getByText("Почему предложено")).toBeInTheDocument();
    expect(screen.getByText("Подходит по назначению")).toBeInTheDocument();
    expect(screen.getByText("Другой цвет")).toBeInTheDocument();
  });

  it("keeps a semantic needs-review recommendation selectable and links to catalog review", () => {
    renderLine({ candidates: [{ key: "offer", offerRef: { catalog_record_id: "record-1", catalog_id: "catalog", source_sha256: "s", source_item_id: "i" }, catalogLabel: "catalog", sourceItemId: "i", productLabel: "Товар", matchLevel: "exact", availability: "eligible", checks: [], differences: [], selected: false, suggested: true, selectable: true, resultPosition: 1, annotationStatus: "needs_review", reviewReasonCount: 2 }] });
    expect(screen.getByText(/Разметка неполная: 2 поля требуют проверки/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Проверить разметку" })).toHaveAttribute("href", "/catalogs/record-1/review");
    expect(screen.getByRole("button", { name: "Выбрать" })).toBeEnabled();
    expect(screen.queryByRole("button", { name: "Подтвердить товар" })).not.toBeInTheDocument();
  });

  it("does not warn for a validated semantic candidate", () => {
    renderLine({ candidates: [{ key: "offer", offerRef: { catalog_record_id: "record-1", catalog_id: "catalog", source_sha256: "s", source_item_id: "i" }, catalogLabel: "catalog", sourceItemId: "i", productLabel: "Товар", matchLevel: "exact", availability: "eligible", checks: [], differences: [], selected: false, suggested: true, selectable: true, resultPosition: 1, annotationStatus: "validated" }] });
    expect(screen.queryByRole("link", { name: "Проверить разметку" })).not.toBeInTheDocument();
  });

  it("renders no-offer semantics and makes reroute blocking", () => {
    renderLine({ semanticRecommendation: "no_offer", semanticReasonCode: "NO_TECHNICAL_MATCH", semanticRationaleRu: "Нет нужного размера" });
    expect(screen.getByText(/рекомендует: без предложения/)).toBeInTheDocument();
    expect(screen.getByText(/Нет технически подходящего товара/)).toBeInTheDocument();
    expect(screen.getByText("Нет нужного размера")).toBeInTheDocument();
  });

  it("does not offer a no-offer action for rerouting", () => {
    renderLine({ resolution: "reroute_required", semanticRecommendation: "reroute_required", semanticReasonCode: "ROUTING_INSUFFICIENT", semanticRationaleRu: "Нужен другой срез", canMarkNoOffer: false });
    expect(screen.getByText("Требуется повторная маршрутизация заявки")).toBeInTheDocument();
    expect(screen.getByText(/Требуется уточнить класс товара/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Без предложения" })).not.toBeInTheDocument();
  });
});
