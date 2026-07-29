import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';

const json = async filename => JSON.parse(await readFile(filename, 'utf8'));

const expected = Object.keys((await json('taxonomy/taxonomy.json')).classes);

test('class contract generator creates exact taxonomy registry and schema counts', async () => {
  const { generateClassContracts } = await import('../scripts/annotation/generate-class-contracts.mjs');
  const result = await generateClassContracts();
  assert.equal(result.classCount, 41);
  const registry = await json('schemas/annotation/class-schema-registry.json');
  assert.equal(registry.taxonomy_version, '1.0.0');
  assert.deepEqual(Object.keys(registry.classes), expected);
  const names = (await readdir('schemas/annotation/class-specific')).sort();
  assert.equal(names.filter(name => name.endsWith('.catalog.schema.json')).length, 41);
  assert.equal(names.filter(name => name.endsWith('.request.schema.json')).length, 41);
  assert.equal(names.some(name => name.includes('fitting.adapter.ppr.male_thread')), false);
});

test('every generated schema filename and class_id const agree', async () => {
  for (const classId of expected) {
    for (const kind of ['catalog', 'request']) {
      const filename = path.join('schemas/annotation/class-specific', `${classId}.${kind}.schema.json`);
      const schema = await json(filename);
      const constValue = schema.allOf.flatMap(item => item?.properties?.class_id?.const ?? []).at(0);
      assert.equal(constValue, classId, filename);
    }
  }
});

test('dispatchers reference every class exactly once', async () => {
  const catalog = await json('schemas/annotation/generated/catalog-item.dispatch.schema.json');
  const request = await json('schemas/annotation/generated/request-line.dispatch.schema.json');
  assert.equal(catalog.oneOf.length, 41);
  assert.equal(request.oneOf.length, 41);
  assert.equal(new Set(catalog.oneOf.map(item => item.$ref)).size, 41);
  assert.equal(new Set(request.oneOf.map(item => item.$ref)).size, 41);
});

test('registry declares repeatable pipe_end only for pressure pipe classes', async () => {
  const registry = await json('schemas/annotation/class-schema-registry.json');
  for (const [classId, entry] of Object.entries(registry.classes)) {
    const expectedRoles = classId.startsWith('pipe.') && !classId.startsWith('pipe.sewer.') ? ['pipe_end'] : [];
    assert.deepEqual(entry.repeatable_port_roles, expectedRoles, classId);
  }
});
