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
});
