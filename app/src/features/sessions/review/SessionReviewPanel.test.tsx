import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { SessionReviewPanel } from "./SessionReviewPanel";

const session: any = { status: "draft", sessionId: "s", name: "Сессия", requestFileName: "request.xlsx" };
const run: any = { id: "r", createdAt: "2026-07-31T09:00:00.000Z" };
const summary = { lineCount: 2, decidedCount: 1, selectedCount: 1, noOfferCount: 0, feedbackCount: 0, undecidedCount: 1 };
describe("SessionReviewPanel", () => {
  it("explains an incomplete review and disables confirmation", () => {
    render(<SessionReviewPanel session={session} run={run} current summary={summary} selectionStateRevision={1} onConfirm={vi.fn()} onReopen={vi.fn()} />);
    expect(screen.getByText("Для подтверждения примите решение ещё по 1 строкам.")).toBeVisible();
    expect(screen.getByRole("button", { name: "Проверить и подтвердить" })).toBeDisabled();
  });
  it("uses inline confirmation and supports cancellation", async () => {
    const user = userEvent.setup();
    render(<SessionReviewPanel session={session} run={run} current summary={{ ...summary, decidedCount: 2, noOfferCount: 1, undecidedCount: 0 }} selectionStateRevision={2} onConfirm={vi.fn()} onReopen={vi.fn()} />);
    await user.click(screen.getByRole("button", { name: "Проверить и подтвердить" }));
    expect(screen.getByText(/После подтверждения настройки/)).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Отмена" }));
    expect(screen.queryByRole("button", { name: "Подтвердить результат" })).not.toBeInTheDocument();
  });
  it("keeps confirmation open after failure and closes it after success", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn().mockResolvedValueOnce(false).mockResolvedValueOnce(true);
    render(<SessionReviewPanel session={session} run={run} current summary={{ ...summary, decidedCount: 2, noOfferCount: 1, undecidedCount: 0 }} selectionStateRevision={2} onConfirm={onConfirm} onReopen={vi.fn()} />);
    await user.click(screen.getByRole("button", { name: "Проверить и подтвердить" }));
    await user.click(screen.getByRole("button", { name: "Подтвердить результат" }));
    expect(screen.getByRole("button", { name: "Подтвердить результат" })).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Подтвердить результат" }));
    expect(screen.queryByRole("button", { name: "Подтвердить результат" })).not.toBeInTheDocument();
  });
  it("blocks confirmation while refreshing", async () => {
    const onConfirm = vi.fn();
    const user = userEvent.setup();
    render(<SessionReviewPanel session={session} run={run} current summary={{ ...summary, decidedCount: 2, noOfferCount: 1, undecidedCount: 0 }} selectionStateRevision={2} busy="refreshing" onConfirm={onConfirm} onReopen={vi.fn()} />);
    expect(screen.getByRole("status")).toHaveTextContent("Обновляем данные…");
    const button = screen.getByRole("button", { name: "Проверить и подтвердить" });
    expect(button).toBeDisabled();
    await user.click(button);
    expect(onConfirm).not.toHaveBeenCalled();
  });
  it("opens, cancels, and blocks reopen warning while refreshing", async () => {
    const user = userEvent.setup();
    const confirmed: any = { ...session, status: "confirmed", confirmation: { confirmedAt: "2026-07-31T09:00:00.000Z", lineCount: 2, selectedOfferCount: 1, noOfferCount: 1, feedbackCount: 0 } };
    const onReopen = vi.fn();
    const view = render(<SessionReviewPanel session={confirmed} run={run} current summary={summary} selectionStateRevision={2} onConfirm={vi.fn()} onReopen={onReopen} />);
    await user.click(screen.getByRole("button", { name: "Вернуть к редактированию" }));
    expect(screen.getByText(/решения и обратная связь сохранятся/)).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Отмена" }));
    view.rerender(<SessionReviewPanel session={confirmed} run={run} current summary={summary} selectionStateRevision={2} busy="refreshing" onConfirm={vi.fn()} onReopen={onReopen} />);
    expect(screen.getByRole("button", { name: "Вернуть к редактированию" })).toBeDisabled();
    expect(screen.getByRole("status")).toHaveTextContent("Обновляем данные…");
    expect(onReopen).not.toHaveBeenCalled();
  });
});
