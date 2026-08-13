import { canonicalJson } from '../../../matching/runtime/canonical-json.mjs';

const FINGERPRINT_FIELDS = [
  'schema_version', 'taxonomy_version', 'request_id', 'class_ids',
  'selection_policy', 'catalog_refs', 'items',
];

export function projectSemanticMatchingFingerprintInput(value) {
  return Object.fromEntries(FINGERPRINT_FIELDS.map((field) => [field, value[field]]));
}

export async function computeSemanticMatchingFingerprint(value, cryptoApi = globalThis.crypto) {
  if (!cryptoApi?.subtle) throw new Error('Web Crypto subtle API is required');
  const bytes = new TextEncoder().encode(canonicalJson(projectSemanticMatchingFingerprintInput(value)));
  const digest = await cryptoApi.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

