import { readFile } from 'node:fs/promises';
import { loadBundleValidationContext } from '../../bundles/lib/bundle-schema-loader.mjs';

const CATALOG_ID = 'https://example.local/schemas/chat-pipeline/semantic-matching-catalog.schema.json';
const RESULT_ID = 'https://example.local/schemas/chat-pipeline/semantic-match-result.schema.json';

export async function loadSemanticMatchingValidators() {
  const context = await loadBundleValidationContext();
  for (const [file, id] of [['semantic-matching-catalog.schema.json', CATALOG_ID], ['semantic-match-result.schema.json', RESULT_ID]]) {
    if (!context.ajv.getSchema(id)) context.ajv.addSchema(JSON.parse(await readFile(new URL(`../../../schemas/chat-pipeline/${file}`, import.meta.url), 'utf8')));
  }
  return { requestBundle: context.requestBundleValidator, matchingCatalog: context.ajv.getSchema(CATALOG_ID), result: context.ajv.getSchema(RESULT_ID) };
}

export { buildSemanticMatchingCatalog } from './semantic-matching-catalog.mjs';
export { computeSemanticMatchingFingerprint, projectSemanticMatchingFingerprintInput } from './semantic-matching-fingerprint.mjs';
export { validateSemanticMatchResultObjects } from './semantic-match-result-core.mjs';
