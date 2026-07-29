import test from 'node:test';
import assert from 'node:assert/strict';
import {renderCatalogInventoryReport, renderTaxonomyApprovalChecklist} from '../scripts/catalog/lib/public-taxonomy-reports.mjs';

const secret = {source_item_id: 'rtp-main:Sheet:42', raw_name: 'Secret product', supplier_sku: 'SKU-SECRET', gtin: '04601234567890', case_id: 'case:secret', question_ru: 'Secret question'};
const inventory = {
  inventoryFileSha256: 'a'.repeat(64), proposalInputSha256: 'b'.repeat(64), physicalNonemptyRows: 20,
  configuredNonemptyRows: 10, configuredSheetCount: 2, ignoredSheetCount: 3, totalInventoryRecords: 9,
  rowStatusCounts: {product_candidate: 8, non_product: 1}, taxonomyStatusCounts: {unsupported: 2, proposed_mapped: 6},
  sourceCounts: {'source-z': 4, 'source-a': 5}, sourceFileHashes: {'source-z': 'z'.repeat(64), 'source-a': 'c'.repeat(64)},
  classCounts: {'class.z': 2, 'class.a': 4}, duplicateCounts: {Z_CODE: 1, GTIN_CONFLICT: 2, A_CODE: 3},
  unresolvedCaseCount: 2, ...secret
};
const classes = [
  {class_id: 'class.z', name_ru: 'Зет', family_id: 'family.z', source_row_count: 2, candidate_attributes: ['b', 'a'], candidate_ports: ['out'], overlaps_with: [], open_question_ids: ['case:secret'], source_examples: [secret]},
  {class_id: 'class.a', name_ru: 'Альфа', family_id: 'family.a', source_row_count: 4, candidate_attributes: [], candidate_ports: [], overlaps_with: ['class.z'], open_question_ids: []}
];

test('inventory report is deterministic, aggregate-only, and sorted', () => {
  const output = renderCatalogInventoryReport(inventory);
  assert.equal(output, renderCatalogInventoryReport(inventory));
  for (const value of ['a'.repeat(64), 'b'.repeat(64), 'Inventory records after configured headers: 9', 'GTIN_CONFLICT: 2']) assert.match(output, new RegExp(value));
  for (const value of ['source_item_id', 'raw_name', secret.supplier_sku, secret.gtin, secret.case_id, 'question_ru']) assert.equal(output.includes(value), false, value);
  assert.ok(output.indexOf('source-a') < output.indexOf('source-z'));
  assert.ok(output.indexOf('A_CODE') < output.indexOf('GTIN_CONFLICT') && output.indexOf('GTIN_CONFLICT') < output.indexOf('Z_CODE'));
  const reordered = {...inventory, rowStatusCounts: {non_product: 1, product_candidate: 8}, sourceCounts: {'source-a': 5, 'source-z': 4}, duplicateCounts: {A_CODE: 3, GTIN_CONFLICT: 2, Z_CODE: 1}};
  assert.equal(renderCatalogInventoryReport(reordered), output);
});

test('checklist is deterministic, complete, safe, and sorted', () => {
  const output = renderTaxonomyApprovalChecklist({classes});
  assert.equal(output, renderTaxonomyApprovalChecklist({classes}));
  assert.ok(output.indexOf('class.a') < output.indexOf('class.z'));
  for (const item of classes) assert.match(output, new RegExp(item.class_id.replace('.', '\\.')));
  assert.equal((output.match(/- \[ \] (?:approve|revise|reject|split|merge with another class)/g) ?? []).length, classes.length * 5);
  for (const value of ['source_examples', secret.source_item_id, secret.raw_name, secret.case_id, secret.supplier_sku, secret.gtin]) assert.equal(output.includes(value), false, value);
  assert.equal(renderTaxonomyApprovalChecklist({classes: Object.fromEntries(classes.map(x => [x.class_id, x]))}), output);
});
