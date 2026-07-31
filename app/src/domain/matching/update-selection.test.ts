import { beforeEach, describe, expect, it, vi } from "vitest";
import request from "../../../../tests/fixtures/matching/golden/D1-single-exact/request.json";
import catalogFixture from "../../../../tests/fixtures/matching/golden/shared/catalog-main.json";
import expected from "../../../../tests/fixtures/matching/golden/D1-single-exact/expected.json";
import { createCatalogRecord, type CatalogBundle } from "../catalog";
import { createDraftSession } from "../session";
import { appRepositories } from "../../storage/repositories";
import { resetDatabaseConnection } from "../../storage/database";
import { clearOfferForLine, selectOfferForLine } from "./update-selection";
import { runSessionMatching } from "./run-session-matching";
import { getDatabase } from "../../storage/database";

describe("selection application service", () => {
  beforeEach(async () => {
    resetDatabaseConnection();
    await new Promise<void>((resolve, reject) => { const r = indexedDB.deleteDatabase("auto-offer"); r.onsuccess = () => resolve(); r.onerror = () => reject(r.error); });
  });
  it(
    "enforces candidate ownership, availability and optimistic concurrency",
    async () => {
      const bundle = structuredClone(catalogFixture) as any;
      for (const id of ["manual-item", "other-item"]) {
        const item = structuredClone(bundle.items[0]);
        item.catalog_item.source_item_id = id;
        bundle.items.push(item);
      }
      const base = createCatalogRecord(bundle as CatalogBundle);
      const catalog = { ...base, recordId: "record-main" };
      const session = createDraftSession(request as any, [catalog], "selection");
      await appRepositories.catalogs.save(catalog); await appRepositories.sessions.save(session);
      const refs = bundle.items.slice(0, 3).map((x: any) => ({ catalog_record_id: catalog.recordId, catalog_id: catalog.catalogId, source_sha256: catalog.sourceSha256, source_item_id: x.catalog_item.source_item_id }));
      const generated = await runSessionMatching({ sessionId: session.sessionId, settings: session.matchingSettings, repositories: appRepositories });
      const original = (expected as any).lines[0];
      const result: any = { ...structuredClone(generated.runRecord.result), lines: [{ ...original, candidates: [
        { ...original.candidates[0], offer_ref: refs[0], availability: "eligible" },
        { ...original.candidates[0], offer_ref: refs[1], availability: "manual_only" },
      ], excluded_candidates: [{ ...original.candidates[0], offer_ref: refs[2], availability: "eligible" }] }, { ...original, line_id: "other-line", candidates: [{ ...original.candidates[0], offer_ref: refs[2] }], excluded_candidates: [] }] };
      const run = { ...generated.runRecord, result };
      await (await getDatabase()).put("matchRuns", run);
      const select = (lineId: string, offerRef: any, revision: number) => selectOfferForLine({ sessionId: session.sessionId, matchRunId: run.id, lineId, offerRef, expectedSelectionRevision: revision, repositories: appRepositories });
      const first = await select(original.line_id, refs[0], 0);
      expect(first.revision).toBe(1); expect(first.decisions[original.line_id].offerRef).toEqual(refs[0]);
      const repeated = await select(original.line_id, refs[0], 0);
      expect(repeated.revision).toBe(1); expect(repeated.decisions[original.line_id].confirmedAt).toBe(first.decisions[original.line_id].confirmedAt);
      const manual = await select(original.line_id, refs[1], 1);
      expect(manual.revision).toBe(2); expect(Object.keys(manual.decisions)).toEqual([original.line_id]); expect(manual.decisions[original.line_id].offerRef).toEqual(refs[1]);
      await expect(select(original.line_id, refs[2], 2)).rejects.toMatchObject({ code: "CANDIDATE_NOT_FOUND" });
      await expect(select(original.line_id, { ...refs[0], catalog_record_id: "changed" }, 2)).rejects.toMatchObject({ code: "CANDIDATE_NOT_FOUND" });
      await expect(select(original.line_id, { ...refs[0], source_sha256: "changed" }, 2)).rejects.toMatchObject({ code: "CANDIDATE_NOT_FOUND" });
      await expect(select(original.line_id, refs[2], 2)).rejects.toMatchObject({ code: "CANDIDATE_NOT_FOUND" });
      const fresh = await select("other-line", refs[2], 2);
      await expect(select(original.line_id, refs[0], 2)).rejects.toMatchObject({ code: "STALE_SELECTION_STATE" });
      expect(await appRepositories.selectionStates.get(run.id)).toEqual(fresh);
      const cleared = await clearOfferForLine({ sessionId: session.sessionId, matchRunId: run.id, lineId: "other-line", expectedSelectionRevision: 3, repositories: appRepositories });
      expect(cleared.revision).toBe(4); expect(cleared.decisions["other-line"]).toBeUndefined();
      const stored = await appRepositories.sessions.get(session.sessionId);
      await appRepositories.sessions.save({ ...stored!, matchingRevision: 1 });
      await expect(select(original.line_id, refs[0], 4)).rejects.toMatchObject({ code: "MATCH_RUN_STALE" });
    },
  );
});
