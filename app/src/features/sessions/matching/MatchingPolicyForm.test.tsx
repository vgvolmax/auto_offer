import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { createDefaultSessionMatchingSettings } from "../../../domain/matching/session-policy";
import { MatchingPolicyForm } from "./MatchingPolicyForm";

describe("MatchingPolicyForm", () => {
  it("does not expose the legacy needs-review eligibility setting", () => {
    render(<MatchingPolicyForm settings={createDefaultSessionMatchingSettings([])} catalogs={[]} state="ready-clean" issues={[]} onChange={vi.fn()} onSave={vi.fn()} locked={false} externalBusy={false} />);
    expect(screen.queryByText("Товары, которые требуют проверки")).not.toBeInTheDocument();
    expect(screen.queryByText(/Не использовать товары/)).not.toBeInTheDocument();
    expect(screen.queryByText(/обязательной ручной проверкой/)).not.toBeInTheDocument();
  });
});
