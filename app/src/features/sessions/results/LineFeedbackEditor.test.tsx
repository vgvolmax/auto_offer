import { useState } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { LineFeedback } from "../../../domain/matching/line-feedback";
import type { MatchLineReviewView } from "../../../domain/matching/match-result-review";
import { LineFeedbackEditor } from "./LineFeedbackEditor";

const line = (feedback?: LineFeedback): MatchLineReviewView => ({
  lineId: "line-1", position: 1, requestText: "Кран", resolution: "no_match",
  candidates: [], excludedCandidates: [], rejectionSummary: [], hasDecision: false,
  hasSelection: false, selectable: true, canSelectCandidate: false,
  canMarkNoOffer: true, feedback,
});

function Harness(p: { line: MatchLineReviewView; onSave: (feedback: LineFeedback) => Promise<boolean>; onClear?: () => Promise<boolean> }) {
  const [open, setOpen] = useState(false);
  return <LineFeedbackEditor line={p.line} disabled={false} open={open} onOpenChange={setOpen} onSave={p.onSave} onClear={p.onClear ?? vi.fn(async () => true)} />;
}

describe("LineFeedbackEditor", () => {
  it("keeps a save success through the confirming prop update and clears it on editing", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn(async () => true);
    const view = render(<Harness line={line()} onSave={onSave} />);
    await user.click(screen.getByRole("button", { name: /Обратная связь для/ }));
    await user.type(screen.getByRole("textbox"), "  полезный комментарий  ");
    await user.click(screen.getByRole("button", { name: "Сохранить обратную связь" }));
    expect(await screen.findByText("Обратная связь сохранена")).toBeVisible();
    view.rerender(<Harness line={line({ comment: "полезный комментарий" })} onSave={onSave} />);
    expect(screen.getByText("Обратная связь сохранена")).toBeVisible();
    await user.type(screen.getByRole("textbox"), " ещё");
    expect(screen.queryByText("Обратная связь сохранена")).not.toBeInTheDocument();
  });

  it("keeps the draft and does not show success when saving fails", async () => {
    const user = userEvent.setup();
    render(<Harness line={line()} onSave={vi.fn(async () => false)} />);
    await user.click(screen.getByRole("button", { name: /Обратная связь для/ }));
    await user.type(screen.getByRole("textbox"), "не сохранено");
    await user.click(screen.getByRole("button", { name: "Сохранить обратную связь" }));
    expect(screen.queryByText("Обратная связь сохранена")).not.toBeInTheDocument();
    expect(screen.getByRole("textbox")).toHaveValue("не сохранено");
  });

  it("keeps a delete success through the confirming prop update and clears it on editing", async () => {
    const user = userEvent.setup();
    const onClear = vi.fn(async () => true);
    const view = render(<Harness line={line({ comment: "старый" })} onSave={vi.fn(async () => true)} onClear={onClear} />);
    await user.click(screen.getByRole("button", { name: /Обратная связь для/ }));
    await user.click(screen.getByRole("button", { name: "Удалить обратную связь" }));
    expect(await screen.findByText("Обратная связь удалена")).toBeVisible();
    view.rerender(<Harness line={line()} onSave={vi.fn(async () => true)} onClear={onClear} />);
    expect(screen.getByText("Обратная связь удалена")).toBeVisible();
    await user.type(screen.getByRole("textbox"), "новый");
    expect(screen.queryByText("Обратная связь удалена")).not.toBeInTheDocument();
  });

  it("replaces the draft and clears success on a different external feedback update", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn(async () => true);
    const view = render(<Harness line={line()} onSave={onSave} />);
    await user.click(screen.getByRole("button", { name: /Обратная связь для/ }));
    await user.type(screen.getByRole("textbox"), "локальный");
    await user.click(screen.getByRole("button", { name: "Сохранить обратную связь" }));
    expect(await screen.findByText("Обратная связь сохранена")).toBeVisible();
    view.rerender(<Harness line={line({ comment: "внешний" })} onSave={onSave} />);
    expect(screen.getByRole("textbox")).toHaveValue("внешний");
    expect(screen.queryByText("Обратная связь сохранена")).not.toBeInTheDocument();
  });
});
