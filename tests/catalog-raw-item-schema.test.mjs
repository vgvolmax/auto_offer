import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import Ajv2020 from 'ajv/dist/2020.js';
import { importStructuredIdentifiers } from '../scripts/lib/catalog-identifiers.mjs';

const schema = JSON.parse(await readFile('schemas/catalog/catalog-raw-item.schema.json', 'utf8'));
const validate = new Ajv2020({ allErrors: true }).compile(schema);
const rawItem = (structured_identifiers = { supplier_sku: '28188', gtins: ['01234565'] }) => ({
  schema_version: '1.0.0', source_item_id: '01-main:Лист1:5',
  source: { file: 'price.xlsm', sheet: 'Лист1', row: 5 },
  raw_fields: { supplier_sku: '28188', gtin: structured_identifiers.gtins[0] ?? null, name: 'Муфта', description: null },
  structured_identifiers
});

test('raw item preserves structured text identifiers and validates', () => assert.equal(validate(rawItem()), true, JSON.stringify(validate.errors)));
test('an empty GTIN cell produces an empty GTIN array', () => assert.deepEqual(importStructuredIdentifiers({ supplierSku: '28188', gtinCell: '' }), { supplier_sku: '28188', gtins: [] }));
test('multiple GTINs require an explicitly configured separator', () => {
  assert.deepEqual(importStructuredIdentifiers({ gtinCell: '01234565;036000291452', separator: ';' }).gtins, ['01234565', '036000291452']);
  assert.deepEqual(importStructuredIdentifiers({ gtinCell: '01234565;036000291452' }).gtins, ['01234565;036000291452']);
});
test('numeric Excel values are rejected before floating-point conversion can lose digits', () => assert.throws(() => importStructuredIdentifiers({ gtinCell: 4660028388359 }), /as text/));
