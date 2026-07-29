import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { deflateRawSync } from 'node:zlib';

import { readWorkbook } from '../scripts/catalog/lib/workbook-reader.mjs';
import { extractConfiguredRecords, validateSourceCoverage } from '../scripts/catalog/lib/inventory-report.mjs';
import { normalizeName } from '../scripts/catalog/lib/name-normalizer.mjs';

const encoder = new TextEncoder();

function crc32(data) {
  let crc = 0xffffffff;
  for (const byte of data) {
    crc ^= byte;
    for (let i = 0; i < 8; i += 1) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function zip(entries) {
  const locals = [];
  const centrals = [];
  let offset = 0;
  for (const [name, value] of Object.entries(entries)) {
    const nameBytes = encoder.encode(name);
    const raw = typeof value === 'string' ? encoder.encode(value) : value;
    const compressed = deflateRawSync(raw);
    const crc = crc32(raw);
    const local = Buffer.alloc(30 + nameBytes.length);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0x0800, 6);
    local.writeUInt16LE(8, 8);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(compressed.length, 18);
    local.writeUInt32LE(raw.length, 22);
    local.writeUInt16LE(nameBytes.length, 26);
    Buffer.from(nameBytes).copy(local, 30);
    locals.push(local, compressed);

    const central = Buffer.alloc(46 + nameBytes.length);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0x0800, 8);
    central.writeUInt16LE(8, 10);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(compressed.length, 20);
    central.writeUInt32LE(raw.length, 24);
    central.writeUInt16LE(nameBytes.length, 28);
    central.writeUInt32LE(offset, 42);
    Buffer.from(nameBytes).copy(central, 46);
    centrals.push(central);
    offset += local.length + compressed.length;
  }
  const centralSize = centrals.reduce((n, b) => n + b.length, 0);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(centrals.length, 8);
  end.writeUInt16LE(centrals.length, 10);
  end.writeUInt32LE(centralSize, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, ...centrals, end]);
}

function workbookFixture({ secondSheet = false } = {}) {
  const sheetsXml = secondSheet
    ? '<sheet name="Товары" sheetId="1" r:id="rId1"/><sheet name="Служебный" sheetId="2" state="hidden" r:id="rId2"/>'
    : '<sheet name="Товары" sheetId="1" r:id="rId1"/>';
  const relsXml = secondSheet
    ? '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet2.xml"/>'
    : '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>';
  return zip({
    '[Content_Types].xml': '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"/>',
    '_rels/.rels': '<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>',
    'xl/workbook.xml': `<?xml version="1.0"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${sheetsXml}</sheets></workbook>`,
    'xl/_rels/workbook.xml.rels': `<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${relsXml}<Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/><Relationship Id="rId4" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/sharedStrings" Target="sharedStrings.xml"/></Relationships>`,
    'xl/sharedStrings.xml': '<?xml version="1.0"?><sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><si><t>Код</t></si><si><t>Наименование</t></si><si><t>Штрихкод</t></si><si><t>Муфта PPR 32×1/2</t></si><si><t>Служебное</t></si></sst>',
    'xl/styles.xml': '<?xml version="1.0"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><numFmts count="1"><numFmt numFmtId="164" formatCode="00000000000000"/></numFmts><cellXfs count="2"><xf numFmtId="0"/><xf numFmtId="164" applyNumberFormat="1"/></cellXfs></styleSheet>',
    'xl/worksheets/sheet1.xml': '<?xml version="1.0"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><dimension ref="A1:D4"/><mergeCells count="1"><mergeCell ref="A1:C1"/></mergeCells><sheetData><row r="1"><c r="A1" t="s"><v>0</v></c><c r="B1" t="s"><v>1</v></c><c r="C1" t="s"><v>2</v></c></row><row r="2"><c r="A2"><v>28188</v></c><c r="B2" t="s"><v>3</v></c><c r="C2" s="1"><v>4660028388359</v></c><c r="D2"><f>1+1</f><v>2</v></c></row><row r="3" hidden="1"><c r="A3"><v>28189</v></c><c r="B3" t="inlineStr"><is><t>Муфта PPR 40×3/4</t></is></c><c r="D3"><f>2+2</f></c></row></sheetData></worksheet>',
    ...(secondSheet ? {'xl/worksheets/sheet2.xml': '<?xml version="1.0"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><dimension ref="A1:A1"/><sheetData><row r="1"><c r="A1" t="s"><v>4</v></c></row></sheetData></worksheet>'} : {})
  });
}

async function withFixture(ext, options = {}) {
  const dir = await mkdtemp(path.join(tmpdir(), 'catalog-inventory-'));
  const file = path.join(dir, `fixture.${ext}`);
  await writeFile(file, workbookFixture(options));
  return file;
}

