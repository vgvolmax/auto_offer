import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

const root = path.resolve(import.meta.dirname, '..');
const files = {
  catalog: 'annotation-kits/catalog/CATALOG_ANNOTATION_PROMPT.md',
  request: 'annotation-kits/request/REQUEST_ANNOTATION_PROMPT.md',
};
const read = (file) => readFile(path.join(root, file), 'utf8');

test('chat prompts exist, are complete, and identify their contracts', async () => {
  for (const [kind, file] of Object.entries(files).filter(([kind]) => kind === 'catalog')) {
    const prompt = await read(file);
    const kit = JSON.parse(await read(`annotation-kits/${kind}-annotation-kit.json`));
    assert.ok(prompt.trim());
    assert.doesNotMatch(prompt, /\b(?:TODO|TBD|FIXME)\b/i);
    assert.match(prompt, new RegExp(`${kind}-annotation-kit\\.json`));
    assert.ok(prompt.includes(kit.root_schema_id));
    assert.ok(prompt.includes(`${kind}_bundle`));
    for (const forbidden of ['matching', 'product_id', 'offer_id']) {
      assert.ok(prompt.includes(forbidden), `${file} must prohibit ${forbidden}`);
    }
    assert.match(prompt, /embedded `schemas_by_id`/);
    assert.match(prompt, /скачиваемый UTF-8\s+JSON-файл/);
    assert.ok(prompt.length < 15_000, 'prompt must reference, not embed, the large kit');
    assert.ok(prompt.length * 5 < (await read(`annotation-kits/${kind}-annotation-kit.json`)).length);
  }
});

test('request step two uses only source and selected kit', async () => {
  const prompt = await read(files.request);
  assert.match(prompt, /request-source\.json/);
  assert.match(prompt, /request-selected-kit\.json/);
  assert.match(prompt, /request_bundle/);
  assert.match(prompt, /embedded `schemas_by_id`/);
  assert.match(prompt, /Не используй исходный\s+PDF, full request kit/);
});

test('request preparation prompt defines both intermediate artifact shapes', async () => {
  const prompt = await read('annotation-kits/request/REQUEST_PREPARE_PROMPT.md');
  for (const key of ['kind', 'source_file', 'line_count', 'lines']) {
    assert.ok(prompt.includes(`"${key}"`), `request source shape must include ${key}`);
  }
  for (const key of [
    'kind', 'source_kit_version', 'taxonomy_version', 'annotation_schema_version',
    'bundle_schema_version', 'root_schema_id', 'selected_class_ids', 'line_candidates',
    'taxonomy', 'class_schema_ids', 'schemas_by_id',
  ]) assert.ok(prompt.includes(`"${key}"`), `selected kit shape must include ${key}`);
  assert.match(prompt, /line_count === lines\.length/);
  assert.match(prompt, /source_kit_version.*fullKit\.kit_version/);
});

test('request preparation preserves the complete logical table row', async () => {
  const prompt = await read('annotation-kits/request/REQUEST_PREPARE_PROMPT.md');
  const normalized = prompt.replaceAll('**', '').replace(/\s+/g, ' ');
  for (const marker of [
    'вся логическая строка таблицы',
    'все непустые product-defining cells',
    'только из значения «Наименование»',
    '«Тип/марка»',
    '«Производитель», «Изготовитель»',
    '«Примечание»',
    '«или эквивалент»',
    'lossless serialization',
    'Количество остаётся отдельно в `quantity_raw`',
  ]) assert.ok(normalized.includes(marker), `preparation prompt must include ${marker}`);
});

test('catalog prompt preserves source and records interpretation', async () => {
  const prompt = await read(files.catalog);
  for (const term of ['source.raw_fields', 'evidence', 'unknown_fields', 'ambiguities', 'RFC 6901']) {
    assert.ok(prompt.includes(term), `catalog prompt must mention ${term}`);
  }
  assert.match(prompt, /Не нормализуй исходные SKU, GTIN/);
});

test('request prompt requires sparse constraints and explicit-only substitution', async () => {
  const prompt = await read(files.request);
  assert.match(prompt, /sparse constraints/);
  assert.match(prompt, /явно написанного/);
  assert.match(prompt, /"policy":"unspecified","explicit":false,"raw_text":null/);
});

test('request prompt treats omitted optional properties as valid sparse input', async () => {
  const prompt = await read(files.request);
  const normalized = prompt.replace(/\r\n/g, '\n');
  for (const marker of [
    'SPARSE REQUEST IS VALID',
    'Optional missing != unknown',
    '`unknown_fields` не является checklist',
    'Отсутствие\noptional field само по себе не означает `needs_review`',
    'Ambiguity с `blocking: false`\nсама по себе не заставляет ставить `needs_review`',
    'Не выдумывай отсутствующие характеристики ради `validated`',
  ]) assert.ok(normalized.includes(marker), `annotation prompt must include ${marker}`);
});

test('operator workflow lists catalog and two-step request attachments and validators', async () => {
  const workflow = await read('docs/CHAT_ANNOTATION_WORKFLOW.md');
  for (const file of [
    'CATALOG_ANNOTATION_PROMPT.md',
    'catalog-annotation-kit.json',
    'REQUEST_ANNOTATION_PROMPT.md',
    'request-annotation-kit.json',
  ]) assert.ok(workflow.includes(file));
  assert.ok(workflow.includes('REQUEST_PREPARE_PROMPT.md'));
  assert.ok(workflow.includes('request-source.json'));
  assert.ok(workflow.includes('request-selected-kit.json'));
  assert.match(workflow, /Обязательно откройте новый чат/);
  assert.ok(workflow.includes('npm run validate:catalog-bundle -- <file>'));
  assert.ok(workflow.includes('npm run validate:request-bundle -- <file>'));
});
