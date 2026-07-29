import { readFile } from 'node:fs/promises';
import { gunzipSync } from 'node:zlib';
import { loadJson } from './lib/source-config.mjs';
import { canonicalStringify, sha256Canonical, sha256Text } from './lib/canonical-json.mjs';

async function loadAjv() {
  const [{default: Ajv2020}, {default: addFormats}] = await Promise.all([
    import('ajv/dist/2020.js'),
    import('ajv-formats')
  ]);
  const ajv = new Ajv2020({allErrors: true, strict: false});
  addFormats(ajv);
  return ajv;
}

const inventoryText = await readFile('data/generated/catalog-source-inventory.jsonl', 'utf8');
const inventory = inventoryText.trim() ? inventoryText.trimEnd().split('\n').map((line, index) => {
  try { return JSON.parse(line); }
  catch (error) { throw new Error(`INVALID_JSONL:${index + 1}:${error.message}`); }
}) : [];
const sourceConfig = await loadJson('config/catalog-sources.json');
const rules = await loadJson('taxonomy/classification-rules.proposed.json');
const taxonomyIndex = await loadJson('taxonomy/taxonomy.proposed.json');
const classMapIndex = await loadJson('taxonomy/class-map.proposed.json');
const unresolvedIndex = await loadJson('taxonomy/unresolved-cases.json');
async function loadGzipJson(file) { return JSON.parse(gunzipSync(await readFile(file)).toString('utf8')); }
const taxonomy = await loadGzipJson('taxonomy/generated/taxonomy.proposed.full.json.gz');
const classMap = await loadGzipJson('taxonomy/generated/class-map.proposed.full.json.gz');
const unresolved = await loadGzipJson('taxonomy/generated/unresolved-cases.full.json.gz');
const report = await loadJson('reports/catalog-source-inventory.json');
const manifest = await loadJson('reports/catalog-source-inventory-manifest.json');

const ajv = await loadAjv();
const schemas = {
  sourceConfig: await loadJson('schemas/inventory/catalog-sources.schema.json'),
  inventory: await loadJson('schemas/inventory/catalog-inventory-record.schema.json'),
  rules: await loadJson('schemas/inventory/classification-rules.schema.json'),
  taxonomy: await loadJson('schemas/inventory/taxonomy-proposal.schema.json')
};
const validators = Object.fromEntries(Object.entries(schemas).map(([name, schema]) => [name, ajv.compile(schema)]));

function assertSchema(name, value, context = name) {
  const valid = validators[name](value);
  if (!valid) throw new Error(`SCHEMA_VALIDATION_FAILED:${context}:${JSON.stringify(validators[name].errors)}`);
}
assertSchema('sourceConfig', sourceConfig);
assertSchema('rules', rules);
assertSchema('taxonomy', taxonomy);
for (const [index, record] of inventory.entries()) assertSchema('inventory', record, `JSONL:${index + 1}:${record.source_item_id ?? 'unknown'}`);

