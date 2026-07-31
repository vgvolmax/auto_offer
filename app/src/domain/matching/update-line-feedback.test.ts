import { beforeEach, describe, expect, it } from "vitest";
import request from "../../../../tests/fixtures/matching/golden/D1-single-exact/request.json";
import catalogFixture from "../../../../tests/fixtures/matching/golden/shared/catalog-main.json";
import { createCatalogRecord, type CatalogBundle } from "../catalog";
import { createDraftSession } from "../session";
import { resetDatabaseConnection } from "../../storage/database";
import { getDatabase } from "../../storage/database";
import { appRepositories } from "../../storage/repositories";
import { normalizeLineFeedback } from "./line-feedback";
import { runSessionMatching } from "./run-session-matching";
import { saveFeedbackForLine } from "./update-line-feedback";

describe("line feedback normalization", () => {
  it("trims comments, removes empty feedback and incompatible fields without mutation", () => {
    const relatedOfferRef = { catalog_record_id: "r", catalog_id: "c", source_sha256: "s", source_item_id: "i" };
    const input = { outcome: "correct_result" as const, suspectedCause: "unknown_cause" as const, comment: "  полезно  ", relatedOfferRef };
    const snapshot = structuredClone(input);
    expect(normalizeLineFeedback(input)).toEqual({ outcome: "correct_result", comment: "полезно" });
    expect(normalizeLineFeedback({ comment: "   " })).toBeUndefined();
    expect(input).toEqual(snapshot);
  });
});

describe("line feedback application service", () => {
  beforeEach(async () => {
    resetDatabaseConnection();
    await new Promise<void>((resolve, reject) => { const r = indexedDB.deleteDatabase("auto-offer"); r.onsuccess = () => resolve(); r.onerror = () => reject(r.error); });
  });

  async function fixture() {
    const bundle = structuredClone(catalogFixture) as any;
    const foreignItem = structuredClone(bundle.items[0]);
    foreignItem.catalog_item.source_item_id = "foreign-item";
    bundle.items.push(foreignItem);
    const catalog = createCatalogRecord(bundle as CatalogBundle);
    const session = createDraftSession(request as any, [catalog], "feedback");
    await appRepositories.catalogs.save(catalog);
    await appRepositories.sessions.save(session);
    const generated = await runSessionMatching({ sessionId: session.sessionId, settings: session.matchingSettings, repositories: appRepositories });
    const run = generated.runRecord;
    const line = run.result.lines[0] as any;
    const localCandidate = line.candidates.find((candidate: any) => candidate.offer_ref.source_item_id !== "foreign-item");
    const localRef = localCandidate.offer_ref;
    const foreignRef = { ...localRef, source_item_id: "foreign-item" };
    const result: any = { ...structuredClone(run.result), lines: [{ ...line, candidates: [localCandidate] }, { ...structuredClone(line), line_id: "foreign-line", candidates: [{ ...localCandidate, offer_ref: foreignRef }] }] };
    const customRun = { ...run, result };
    await (await getDatabase()).put("matchRuns", customRun);
    return { session, run: customRun, lineId: line.line_id, localRef, foreignRef };
  }

  it("saves an owned candidate without changing the decision or match result and rejects stale state", async () => {
    const { session, run, lineId, localRef } = await fixture();
    const before = structuredClone(run.result);
    const state = await appRepositories.selectionStates.getOrCreateForRun(run);
    const decided = await appRepositories.selectionStates.saveDecision({ sessionId: session.sessionId, matchRunId: run.id, lineId, expectedRevision: state.revision, decision: { kind: "no_offer", confirmedAt: "2026-01-01T00:00:00.000Z" } });
    const saved = await saveFeedbackForLine({ sessionId: session.sessionId, matchRunId: run.id, lineId, expectedSelectionRevision: decided.revision, repositories: appRepositories, feedback: { outcome: "correct_candidate_ranked_low", relatedOfferRef: localRef, comment: "  кандидат ниже  " } });
    expect(saved.feedback[lineId]).toEqual({ outcome: "correct_candidate_ranked_low", relatedOfferRef: localRef, comment: "кандидат ниже" });
    expect(saved.decisions).toEqual(decided.decisions);
    expect((await appRepositories.selectionStates.get(run.id))?.feedback[lineId]).toEqual(saved.feedback[lineId]);
    expect((await appRepositories.matchRuns.get(run.id))?.result).toEqual(before);
    await expect(saveFeedbackForLine({ sessionId: session.sessionId, matchRunId: run.id, lineId, expectedSelectionRevision: decided.revision, repositories: appRepositories, feedback: { comment: "stale" } })).rejects.toMatchObject({ code: "STALE_SELECTION_STATE" });
  });

  it.each([
    ["another line", (x: Awaited<ReturnType<typeof fixture>>) => x.foreignRef],
    ["catalog_record_id", (x: Awaited<ReturnType<typeof fixture>>) => ({ ...x.localRef, catalog_record_id: "altered" })],
    ["catalog_id", (x: Awaited<ReturnType<typeof fixture>>) => ({ ...x.localRef, catalog_id: "altered" })],
    ["source_sha256", (x: Awaited<ReturnType<typeof fixture>>) => ({ ...x.localRef, source_sha256: "altered" })],
    ["source_item_id", (x: Awaited<ReturnType<typeof fixture>>) => ({ ...x.localRef, source_item_id: "altered" })],
  ])("rejects a related offer from %s", async (_label, relatedOffer) => {
    const data = await fixture();
    await expect(saveFeedbackForLine({ sessionId: data.session.sessionId, matchRunId: data.run.id, lineId: data.lineId, expectedSelectionRevision: 0, repositories: appRepositories, feedback: { outcome: "correct_candidate_ranked_low", relatedOfferRef: relatedOffer(data) } })).rejects.toMatchObject({ code: "CANDIDATE_NOT_SELECTABLE" });
  });
});
