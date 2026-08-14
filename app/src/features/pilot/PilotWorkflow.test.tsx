import { beforeEach, describe, expect, it } from "vitest";
import { createCatalogRecord } from "../../domain/catalog";
import { buildAiFeedbackExport } from "../../domain/export/ai-feedback-export";
import { saveFeedbackForLine } from "../../domain/matching/update-line-feedback";
import { markNoOfferForLine, selectOfferForLine } from "../../domain/matching/update-selection";
import { runSessionMatching } from "../../domain/matching/run-session-matching";
import { createDraftSession } from "../../domain/session";
import { appRepositories } from "../../storage/repositories";
import { resetDatabaseConnection } from "../../storage/database";
import { createPilotWorkflowFixture } from "../../test/pilot/pilot-fixtures";
import { serializeAiFeedback } from "../sessions/results/download-ai-feedback";

beforeEach(async () => {
  resetDatabaseConnection();
  await new Promise<void>((resolve) => { const request = indexedDB.deleteDatabase("auto-offer"); request.onsuccess = () => resolve(); });
});

describe("complete pilot workflow", () => {
  it("persists matching, review, feedback, confirmation, export, reload and reopen", async () => {
    const fixture = createPilotWorkflowFixture();
    const primary = { ...createCatalogRecord(fixture.primaryCatalogBundle), recordId: "pilot-primary-record" };
    const secondary = { ...createCatalogRecord(fixture.secondaryCatalogBundle), recordId: "pilot-secondary-record" };
    await appRepositories.catalogs.save(primary);
    await appRepositories.catalogs.save(secondary);
    const draft = createDraftSession(fixture.requestBundle, [primary, secondary], "Pilot workflow");
    await appRepositories.sessions.save(draft);
    const settings = { ...draft.matchingSettings, maxMatchLevel: "exact" as const, catalogPriority: [secondary.recordId, primary.recordId] };
    const matched = await runSessionMatching({ sessionId: draft.sessionId, settings, repositories: appRepositories });
    const line = (id: string) => (matched.runRecord.result.lines as any[]).find((value) => value.line_id === id);
    expect(line(fixture.expected.rankedLineId).candidates[0].offer_ref).toEqual(fixture.expected.rankedCorrectOfferRef);
    let state = await selectOfferForLine({ sessionId: draft.sessionId, matchRunId: matched.runRecord.id, lineId: fixture.expected.selectedLineId, offerRef: line(fixture.expected.selectedLineId).candidates[0].offer_ref, expectedSelectionRevision: 0, repositories: appRepositories });
    state = await selectOfferForLine({ sessionId: draft.sessionId, matchRunId: matched.runRecord.id, lineId: fixture.expected.rankedLineId, offerRef: fixture.expected.rankedCorrectOfferRef, expectedSelectionRevision: state.revision, repositories: appRepositories });
    state = await markNoOfferForLine({ sessionId: draft.sessionId, matchRunId: matched.runRecord.id, lineId: fixture.expected.noOfferLineId, expectedSelectionRevision: state.revision, repositories: appRepositories });
    state = await saveFeedbackForLine({ sessionId: draft.sessionId, matchRunId: matched.runRecord.id, lineId: fixture.expected.rankedLineId, expectedSelectionRevision: state.revision, repositories: appRepositories, feedback: { outcome: "correct_candidate_ranked_low", relatedOfferRef: fixture.expected.rankedCorrectOfferRef, comment: "Корректный товар был ниже в списке" } });
    state = await saveFeedbackForLine({ sessionId: draft.sessionId, matchRunId: matched.runRecord.id, lineId: fixture.expected.noOfferLineId, expectedSelectionRevision: state.revision, repositories: appRepositories, feedback: { outcome: "no_correct_candidate", suspectedCause: "unknown_cause", comment: "Подходящего товара в каталогах нет" } });
    expect(state).toMatchObject({ revision: 5, decisions: { [fixture.expected.selectedLineId]: { kind: "selected_offer" }, [fixture.expected.rankedLineId]: { kind: "selected_offer" }, [fixture.expected.noOfferLineId]: { kind: "no_offer" } } });
    expect(state.feedback[fixture.expected.rankedLineId].relatedOfferRef).toEqual(fixture.expected.rankedCorrectOfferRef);
    const confirmed = await appRepositories.sessionReview.confirm({ sessionId: draft.sessionId, matchRunId: matched.runRecord.id, expectedSelectionRevision: state.revision });
    expect(confirmed.confirmation).toMatchObject({ lineCount: 3, selectedOfferCount: 2, noOfferCount: 1, feedbackCount: 2, selectionStateRevision: 5 });
    const exportedAt = "2026-07-31T12:00:00.000Z";
    const first = buildAiFeedbackExport({ session: confirmed, catalogs: [primary, secondary], run: matched.runRecord, selectionState: state, current: true, exportedAt });
    expect(JSON.parse(serializeAiFeedback(first))).toMatchObject({ schema_version: "1.2.0", export_type: "auto_offer_ai_feedback", session: { name: "Pilot workflow", status: "confirmed", confirmation: expect.any(Object) }, operator_review: { decided_count: 3, selected_offer_count: 2, no_offer_count: 1, feedback_count: 2 } });
    resetDatabaseConnection();
    const restored = await appRepositories.sessions.get(draft.sessionId);
    const restoredState = await appRepositories.selectionStates.get(matched.runRecord.id);
    expect(restored).toEqual(confirmed);
    expect(restoredState).toEqual(state);
    const second = buildAiFeedbackExport({ session: restored!, catalogs: [primary, secondary], run: matched.runRecord, selectionState: restoredState!, current: true, exportedAt });
    expect(second).toEqual(first);
    const reopened = await appRepositories.sessionReview.reopen({ sessionId: draft.sessionId, expectedConfirmedAt: confirmed.confirmation.confirmedAt });
    expect(reopened.status).toBe("draft");
    expect(await appRepositories.selectionStates.get(matched.runRecord.id)).toEqual(state);
    expect(await appRepositories.matchRuns.get(matched.runRecord.id)).toEqual(matched.runRecord);
  });
});
