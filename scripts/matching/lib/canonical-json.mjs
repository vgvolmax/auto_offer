import { createHash } from 'node:crypto';
function normalize(value) {
  if (Array.isArray(value)) return value.map(normalize);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map(key => [key, normalize(value[key])]));
  if (typeof value === 'number' && !Number.isFinite(value)) throw new TypeError('Canonical JSON only supports finite numbers');
  return value;
}
export const canonicalJson = value => JSON.stringify(normalize(value));
export function matchingInputFingerprint({ requestBundle, catalogRefs, policy, policyRegistryVersion, engineVersion }) {
  const refs = [...catalogRefs].sort((a,b) => canonicalJson(a).localeCompare(canonicalJson(b)));
  return createHash('sha256').update(canonicalJson({request_bundle:requestBundle,catalog_refs:refs,matching_policy:policy,policy_registry_version:policyRegistryVersion,engine_version:engineVersion})).digest('hex');
}
