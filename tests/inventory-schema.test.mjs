import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { canonicalStringify } from '../scripts/catalog/lib/canonical-json.mjs';

const ajv = new Ajv2020({allErrors: true, strict: false});
addFormats(ajv);

async function text(file) { return readFile(file, 'utf8'); }
async function json(file) { return JSON.parse(await text(file)); }

const sourceSchema = await json('schemas/inventory/catalog-sources.schema.json');
const inventorySchema = await json('schemas/inventory/catalog-inventory-record.schema.json');
const rulesSchema = await json('schemas/inventory/classification-rules.schema.json');
const taxonomySchema = await json('schemas/inventory/taxonomy-proposal.schema.json');

const validateSources = ajv.compile(sourceSchema);
const validateInventory = ajv.compile(inventorySchema);
const validateRules = ajv.compile(rulesSchema);
const validateTaxonomy = ajv.compile(taxonomySchema);

const taxonomy = await json('taxonomy/taxonomy.proposed.json');
const classMapIndex = await json('taxonomy/class-map.proposed.json');
const classMapParts = await Promise.all(classMapIndex.part_files.map(json));
const classMap = Object.assign({}, ...classMapParts);
const unresolvedIndex = await json('taxonomy/unresolved-cases.json');
const unresolvedParts = await Promise.all(unresolvedIndex.part_files.map(json));
const unresolvedCases = unresolvedParts.flat();
const inspection = await json('reports/catalog-source-inspection.json');
const report = await json('reports/catalog-source-inventory.json');
const manifest = await json('reports/catalog-source-inventory-manifest.json');

function assertValid(validate, value, context) {
  assert.equal(validate(value), true, `${context}: ${JSON.stringify(validate.errors, null, 2)}`);
}

test('inventory source config and proposals pass production schemas', async () => {
  assertValid(validateSources, await json('config/catalog-sources.json'), 'source config');
  assertValid(validateRules, await json('taxonomy/classification-rules.proposed.json'), 'classification rules');
  assertValid(validateTaxonomy, taxonomy, 'taxonomy proposal');
});

test('representative inventory record passes its schema', () => {
  const value = {
    inventory_schema_version: '1.0.0',
    source_file: {source_id: 'fixture', filename: 'fixture.xlsx', sha256: '0'.repeat(64)},
    source_item_id: 'fixture:Товары:2',
    source: {sheet: 'Товары', row: 2, hidden: false},
    raw: {name: 'Муфта PPR 32', description: null, supplier_sku: '001', gtin: null, unit: 'шт', category_context: []},
    normalized: {name: 'муфта ppr 32', name_skeleton: 'муфта ppr <diameter_mm>', tokens: ['муфта', 'ppr', '32']},
    row_status: 'product_candidate',
    taxonomy_status: 'unsupported',
    cluster_id: 'cluster:0123456789abcdef',
    proposed_class_ids: [],
    matched_rule_ids: [],
    duplicate_flags: [],
    diagnostics: [],
    source_fingerprint: `sha256:${'1'.repeat(64)}`
  };
  assertValid(validateInventory, value, 'representative inventory record');
});

test('committed proposal indexes, reports, and manifest are internally consistent', () => {
  assert.equal(classMapIndex.cluster_count, Object.keys(classMap).length);
  assert.equal(unresolvedIndex.case_count, unresolvedCases.length);
  assert.equal(classMapIndex.cluster_count, 1515);
  assert.equal(unresolvedIndex.case_count, 192);
  assert.equal(report.total_inventory_records, 4452);
  assert.deepEqual(report.row_status_counts, {non_product: 339, product_candidate: 4113});
  assert.deepEqual(report.taxonomy_status_counts, {ambiguous: 300, not_applicable: 339, proposed_mapped: 3333, unsupported: 480});
  assert.equal(report.configured_sheet_count, 9);
  assert.equal(report.ignored_sheet_count, 26);
  assert.equal(manifest.total_inventory_records, report.total_inventory_records);
  assert.equal(manifest.inventory_sha256, report.inventory_file_sha256);
  assert.equal(manifest.proposal_input_sha256, taxonomy.source_inventory_sha256);
  assert.equal(manifest.committed, false);
  assert.equal(manifest.contains_prices, false);
  assert.equal(manifest.source_files.length, 4);
  assert.equal(inspection.sources.length, 4);
});

test('every unresolved and class reference is auditable', () => {
  const caseIds = new Set(unresolvedCases.map(item => item.case_id));
  assert.equal(caseIds.size, unresolvedCases.length);
  assert.deepEqual(new Set(taxonomy.open_questions), caseIds);
  assert.ok(unresolvedCases.every(item => item.owner_decision === null));
  for (const [classId, definition] of Object.entries(taxonomy.classes)) {
    assert.equal(definition.review_status, 'needs_owner_approval', classId);
    assert.ok(definition.source_examples.length >= 1, classId);
    for (const clusterId of definition.cluster_ids) assert.ok(Object.hasOwn(classMap, clusterId), `${classId}:${clusterId}`);
    for (const caseId of definition.open_question_ids) assert.ok(caseIds.has(caseId), `${classId}:${caseId}`);
  }
  for (const item of unresolvedCases) {
    for (const clusterId of item.cluster_ids) assert.ok(Object.hasOwn(classMap, clusterId), `${item.case_id}:${clusterId}`);
  }
  assert.equal(taxonomy.status, 'proposed');
  assert.equal(taxonomy.mass_annotation_allowed, false);
});

test('committed generated JSON is canonical and deterministic', async () => {
  const jsonFiles = [
    'taxonomy/taxonomy.proposed.json',
    'taxonomy/class-map.proposed.json',
    'taxonomy/unresolved-cases.json',
    ...classMapIndex.part_files,
    ...unresolvedIndex.part_files,
    'reports/catalog-source-inspection.json',
    'reports/catalog-source-inventory.json',
    'reports/catalog-source-inventory-manifest.json'
  ];
  for (const file of jsonFiles) {
    const raw = await text(file);
    assert.equal(raw, `${canonicalStringify(JSON.parse(raw), 2)}\n`, file);
  }
});

test('committed audit outputs contain no price fields or machine-local paths', () => {
  const forbiddenKey = /^(price|cost|amount|цена|стоимость)$/iu;
  const localPath = /(?:\/mnt\/data|[A-Z]:\\)/u;
  function scan(value, path = '') {
    if (Array.isArray(value)) return value.forEach((item, index) => scan(item, `${path}/${index}`));
    if (value && typeof value === 'object') {
      for (const [key, child] of Object.entries(value)) {
        assert.equal(forbiddenKey.test(key), false, `${path}/${key}`);
        scan(child, `${path}/${key}`);
      }
      return;
    }
    if (typeof value === 'string') assert.equal(localPath.test(value), false, `${path}: ${value}`);
  }
  scan(taxonomy);
  scan(classMap);
  scan(unresolvedCases);
  scan(inspection);
  scan(report);
  scan(manifest);
});