test('OOXML reader handles xlsx/xlsm, Cyrillic sheets, styles, formulas, merges, and hidden rows', async () => {
  for (const ext of ['xlsx', 'xlsm']) {
    const file = await withFixture(ext);
    const workbook = await readWorkbook(file);
    assert.equal(workbook.sheets[0].name, 'Товары');
    assert.deepEqual(workbook.sheets[0].merged_ranges, ['A1:C1']);
    assert.equal(workbook.sheets[0].hidden_row_count, 1);
    assert.equal(workbook.sheets[0].formula_count, 2);
    assert.equal(workbook.sheets[0].formula_without_cached_value_count, 1);
    assert.equal(workbook.sheets[0].rows[1].cells.C.text, '04660028388359');
  }
});

test('configured extraction preserves identifiers as strings and reports missing formula results', async () => {
  const file = await withFixture('xlsx');
  const workbook = await readWorkbook(file);
  const [record, hiddenRecord] = extractConfiguredRecords(workbook, {
    source_id: 'fixture',
    price_pool: 'fixture',
    sheets: [{
      name: 'Товары',
      header_row: 1,
      columns: {supplier_sku: 'A', name: 'B', gtin: 'C'},
      row_predicate: 'sku_and_name'
    }]
  }, 'sha256:fixture');
  assert.equal(record.raw.supplier_sku, '28188');
  assert.equal(record.raw.gtin, '04660028388359');
  assert.equal(hiddenRecord.source.hidden, true);
  assert.ok(hiddenRecord.diagnostics.some(({code}) => code === 'FORMULA_RESULT_UNAVAILABLE'));
});

test('configured extraction keeps non-product rows for source accounting', async () => {
  const file = await withFixture('xlsx');
  const workbook = await readWorkbook(file);
  workbook.sheets[0].rows.push({number: 4, hidden: false, cells: {B: {text: 'Раздел фитингов', formula: null, formula_has_cached_value: false}}});
  const records = extractConfiguredRecords(workbook, {
    source_id: 'fixture',
    price_pool: 'fixture',
    sheets: [{
      name: 'Товары',
      header_row: 1,
      columns: {supplier_sku: 'A', name: 'B', gtin: 'C'},
      row_predicate: 'sku_and_name'
    }]
  }, 'sha256:fixture');
  const heading = records.find(item => item.source.row === 4);
  assert.equal(heading.row_status, 'non_product');
  assert.equal(heading.taxonomy_status, 'not_applicable');
});

test('carry-forward context ignores numeric repeated-header markers', async () => {
  const file = await withFixture('xlsx');
  const workbook = await readWorkbook(file);
  workbook.sheets[0].rows = [
    {number: 1, hidden: false, cells: {B: {text: 'Категория PP-R', formula: null, formula_has_cached_value: null}}},
    {number: 2, hidden: false, cells: {B: {text: '81', formula: null, formula_has_cached_value: null}, A: {text: 'Арт', formula: null, formula_has_cached_value: null}}},
    {number: 3, hidden: false, cells: {A: {text: '28188', formula: null, formula_has_cached_value: null}, B: {text: 'Муфта PPR 32', formula: null, formula_has_cached_value: null}}}
  ];
  workbook.sheets[0].nonempty_row_count = 3;
  const records = extractConfiguredRecords(workbook, {
    source_id: 'fixture',
    price_pool: 'fixture',
    sheets: [{
      name: 'Товары',
      header_row: 0,
      columns: {supplier_sku: 'A', name: 'B'},
      carry_forward_context_columns: ['B'],
      row_predicate: 'sku_and_name'
    }]
  }, 'sha256:fixture');
  const product = records.find(item => item.row_status === 'product_candidate');
  assert.deepEqual(product.raw.category_context, ['Категория PP-R']);
});

test('source coverage rejects unconfigured non-empty sheets and ignored sheets without reasons', async () => {
  const file = await withFixture('xlsx', {secondSheet: true});
  const workbook = await readWorkbook(file);
  assert.throws(() => validateSourceCoverage(workbook, {sheets: [{name: 'Товары'}], ignored_sheets: []}), /UNCONFIGURED_NON_EMPTY_SHEET/);
  assert.throws(() => validateSourceCoverage(workbook, {sheets: [{name: 'Товары'}], ignored_sheets: [{name: 'Служебный', reason: ''}]}), /IGNORED_SHEET_REASON_REQUIRED/);
  assert.doesNotThrow(() => validateSourceCoverage(workbook, {sheets: [{name: 'Товары'}], ignored_sheets: [{name: 'Служебный', reason: 'test helper'}]}));
});

test('name normalizer is deterministic and replaces typed dimensions without classifying', () => {
  const value = normalizeName('  Муфта ЁЛКА PPR 32×1/2", PN 20  ');
  assert.equal(value.name, 'муфта елка ppr 32x1/2", pn 20');
  assert.match(value.name_skeleton, /<diameter_mm>/);
  assert.match(value.name_skeleton, /<thread_inch>/);
  assert.match(value.name_skeleton, /<pn>/);
  assert.ok(value.tokens.includes('ppr'));
});
