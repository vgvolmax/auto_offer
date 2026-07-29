import test from 'node:test';
import assert from 'node:assert/strict';
import { classifyRecord, detectDuplicateDiagnostics } from '../scripts/catalog/lib/classification-rules.mjs';
import { canonicalStringify, sha256Canonical } from '../scripts/catalog/lib/canonical-json.mjs';

const rules = [
  {rule_id: 'pipe-ppr', class_id: 'pipe.ppr', priority: 10, all_tokens: ['труба'], any_tokens: ['ppr', 'pp-r'], excluded_tokens: ['канализационная']},
  {rule_id: 'fitting-ppr-a', class_id: 'fitting.ppr', priority: 20, any_tokens: ['муфта', 'отвод'], all_tokens: ['ppr']},
  {rule_id: 'fitting-ppr-b', class_id: 'fitting.ppr', priority: 30, exact_context: ['фитинги ппр белые']},
  {rule_id: 'other-mufta', class_id: 'fitting.generic', priority: 40, all_tokens: ['муфта']}
];

function record(name, context = []) {
  const normalizedName = name.toLowerCase();
  return {raw: {name, category_context: context}, normalized: {name: normalizedName, name_skeleton: normalizedName, tokens: normalizedName.split(/\s+/)}};
}

test('classification returns mapped, unsupported, and ambiguous without first-match wins', () => {
  assert.equal(classifyRecord(record('труба ppr 32'), rules).taxonomy_status, 'proposed_mapped');
  assert.equal(classifyRecord(record('неизвестный товар'), rules).taxonomy_status, 'unsupported');
  const ambiguous = classifyRecord(record('муфта ppr'), rules);
  assert.equal(ambiguous.taxonomy_status, 'ambiguous');
  assert.deepEqual(ambiguous.proposed_class_ids, ['fitting.generic', 'fitting.ppr']);
});

test('multiple matching rules for one class are not ambiguity and exclusion cancels a rule', () => {
  const mapped = classifyRecord(record('муфта ppr', ['Фитинги ППР белые']), rules.filter(rule => rule.class_id === 'fitting.ppr'));
  assert.equal(mapped.taxonomy_status, 'proposed_mapped');
  assert.deepEqual(mapped.proposed_class_ids, ['fitting.ppr']);
  assert.equal(classifyRecord(record('труба канализационная ppr'), rules).matched_rule_ids.includes('pipe-ppr'), false);
});

test('duplicate diagnostics flag conflicts but preserve all records', () => {
  const records = [
    {source_item_id: 'a:1', source_file: {source_id: 'a'}, raw: {supplier_sku: '1', gtin: '4006381333931', name: 'Муфта'}, normalized: {name: 'муфта'}, source_fingerprint: 'sha256:x', duplicate_flags: [], diagnostics: []},
    {source_item_id: 'b:1', source_file: {source_id: 'b'}, raw: {supplier_sku: '1', gtin: '4006381333931', name: 'Труба'}, normalized: {name: 'труба'}, source_fingerprint: 'sha256:x', duplicate_flags: [], diagnostics: []}
  ];
  detectDuplicateDiagnostics(records);
  assert.equal(records.length, 2);
  assert.ok(records.every(item => item.duplicate_flags.includes('CROSS_SOURCE_DUPLICATE')));
  assert.ok(records.every(item => item.duplicate_flags.includes('SUPPLIER_SKU_CONFLICT')));
  assert.ok(records.every(item => item.duplicate_flags.includes('GTIN_CONFLICT')));
});

test('same identifier and normalized name across sources is a cross-source duplicate', () => {
  const records = [
    {source_item_id: 'a:1', source_file: {source_id: 'a'}, raw: {supplier_sku: '1', gtin: null, name: 'Муфта'}, normalized: {name: 'муфта'}, source_fingerprint: 'sha256:a', duplicate_flags: [], diagnostics: []},
    {source_item_id: 'b:1', source_file: {source_id: 'b'}, raw: {supplier_sku: '1', gtin: null, name: 'Муфта'}, normalized: {name: 'муфта'}, source_fingerprint: 'sha256:b', duplicate_flags: [], diagnostics: []}
  ];
  detectDuplicateDiagnostics(records);
  assert.ok(records.every(item => item.duplicate_flags.includes('CROSS_SOURCE_DUPLICATE')));
});

test('non-product rows are excluded from product duplicate diagnostics', () => {
  const records = [
    {row_status: 'non_product', source_item_id: 'a:1', source_file: {source_id: 'a'}, raw: {supplier_sku: null, gtin: null, name: 'Раздел'}, normalized: {name: 'раздел'}, source_fingerprint: 'sha256:x', duplicate_flags: [], diagnostics: []},
    {row_status: 'non_product', source_item_id: 'a:2', source_file: {source_id: 'a'}, raw: {supplier_sku: null, gtin: null, name: 'Раздел'}, normalized: {name: 'раздел'}, source_fingerprint: 'sha256:x', duplicate_flags: [], diagnostics: []}
  ];
  detectDuplicateDiagnostics(records);
  assert.deepEqual(records.map(item => item.duplicate_flags), [[], []]);
});

test('canonical JSON and hash ignore object insertion order', () => {
  assert.equal(canonicalStringify({b: 1, a: {d: 2, c: 3}}), canonicalStringify({a: {c: 3, d: 2}, b: 1}));
  assert.equal(sha256Canonical({b: 1, a: 2}), sha256Canonical({a: 2, b: 1}));
});
