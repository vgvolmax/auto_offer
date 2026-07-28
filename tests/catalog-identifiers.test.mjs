import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { buildCatalogProduct, classifyGtin, createExactGtinIndex, importStructuredIdentifiers } from '../scripts/lib/catalog-identifiers.mjs';

const annotation = { class_id: 'fitting.adapter.ppr.male_thread', identity: { brand: 'rtp', manufacturer: null, manufacturer_articles: [], models: [], series: null }, attributes: { body_material: 'PP-R' }, ports: [], annotation: { status: 'validated' } };
const raw = (gtins, supplier_sku = '28188', source_item_id = 'main:sheet:5') => ({ source_item_id, structured_identifiers: { supplier_sku, gtins } });

test('moved catalog identifier fixtures exercise the identifier policy, not AI annotation', async () => {
  for (const filename of await readdir('tests/fixtures/catalog-identifiers')) {
    const fixture = JSON.parse(await readFile(`tests/fixtures/catalog-identifiers/${filename}`, 'utf8'));
    assert.equal(classifyGtin(fixture.value), fixture.expected_status, filename);
  }
});

test('GTIN-8 with a leading zero and GTIN-12/13/14 pass deterministic checksum validation', () => {
  for (const value of ['01234565', '036000291452', '4006381333931', '10012345000017']) assert.equal(classifyGtin(value), 'valid', value);
});
test('missing GTIN and supplier-SKU-only products remain eligible for technical matching', () => {
  for (const supplierSku of [null, '28188']) {
    const product = buildCatalogProduct({ rawItem: raw([], supplierSku), annotation });
    assert.equal(product.technicalMatchingEligible, true); assert.deepEqual(product.identifiers.gtins, []);
  }
});
test('valid and unique GTIN enters the exact index', () => {
  const product = buildCatalogProduct({ rawItem: raw(['4006381333931']), annotation });
  assert.equal(createExactGtinIndex([product]).get('4006381333931'), product);
});
test('the same supplier SKU across price pools keeps one stable product_id', () => {
  const a = buildCatalogProduct({ rawItem: raw([], '28188', 'main:sheet:5'), annotation });
  const b = buildCatalogProduct({ rawItem: raw([], '28188', 'sale:sheet:8'), annotation });
  assert.equal(a.product_id, b.product_id);
});
test('bad checksum, length, letters, scientific notation, and a lost leading zero are identifier-only warnings', () => {
  for (const value of ['4006381333932', '123456789', '40063813339A1', '4.006381333931E+12', '1234565']) {
    const product = buildCatalogProduct({ rawItem: raw([value]), annotation });
    assert.equal(product.technicalMatchingEligible, true);
    assert.equal(product.status, 'active');
    assert.equal(product.identifiers.gtins[0].exactIndexEligible, false);
    assert.equal(product.data_quality_issues[0].severity, 'warning');
    assert.equal(product.data_quality_issues[0].effect, 'excluded_from_exact_index');
    assert.equal(createExactGtinIndex([product]).has(value), false);
  }
});
test('one GTIN on incompatible products creates a conflict and no automatic exact result', () => {
  const a = buildCatalogProduct({ rawItem: raw(['4006381333931'], '1'), annotation, productId: 'p1' });
  const b = buildCatalogProduct({ rawItem: raw(['4006381333931'], '2'), annotation, productId: 'p2' });
  const index = createExactGtinIndex([a, b]);
  assert.equal(index.has('4006381333931'), false);
  for (const product of [a, b]) { assert.equal(product.technicalMatchingEligible, true); assert.equal(product.identifiers.gtins[0].status, 'conflict'); assert.equal(product.identifiers.gtins[0].exactIndexEligible, false); }
});
test('structured importer preserves leading zeroes and rejects spreadsheet numeric cells', () => {
  assert.deepEqual(importStructuredIdentifiers({ supplierSku: '001', gtinCell: '01234565' }), { supplier_sku: '001', gtins: ['01234565'] });
  assert.throws(() => importStructuredIdentifiers({ gtinCell: 1.2345e7 }), /as text/);
});
