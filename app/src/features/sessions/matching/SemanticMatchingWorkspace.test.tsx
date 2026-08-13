import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SemanticMatchingWorkspace } from "./SemanticMatchingWorkspace";
import {
  importSemanticMatchResult,
  prepareSemanticMatchingPackage,
  SemanticImportError,
} from "../../../domain/matching/semantic-session-matching";
import { downloadTextFile } from "../../../lib/download-file";

vi.mock("../../../domain/matching/semantic-session-matching", async (original) => {
  const actual = await original<typeof import("../../../domain/matching/semantic-session-matching")>();
  return { ...actual, prepareSemanticMatchingPackage: vi.fn(), importSemanticMatchResult: vi.fn() };
});
vi.mock("../../../lib/download-file", () => ({ downloadTextFile: vi.fn() }));

const settings = {} as never;
const result = { request_id: "request", package_fingerprint: "fp", lines: [] };

describe("SemanticMatchingWorkspace", () => {
  beforeEach(() => vi.clearAllMocks());

  it("downloads exactly the prompt, request, and semantic catalog", async () => {
    const requestBundle = { request_id: "request" };
    const matchingCatalog = { package_fingerprint: "fp" };
    vi.mocked(prepareSemanticMatchingPackage).mockResolvedValue({
      session: { requestBundle }, matchingCatalog,
    } as never);
    render(<SemanticMatchingWorkspace sessionId="session" settings={settings} disabled={false} />);
    expect(screen.getByRole("heading", { name: "Шаг 3 — Подбор наших товаров" })).toBeVisible();
    await userEvent.click(screen.getByRole("button", { name: "Подготовить подбор для ИИ" }));
    await waitFor(() => expect(downloadTextFile).toHaveBeenCalledTimes(3));
    expect(prepareSemanticMatchingPackage).toHaveBeenCalledWith(expect.objectContaining({ sessionId: "session", settings }));
    expect(vi.mocked(downloadTextFile).mock.calls.map(([name]) => name)).toEqual([
      "SEMANTIC_MATCH_PROMPT.md", "request_bundle.json", "semantic-matching-catalog.json",
    ]);
    expect(downloadTextFile).toHaveBeenNthCalledWith(2, "request_bundle.json", JSON.stringify(requestBundle, null, 2));
    expect(downloadTextFile).toHaveBeenNthCalledWith(3, "semantic-matching-catalog.json", JSON.stringify(matchingCatalog, null, 2));
    expect(vi.mocked(downloadTextFile).mock.calls[0][1]).toContain("SEMANTIC");
  });

  it("disables both operations", async () => {
    render(<SemanticMatchingWorkspace sessionId="session" settings={settings} disabled />);
    expect(screen.getByRole("button", { name: "Подготовить подбор для ИИ" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Загрузить результат ИИ" })).toBeDisabled();
    expect(prepareSemanticMatchingPackage).not.toHaveBeenCalled();
    expect(importSemanticMatchResult).not.toHaveBeenCalled();
  });

  it("reports malformed JSON without invoking the domain import", async () => {
    const { container } = render(<SemanticMatchingWorkspace sessionId="session" settings={settings} disabled={false} />);
    fireEvent.change(container.querySelector("input[type=file]")!, {
      target: { files: [{ text: vi.fn().mockResolvedValue("{") }] },
    });
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("JSON результата имеет неверный формат"));
    expect(importSemanticMatchResult).not.toHaveBeenCalled();
  });

  it("shows only the human-readable domain error", async () => {
    vi.mocked(importSemanticMatchResult).mockRejectedValue(new SemanticImportError(
      "Заявка, каталоги или настройки изменились после подготовки файлов",
      [{ code: "PACKAGE_TAMPERED", path: "/foo/bar", message: "internal" }],
    ));
    const { container } = render(<SemanticMatchingWorkspace sessionId="session" settings={settings} disabled={false} />);
    fireEvent.change(container.querySelector("input[type=file]")!, {
      target: { files: [{ text: vi.fn().mockResolvedValue(JSON.stringify(result)) }] },
    });
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Заявка, каталоги или настройки изменились после подготовки файлов"));
    expect(screen.getByRole("status")).not.toHaveTextContent("PACKAGE_TAMPERED");
    expect(screen.getByRole("status")).not.toHaveTextContent("/foo/bar");
  });

  it("passes a parsed valid result to the domain import", async () => {
    vi.mocked(importSemanticMatchResult).mockResolvedValue({} as never);
    const { container } = render(<SemanticMatchingWorkspace sessionId="session" settings={settings} disabled={false} />);
    fireEvent.change(container.querySelector("input[type=file]")!, {
      target: { files: [{ text: vi.fn().mockResolvedValue(JSON.stringify(result)) }] },
    });
    await waitFor(() => expect(importSemanticMatchResult).toHaveBeenCalledWith(expect.objectContaining({
      sessionId: "session", semanticResult: result,
    })));
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Подбор ИИ загружен"));
  });
});