const errors = [];
function check(condition, code, details = '') { if (!condition) errors.push(`${code}${details ? `:${details}` : ''}`); }
const ids = inventory.map(record => record.source_item_id);
check(new Set(ids).size === ids.length, 'DUPLICATE_SOURCE_ITEM_ID');
for (const record of inventory) {
  if (record.row_status === 'product_candidate') check(['proposed_mapped', 'ambiguous', 'unsupported'].includes(record.taxonomy_status), 'PRODUCT_TAXONOMY_STATUS_REQUIRED', record.source_item_id);
  else check(record.taxonomy_status === 'not_applicable', 'NON_PRODUCT_TAXONOMY_STATUS_INVALID', record.source_item_id);
  if (record.taxonomy_status === 'proposed_mapped') check(record.proposed_class_ids.length === 1, 'MAPPED_CLASS_COUNT_INVALID', record.source_item_id);
  if (record.taxonomy_status === 'ambiguous') check(record.proposed_class_ids.length > 1, 'AMBIGUOUS_CLASS_COUNT_INVALID', record.source_item_id);
  if (record.taxonomy_status === 'unsupported') check(record.proposed_class_ids.length === 0, 'UNSUPPORTED_CLASS_COUNT_INVALID', record.source_item_id);
}
const clusterIds = new Set(inventory.filter(record => record.cluster_id).map(record => record.cluster_id));
for (const clusterId of clusterIds) check(Object.hasOwn(classMap.clusters, clusterId), 'CLUSTER_NOT_IN_CLASS_MAP', clusterId);
for (const [clusterId, cluster] of Object.entries(classMap.clusters)) {
  check(clusterIds.has(clusterId), 'CLASS_MAP_CLUSTER_NOT_IN_INVENTORY', clusterId);
  for (const classId of cluster.proposed_class_ids) check(Object.hasOwn(taxonomy.classes, classId), 'CLASS_MAP_UNKNOWN_CLASS', `${clusterId}:${classId}`);
}
const caseIds = new Set(unresolved.cases.map(item => item.case_id));
check(caseIds.size === unresolved.cases.length, 'DUPLICATE_UNRESOLVED_CASE_ID');
for (const caseId of taxonomy.open_questions) check(caseIds.has(caseId), 'UNKNOWN_OPEN_QUESTION', caseId);
for (const [classId, definition] of Object.entries(taxonomy.classes)) {
  check(definition.review_status === 'needs_owner_approval', 'CLASS_AUTO_APPROVED', classId);
  for (const caseId of definition.open_question_ids) check(caseIds.has(caseId), 'CLASS_UNKNOWN_QUESTION', `${classId}:${caseId}`);
}
check(taxonomy.status === 'proposed', 'TAXONOMY_STATUS_NOT_PROPOSED');
check(taxonomy.mass_annotation_allowed === false, 'MASS_ANNOTATION_MUST_BE_FALSE');
check(unresolved.cases.every(item => item.owner_decision === null), 'OWNER_DECISION_AUTO_FILLED');
check(classMapIndex.cluster_count === Object.keys(classMap.clusters).length, 'CLASS_MAP_COUNT_MISMATCH');
check(unresolvedIndex.case_count === unresolved.cases.length, 'UNRESOLVED_COUNT_MISMATCH');
check(report.total_inventory_records === inventory.length, 'REPORT_TOTAL_MISMATCH');
check(report.configured_nonempty_rows >= inventory.length, 'REPORT_CONFIGURED_ROW_COUNT_INVALID');
check(report.physical_nonempty_rows_all_sheets >= report.configured_nonempty_rows, 'REPORT_PHYSICAL_ROW_COUNT_INVALID');
check(report.inventory_file_sha256 === sha256Text(inventoryText), 'REPORT_INVENTORY_HASH_MISMATCH');
check(manifest.total_inventory_records === inventory.length, 'MANIFEST_TOTAL_MISMATCH');
check(manifest.inventory_sha256 === sha256Text(inventoryText), 'MANIFEST_INVENTORY_HASH_MISMATCH');
check(manifest.proposal_input_sha256 === taxonomy.source_inventory_sha256, 'MANIFEST_PROPOSAL_HASH_MISMATCH');
check(manifest.committed === false, 'MANIFEST_MUST_MARK_INVENTORY_UNCOMMITTED');
check(manifest.contains_prices === false, 'MANIFEST_CONTAINS_PRICES_MUST_BE_FALSE');
const rowCount = Object.values(report.row_status_counts).reduce((sum, value) => sum + value, 0);
check(rowCount === inventory.length, 'REPORT_ROW_STATUS_MISMATCH');
const sourceHashes = new Set(inventory.map(record => `${record.source_file.source_id}:${record.source_file.sha256}`));
check(sourceHashes.size === sourceConfig.sources.length, 'SOURCE_HASH_COVERAGE_MISMATCH');
const forbiddenKeys = /^(price|cost|amount|цена|стоимость)$/iu;
function scan(value, path = '') {
  if (Array.isArray(value)) return value.forEach((item, index) => scan(item, `${path}/${index}`));
  if (!value || typeof value !== 'object') return;
  for (const [key, child] of Object.entries(value)) {
    if (forbiddenKeys.test(key)) errors.push(`PRICE_KEY_IN_COMMITTED_OUTPUT:${path}/${key}`);
    scan(child, `${path}/${key}`);
  }
}
scan(inventory); scan(taxonomy); scan(classMap); scan(unresolved); scan(report); scan(manifest);
check(canonicalStringify(taxonomy).length > 0 && sha256Canonical(taxonomy).length === 64, 'CANONICAL_SERIALIZATION_FAILED');

if (errors.length) {
  console.error(errors.join('\n'));
  process.exitCode = 1;
} else {
  console.log(`Validated ${inventory.length} inventory records, ${Object.keys(taxonomy.classes).length} proposed classes, and ${unresolved.cases.length} unresolved cases.`);
}
