import type { CatalogRecord } from "../catalog";
import type { SessionRecord } from "../session";
import type { MatchRunRecord } from "./match-run";
import { buildSessionMatchingPolicy } from "./session-policy";
import { pilotPolicyRegistry } from "./pilot-config";
import { buildSemanticSelectionPolicy } from "./semantic-session-matching";
const same = (a: unknown, b: unknown) =>
  JSON.stringify(a) === JSON.stringify(b);

type CatalogRefSnapshot = {
  catalog_record_id: string;
  catalog_id: string;
  source_sha256: string;
  catalog_revision?: number;
};

function canonicalizeCatalogRefs(
  refs: readonly CatalogRefSnapshot[],
): CatalogRefSnapshot[] {
  return refs
    .map((ref) => ({ ...ref, catalog_revision: ref.catalog_revision ?? 0 }))
    .sort((left, right) => {
      for (const field of [
        "catalog_record_id",
        "catalog_id",
        "source_sha256",
        "catalog_revision",
      ] as const) {
        if (left[field] < right[field]) return -1;
        if (left[field] > right[field]) return 1;
      }
      return 0;
    });
}
export function isMatchRunCurrent(input: {
  session: SessionRecord;
  catalogs: readonly CatalogRecord[];
  run: MatchRunRecord;
}): boolean {
  const { session, run } = input;
  if (run.runKind === "semantic") {
    const byId = new Map(input.catalogs.map((catalog) => [catalog.recordId, catalog]));
    const prioritized = run.semanticContext.selectionPolicy.catalog_priority.map((id) => byId.get(id));
    if (prioritized.some((catalog) => !catalog)) return false;
    const refs = (prioritized as CatalogRecord[]).map((catalog) => ({
      catalog_record_id: catalog.recordId,
      catalog_id: catalog.catalogId,
      source_sha256: catalog.sourceSha256,
      semantic_revision: catalog.semanticRevision,
    }));
    return run.sessionRevision === session.matchingRevision
      && run.semanticContext.requestId === session.requestId
      && run.semanticContext.taxonomyVersion === session.requestBundle.taxonomy_version
      && same(run.semanticContext.selectionPolicy, buildSemanticSelectionPolicy(session.matchingSettings))
      && same(run.semanticContext.catalogRefs, refs);
  }
  if (
    run.sessionRevision !== session.matchingRevision ||
    run.result.request_id !== session.requestId
  )
    return false;
  const policy = buildSessionMatchingPolicy({
    sessionId: session.sessionId,
    catalogRecordIds: session.catalogRecordIds,
    settings: session.matchingSettings,
    policyRegistryVersion: pilotPolicyRegistry.policy_version,
  });
  if (!same(run.result.policy, policy)) return false;
  const refs = input.catalogs.map((catalog) => ({
    catalog_record_id: catalog.recordId,
    catalog_id: catalog.catalogId,
    source_sha256: catalog.sourceSha256,
    catalog_revision: catalog.semanticRevision ?? 0,
  }));
  return same(
    canonicalizeCatalogRefs(run.result.catalog_refs),
    canonicalizeCatalogRefs(refs),
  );
}
