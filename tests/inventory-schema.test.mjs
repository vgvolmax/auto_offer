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
ajv.compile(taxonomySchema);

const taxonomyIndex = await json('taxonomy/taxonomy.proposed.json');
const classMapIndex = await json('taxonomy/class-map.proposed.json');
const unresolvedIndex = await json('taxonomy/unresolved-cases.json');
const inspectionIndex = await json('reports/catalog-source-inspection.json');
const report = await json('reports/catalog-source-inventory.json');
const manifest = await json('reports/catalog-source-inventory-manifest.json');

function assertValid(validate, value, context) {
  assert.equal(validate(value), true, `${context}: ${JSON.stringify(validate.errors, null, 2)}`);
}

test('inventory source config and classification rules pass production schemas', async () => {
  assertValid(validateSources, await json('config/catalog-sources.json'), 'source config');
  assertValid(validateRules, await json('taxonomy/classification-rules.proposed.json'), 'classification rules');
});

test('taxonomy proposal schema compiles without loading private audit payloads', () => {
  assert.equal(typeof taxonomySchema, 'object');
  assert.equal(taxonomySchema.$schema, 'https://json-schema.org/draft/2020-12/schema');
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

test('committed indexes, reports, and manifest are internally consistent', () => {
  assert.equal(taxonomyIndex.class_count, 27);
  assert.equal(taxonomyIndex.open_question_count, unresolvedIndex.case_count);
  assert.equal(classMapIndex.cluster_count, 1515);
  assert.equal(unresolvedIndex.case_count, 192);
  assert.equal(report.total_inventory_records, 4452);
  assert.deepEqual(report.row_status_counts, {non_product: 339, product_candidate: 4113});
  assert.deepEqual(report.taxonomy_status_counts, {ambiguous: 300, not_applicable: 339, proposed_mapped: 3333, unsupported: 480});
  assert.equal(report.configured_sheet_count, 9);
  assert.equal(report.ignored_sheet_count, 26);
  assert.equal(manifest.total_inventory_records, report.total_inventory_records);
  assert.equal(manifest.inventory_sha256, report.inventory_file_sha256);
  assert.equal(manifest.proposal_input_sha256, taxonomyIndex.source_inventory_sha256);
  assert.equal(manifest.committed, false);
  assert.equal(manifest.contains_prices, false);
  assert.equal(manifest.source_files.length, 4);
  assert.equal(inspectionIndex.source_count, 4);
  assert.equal(taxonomyIndex.status, 'proposed');
  assert.equal(taxonomyIndex.mass_annotation_allowed, false);
  assert.equal(manifest.inventory_sha256, 'ce22807e0c3dc986c4351a9e974b57a591fc8d784ad8c81d801081fddaedba81');
  assert.equal(manifest.proposal_input_sha256, 'dda007dba97121a73c793f0dab003242910e6454337be453a5aa2d7479f58fed');
  assert.equal(taxonomyIndex.private_payload.uncompressed_sha256, 'a8b3091004bb80a88c4be61ef471e0a9e02db7f7ed8620c0a1298820ab0e1d32');
  assert.equal(classMapIndex.private_payload.uncompressed_sha256, 'dea970d2ad5f5d5a3518a2122d5806ab36bd7d9af85dce1d8d3549e08835b8d1');
  assert.equal(unresolvedIndex.private_payload.uncompressed_sha256, '441fa69b5e4f729a692f03ce8859a0130bafb1eb199f1aee381b606f82a00e89');
});

test('committed public reports contain no row-level review payload', async () => {
  const inventoryReport = await text('reports/catalog-source-inventory.md');
  const checklist = await text('reports/taxonomy-approval-checklist.md');
  const status = await text('reports/taxonomy-review-status.md');
  const combined = `${inventoryReport}\n${checklist}\n${status}`;
  for (const forbidden of ['source_item_id', 'raw_name', 'supplier_sku', 'taxonomy-review-pack.json', 'taxonomy.approval.draft.json', 'Как обработать конфликт gtin']) {
    assert.equal(combined.includes(forbidden), false, forbidden);
  }
  assert.doesNotMatch(combined, /rtp-(?:main|new|clearance|distribution):[^:\n]+:\d+/u);
  assert.equal((checklist.match(/^## [^#]/gmu) ?? []).length, 27);
});

test('private full taxonomy payloads have explicit local-only manifests', async () => {
  for (const index of [taxonomyIndex, classMapIndex, unresolvedIndex]) {
    assert.equal(index.private_payload.committed, false);
    assert.equal(index.private_payload.regeneration_command, 'npm run catalog:inventory');
    assert.equal('payload_file' in index, false);
    assert.match(index.private_payload.sha256, /^[0-9a-f]{64}$/);
    assert.match(index.private_payload.uncompressed_sha256, /^[0-9a-f]{64}$/);
  }
  for (const index of [inspectionIndex]) {
    assert.match(index.payload_file, /^(?:taxonomy|reports)\/generated\/.+\.json\.gz$/);
    assert.match(index.payload_sha256, /^[0-9a-f]{64}$/);
    assert.match(index.payload_uncompressed_sha256, /^[0-9a-f]{64}$/);
  }
  const ignore = await text('.gitignore');
  assert.match(ignore, /\/data\/source\/\*/);
  assert.match(ignore, /\/data\/generated\/\*/);
  assert.match(ignore, /\/reports\/generated\/\*/);
  assert.match(ignore, /\/taxonomy\/generated\/\*/);
});

test('committed generated JSON is canonical and deterministic', async () => {
  const jsonFiles = [
    'taxonomy/taxonomy.proposed.json',
    'taxonomy/class-map.proposed.json',
    'taxonomy/unresolved-cases.json',
    'reports/catalog-source-inspection.json',
    'reports/catalog-source-inventory.json',
    'reports/catalog-source-inventory-manifest.json'
  ];
  for (const file of jsonFiles) {
    const raw = await text(file);
    assert.equal(raw, `${canonicalStringify(JSON.parse(raw), 2)}\n`, file);
  }
});

test('committed summaries contain no price fields or machine-local paths', () => {
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
  scan(taxonomyIndex);
  scan(classMapIndex);
  scan(unresolvedIndex);
  scan(inspectionIndex);
  scan(report);
  scan(manifest);
});
