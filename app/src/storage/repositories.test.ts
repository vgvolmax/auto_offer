import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import catalog from "../../../tests/fixtures/bundles/catalog.valid.json";
import request from "../../../tests/fixtures/bundles/request.valid.json";
import { createCatalogRecord } from "../domain/catalog";
import { createDraftSession } from "../domain/session";
import { catalogsRepository } from "./catalogs-repository";
import { sessionsRepository } from "./sessions-repository";
import { resetDatabaseConnection } from "./database";
import expected from "../../../tests/fixtures/matching/golden/D1-single-exact/expected.json";
import {
  matchRunsRepository,
  createMatchRunsRepository,
} from "./match-runs-repository";
import { selectionStatesRepository } from "./selection-states-repository";
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
  it("rejects a stale reviewed catalog revision and preserves the winner",async()=>{const original={...createCatalogRecord(catalog as any),recordId:"review-cas"},winner={...original,semanticRevision:1,updatedAt:"winner"},stale={...original,semanticRevision:1,updatedAt:"stale"};await catalogsRepository.save(original);await catalogsRepository.updateReviewedCatalog({recordId:original.recordId,expectedSemanticRevision:0,next:winner});await expect(catalogsRepository.updateReviewedCatalog({recordId:original.recordId,expectedSemanticRevision:0,next:stale})).rejects.toMatchObject({code:"CATALOG_REVISION_CHANGED"});expect(await catalogsRepository.get(original.recordId)).toEqual(winner)});
  it("updates matching settings with revision CAS and preserves the winner", async () => {
    const c = createCatalogRecord(catalog as any);
    const s = createDraftSession(request as any, [c], "cas");
    await sessionsRepository.save(s);
    const firstSettings = {
      ...s.matchingSettings,
      maxMatchLevel: "exact" as const,
    };
    const first = await sessionsRepository.updateMatchingSettings({
      sessionId: s.sessionId,
      expectedMatchingRevision: 0,
      settings: firstSettings,
    });
    expect(first).toMatchObject({
      matchingRevision: 1,
      matchingSettings: firstSettings,
    });
    await expect(
      sessionsRepository.updateMatchingSettings({
        sessionId: s.sessionId,
        expectedMatchingRevision: 0,
        settings: s.matchingSettings,
      }),
    ).rejects.toMatchObject({ code: "SESSION_REVISION_CHANGED" });
    expect(await sessionsRepository.get(s.sessionId)).toMatchObject({
      matchingRevision: 1,
      matchingSettings: firstSettings,
    });
  });
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
  it("upgrades a v2 database and lazily preserves one selection state per run", async () => {
    const c = createCatalogRecord(catalog as any);
    const s = createDraftSession(request as any, [c], "v2");
    const run: any = {
      id: "v2-run",
      sessionId: s.sessionId,
      sessionRevision: 0,
      createdAt: "2026-01-01T00:00:00.000Z",
      result: expected,
    };
    const linked = { ...s, latestMatchRunId: run.id };
    await new Promise<void>((resolve, reject) => {
      const open = indexedDB.open("auto-offer", 2);
      open.onupgradeneeded = () => {
        const db = open.result;
        db.createObjectStore("catalogs", { keyPath: "recordId" });
        db.createObjectStore("sessions", { keyPath: "sessionId" });
        db.createObjectStore("matchRuns", { keyPath: "id" }).createIndex(
          "by-session",
          "sessionId",
        );
        db.createObjectStore("settings", { keyPath: "key" });
        open.transaction!.objectStore("catalogs").put(c);
        open.transaction!.objectStore("sessions").put(linked);
        open.transaction!.objectStore("matchRuns").put(run);
      };
      open.onsuccess = () => {
        open.result.close();
        resolve();
      };
      open.onerror = () => reject(open.error);
    });
    const db = await (await import("./database")).getDatabase();
    expect(db.version).toBe(3);
    expect(db.objectStoreNames.contains("selectionStates")).toBe(true);
    expect(
      db.transaction("selectionStates").store.indexNames.contains("by-session"),
    ).toBe(true);
    expect(await catalogsRepository.get(c.recordId)).toEqual(c);
    expect(await sessionsRepository.get(s.sessionId)).toMatchObject({
      latestMatchRunId: run.id,
    });
    expect(await matchRunsRepository.get(run.id)).toEqual(run);
    const state = await selectionStatesRepository.getOrCreateForRun(run);
    expect(state).toMatchObject({
      matchRunId: run.id,
      sessionId: run.sessionId,
      inputFingerprint: expected.input_fingerprint,
      revision: 0,
      decisions: {},
    });
    const saved = await selectionStatesRepository.saveDecision({
      sessionId: s.sessionId,
      matchRunId: run.id,
      lineId: "line",
      expectedRevision: 0,
      decision: {
        kind: "selected_offer",
        offerRef: (expected as any).lines[0].candidates[0].offer_ref,
        confirmedAt: "2026-01-01",
      },
    });
    const restored = await selectionStatesRepository.getOrCreateForRun(run);
    expect(restored).toEqual(saved);
    expect(restored.createdAt).toBe(state.createdAt);
  });
  it("atomically replaces the latest run and starts with an empty selection state", async () => {
    const c = createCatalogRecord(catalog as any);
    const s = createDraftSession(request as any, [c], "atomic");
    await catalogsRepository.save(c);
    await sessionsRepository.save(s);
    const a = await matchRunsRepository.saveLatest({
      sessionId: s.sessionId,
      expectedSessionRevision: 0,
      result: expected as any,
    });
    await selectionStatesRepository.saveDecision({
      sessionId: s.sessionId,
      matchRunId: a.id,
      lineId: "line",
      expectedRevision: 0,
      decision: {
        kind: "selected_offer",
        offerRef: (expected as any).lines[0].candidates[0].offer_ref,
        confirmedAt: "2026-01-01",
      },
    });
    const b = await matchRunsRepository.saveLatest({
      sessionId: s.sessionId,
      expectedSessionRevision: 0,
      result: { ...expected, input_fingerprint: "b" } as any,
    });
    expect(await matchRunsRepository.get(a.id)).toBeUndefined();
    expect(await selectionStatesRepository.get(a.id)).toBeUndefined();
    expect(await selectionStatesRepository.get(b.id)).toMatchObject({
      revision: 0,
      decisions: {},
    });
    expect(await sessionsRepository.get(s.sessionId)).toMatchObject({
      latestMatchRunId: b.id,
    });
    const bState = await selectionStatesRepository.saveDecision({
      sessionId: s.sessionId,
      matchRunId: b.id,
      lineId: "line",
      expectedRevision: 0,
      decision: {
        kind: "selected_offer",
        offerRef: (expected as any).lines[0].candidates[0].offer_ref,
        confirmedAt: "kept",
      },
    });
    const failing = createMatchRunsRepository({
      createId: () => "run-c",
      createSelectionStateForRun: () => {
        throw new Error("transaction failure");
      },
    });
    await expect(
      failing.saveLatest({
        sessionId: s.sessionId,
        expectedSessionRevision: 0,
        result: { ...expected, input_fingerprint: "c" } as any,
      }),
    ).rejects.toThrow("transaction failure");
    expect(await sessionsRepository.get(s.sessionId)).toMatchObject({
      latestMatchRunId: b.id,
    });
    expect(await matchRunsRepository.get(b.id)).toEqual(b);
    expect(await selectionStatesRepository.get(b.id)).toEqual(bState);
    expect(await matchRunsRepository.get("run-c")).toBeUndefined();
    expect(await selectionStatesRepository.get("run-c")).toBeUndefined();
  });
});
