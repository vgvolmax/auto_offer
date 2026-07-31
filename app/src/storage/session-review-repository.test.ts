import { beforeEach, describe, expect, it } from "vitest";
import request from "../../../tests/fixtures/matching/golden/D1-single-exact/request.json";
import catalog from "../../../tests/fixtures/matching/golden/shared/catalog-main.json";
import expected from "../../../tests/fixtures/matching/golden/D1-single-exact/expected.json";
import { createCatalogRecord } from "../domain/catalog";
import { createDraftSession } from "../domain/session";
import { buildSessionMatchingPolicy } from "../domain/matching/session-policy";
import { pilotPolicyRegistry } from "../domain/matching/pilot-config";
import { resetDatabaseConnection } from "./database";
import { appRepositories } from "./repositories";
import { createSessionReviewRepository } from "./session-review-repository";

describe("session review repository", () => {
  beforeEach(async () => {
    resetDatabaseConnection();
    await new Promise<void>((resolve) => {
      const deletion = indexedDB.deleteDatabase("auto-offer");
      deletion.onsuccess = () => resolve();
    });
  });

  async function completeReview() {
    const c = createCatalogRecord(catalog as any);
    const session = createDraftSession(request as any, [c], "review");
    await appRepositories.catalogs.save(c);
    await appRepositories.sessions.save(session);
    const result: any = {
      ...expected,
      policy: buildSessionMatchingPolicy({ sessionId: session.sessionId, catalogRecordIds: [c.recordId], settings: session.matchingSettings, policyRegistryVersion: pilotPolicyRegistry.policy_version }),
      catalog_refs: [{ catalog_record_id: c.recordId, catalog_id: c.catalogId, source_sha256: c.sourceSha256 }],
    };
    const run = await appRepositories.matchRuns.saveLatest({ sessionId: session.sessionId, expectedSessionRevision: session.matchingRevision, result });
    let state = (await appRepositories.selectionStates.get(run.id))!;
    const lineId = result.lines[0].line_id;
    state = await appRepositories.selectionStates.saveDecision({ sessionId: session.sessionId, matchRunId: run.id, expectedRevision: state.revision, lineId, decision: { kind: "selected_offer", offerRef: result.lines[0].candidates[0].offer_ref, confirmedAt: "decision-time" } });
    state = await appRepositories.selectionStates.saveFeedback({ sessionId: session.sessionId, matchRunId: run.id, expectedRevision: state.revision, lineId, feedback: { comment: "kept feedback" } });
    return { session, run, state };
  }

  it("confirms idempotently and reopens without changing the run or review", async () => {
    const { session, run, state } = await completeReview();
    const repository = createSessionReviewRepository({ now: () => "2026-07-31T10:00:00.000Z" });
    const confirmed = await repository.confirm({ sessionId: session.sessionId, matchRunId: run.id, expectedSelectionRevision: state.revision });
    expect(confirmed).toMatchObject({ status: "confirmed", updatedAt: "2026-07-31T10:00:00.000Z", confirmation: { matchRunId: run.id, inputFingerprint: run.result.input_fingerprint, matchingRevision: session.matchingRevision, selectionStateRevision: state.revision, lineCount: 1, selectedOfferCount: 1, noOfferCount: 0, feedbackCount: 1, confirmedAt: "2026-07-31T10:00:00.000Z" } });
    expect(await appRepositories.matchRuns.get(run.id)).toEqual(run);
    expect(await appRepositories.selectionStates.get(run.id)).toEqual(state);
    expect(await repository.confirm({ sessionId: session.sessionId, matchRunId: run.id, expectedSelectionRevision: state.revision })).toEqual(confirmed);
    const reopened = await repository.reopen({ sessionId: session.sessionId, expectedConfirmedAt: confirmed.confirmation.confirmedAt });
    expect(reopened).toMatchObject({ status: "draft", latestMatchRunId: run.id, matchingRevision: session.matchingRevision });
    expect("confirmation" in reopened && reopened.confirmation).toBeFalsy();
    expect(await appRepositories.selectionStates.get(run.id)).toEqual(state);
  });

  it("rejects stale confirmation and reopen revisions atomically", async () => {
    const { session, run, state } = await completeReview();
    const repository = createSessionReviewRepository({ now: () => "confirmed-at" });
    await expect(repository.confirm({ sessionId: session.sessionId, matchRunId: run.id, expectedSelectionRevision: state.revision - 1 })).rejects.toMatchObject({ code: "SELECTION_REVISION_CHANGED" });
    expect(await appRepositories.sessions.get(session.sessionId)).toMatchObject({ status: "draft" });
    await repository.confirm({ sessionId: session.sessionId, matchRunId: run.id, expectedSelectionRevision: state.revision });
    await expect(repository.reopen({ sessionId: session.sessionId, expectedConfirmedAt: "stale" })).rejects.toMatchObject({ code: "REVIEW_CONFIRMATION_MISMATCH" });
    expect(await appRepositories.sessions.get(session.sessionId)).toMatchObject({ status: "confirmed" });
  });
});
