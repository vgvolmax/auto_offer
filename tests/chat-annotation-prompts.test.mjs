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
  for (const [kind, file] of Object.entries(files)) {
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
  assert.match(prompt, /только если он\s+явно написан/);
  assert.match(prompt, /"policy":"unspecified","explicit":false,"raw_text":null/);
});

test('operator workflow lists both three-attachment flows and validators', async () => {
  const workflow = await read('docs/CHAT_ANNOTATION_WORKFLOW.md');
  for (const file of [
    'CATALOG_ANNOTATION_PROMPT.md',
    'catalog-annotation-kit.json',
    'REQUEST_ANNOTATION_PROMPT.md',
    'request-annotation-kit.json',
  ]) assert.ok(workflow.includes(file));
  assert.match(workflow, /три (?:типа )?вложения/g);
  assert.ok(workflow.includes('npm run validate:catalog-bundle -- <file>'));
  assert.ok(workflow.includes('npm run validate:request-bundle -- <file>'));
});
