import { computeSemanticMatchingFingerprint } from './semantic-matching-fingerprint.mjs';
import { isOfferAllowedByBrandPolicy } from './semantic-matching-catalog.mjs';

const LEVEL = { exact: 0, equivalent: 1, alternative: 2 };
const STATUS_DECISIONS = {
  validated: new Set(['offer', 'no_offer', 'reroute_required']), needs_review: new Set(['offer', 'no_offer', 'reroute_required']),
  invalid: new Set(['request_invalid']), unsupported: new Set(['request_unsupported']),
};
const error = (code, message, path = '') => ({ code, path, message });

const escapeJsonPointerToken = (value) => String(value).replaceAll('~', '~0').replaceAll('/', '~1');
const normalizeSchemaError = (name, detail) => {
  let path = detail.instancePath ?? '';
  let description = detail.message ?? 'does not match the schema';
  if (detail.keyword === 'additionalProperties' && detail.params?.additionalProperty !== undefined) {
    path += `/${escapeJsonPointerToken(detail.params.additionalProperty)}`;
    description = 'additional property is not allowed';
  } else if (detail.keyword === 'required' && detail.params?.missingProperty !== undefined) {
    path += `/${escapeJsonPointerToken(detail.params.missingProperty)}`;
    description = 'required property is missing';
  }
  return error('SCHEMA_INVALID', `${name}: ${description}`, path);
};

export async function validateSemanticMatchResultObjects({ result, requestBundle, matchingCatalog, validators = {}, cryptoApi }) {
  const errors = [];
  for (const [name, value] of [['requestBundle', requestBundle], ['matchingCatalog', matchingCatalog], ['result', result]]) {
    const validate = validators[name];
    if (validate && !validate(value)) errors.push(...(validate.errors ?? []).map((detail) => normalizeSchemaError(name, detail)));
  }
  if (errors.length) return { valid: false, errors };
  const requestId = requestBundle?.request_document?.request_id;
  const taxonomy = requestBundle?.taxonomy_version;
  if (result.taxonomy_version !== taxonomy || matchingCatalog.taxonomy_version !== taxonomy) errors.push(error('TAXONOMY_MISMATCH', 'Taxonomy versions must match exactly'));
  if (result.request_id !== requestId || matchingCatalog.request_id !== requestId) errors.push(error('REQUEST_ID_MISMATCH', 'Request IDs must match exactly'));
  if (result.package_fingerprint !== matchingCatalog.package_fingerprint) errors.push(error('FINGERPRINT_MISMATCH', 'Result fingerprint does not match package'));
  const computed = await computeSemanticMatchingFingerprint({ requestBundle, matchingCatalog }, cryptoApi);
  if (computed !== matchingCatalog.package_fingerprint) errors.push(error('PACKAGE_TAMPERED', 'Matching package fingerprint does not match the supplied request bundle and package content'));

  const requestLines = requestBundle.request_document.lines;
  if (result.lines.length !== requestLines.length) errors.push(error('LINE_COUNT_MISMATCH', 'Result must cover every request line exactly once', '/lines'));
  const seenLines = new Set();
  const offerMap = new Map();
  for (const item of matchingCatalog.items) {
    const key = `${item.offer_ref.catalog_record_id}\0${item.offer_ref.source_item_id}`;
    if (offerMap.has(key)) offerMap.set(key, null); else offerMap.set(key, item);
  }
  const catalogIds = new Set(matchingCatalog.catalog_refs.map((ref) => ref.catalog_record_id));
  result.lines.forEach((line, index) => {
    const requestLine = requestLines[index];
    if (seenLines.has(line.line_id)) errors.push(error('DUPLICATE_LINE', `Duplicate line_id ${line.line_id}`, `/lines/${index}`));
    seenLines.add(line.line_id);
    if (!requestLine || line.line_id !== requestLine.line_id) errors.push(error('LINE_ORDER_MISMATCH', `Line ${index} does not match request order`, `/lines/${index}/line_id`));
    if (!requestLine) return;
    const allowed = STATUS_DECISIONS[requestLine.annotation?.status];
    if (!allowed?.has(line.decision)) errors.push(error('REQUEST_STATUS_MISMATCH', `Decision ${line.decision} is not allowed for ${requestLine.annotation?.status}`, `/lines/${index}/decision`));
    if (line.decision !== 'offer') return;
    const key = `${line.offer_ref.catalog_record_id}\0${line.offer_ref.source_item_id}`;
    const item = offerMap.get(key);
    if (!item) errors.push(error('UNKNOWN_OR_AMBIGUOUS_OFFER', 'offer_ref must identify exactly one packaged item', `/lines/${index}/offer_ref`));
    if (!catalogIds.has(line.offer_ref.catalog_record_id)) errors.push(error('UNKNOWN_CATALOG', 'Offer catalog is not in package', `/lines/${index}/offer_ref/catalog_record_id`));
    if (item?.class_id !== requestLine.class_id) errors.push(error('CLASS_MISMATCH', 'Offer class must exactly match request class', `/lines/${index}/offer_ref`));
    if (LEVEL[line.match_level] > LEVEL[matchingCatalog.selection_policy.max_match_level]) errors.push(error('MATCH_LEVEL_EXCEEDED', 'Offer exceeds max_match_level', `/lines/${index}/match_level`));
    if (item && !['validated', 'needs_review'].includes(item.annotation_status)) errors.push(error('INELIGIBLE_ANNOTATION_STATUS', 'Offer annotation status is not eligible', `/lines/${index}/offer_ref`));
    const catalogRef = matchingCatalog.catalog_refs.find((ref) => ref.catalog_record_id === line.offer_ref.catalog_record_id);
    if (item && catalogRef?.catalog_id !== item.catalog_id) errors.push(error('CATALOG_ID_MISMATCH', 'Packaged item catalog_id does not match its catalog reference', `/lines/${index}/offer_ref`));
    if (item && !isOfferAllowedByBrandPolicy(item, matchingCatalog.selection_policy.brands)) errors.push(error('BRAND_POLICY_VIOLATION', 'Offer violates hard brand policy', `/lines/${index}/offer_ref`));
  });
  const counts = Object.fromEntries(['offer', 'no_offer', 'reroute_required'].map((decision) => [decision, result.lines.filter((line) => line.decision === decision).length]));
  return errors.length ? { valid: false, errors } : { valid: true, line_count: result.lines.length, offer_count: counts.offer, no_offer_count: counts.no_offer, reroute_count: counts.reroute_required };
}
