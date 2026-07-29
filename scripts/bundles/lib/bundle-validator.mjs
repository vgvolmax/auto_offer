import { validateAnnotation } from '../../lib/annotation-contract-validator.mjs';

const structural = validator => (validator.errors ?? []).map(error => ({ code: 'BUNDLE_SCHEMA_INVALID', path: error.instancePath || '/', message: error.message, details: { keyword: error.keyword, schema_path: error.schemaPath, params: error.params } }));
const prefixed = (prefix, issue) => ({ ...issue, path: `${prefix}${issue.path === '/' ? '' : issue.path}` || '/' });
const sort = errors => errors.sort((a, b) => a.path.localeCompare(b.path) || a.code.localeCompare(b.code) || a.message.localeCompare(b.message));
const mismatch = (path, message, details) => ({ code: 'TAXONOMY_VERSION_MISMATCH', path, message, ...(details ? { details } : {}) });
const finish = (kind, errors, summary) => ({ valid: errors.length === 0, kind, errors: sort(errors), summary });
const isObject = value => value !== null && typeof value === 'object' && !Array.isArray(value);

export function validateCatalogBundle(bundle, context) {
  const errors = []; if (!context.catalogBundleValidator(bundle)) errors.push(...structural(context.catalogBundleValidator));
  const production = context.taxonomy.taxonomy_version; const root = bundle?.taxonomy_version;
  if (root !== production) errors.push(mismatch('/taxonomy_version', 'Bundle taxonomy version does not match production taxonomy', { expected: production, actual: root }));
  const items = Array.isArray(bundle?.items) ? bundle.items : [];
  if (typeof bundle?.catalog?.item_count === 'number' && bundle.catalog.item_count !== items.length) errors.push({ code: 'ITEM_COUNT_MISMATCH', path: '/catalog/item_count', message: 'Declared item count does not match items length', details: { declared: bundle.catalog.item_count, actual: items.length } });
  const seen = new Map();
  items.forEach((entry, index) => { const item = entry?.catalog_item; if (!item || typeof item !== 'object') return;
    if (item.taxonomy_version !== root || item.taxonomy_version !== production) errors.push(mismatch(`/items/${index}/catalog_item/taxonomy_version`, 'Catalog item taxonomy version does not match bundle and production taxonomy'));
    if (typeof item.source_item_id === 'string') { if (seen.has(item.source_item_id)) errors.push({ code: 'DUPLICATE_SOURCE_ITEM_ID', path: `/items/${index}/catalog_item/source_item_id`, message: 'source_item_id must be unique', details: { value: item.source_item_id, first_index: seen.get(item.source_item_id), duplicate_index: index } }); else seen.set(item.source_item_id, index); }
    if (isObject(item) && context.catalogItemValidator(item)) {
      const result = validateAnnotation({ kind: 'catalog_item', data: item, taxonomy: context.taxonomy, registry: context.registry, schemas: context.classSchemas });
      errors.push(...result.issues.map(issue => prefixed(`/items/${index}/catalog_item`, issue)));
    }
  });
  return finish('catalog_bundle', errors, { records: items.length, taxonomy_version: root });
}

export function validateRequestBundle(bundle, context) {
  const errors = []; if (!context.requestBundleValidator(bundle)) errors.push(...structural(context.requestBundleValidator));
  const production = context.taxonomy.taxonomy_version; const root = bundle?.taxonomy_version; const document = bundle?.request_document;
  if (root !== production) errors.push(mismatch('/taxonomy_version', 'Bundle taxonomy version does not match production taxonomy'));
  if (document && document.taxonomy_version !== root || document && document.taxonomy_version !== production) errors.push(mismatch('/request_document/taxonomy_version', 'Request document taxonomy version does not match bundle and production taxonomy'));
  const lines = Array.isArray(document?.lines) ? document.lines : [];
  if (typeof bundle?.source?.line_count === 'number' && bundle.source.line_count !== lines.length) errors.push({ code: 'LINE_COUNT_MISMATCH', path: '/source/line_count', message: 'Declared line count does not match lines length', details: { declared: bundle.source.line_count, actual: lines.length } });
  if (typeof bundle?.source?.source_file_name === 'string' && typeof document?.document?.source_file === 'string' && bundle.source.source_file_name !== document.document.source_file) errors.push({ code: 'SOURCE_FILE_MISMATCH', path: '/request_document/document/source_file', message: 'Request source filenames do not match', details: { expected: bundle.source.source_file_name, actual: document.document.source_file } });
  const seen = new Map(); lines.forEach((line, index) => { if (typeof line?.line_id !== 'string') return; if (seen.has(line.line_id)) errors.push({ code: 'DUPLICATE_LINE_ID', path: `/request_document/lines/${index}/line_id`, message: 'line_id must be unique', details: { value: line.line_id, first_index: seen.get(line.line_id), duplicate_index: index } }); else seen.set(line.line_id, index); });
  if (isObject(document) && context.requestDocumentValidator(document)) { const result = validateAnnotation({ kind: 'request_document', data: document, taxonomy: context.taxonomy, registry: context.registry, schemas: context.classSchemas }); errors.push(...result.issues.map(issue => prefixed('/request_document', issue))); }
  return finish('request_bundle', errors, { records: lines.length, taxonomy_version: root });
}
