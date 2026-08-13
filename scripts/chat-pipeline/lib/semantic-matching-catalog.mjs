import { computeSemanticMatchingFingerprint } from './semantic-matching-fingerprint.mjs';

const clone = (value) => structuredClone(value);
const usableId = (value) => typeof value === 'string' && value.trim().length > 0;

function brandAllowed(identity, brands) {
  const brand = identity?.brand;
  if (!usableId(brand)) return brands.unknown === 'allow';
  if (brands.exclude.includes(brand)) return false;
  return brands.include.length === 0 || brands.include.includes(brand);
}

function validateInputs(requestBundle, catalogs, policy) {
  if (!requestBundle?.request_document || !Array.isArray(requestBundle.request_document.lines)) throw new TypeError('requestBundle.request_document.lines is required');
  if (!Array.isArray(catalogs)) throw new TypeError('catalogs must be an array');
  const recordIds = catalogs.map((catalog) => catalog.recordId);
  if (recordIds.some((id) => !usableId(id)) || new Set(recordIds).size !== recordIds.length) throw new Error('Selected catalog record IDs must be usable and unique');
  if (!policy || !Array.isArray(policy.catalog_priority)) throw new TypeError('selectionPolicy.catalog_priority is required');
  if (!['exact', 'equivalent', 'alternative'].includes(policy.max_match_level)) throw new Error('Invalid max_match_level');
  if (!['exclude', 'manual_only'].includes(policy.catalog_needs_review)) throw new Error('Invalid catalog_needs_review policy');
  if (!policy.brands || !['allow', 'exclude'].includes(policy.brands.unknown) || !['include', 'exclude', 'preferred'].every((key) => Array.isArray(policy.brands[key]))) throw new Error('Invalid brands policy');
  const priority = policy.catalog_priority;
  if (new Set(priority).size !== priority.length || priority.length !== recordIds.length || priority.some((id) => !recordIds.includes(id))) {
    throw new Error('catalog_priority must contain every selected catalog record exactly once');
  }
  for (const catalog of catalogs) {
    if (catalog.bundle?.taxonomy_version !== requestBundle.taxonomy_version) throw new Error(`Taxonomy mismatch for catalog ${catalog.recordId}`);
    if (catalog.bundle?.catalog?.catalog_id !== catalog.catalogId) throw new Error(`Catalog ID mismatch for catalog ${catalog.recordId}`);
    if (!/^[0-9a-f]{64}$/.test(catalog.sourceSha256 ?? '')) throw new Error(`Invalid sourceSha256 for catalog ${catalog.recordId}`);
    if (!Number.isInteger(catalog.semanticRevision) || catalog.semanticRevision < 0) throw new Error(`Invalid semanticRevision for catalog ${catalog.recordId}`);
  }
}

export async function buildSemanticMatchingCatalog({ requestBundle, catalogs, selectionPolicy, cryptoApi }) {
  validateInputs(requestBundle, catalogs, selectionPolicy);
  const classIds = [...new Set(requestBundle.request_document.lines
    .filter((line) => line.annotation?.status !== 'unsupported' && usableId(line.class_id))
    .map((line) => line.class_id))].sort();
  const byId = new Map(catalogs.map((catalog) => [catalog.recordId, catalog]));
  const ordered = selectionPolicy.catalog_priority.map((id) => byId.get(id));
  const items = [];
  const offerRefs = new Set();
  for (const catalog of ordered) {
    for (const entry of catalog.bundle.items ?? []) {
      const item = entry.catalog_item;
      if (!item || !classIds.includes(item.class_id)) continue;
      const status = item.annotation?.status;
      if (status === 'invalid' || status === 'unsupported') continue;
      if (status !== 'validated' && !(status === 'needs_review' && selectionPolicy.catalog_needs_review === 'manual_only')) continue;
      if (!usableId(item.source_item_id)) throw new Error(`Eligible catalog item in ${catalog.recordId} has no usable source_item_id`);
      if (!brandAllowed(item.identity, selectionPolicy.brands)) continue;
      const offerKey = `${catalog.recordId}\0${item.source_item_id}`;
      if (offerRefs.has(offerKey)) throw new Error(`Duplicate offer_ref in catalog ${catalog.recordId}: ${item.source_item_id}`);
      offerRefs.add(offerKey);
      items.push(clone({
        offer_ref: { catalog_record_id: catalog.recordId, source_item_id: item.source_item_id },
        catalog_id: catalog.catalogId, class_id: item.class_id, annotation_status: status,
        source: entry.source, identity: item.identity ?? {}, attributes: item.attributes ?? {}, ports: item.ports ?? [],
      }));
    }
  }
  const catalogRefs = ordered.map((catalog) => ({
    catalog_record_id: catalog.recordId, catalog_id: catalog.catalogId,
    source_sha256: catalog.sourceSha256, semantic_revision: catalog.semanticRevision,
  }));
  const base = clone({
    kind: 'semantic_matching_catalog', schema_version: '1.0.0', taxonomy_version: requestBundle.taxonomy_version,
    request_id: requestBundle.request_document.request_id, class_ids: classIds, selection_policy: selectionPolicy,
    catalog_refs: catalogRefs, items,
  });
  const packageFingerprint = await computeSemanticMatchingFingerprint(base, cryptoApi);
  return {
    ...base, package_fingerprint: packageFingerprint,
    summary: { catalog_count: catalogRefs.length, request_class_count: classIds.length, item_count: items.length },
  };
}

export function isOfferAllowedByBrandPolicy(item, brands) { return brandAllowed(item.identity, brands); }
