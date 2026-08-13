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

async function deleteDatabase() {
  resetDatabaseConnection();
  await new Promise<void>((resolve, reject) => {
    const operation = indexedDB.deleteDatabase("auto-offer");
    operation.onsuccess = () => resolve();
    operation.onerror = () => reject(operation.error);
  });
}

function renderSession(sessionId: string) {
  return render(
    <MemoryRouter initialEntries={[`/sessions/${sessionId}`]}>
      <Routes><Route path="sessions/:id" element={<SessionPage />} /></Routes>
    </MemoryRouter>,
  );
}

async function createPersistedPilotRun(options: { twoCatalogs?: boolean } = {}) {
  const primaryBundle = structuredClone(catalogFixture) as CatalogBundle;
  (primaryBundle.items[0] as any).catalog_item.identity.brand = "Volmax";
  const primary = createCatalogRecord(primaryBundle);
  const catalogs = [primary];
  if (options.twoCatalogs) {
    const secondaryBundle = structuredClone(catalogFixture) as CatalogBundle;
    secondaryBundle.catalog.catalog_id = "synthetic-valves-secondary";
    secondaryBundle.catalog.source_file_name = "Secondary catalog.xlsx";
    secondaryBundle.catalog.source_sha256 = "1".repeat(64);
    catalogs.push(createCatalogRecord(secondaryBundle));
  }
  for (const catalog of catalogs) await appRepositories.catalogs.save(catalog);
  const session = createDraftSession(request as Parameters<typeof createDraftSession>[0], catalogs, "Legacy Pilot regression");
  await appRepositories.sessions.save(session);
  const matched = await runSessionMatching({ sessionId: session.sessionId, settings: session.matchingSettings, repositories: appRepositories });
  return { catalogs, session: matched.session, run: matched.runRecord };
}

beforeEach(async () => {
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

describe("SessionPage persisted Pilot regressions", () => {
  it("tracks a stored run as stale and current as catalog priority is changed and restored", async () => {
    const user = userEvent.setup();
    const { catalogs, session } = await createPersistedPilotRun({ twoCatalogs: true });
    renderSession(session.sessionId);

    expect(await screen.findByText("Актуальный")).toBeVisible();
    await user.click(screen.getByRole("button", { name: `Поднять каталог ${catalogs[1].recordId} выше` }));
    expect(screen.getByText("Настройки изменены — результат устарел")).toBeVisible();
    expect(screen.getByText("Подбор устарел. Подготовьте новые файлы для ИИ.")).toBeVisible();
    expect(screen.queryByText("Запустите подбор заново.")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: `Опустить каталог ${catalogs[1].recordId} ниже` }));
    expect(screen.getByText("Актуальный")).toBeVisible();

    await user.click(screen.getByRole("button", { name: `Поднять каталог ${catalogs[1].recordId} выше` }));
    await user.click(screen.getByRole("button", { name: "Сохранить настройки" }));
    expect(await screen.findByText("Сохранено")).toBeVisible();
    expect(screen.getByText("Подбор устарел. Подготовьте новые файлы для ИИ.")).toBeVisible();
  });

  it("persists selected_offer across reload and protects it while settings are stale", async () => {
    const user = userEvent.setup();
    const { session, run } = await createPersistedPilotRun();
    const first = renderSession(session.sessionId);

    expect(await screen.findByLabelText("Обработано 0 из 1")).toBeVisible();
    await user.click(screen.getByRole("button", { name: /request-valve\.ball/ }));
    expect(screen.getByRole("radio", { name: "Не выбрано" })).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Выбрать" }));
    await waitFor(() => expect(screen.getByLabelText("Обработано 1 из 1")).toBeVisible());
    expect(screen.getByRole("radio", { name: "Выбрано" })).toBeChecked();

    const saved = await appRepositories.selectionStates.get(run.id);
    const lineId = (run.result.lines as any[])[0].line_id;
    const offerRef = (run.result.lines as any[])[0].candidates[0].offer_ref;
    expect(saved).toMatchObject({ revision: 1, decisions: { [lineId]: { kind: "selected_offer", offerRef } } });

    first.unmount();
    resetDatabaseConnection();
    renderSession(session.sessionId);
    expect(await screen.findByLabelText("Обработано 1 из 1")).toBeVisible();
    await user.click(screen.getByRole("button", { name: /request-valve\.ball/ }));
    expect(screen.getByRole("radio", { name: "Выбрано" })).toBeChecked();

    await user.click(screen.getByRole("radio", { name: "Только точное соответствие" }));
    expect(screen.getByText(/Результат построен по другим настройкам/)).toBeVisible();
    expect(screen.getByRole("radio", { name: "Выбрано" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Снять выбор" })).toBeDisabled();
    await user.click(screen.getByRole("radio", { name: "Можно предлагать альтернативы" }));
    expect(screen.getByRole("radio", { name: "Выбрано" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Снять выбор" })).toBeEnabled();
  });

  it("persists no_offer and operator feedback across reload", async () => {
    const user = userEvent.setup();
    const { session, run } = await createPersistedPilotRun();
    const first = renderSession(session.sessionId);
    await user.click(await screen.findByRole("button", { name: /request-valve\.ball/ }));
    await user.click(screen.getByRole("button", { name: "Оставить без предложения" }));
    await waitFor(() => expect(screen.getByText("✓ Без предложения")).toBeVisible());
    expect(screen.getByRole("button", { name: /Обратная связь для/ })).toHaveAttribute("aria-expanded", "true");
    await user.type(screen.getByLabelText("Комментарий оператора"), "Нет подходящего товара");
    await user.click(screen.getByRole("button", { name: "Сохранить обратную связь" }));
    expect(await screen.findByText("Обратная связь сохранена")).toBeVisible();

    const lineId = (run.result.lines as any[])[0].line_id;
    const saved = await appRepositories.selectionStates.get(run.id);
    expect(saved?.decisions[lineId]).toMatchObject({ kind: "no_offer" });
    expect(saved?.feedback[lineId].comment).toBe("Нет подходящего товара");

    first.unmount();
    resetDatabaseConnection();
    renderSession(session.sessionId);
    expect(await screen.findByLabelText("Обработано 1 из 1")).toBeVisible();
    await user.click(screen.getByRole("button", { name: /request-valve\.ball/ }));
    expect(screen.getByText("✓ Без предложения")).toBeVisible();
    await user.click(screen.getByRole("button", { name: /Обратная связь для/ }));
    expect(screen.getByLabelText("Комментарий оператора")).toHaveValue("Нет подходящего товара");
  });
});
