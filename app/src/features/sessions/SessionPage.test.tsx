import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import request from "../../../../tests/fixtures/matching/golden/D1-single-exact/request.json";
import catalogFixture from "../../../../tests/fixtures/matching/golden/shared/catalog-main.json";
import { createCatalogRecord, type CatalogBundle } from "../../domain/catalog";
import { createDraftSession } from "../../domain/session";
import { resetDatabaseConnection } from "../../storage/database";
import { appRepositories } from "../../storage/repositories";
import { SessionPage } from "./SessionPage";

function deleteDatabase() {
  return new Promise<void>((resolve, reject) => {
    const request = indexedDB.deleteDatabase("auto-offer");
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

function renderSession(sessionId: string) {
  return render(
    <MemoryRouter initialEntries={[`/sessions/${sessionId}`]}>
      <Routes>
        <Route path="sessions/:id" element={<SessionPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(async () => {
  resetDatabaseConnection();
  await deleteDatabase();
  let sequence = 0;
  vi.spyOn(globalThis.crypto, "randomUUID").mockImplementation(
    () => `00000000-0000-4000-8000-${String(++sequence).padStart(12, "0")}`,
  );
});

afterEach(() => {
  resetDatabaseConnection();
  vi.restoreAllMocks();
});

describe("SessionPage B4a matching state", () => {
  it("marks edited settings stale and restores a reordered run as current after reload", async () => {
    const user = userEvent.setup();
    const catalogA = createCatalogRecord(catalogFixture as CatalogBundle);
    const catalogBBundle = structuredClone(catalogFixture) as CatalogBundle;
    catalogBBundle.catalog.catalog_id = "synthetic-valves-secondary";
    catalogBBundle.catalog.source_file_name = "Secondary catalog.xlsx";
    catalogBBundle.catalog.source_sha256 = "1".repeat(64);
    const catalogB = createCatalogRecord(catalogBBundle);
    const session = createDraftSession(
      request as Parameters<typeof createDraftSession>[0],
      [catalogA, catalogB],
      "B4a regression",
    );
    await appRepositories.catalogs.save(catalogA);
    await appRepositories.catalogs.save(catalogB);
    await appRepositories.sessions.save(session);

    const firstView = renderSession(session.sessionId);
    const runButton = await screen.findByRole("button", {
      name: "Запустить подбор",
    });
    await user.click(runButton);
    expect(await screen.findByText("Актуальный")).toBeVisible();

    await user.click(
      screen.getByRole("button", {
        name: `Поднять каталог ${catalogB.recordId} выше`,
      }),
    );
    expect(
      screen.getByText("Настройки изменены — результат устарел"),
    ).toBeVisible();
    expect(
      screen.getByRole("button", { name: "Сохранить настройки" }),
    ).toBeEnabled();

    await user.click(
      screen.getByRole("button", {
        name: `Опустить каталог ${catalogB.recordId} ниже`,
      }),
    );
    expect(screen.getByText("Актуальный")).toBeVisible();

    await user.click(
      screen.getByRole("button", {
        name: `Поднять каталог ${catalogB.recordId} выше`,
      }),
    );
    await user.click(runButton);
    expect(await screen.findByText("Актуальный")).toBeVisible();
    expect(
      screen.getByRole("button", { name: "Сохранить настройки" }),
    ).toBeDisabled();
    expect(screen.getByLabelText("Сводка подбора")).toBeVisible();
    expect(
      screen.queryByText(/выбранное предложение/i),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText(/подтвердить предложение/i),
    ).not.toBeInTheDocument();
    expect(screen.queryByText(/^экспорт$/i)).not.toBeInTheDocument();

    firstView.unmount();
    resetDatabaseConnection();
    renderSession(session.sessionId);

    expect(await screen.findByText("Актуальный")).toBeVisible();
    expect(screen.getByLabelText("Сводка подбора")).toBeVisible();
    const priority = screen.getByRole("group", {
      name: "Приоритет каталогов",
    });
    await waitFor(() => {
      const labels = within(priority)
        .getAllByText(/synthetic-valves/)
        .map((element) => element.textContent);
      expect(labels).toEqual([
        "synthetic-valves-secondary",
        "synthetic-valves",
      ]);
    });
  });
  it(
    "persists a manual selection but starts empty after a new matcher run",
    async () => {
      const user = userEvent.setup();
      const bundle = structuredClone(catalogFixture) as CatalogBundle;
      (bundle.items[0] as any).catalog_item.identity.brand = "Volmax";
      const catalog = createCatalogRecord(bundle);
      const session = createDraftSession(request as any, [catalog], "B4b regression");
      await appRepositories.catalogs.save(catalog); await appRepositories.sessions.save(session);
      const first = renderSession(session.sessionId);
      await user.click(await screen.findByRole("button", { name: "Запустить подбор" }));
      expect(await screen.findByText("Результаты подбора")).toBeVisible();
      await user.click(await screen.findByRole("button", { name: /request-valve\.ball/ }));
      expect(screen.getByText("Синтетический кран шаровой")).toBeVisible();
      expect(screen.getAllByText(/Volmax/).some((element) => element.textContent?.includes("synthetic-valve.ball-1"))).toBe(true);
      expect(screen.getByText(/Рекомендуется/)).toBeVisible();
      expect(screen.queryByText(/· Выбрано/)).not.toBeInTheDocument();
      await user.click(screen.getByRole("button", { name: "Выбрать" }));
      await waitFor(() => expect(screen.getByText(/Выбрано 1 из 1/)).toBeVisible());
      expect(screen.getByRole("radio", { name: "Выбрано" })).toBeChecked();

      first.unmount(); resetDatabaseConnection();
      renderSession(session.sessionId);
      expect(await screen.findByText(/Выбрано 1 из 1/)).toBeVisible();
      expect(screen.queryByText("Выполняется подбор…")).not.toBeInTheDocument();
      await user.click(screen.getByRole("button", { name: /request-valve\.ball/ }));
      expect(screen.getByRole("radio", { name: "Выбрано" })).toBeChecked();
      await user.click(screen.getByRole("radio", { name: "Только точные" }));
      expect(screen.getByText(/Результат построен по другим настройкам/)).toBeVisible();
      expect(screen.getByRole("button", { name: "Снять выбор" })).toBeDisabled();
      await user.click(screen.getByRole("radio", { name: "Все варианты, включая альтернативные" }));
      expect(screen.getByRole("button", { name: "Снять выбор" })).toBeEnabled();
      await user.click(screen.getByRole("radio", { name: "Только точные" }));
      await user.click(screen.getByRole("button", { name: "Запустить подбор" }));
      await waitFor(() => expect(screen.getByText(/Выбрано 0 из 1/)).toBeVisible());
      expect(screen.queryByText(/· Выбрано/)).not.toBeInTheDocument();
      expect(screen.getByRole("radio", { name: "Не выбрано" })).not.toBeChecked();
      for (const label of ["Экспортировать", "Скачать Excel", "Завершить сессию", "Создать заказ"])
        expect(screen.queryByText(label)).not.toBeInTheDocument();
    },
  );
});
