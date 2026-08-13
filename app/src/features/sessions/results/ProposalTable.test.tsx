import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { ProposalRowView } from "../../../domain/presentation/proposal-table-view";
import { ProposalTable } from "./ProposalTable";

const row = { lineId: "line-1", position: 1, request: { primary: "Кран DN25", raw: "Кран DN25 | полные параметры", quantity: "2 шт" }, offer: { kind: "recommended_offer", productLabel: "Кран наш", catalogLabel: "Каталог", matchLevel: "exact", availability: "eligible", rationale: "Подходит", differences: ["Цвет"], candidate: { key: "offer", offerRef: { catalog_record_id: "r", catalog_id: "c", source_sha256: "s", source_item_id: "i" }, catalogLabel: "Каталог", sourceItemId: "i", productLabel: "Кран наш", matchLevel: "exact", availability: "eligible", checks: [], differences: [], selected: false, suggested: true, selectable: true, resultPosition: 1, semanticRationaleRu: "Подходит", semanticDifferencesRu: ["Цвет"] } }, statusLabel: "Не подтверждено", statusTone: "info", hasDecision: false, source: { lineId: "line-1", position: 1, requestText: "Кран DN25 | полные параметры", quantityLabel: "2 шт", resolution: "single_exact", candidates: [], excludedCandidates: [], rejectionSummary: [], hasDecision: false, hasSelection: false, selectable: true, canSelectCandidate: true, canMarkNoOffer: true } } as ProposalRowView;

function renderTable(expanded = new Set<string>()) { return render(<ProposalTable rows={[row]} expanded={expanded} feedbackExpanded={new Set()} disabled={false} onToggle={vi.fn()} onSelect={vi.fn()} onClear={vi.fn()} onNoOffer={vi.fn()} onFeedbackOpenChange={vi.fn()} onSaveFeedback={vi.fn()} onClearFeedback={vi.fn()} />); }

describe("ProposalTable", () => {
  it("renders semantic headers and exactly one business row", () => {
    const { container } = renderTable();
    for (const label of ["№", "Запрос клиента", "Количество", "Наш товар", "Статус"]) expect(screen.getByRole("columnheader", { name: label })).toBeInTheDocument();
    expect(container.querySelectorAll("tr[data-proposal-row]")).toHaveLength(1);
    expect(screen.getByText("Кран наш")).toBeInTheDocument();
    expect(screen.getByText("Рекомендация ИИ")).toBeInTheDocument();
    expect(screen.getByText("Не подтверждено")).toBeInTheDocument();
    expect(screen.queryByText("Подходит")).not.toBeInTheDocument();
  });

  it("exposes details only when expanded", () => {
    renderTable(new Set(["line-1"]));
    const button = screen.getByRole("button", { name: /line-1/ });
    expect(button).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText("Исходный запрос")).toBeInTheDocument();
    expect(screen.getAllByText("Подходит").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Цвет").length).toBeGreaterThan(0);
  });
});
