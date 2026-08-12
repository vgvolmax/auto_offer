import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { buildRequestPortContracts, selectorValues } from '../scripts/annotation/lib/request-port-contracts.mjs';

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
  assert.equal(request.oneOf.length, 42);
  assert.equal(new Set(catalog.oneOf.map(item => item.$ref)).size, 41);
  assert.equal(new Set(request.oneOf.map(item => item.$ref)).size, 42);
  assert.equal(request.oneOf[0].$ref, '../unsupported-request-line.schema.json');
});

test('registry declares repeatable pipe_end only for pressure pipe classes', async () => {
  const registry = await json('schemas/annotation/class-schema-registry.json');
  for (const [classId, entry] of Object.entries(registry.classes)) {
    const expectedRoles = classId.startsWith('pipe.') && !classId.startsWith('pipe.sewer.') ? ['pipe_end'] : [];
    assert.deepEqual(entry.repeatable_port_roles, expectedRoles, classId);
  }
});

test('request registry exposes only class-declared technical port fields', async () => {
  const registry = await json('schemas/annotation/class-schema-registry.json');
  const paths = registry.classes['pipe.pert'].allowed_annotation_paths;
  for (const path of ['/constraints/ports/*/connection_kind', '/constraints/ports/*/system', '/constraints/ports/*/pipe_outer_diameter_mm']) assert.ok(paths.includes(path), path);
  for (const path of ['/constraints/ports/*/nominal_diameter_dn', '/constraints/ports/*/pipe_wall_thickness_mm', '/constraints/ports/*/thread_standard', '/constraints/ports/*/thread_size']) assert.equal(paths.includes(path), false, path);
  assert.ok(paths.includes('/constraints/attributes/wall_thickness_mm'));
});

test('request port contracts merge selectors and fields deterministically', () => {
  assert.deepEqual(selectorValues({ allowed: ['female_thread', 'male_thread', 'female_thread'] }), ['female_thread', 'male_thread']);
  assert.deepEqual(selectorValues({ fixed: 'pe_rt' }), ['pe_rt']);
  assert.deepEqual(selectorValues(), []);
  const definition = { class_id: 'synthetic', ports: { request_allowed_roles: ['inlet'], catalog_ordered_slots: [
    { role: 'inlet', connection_kind: { fixed: 'female_thread' }, system: { fixed: 'threaded_generic' }, allowed_fields: ['thread_size'] },
    { role: 'inlet', connection_kind: { allowed: ['male_thread', 'female_thread'] }, system: { fixed: 'threaded_generic' }, allowed_fields: ['thread_standard'] }
  ] } };
  assert.deepEqual(buildRequestPortContracts(definition), [{
    role: 'inlet', connection_kind_selector: { allowed: ['female_thread', 'male_thread'] },
    system_selector: { fixed: 'threaded_generic' }, allowed_fields: ['thread_size', 'thread_standard']
  }]);
  assert.throws(() => buildRequestPortContracts({ class_id: 'broken', ports: { request_allowed_roles: ['missing'], catalog_ordered_slots: [] } }), /REQUEST_ROLE_WITHOUT_CATALOG_SLOT:broken:missing/);
});
