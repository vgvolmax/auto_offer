export class MatchingInputError extends Error {
  constructor(code, path, message) {
    super(`${code} at ${path}: ${message}`);
    this.name = 'MatchingInputError';
    this.code = code;
    this.path = path;
  }
}

function fail(code, path, message) {
  throw new MatchingInputError(code, path, message);
}

export function validateInput({ requestBundle, catalogs, policy, registry, engineVersion }) {
  if (engineVersion !== 'pilot-1.0.0') fail('UNSUPPORTED_ENGINE_VERSION', '/engineVersion', 'only pilot-1.0.0 is supported');
  if (policy.policy_registry_version !== registry.policy_version) fail('POLICY_REGISTRY_VERSION_MISMATCH', '/policy/policy_registry_version', 'policy and registry versions differ');

  const taxonomyVersion = requestBundle.taxonomy_version;
  const catalogIds = new Set();
  for (const [catalogIndex, catalog] of catalogs.entries()) {
    if (catalogIds.has(catalog.catalogRecordId)) fail('DUPLICATE_CATALOG_RECORD_ID', `/catalogs/${catalogIndex}/catalogRecordId`, 'catalogRecordId must be unique');
    catalogIds.add(catalog.catalogRecordId);
    if (catalog.bundle.taxonomy_version !== taxonomyVersion) fail('TAXONOMY_VERSION_MISMATCH', `/catalogs/${catalogIndex}/bundle/taxonomy_version`, 'request and catalog taxonomy versions differ');

    const itemIds = new Set();
    for (const [itemIndex, offer] of catalog.bundle.items.entries()) {
      const itemId = offer.catalog_item.source_item_id;
      if (itemIds.has(itemId)) fail('DUPLICATE_SOURCE_ITEM_ID', `/catalogs/${catalogIndex}/bundle/items/${itemIndex}`, 'source_item_id must be unique within a catalog');
      itemIds.add(itemId);
    }
  }
  for (const [index, id] of policy.catalog_record_ids.entries()) {
    if (!catalogIds.has(id)) fail('UNKNOWN_CATALOG_RECORD_ID', `/policy/catalog_record_ids/${index}`, `selected catalog ${JSON.stringify(id)} does not exist`);
  }
  for (const [index, id] of policy.catalog_priority.entries()) {
    if (!policy.catalog_record_ids.includes(id)) fail('INVALID_CATALOG_PRIORITY', `/policy/catalog_priority/${index}`, `priority catalog ${JSON.stringify(id)} is not selected`);
  }

  const document = requestBundle.request_document;
  if (!document?.request_id) fail('REQUEST_ID_MISSING', '/requestBundle/request_document/request_id', 'request_id is required');
  const lineIds = new Set();
  for (const [lineIndex, line] of document.lines.entries()) {
    if (lineIds.has(line.line_id)) fail('DUPLICATE_LINE_ID', `/requestBundle/request_document/lines/${lineIndex}/line_id`, 'line_id must be unique');
    lineIds.add(line.line_id);
  }
}
