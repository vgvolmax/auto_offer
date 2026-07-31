import { beforeEach, describe, expect, it, vi } from "vitest";
import request from "../../../../tests/fixtures/matching/golden/D1-single-exact/request.json";
import catalogFixture from "../../../../tests/fixtures/matching/golden/shared/catalog-main.json";
import expected from "../../../../tests/fixtures/matching/golden/D1-single-exact/expected.json";
import { createCatalogRecord, type CatalogBundle } from "../catalog";
import { createDraftSession } from "../session";
import { appRepositories } from "../../storage/repositories";
import { resetDatabaseConnection } from "../../storage/database";
import { clearDecisionForLine, markNoOfferForLine, selectOfferForLine } from "./update-selection";
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
      for (const id of ["manual-item", "excluded-item", "foreign-item"]) {
        const item = structuredClone(bundle.items[0]);
        item.catalog_item.source_item_id = id;
        bundle.items.push(item);
      }
      const base = createCatalogRecord(bundle as CatalogBundle);
      const catalog = { ...base, recordId: "record-main" };
      const session = createDraftSession(request as any, [catalog], "selection");
      await appRepositories.catalogs.save(catalog); await appRepositories.sessions.save(session);
      const refs = bundle.items.slice(0, 4).map((x: any) => ({ catalog_record_id: catalog.recordId, catalog_id: catalog.catalogId, source_sha256: catalog.sourceSha256, source_item_id: x.catalog_item.source_item_id }));
      const generated = await runSessionMatching({ sessionId: session.sessionId, settings: session.matchingSettings, repositories: appRepositories });
      const original = (expected as any).lines[0];
      const result: any = { ...structuredClone(generated.runRecord.result), lines: [{ ...original, candidates: [
        { ...original.candidates[0], offer_ref: refs[0], availability: "eligible" },
        { ...original.candidates[0], offer_ref: refs[1], availability: "manual_only" },
      ], excluded_candidates: [{ ...original.candidates[0], offer_ref: refs[2], availability: "eligible" }] }, { ...original, line_id: "other-line", candidates: [{ ...original.candidates[0], offer_ref: refs[3] }], excluded_candidates: [] }] };
      const run = { ...generated.runRecord, result };
      await (await getDatabase()).put("matchRuns", run);
      const matchResultBeforeSelections = structuredClone(run.result);
      const select = (lineId: string, offerRef: any, revision: number) => selectOfferForLine({ sessionId: session.sessionId, matchRunId: run.id, lineId, offerRef, expectedSelectionRevision: revision, repositories: appRepositories });
      const first = await select(original.line_id, refs[0], 0);
      expect(first.revision).toBe(1); expect((first.decisions[original.line_id] as any).offerRef).toEqual(refs[0]);
      const repeated = await select(original.line_id, refs[0], 0);
      expect(repeated.revision).toBe(1); expect(repeated.decisions[original.line_id].confirmedAt).toBe(first.decisions[original.line_id].confirmedAt);
      const manual = await select(original.line_id, refs[1], 1);
      expect(manual.revision).toBe(2); expect(Object.keys(manual.decisions)).toEqual([original.line_id]); expect((manual.decisions[original.line_id] as any).offerRef).toEqual(refs[1]);
      await expect(select(original.line_id, refs[2], 2)).rejects.toMatchObject({ code: "CANDIDATE_NOT_FOUND" });
      await expect(select(original.line_id, refs[3], 2)).rejects.toMatchObject({ code: "CANDIDATE_NOT_FOUND" });
      await expect(select(original.line_id, { ...refs[0], catalog_record_id: "changed" }, 2)).rejects.toMatchObject({ code: "CANDIDATE_NOT_FOUND" });
      await expect(select(original.line_id, { ...refs[0], source_sha256: "changed" }, 2)).rejects.toMatchObject({ code: "CANDIDATE_NOT_FOUND" });
      const fresh = await select("other-line", refs[3], 2);
      await expect(select(original.line_id, refs[0], 2)).rejects.toMatchObject({ code: "STALE_SELECTION_STATE" });
      expect(await appRepositories.selectionStates.get(run.id)).toEqual(fresh);
      const cleared = await clearDecisionForLine({ sessionId: session.sessionId, matchRunId: run.id, lineId: "other-line", expectedSelectionRevision: 3, repositories: appRepositories });
      expect(cleared.revision).toBe(4); expect(cleared.decisions["other-line"]).toBeUndefined();
      expect((await appRepositories.matchRuns.get(run.id))?.result).toEqual(matchResultBeforeSelections);
      const stored = await appRepositories.sessions.get(session.sessionId);
      await appRepositories.sessions.save({ ...stored!, matchingRevision: 1 });
      await expect(select(original.line_id, refs[0], 4)).rejects.toMatchObject({ code: "MATCH_RUN_STALE" });
    },
  );
  it("persists no-offer idempotently and preserves feedback across decision transitions", async () => {
    const catalog = createCatalogRecord(catalogFixture as CatalogBundle);
    const session = createDraftSession(request as any, [catalog], "no-offer");
    await appRepositories.catalogs.save(catalog);
    await appRepositories.sessions.save(session);
    const generated = await runSessionMatching({ sessionId: session.sessionId, settings: session.matchingSettings, repositories: appRepositories });
    const run = generated.runRecord;
    const line = run.result.lines[0] as any;
    const offerRef = line.candidates[0].offer_ref;
    const initial = await appRepositories.selectionStates.getOrCreateForRun(run);
    const withFeedback = await appRepositories.selectionStates.saveFeedback({
      sessionId: session.sessionId, matchRunId: run.id, lineId: line.line_id,
      expectedRevision: initial.revision, feedback: { comment: "сохранить" },
    });
    const selected = await selectOfferForLine({ sessionId: session.sessionId, matchRunId: run.id, lineId: line.line_id, offerRef, expectedSelectionRevision: withFeedback.revision, repositories: appRepositories });
    const noOffer = await markNoOfferForLine({ sessionId: session.sessionId, matchRunId: run.id, lineId: line.line_id, expectedSelectionRevision: selected.revision, repositories: appRepositories });
    expect(noOffer.decisions[line.line_id]).toMatchObject({ kind: "no_offer" });
    expect(noOffer.feedback[line.line_id]).toEqual({ comment: "сохранить" });

    const repeated = await markNoOfferForLine({ sessionId: session.sessionId, matchRunId: run.id, lineId: line.line_id, expectedSelectionRevision: selected.revision, repositories: appRepositories });
    expect(repeated.revision).toBe(noOffer.revision);
    expect(repeated.decisions[line.line_id].confirmedAt).toBe(noOffer.decisions[line.line_id].confirmedAt);

    const selectedAgain = await selectOfferForLine({ sessionId: session.sessionId, matchRunId: run.id, lineId: line.line_id, offerRef, expectedSelectionRevision: noOffer.revision, repositories: appRepositories });
    expect(selectedAgain.decisions[line.line_id]).toMatchObject({ kind: "selected_offer", offerRef });
    expect(selectedAgain.feedback[line.line_id]).toEqual({ comment: "сохранить" });
    await expect(markNoOfferForLine({ sessionId: session.sessionId, matchRunId: run.id, lineId: line.line_id, expectedSelectionRevision: noOffer.revision, repositories: appRepositories })).rejects.toMatchObject({ code: "STALE_SELECTION_STATE" });
  });
});
