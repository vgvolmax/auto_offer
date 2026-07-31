import type { CatalogRecord } from "../catalog";
import type { SessionRecord } from "../session";
import type { MatchRunRecord } from "./match-run";
import { buildSessionMatchingPolicy } from "./session-policy";
import { pilotPolicyRegistry } from "./pilot-config";
const same = (a: unknown, b: unknown) =>
  JSON.stringify(a) === JSON.stringify(b);

type CatalogRefSnapshot = {
  catalog_record_id: string;
  catalog_id: string;
  source_sha256: string;
};

function canonicalizeCatalogRefs(
  refs: readonly CatalogRefSnapshot[],
): CatalogRefSnapshot[] {
  return refs
    .map((ref) => ({ ...ref }))
    .sort((left, right) => {
      for (const field of [
        "catalog_record_id",
        "catalog_id",
        "source_sha256",
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
  }));
  return same(
    canonicalizeCatalogRefs(run.result.catalog_refs),
    canonicalizeCatalogRefs(refs),
  );
}
