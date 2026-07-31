import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import catalog from "../../../tests/fixtures/bundles/catalog.valid.json";
import request from "../../../tests/fixtures/bundles/request.valid.json";
import { createCatalogRecord } from "../domain/catalog";
import { createDraftSession } from "../domain/session";
import { catalogsRepository } from "./catalogs-repository";
import { sessionsRepository } from "./sessions-repository";
import { resetDatabaseConnection } from "./database";
const clear = () =>
  new Promise<void>((ok, fail) => {
    const r = indexedDB.deleteDatabase("auto-offer");
    r.onsuccess = () => ok();
    r.onerror = () => fail(r.error);
  });
beforeEach(async () => {
  resetDatabaseConnection();
  await clear();
  vi.stubGlobal("crypto", { randomUUID: () => Math.random().toString(36) });
});
afterEach(() => vi.unstubAllGlobals());
describe("IndexedDB repositories — A2-A5, H1, G5", () => {
  it("restores multiple catalogs and persisted enabled state", async () => {
    const a = createCatalogRecord(catalog as any),
      b = {
        ...createCatalogRecord(catalog as any),
        recordId: "two",
        catalogId: "other",
      };
    await catalogsRepository.save(a);
    await catalogsRepository.save(b);
    await catalogsRepository.setEnabled(a.recordId, false);
    resetDatabaseConnection();
    const all = await catalogsRepository.all();
    expect(all).toHaveLength(2);
    expect(all.find((x) => x.recordId === a.recordId)?.enabled).toBe(false);
  });
  it("replaces atomically and counts session links", async () => {
    const old = createCatalogRecord(catalog as any),
      next = { ...createCatalogRecord(catalog as any), sourceSha256: "next" };
    await catalogsRepository.save(old);
    const session = createDraftSession(request as any, [old], "draft");
    await sessionsRepository.save(session);
    expect(await sessionsRepository.countUsingCatalog(old.recordId)).toBe(1);
    await catalogsRepository.replace(old.recordId, {
      ...next,
      recordId: old.recordId,
    });
    expect((await catalogsRepository.all())[0].sourceSha256).toBe("next");
  });
  it("restores a draft with immutable bundle and snapshots", async () => {
    const c = createCatalogRecord(catalog as any),
      s = createDraftSession(request as any, [c], "draft");
    await sessionsRepository.save(s);
    resetDatabaseConnection();
    expect(await sessionsRepository.get(s.sessionId)).toEqual(s);
  });
  it("upgrades a legacy v1 session lazily and preserves its catalog", async () => {
    const c = createCatalogRecord(catalog as any),
      s = createDraftSession(request as any, [c], "legacy"),
      legacy = Object.fromEntries(
        Object.entries(s).filter(
          ([key]) =>
            ![
              "catalogRecordIds",
              "matchingSettings",
              "matchingRevision",
              "latestMatchRunId",
            ].includes(key),
        ),
      );
    await new Promise<void>((resolve, reject) => {
      const open = indexedDB.open("auto-offer", 1);
      open.onupgradeneeded = () => {
        const db = open.result;
        db.createObjectStore("catalogs", { keyPath: "recordId" });
        db.createObjectStore("sessions", { keyPath: "sessionId" });
        db.createObjectStore("settings", { keyPath: "key" });
        open.transaction!.objectStore("catalogs").put(c);
        open.transaction!.objectStore("sessions").put(legacy);
      };
      open.onsuccess = () => {
        open.result.close();
        resolve();
      };
      open.onerror = () => reject(open.error);
    });
    const restored = await sessionsRepository.get(s.sessionId);
    expect(restored).toMatchObject({
      catalogRecordIds: [c.recordId],
      matchingRevision: 0,
      latestMatchRunId: null,
      matchingSettings: { maxMatchLevel: "alternative" },
    });
    await sessionsRepository.save(restored!);
    expect(
      (
        await (await import("./database")).getDatabase()
      ).objectStoreNames.contains("matchRuns"),
    ).toBe(true);
  });
});
