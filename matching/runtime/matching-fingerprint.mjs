import { canonicalJson } from './canonical-json.mjs';

function normalizedCatalogRefs(catalogRefs) {
  return catalogRefs
    .map((reference) => structuredClone(reference))
    .sort((left, right) => canonicalJson(left).localeCompare(canonicalJson(right)));
}

export async function matchingInputFingerprint({
  requestBundle,
  catalogRefs,
  policy,
  policyRegistryVersion,
  engineVersion,
}) {
  const input = {
    request_bundle: requestBundle,
    catalog_refs: normalizedCatalogRefs(catalogRefs),
    matching_policy: policy,
    policy_registry_version: policyRegistryVersion,
    engine_version: engineVersion,
  };
  const bytes = new TextEncoder().encode(canonicalJson(input));
  const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes);

  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}
