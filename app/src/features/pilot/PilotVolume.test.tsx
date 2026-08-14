import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { buildAiFeedbackExport } from "../../domain/export/ai-feedback-export";
import { MatchResultsPanel } from "../sessions/results/MatchResultsPanel";
import { MATCH_RESULTS_BATCH_SIZE } from "../sessions/results/useMatchResultReview";
import { catalogsRepository } from "../../storage/catalogs-repository";
import { sessionsRepository } from "../../storage/sessions-repository";
import { getDatabase, resetDatabaseConnection } from "../../storage/database";
import { sessionReviewRepository } from "../../storage/session-review-repository";
import { createPilotVolumeFixture, PILOT_VOLUME_PROFILE } from "../../test/pilot/pilot-volume-fixture";

async function clearDatabase() {
  resetDatabaseConnection();
  await new Promise<void>((resolve, reject) => {
    const request = indexedDB.deleteDatabase("auto-offer");
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

async function persistFixture() {
  const fixture = createPilotVolumeFixture();
  for (const catalog of fixture.catalogs) await catalogsRepository.save(catalog);
  await sessionsRepository.save(fixture.session);
  const db = await getDatabase();
  await db.put("matchRuns", fixture.run);
  await db.put("selectionStates", fixture.selectionState);
  return fixture;
}

beforeEach(clearDatabase);

describe("Pilot 1.0 volume readiness", () => {
  it("confirms and deterministically exports a 500-line review", async () => {
    const fixture = await persistFixture();
    const before = structuredClone(fixture);
    const confirmed = await sessionReviewRepository.confirm({
      sessionId: fixture.session.sessionId,
      matchRunId: fixture.run.id,
      expectedSelectionRevision: fixture.selectionState.revision,
    });
    const input = { session: confirmed, catalogs: fixture.catalogs, run: fixture.run, selectionState: fixture.selectionState, current: true, exportedAt: "2026-07-31T12:00:00.000Z" };
    const first = buildAiFeedbackExport(input);
    const second = buildAiFeedbackExport(input);
    expect(PILOT_VOLUME_PROFILE).toEqual({ requestLines: 500, catalogs: 2, catalogItemsTotal: 2_000, candidatesPerResultLine: 1 });
    expect(confirmed.confirmation).toMatchObject({ lineCount: 500, selectedOfferCount: 375, noOfferCount: 125, feedbackCount: 50 });
    expect(first.operator_review.lines).toHaveLength(500);
    expect(first.operator_review.lines.map((line) => line.line_id)).toEqual(fixture.session.requestBundle.request_document.lines.map((line) => line.line_id));
    expect(second).toEqual(first);
    expect(fixture).toEqual(before);
  });

  it("renders the existing 50-row batch and paginates/filter without mounting 500 rows", async () => {
    const fixture = await persistFixture();
    render(<MatchResultsPanel session={fixture.session} catalogs={fixture.catalogs} run={fixture.run} current locked={false} confirming={false} reopening={false} reviewRefreshing={false} onReviewRefreshingChange={() => undefined} onConfirm={async () => ({ ok: false, code: "REVIEW_INCOMPLETE", message: "not used" })} onReopen={async () => false} onRefreshSessionSnapshot={async () => true} />);
    await screen.findByText(/500 позиций · 375 с предложением · 125 без предложения/);
    const cards = () => document.querySelectorAll("tr[data-proposal-row]");
    expect(cards()).toHaveLength(MATCH_RESULTS_BATCH_SIZE);
    expect(cards().length).toBeLessThan(500);
    await userEvent.click(screen.getByRole("button", { name: "Показать ещё" }));
    expect(cards()).toHaveLength(MATCH_RESULTS_BATCH_SIZE * 2);
    await userEvent.selectOptions(screen.getByLabelText("Фильтр"), "no_offer");
    await waitFor(() => expect(cards()).toHaveLength(MATCH_RESULTS_BATCH_SIZE));
    expect(document.querySelectorAll("tr[data-proposal-row]").length).toBeLessThan(500);
  });

  it("shows Pilot diagnostics only for legacy Pilot runs", async () => {
    const fixture = await persistFixture();
    const input = { session: fixture.session, catalogs: fixture.catalogs, current: true, locked: false, confirming: false, reopening: false, reviewRefreshing: false, onReviewRefreshingChange: () => undefined, onConfirm: async () => ({ ok: false as const, code: "REVIEW_INCOMPLETE" as const, message: "not used" }), onReopen: async () => false, onRefreshSessionSnapshot: async () => true };
    const pilot = render(<MatchResultsPanel {...input} run={fixture.run} />);
    expect(await screen.findByText("Диагностика пилота")).toBeInTheDocument();

    pilot.unmount();
    const semanticRun = {
      ...fixture.run,
      runKind: "semantic" as const,
      result: {
        kind: "semantic_match_result" as const,
        schema_version: "1.0.0" as const,
        taxonomy_version: "test",
        request_id: fixture.session.requestBundle.request_document.request_id,
        package_fingerprint: fixture.selectionState.inputFingerprint,
        lines: fixture.session.requestBundle.request_document.lines.map((line) => ({
          line_id: line.line_id,
          decision: "no_offer" as const,
          reason_code: "NO_ELIGIBLE_OFFER" as const,
          rationale_ru: "Нет предложения",
        })),
      },
      semanticContext: {
        taxonomyVersion: "test",
        requestId: fixture.session.requestBundle.request_document.request_id,
        packageFingerprint: fixture.selectionState.inputFingerprint,
        selectionPolicy: {} as never,
        catalogRefs: [],
      },
    };
    render(<MatchResultsPanel {...input} run={semanticRun} />);
    await screen.findByText(/500 позиций/);
    expect(screen.queryByText("Диагностика пилота")).not.toBeInTheDocument();
  });
});
