import { matchRunFingerprint } from "../matching/match-run";
import type { CatalogRecord } from "../catalog";
import { AI_FEEDBACK_EXPORT_SCHEMA_VERSION } from "../export/ai-feedback-export";
import { PILOT_MATCHING_ENGINE_VERSION, pilotPolicyRegistry } from "../matching/pilot-config";
import { SELECTION_STATE_SCHEMA_VERSION, type SelectionStateRecord } from "../matching/selection-state";
import { SESSION_CONFIRMATION_SCHEMA_VERSION, type SessionRecord } from "../session";
import type { MatchRunRecord } from "../matching/match-run";
import { DATABASE_NAME, DATABASE_VERSION } from "../../storage/database";

export const PILOT_RELEASE_ID = "auto-offer-pilot-1.0.0" as const;

export interface PilotRuntimeInfo {
  pilotReleaseId: typeof PILOT_RELEASE_ID;
  taxonomy: {
    requestVersion: string;
    catalogVersions: Array<{ recordId: string; catalogId: string; taxonomyVersion: string }>;
    consistent: boolean;
  };
  matcher: { engineVersion: string; policyVersion: string };
  contracts: { selectionStateSchemaVersion: string; sessionConfirmationSchemaVersion: string; aiFeedbackExportSchemaVersion: string };
  storage: { databaseName: string; databaseVersion: number };
  session: {
    sessionId: string; status: "draft" | "confirmed"; matchingRevision: number;
    latestMatchRunId: string | null; current: boolean; inputFingerprint?: string;
    selectionStateRevision?: number;
  };
}

/** Builds a serializable, read-only description of the exact pilot snapshot. */
export function buildPilotRuntimeInfo(input: {
  session: SessionRecord; catalogs: readonly CatalogRecord[]; run?: MatchRunRecord;
  selectionState?: SelectionStateRecord; current: boolean;
}): PilotRuntimeInfo {
  const byId = new Map(input.catalogs.map((catalog) => [catalog.recordId, catalog]));
  const refs = new Map(input.session.catalogRefs.map((ref) => [ref.recordId, ref]));
  const catalogVersions = input.session.catalogRecordIds.map((recordId) => {
    const catalog = byId.get(recordId);
    return catalog
      ? { recordId, catalogId: catalog.catalogId, taxonomyVersion: catalog.taxonomyVersion }
      : { recordId, catalogId: refs.get(recordId)?.catalogId ?? "(неизвестен)", taxonomyVersion: "(catalog record отсутствует)" };
  });
  const requestVersion = input.session.requestBundle.taxonomy_version;
  return {
    pilotReleaseId: PILOT_RELEASE_ID,
    taxonomy: {
      requestVersion,
      catalogVersions,
      consistent: catalogVersions.length === input.session.catalogRecordIds.length &&
        catalogVersions.every(({ taxonomyVersion }) => taxonomyVersion === requestVersion),
    },
    matcher: { engineVersion: PILOT_MATCHING_ENGINE_VERSION, policyVersion: pilotPolicyRegistry.policy_version },
    contracts: {
      selectionStateSchemaVersion: SELECTION_STATE_SCHEMA_VERSION,
      sessionConfirmationSchemaVersion: SESSION_CONFIRMATION_SCHEMA_VERSION,
      aiFeedbackExportSchemaVersion: AI_FEEDBACK_EXPORT_SCHEMA_VERSION,
    },
    storage: { databaseName: DATABASE_NAME, databaseVersion: DATABASE_VERSION },
    session: {
      sessionId: input.session.sessionId, status: input.session.status,
      matchingRevision: input.session.matchingRevision, latestMatchRunId: input.session.latestMatchRunId,
      current: input.current,
      ...(input.run && { inputFingerprint: matchRunFingerprint(input.run) }),
      ...(input.selectionState && { selectionStateRevision: input.selectionState.revision }),
    },
  };
}
