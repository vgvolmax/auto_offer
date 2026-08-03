import { beforeEach, describe, expect, it } from "vitest";
import { runSessionMatching } from "../domain/matching/run-session-matching";
import { createCatalogRecord } from "../domain/catalog";
import { createDraftSession } from "../domain/session";
import { appRepositories } from "./repositories";
import { resetDatabaseConnection } from "./database";
import { createPilotWorkflowFixture } from "../test/pilot/pilot-fixtures";

beforeEach(async () => {
  resetDatabaseConnection();
  await new Promise<void>((resolve) => { const request = indexedDB.deleteDatabase("auto-offer"); request.onsuccess = () => resolve(); });
});

describe("pilot catalog snapshot immutability", () => {
  it("keeps a session and confirmed export attached to record A after importing version B", async () => {
    const fixture = createPilotWorkflowFixture();
    const a = { ...createCatalogRecord(fixture.primaryCatalogBundle), recordId: "snapshot-a" };
    await appRepositories.catalogs.save(a);
    const session = createDraftSession(fixture.requestBundle, [a], "snapshot");
    await appRepositories.sessions.save(session);
    const matched = await runSessionMatching({ sessionId: session.sessionId, settings: { ...session.matchingSettings, maxMatchLevel: "exact" }, repositories: appRepositories });
    const fingerprint = matched.runRecord.result.input_fingerprint;
    const changedBundle = structuredClone(fixture.primaryCatalogBundle);
    changedBundle.catalog.source_sha256 = "e".repeat(64);
    const b = { ...createCatalogRecord(changedBundle), recordId: "snapshot-b" };
    await appRepositories.catalogs.save(b);
    expect((await appRepositories.sessions.get(session.sessionId))?.catalogRecordIds).toEqual([a.recordId]);
    expect((await appRepositories.matchRuns.get(matched.runRecord.id))?.result.input_fingerprint).toBe(fingerprint);
    expect(await appRepositories.sessions.countUsingCatalog(a.recordId)).toBe(1);
    expect(await appRepositories.sessions.countUsingCatalog(b.recordId)).toBe(0);
  });
});
