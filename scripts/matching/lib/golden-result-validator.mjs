import { canonicalJson } from '../../../matching/runtime/canonical-json.mjs';
import { catalogReferences } from './golden-scenario-loader.mjs';
import { matchingInputFingerprint } from '../../../matching/runtime/matching-fingerprint.mjs';

function offerKey(reference) {
  return [reference.catalog_record_id, reference.catalog_id, reference.source_sha256, reference.source_item_id].join('\u0000');
}

export async function expectedFingerprint(loaded) {
  return matchingInputFingerprint({
    requestBundle: loaded.request,
    catalogRefs: catalogReferences(loaded.catalogs),
    policy: loaded.policy,
    policyRegistryVersion: loaded.expected.policy_registry_version,
    engineVersion: loaded.expected.engine_version,
  });
}

export async function validateGoldenResult(loaded) {
  const { scenario, catalogs, request, expected } = loaded;
  const prefix = `scenario ${scenario.scenario_id}`;
  const errors = [];
  const actualCatalogRefs = catalogReferences(catalogs);
  const allowedCatalogRefs = new Set(actualCatalogRefs.map(canonicalJson));
  const seenCatalogRefs = new Set();

  for (const reference of expected.catalog_refs) {
    const key = canonicalJson(reference);
    if (!allowedCatalogRefs.has(key)) {
      errors.push(`${prefix}: unknown catalog reference ${key}`);
    }
    if (seenCatalogRefs.has(key)) {
      errors.push(`${prefix}: duplicate catalog reference ${key}`);
    }
    seenCatalogRefs.add(key);
  }
  for (const reference of actualCatalogRefs) {
    if (!seenCatalogRefs.has(canonicalJson(reference))) {
      errors.push(`${prefix}: missing catalog reference ${canonicalJson(reference)}`);
    }
  }

  const offers = new Set();
  for (const { input, bundle } of catalogs) {
    for (const item of bundle.items) {
      offers.add(offerKey({
        catalog_record_id: input.catalog_record_id,
        catalog_id: bundle.catalog.catalog_id,
        source_sha256: bundle.catalog.source_sha256,
        source_item_id: item.catalog_item.source_item_id,
      }));
    }
  }

  const requestLineIds = new Set(request.request_document.lines.map((line) => line.line_id));
  const resultLineIds = new Set();
  for (const line of expected.lines) {
    if (!requestLineIds.has(line.line_id)) {
      errors.push(`${prefix}: unknown request line ${JSON.stringify(line.line_id)}`);
    }
    if (resultLineIds.has(line.line_id)) {
      errors.push(`${prefix}: duplicate result line ${JSON.stringify(line.line_id)}`);
    }
    resultLineIds.add(line.line_id);

    for (const candidate of [...line.candidates, ...line.excluded_candidates]) {
      if (!offers.has(offerKey(candidate.offer_ref))) {
        errors.push(`${prefix}: unknown offer reference ${JSON.stringify(candidate.offer_ref)}`);
      }
    }
  }
  for (const lineId of requestLineIds) {
    if (!resultLineIds.has(lineId)) {
      errors.push(`${prefix}: missing result line ${JSON.stringify(lineId)}`);
    }
  }

  if (expected.summary.lines !== undefined && expected.summary.lines !== expected.lines.length) {
    errors.push(`${prefix}: summary lines is ${expected.summary.lines}, expected ${expected.lines.length}`);
  }
  const resolutionCounts = Object.create(null);
  for (const line of expected.lines) {
    resolutionCounts[line.resolution] = (resolutionCounts[line.resolution] ?? 0) + 1;
  }
  for (const [name, count] of Object.entries(expected.summary)) {
    if (name === 'lines') continue;
    const expectedCount = resolutionCounts[name] ?? 0;
    if (count !== expectedCount) {
      errors.push(`${prefix}: summary ${name} is ${count}, expected ${expectedCount}`);
    }
  }

  const fingerprint = await expectedFingerprint(loaded);
  if (expected.input_fingerprint !== fingerprint) {
    errors.push(`${prefix}: input fingerprint mismatch: expected ${fingerprint}, found ${expected.input_fingerprint}`);
  }
  return errors;
}
