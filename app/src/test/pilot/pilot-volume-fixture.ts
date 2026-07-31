import golden from "../../../../tests/fixtures/matching/golden/D1-single-exact/expected.json";
import { createCatalogRecord, type CatalogRecord } from "../../domain/catalog";
import { buildSessionMatchingPolicy } from "../../domain/matching/session-policy";
import type { MatchRunRecord } from "../../domain/matching/match-run";
import { createSelectionState, type SelectionStateRecord } from "../../domain/matching/selection-state";
import { pilotPolicyRegistry } from "../../domain/matching/pilot-config";
import { createDraftSession, type SessionRecord } from "../../domain/session";
import { createPilotWorkflowFixture } from "./pilot-fixtures";

export const PILOT_VOLUME_PROFILE = {
  requestLines: 500,
  catalogs: 2,
  catalogItemsTotal: 2_000,
  candidatesPerResultLine: 1,
} as const;

export interface PilotVolumeFixture {
  catalogs: CatalogRecord[];
  session: SessionRecord;
  run: MatchRunRecord;
  selectionState: SelectionStateRecord;
  selectedCount: number;
  noOfferCount: number;
  feedbackCount: number;
}

export function createPilotVolumeFixture(): PilotVolumeFixture {
  const base = createPilotWorkflowFixture();
  const bundles = [base.primaryCatalogBundle, base.secondaryCatalogBundle].map((source, catalogIndex) => {
    const bundle = structuredClone(source) as any;
    bundle.items = Array.from({ length: 1_000 }, (_, itemIndex) => {
      const item = structuredClone(source.items[0]) as any;
      item.catalog_item.source_item_id = `volume-${catalogIndex}-${itemIndex}`;
      item.source.supplier_sku = `V-${catalogIndex}-${itemIndex}`;
      return item;
    });
    bundle.catalog.item_count = bundle.items.length;
    return bundle;
  });
  const records = bundles.map((bundle, index) => ({
    ...createCatalogRecord(bundle, 0, "2026-07-31T00:00:00.000Z"),
    recordId: `volume-catalog-${index}`,
  }));
  const request = structuredClone(base.requestBundle) as any;
  const lineTemplate = request.request_document.lines[0];
  request.source.line_count = PILOT_VOLUME_PROFILE.requestLines;
  request.request_document.request_id = "pilot-volume-request";
  request.request_document.lines = Array.from({ length: PILOT_VOLUME_PROFILE.requestLines }, (_, index) => ({
    ...structuredClone(lineTemplate),
    line_id: `volume-line-${String(index).padStart(3, "0")}`,
    raw_text: `Строка объёмного пилота ${index}`,
  }));
  const session = {
    ...createDraftSession(request, records, "Pilot volume", "", "2026-07-31T00:00:00.000Z"),
    sessionId: "pilot-volume-session",
  };
  const policy = buildSessionMatchingPolicy({
    sessionId: session.sessionId,
    catalogRecordIds: session.catalogRecordIds,
    settings: session.matchingSettings,
    policyRegistryVersion: pilotPolicyRegistry.policy_version,
  });
  const candidate = structuredClone((golden as any).lines[0].candidates[0]);
  candidate.offer_ref = {
    catalog_record_id: records[0].recordId,
    catalog_id: records[0].catalogId,
    source_sha256: records[0].sourceSha256,
    source_item_id: "volume-0-0",
  };
  const run: MatchRunRecord = {
    id: "pilot-volume-run",
    sessionId: session.sessionId,
    sessionRevision: 0,
    createdAt: "2026-07-31T00:00:01.000Z",
    result: {
      ...(structuredClone(golden) as any),
      request_id: session.requestId,
      input_fingerprint: "d".repeat(64),
      policy,
      catalog_refs: records.map((record) => ({ catalog_record_id: record.recordId, catalog_id: record.catalogId, source_sha256: record.sourceSha256 })),
      lines: request.request_document.lines.map((line: any) => ({
        line_id: line.line_id,
        resolution: "single_exact",
        candidates: [structuredClone(candidate)],
        excluded_candidates: [],
        rejection_summary: [],
      })),
      summary: { lines: PILOT_VOLUME_PROFILE.requestLines },
    } as any,
  };
  const linked: SessionRecord = { ...session, latestMatchRunId: run.id };
  const selectionState = createSelectionState(run, "2026-07-31T00:00:02.000Z");
  request.request_document.lines.forEach((line: any, index: number) => {
    selectionState.decisions[line.line_id] = index % 4 === 0
      ? { kind: "no_offer", confirmedAt: "2026-07-31T00:00:03.000Z" }
      : { kind: "selected_offer", offerRef: structuredClone(candidate.offer_ref), confirmedAt: "2026-07-31T00:00:03.000Z" };
    if (index % 10 === 0) selectionState.feedback[line.line_id] = {
      outcome: "no_correct_candidate",
      suspectedCause: "unknown_cause",
      comment: `Volume feedback ${index}`,
    };
  });
  selectionState.revision = PILOT_VOLUME_PROFILE.requestLines + 50;
  selectionState.updatedAt = "2026-07-31T00:00:03.000Z";
  return { catalogs: records, session: linked, run, selectionState, selectedCount: 375, noOfferCount: 125, feedbackCount: 50 };
}
