import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { NoOfferDecisionCard } from "./NoOfferDecisionCard";

describe("NoOfferDecisionCard", () => {
  it("uses legacy Pilot copy by default and preserves the clear callback", () => {
    const onClear = vi.fn();
    render(<NoOfferDecisionCard lineId="line" selected disabled={false} onSelect={() => undefined} onClear={onClear} />);
    fireEvent.click(screen.getByRole("button", { name: "Снять решение" }));
    expect(screen.queryByText("Вернуть результат ИИ")).not.toBeInTheDocument();
    expect(onClear).toHaveBeenCalledOnce();
  });

  it("shows the semantic baseline copy when supplied by its source-aware parent", () => {
    render(<NoOfferDecisionCard lineId="line" selected disabled={false} clearLabel="Вернуть результат ИИ" onSelect={() => undefined} onClear={() => undefined} />);
    expect(screen.getByRole("button", { name: "Вернуть результат ИИ" })).toBeInTheDocument();
  });
});
