import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import request from "../../../../tests/fixtures/matching/golden/D1-single-exact/request.json";
import catalogFixture from "../../../../tests/fixtures/matching/golden/shared/catalog-main.json";
import { createCatalogRecord, type CatalogBundle } from "../../domain/catalog";
import { runSessionMatching } from "../../domain/matching/run-session-matching";
import { createDraftSession } from "../../domain/session";
import { resetDatabaseConnection } from "../../storage/database";
import { appRepositories } from "../../storage/repositories";
import { SessionPage } from "./SessionPage";

function deleteDatabase() {
  return new Promise<void>((resolve, reject) => {
    const operation = indexedDB.deleteDatabase("auto-offer");
    operation.onsuccess = () => resolve();
    operation.onerror = () => reject(operation.error);
  });
}
function renderSession(sessionId: string) {
  return render(<MemoryRouter initialEntries={[`/sessions/${sessionId}`]}><Routes><Route path="sessions/:id" element={<SessionPage />} /></Routes></MemoryRouter>);
}
async function setupSession() {
  const catalog = createCatalogRecord(catalogFixture as CatalogBundle);
  const session = createDraftSession(request as Parameters<typeof createDraftSession>[0], [catalog], "AI-only flow");
  await appRepositories.catalogs.save(catalog);
  await appRepositories.sessions.save(session);
  return { catalog, session };
}

beforeEach(async () => {
  resetDatabaseConnection();
  await deleteDatabase();
  let sequence = 0;
  vi.spyOn(globalThis.crypto, "randomUUID").mockImplementation(() => `00000000-0000-4000-8000-${String(++sequence).padStart(12, "0")}`);
});
afterEach(() => { resetDatabaseConnection(); vi.restoreAllMocks(); });

describe("SessionPage AI-only matching flow", () => {
  it("shows offer rules and STEP3 without a Pilot run action", async () => {
    const user = userEvent.setup();
    const { session } = await setupSession();
    renderSession(session.sessionId);

    expect(await screen.findByRole("heading", { name: "Правила предложения" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "Шаг 3 — Подбор наших товаров" })).toBeVisible();
    expect(screen.queryByRole("button", { name: "Запустить подбор" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Перезапустить подбор" })).not.toBeInTheDocument();
    expect(screen.queryByText("Товары, которые требуют проверки")).not.toBeInTheDocument();
    expect(screen.queryByRole("radio", { name: "Разрешить их как варианты с обязательной ручной проверкой" })).not.toBeInTheDocument();

    await user.click(screen.getByRole("radio", { name: "Только точное соответствие" }));
    expect(screen.getByRole("button", { name: "Сохранить настройки" })).toBeEnabled();
    await user.click(screen.getByRole("button", { name: "Сохранить настройки" }));
    expect(await screen.findByText("Сохранено")).toBeVisible();
  });

  it("opens a stored Pilot result for review but does not offer another Pilot run", async () => {
    const { session } = await setupSession();
    await runSessionMatching({ sessionId: session.sessionId, settings: session.matchingSettings, repositories: appRepositories });
    renderSession(session.sessionId);

    expect(await screen.findByRole("heading", { name: "Результаты подбора" })).toBeVisible();
    expect(screen.getByText("Источник: Локальный подбор (legacy).")).toBeVisible();
    expect(screen.queryByRole("button", { name: /^(Пере)?запустить подбор$/ })).not.toBeInTheDocument();
    await waitFor(() => expect(screen.getByText("Служебная информация и экспорт")).toBeVisible());
  });
});
