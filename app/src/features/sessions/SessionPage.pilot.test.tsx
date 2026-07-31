import { beforeEach, describe, expect, it } from "vitest";
import { createCatalogRecord } from "../../domain/catalog";
import { isMatchRunCurrent } from "../../domain/matching/match-run-current";
import { runSessionMatching, saveSessionMatchingSettings } from "../../domain/matching/run-session-matching";
import { createDraftSession } from "../../domain/session";
import { appRepositories } from "../../storage/repositories";
import { resetDatabaseConnection } from "../../storage/database";
import { createPilotWorkflowFixture } from "../../test/pilot/pilot-fixtures";

async function setup() {
  const fixture = createPilotWorkflowFixture();
  const catalogs = [
    { ...createCatalogRecord(fixture.primaryCatalogBundle), recordId: "pilot-primary-record" },
    { ...createCatalogRecord(fixture.secondaryCatalogBundle), recordId: "pilot-secondary-record" },
  ];
  for (const catalog of catalogs) await appRepositories.catalogs.save(catalog);
  const session = createDraftSession(fixture.requestBundle, catalogs, "Pilot recovery");
  await appRepositories.sessions.save(session);
  const matched = await runSessionMatching({ sessionId: session.sessionId, settings: { ...session.matchingSettings, maxMatchLevel: "exact" }, repositories: appRepositories });
  return { fixture, catalogs, session: matched.session, run: matched.runRecord };
}

beforeEach(async () => {
  resetDatabaseConnection();
  await new Promise<void>((resolve) => { const request = indexedDB.deleteDatabase("auto-offer"); request.onsuccess = () => resolve(); });
});

describe("pilot session recovery", () => {
  it("restores a partially reviewed draft with two pending lines", async () => {
    const { fixture, session, run } = await setup();
    const offerRef = (run.result.lines as any[]).find((line) => line.line_id === fixture.expected.selectedLineId).candidates[0].offer_ref;
    let state = await appRepositories.selectionStates.saveDecision({ sessionId: session.sessionId, matchRunId: run.id, lineId: fixture.expected.selectedLineId, expectedRevision: 0, decision: { kind: "selected_offer", offerRef, confirmedAt: "2026-07-31T00:00:00Z" } });
    state = await appRepositories.selectionStates.saveFeedback({ sessionId: session.sessionId, matchRunId: run.id, lineId: fixture.expected.selectedLineId, expectedRevision: state.revision, feedback: { outcome: "correct_result", comment: "Проверено" } });
    resetDatabaseConnection();
    expect((await appRepositories.sessions.get(session.sessionId))?.status).toBe("draft");
    const restored = await appRepositories.selectionStates.get(run.id);
    expect(Object.keys(restored!.decisions)).toEqual([fixture.expected.selectedLineId]);
    expect(Object.keys(restored!.feedback)).toEqual([fixture.expected.selectedLineId]);
    expect(session.lineCount - Object.keys(restored!.decisions).length).toBe(2);
    await expect(appRepositories.sessionReview.confirm({ sessionId: session.sessionId, matchRunId: run.id, expectedSelectionRevision: restored!.revision })).rejects.toMatchObject({ code: "REVIEW_INCOMPLETE" });
  });

  it("refreshes after a SelectionState conflict and confirms on the second attempt without reload", async () => {
    const { fixture, session, run } = await setup();
    let state = await appRepositories.selectionStates.getOrCreateForRun(run);
    for (const line of run.result.lines as any[]) {
      state = await appRepositories.selectionStates.saveDecision({ sessionId: session.sessionId, matchRunId: run.id, lineId: line.line_id, expectedRevision: state.revision, decision: line.line_id === fixture.expected.noOfferLineId ? { kind: "no_offer", confirmedAt: "2026-07-31" } : { kind: "selected_offer", offerRef: line.candidates[0].offer_ref, confirmedAt: "2026-07-31" } });
    }
    const revisionN = state.revision;
    const external = await appRepositories.selectionStates.saveFeedback({ sessionId: session.sessionId, matchRunId: run.id, lineId: fixture.expected.noOfferLineId, expectedRevision: revisionN, feedback: { outcome: "no_correct_candidate", suspectedCause: "unknown_cause", comment: "Изменено в другой вкладке" } });
    await expect(appRepositories.sessionReview.confirm({ sessionId: session.sessionId, matchRunId: run.id, expectedSelectionRevision: revisionN })).rejects.toMatchObject({ code: "SELECTION_REVISION_CHANGED" });
    const refreshed = await appRepositories.selectionStates.get(run.id);
    expect(refreshed).toEqual(external);
    expect(refreshed!.feedback[fixture.expected.noOfferLineId].comment).toBe("Изменено в другой вкладке");
    const confirmed = await appRepositories.sessionReview.confirm({ sessionId: session.sessionId, matchRunId: run.id, expectedSelectionRevision: refreshed!.revision });
    expect(confirmed.status).toBe("confirmed");
  });

  it("marks a run stale after settings change and creates an empty state for a new run", async () => {
    const { fixture, catalogs, session, run } = await setup();
    const line = (run.result.lines as any[]).find((value) => value.line_id === fixture.expected.selectedLineId);
    const decided = await appRepositories.selectionStates.saveDecision({ sessionId: session.sessionId, matchRunId: run.id, lineId: fixture.expected.selectedLineId, expectedRevision: 0, decision: { kind: "selected_offer", offerRef: line.candidates[0].offer_ref, confirmedAt: "2026-07-31" } });
    const changedSettings = { ...session.matchingSettings, maxMatchLevel: "equivalent" as const };
    const changed = await saveSessionMatchingSettings({ sessionId: session.sessionId, settings: changedSettings, repositories: appRepositories });
    expect(changed.matchingRevision).toBe(session.matchingRevision + 1);
    expect(isMatchRunCurrent({ session: changed, catalogs, run })).toBe(false);
    expect((await appRepositories.selectionStates.get(run.id))?.decisions).toEqual(decided.decisions);
    await expect(appRepositories.selectionStates.saveFeedback({ sessionId: session.sessionId, matchRunId: run.id, lineId: fixture.expected.selectedLineId, expectedRevision: decided.revision, feedback: { comment: "blocked" } })).rejects.toMatchObject({ code: "MATCH_RUN_STALE" });
    const next = await runSessionMatching({ sessionId: session.sessionId, settings: changedSettings, repositories: appRepositories });
    expect(next.runRecord.id).not.toBe(run.id);
    expect(await appRepositories.selectionStates.get(next.runRecord.id)).toMatchObject({ revision: 0, decisions: {}, feedback: {} });
    expect(await appRepositories.selectionStates.get(run.id)).toBeUndefined();
  });
});
