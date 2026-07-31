import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  buildSessionMatchingPolicy,
  createDefaultSessionMatchingSettings,
  validateSessionMatchingSettings,
} from "./session-policy";
import { createCatalogRecord } from "../catalog";
import { createDraftSession } from "../session";
import request from "../../../../tests/fixtures/matching/golden/D1-single-exact/request.json";
import catalog from "../../../../tests/fixtures/matching/golden/shared/catalog-main.json";
import expected from "../../../../tests/fixtures/matching/golden/D1-single-exact/expected.json";
import { appRepositories } from "../../storage/repositories";
import { resetDatabaseConnection } from "../../storage/database";
import { runSessionMatching } from "./run-session-matching";
import type { MatchResult } from "./index";
import { ConfirmedSessionWriteError } from "../../storage/match-runs-repository";
describe("B4a session matching", () => {
  beforeEach(async () => {
    resetDatabaseConnection();
    await new Promise<void>((ok) => {
      const r = indexedDB.deleteDatabase("auto-offer");
      r.onsuccess = () => ok();
    });
    vi.stubGlobal("crypto", {
      randomUUID: vi
        .fn()
        .mockReturnValueOnce("catalog-record")
        .mockReturnValueOnce("session-record")
        .mockReturnValueOnce("run-one")
        .mockReturnValueOnce("run-two"),
    });
  });
  it("builds immutable defaults and a contract policy, and rejects brand conflicts", () => {
    const ids = ["a", "b"],
      settings = createDefaultSessionMatchingSettings(ids);
    ids.reverse();
    const policy = buildSessionMatchingPolicy({
      sessionId: "s",
      catalogRecordIds: ["a", "b"],
      settings,
      policyRegistryVersion: "pilot-1.0.0",
    });
    expect(settings.catalogPriority).toEqual(["a", "b"]);
    expect(policy).toMatchObject({
      policy_id: "session:s",
      catalog_record_ids: ["a", "b"],
      catalog_priority: ["a", "b"],
      max_match_level: "alternative",
    });
    (policy.catalog_priority as string[]).reverse();
    expect(settings.catalogPriority).toEqual(["a", "b"]);
    const invalid = {
      ...settings,
      brands: { ...settings.brands, include: ["brand"], exclude: ["brand"] },
    };
    expect(validateSessionMatchingSettings(invalid, ["a", "b"])).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "BRAND_CONFLICT" }),
      ]),
    );
  });
  it("orchestrates matching and atomically replaces the prior run", async () => {
    const c = createCatalogRecord(catalog as any),
      session = createDraftSession(request as any, [c], "B4a");
    await appRepositories.catalogs.save(c);
    await appRepositories.sessions.save(session);
    let received: any;
    const matcher = vi.fn(async (input) => {
      received = input;
      return {
        ...expected,
        policy: input.policy,
        catalog_refs: [
          {
            catalog_record_id: c.recordId,
            catalog_id: c.catalogId,
            source_sha256: c.sourceSha256,
          },
        ],
      } as unknown as MatchResult;
    });
    const first = await runSessionMatching({
      sessionId: session.sessionId,
      settings: session.matchingSettings,
      repositories: appRepositories,
      runMatcher: matcher,
    });
    expect(received.policy.catalog_record_ids).toEqual([c.recordId]);
    const second = await runSessionMatching({
      sessionId: session.sessionId,
      settings: session.matchingSettings,
      repositories: appRepositories,
      runMatcher: matcher,
    });
    expect(
      await appRepositories.matchRuns.get(first.runRecord.id),
    ).toBeUndefined();
    expect(
      (await appRepositories.sessions.get(session.sessionId))?.latestMatchRunId,
    ).toBe(second.runRecord.id);
    expect(
      await appRepositories.matchRuns.getLatestForSession(session.sessionId),
    ).toEqual(second.runRecord);
  });
  it("reports confirmation that races with persisting a completed matcher run", async () => {
    const c = createCatalogRecord(catalog as any);
    const session = createDraftSession(request as any, [c], "concurrent");
    await appRepositories.catalogs.save(c);
    await appRepositories.sessions.save(session);
    const saveLatest = vi.fn().mockRejectedValue(
      new ConfirmedSessionWriteError(
        "Подтверждённый результат доступен только для просмотра",
      ),
    );
    const operation = runSessionMatching({
      sessionId: session.sessionId,
      settings: session.matchingSettings,
      repositories: {
        ...appRepositories,
        matchRuns: { ...appRepositories.matchRuns, saveLatest },
      },
      runMatcher: vi.fn().mockResolvedValue(expected as unknown as MatchResult),
    });

    await expect(operation).rejects.toMatchObject({
      code: "SESSION_CONFIRMED",
      message: expect.stringMatching(/подтверждён/i),
    });
    await expect(operation).rejects.not.toMatchObject({
      code: "MATCH_RUN_PERSIST_FAILED",
    });
    expect(saveLatest).toHaveBeenCalledOnce();
  });
});
