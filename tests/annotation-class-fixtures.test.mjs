import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { loadAnnotationSchemas } from '../scripts/lib/annotation-schema-loader.mjs';
import { validateAnnotation } from '../scripts/lib/annotation-contract-validator.mjs';

const taxonomy = JSON.parse(await readFile('taxonomy/taxonomy.json', 'utf8'));
const registry = JSON.parse(await readFile('schemas/annotation/class-schema-registry.json', 'utf8'));
const { classSchemas } = await loadAnnotationSchemas();
const classIds = Object.keys(taxonomy.classes);
const dir = 'tests/fixtures/annotation/classes';
const json = async filename => JSON.parse(await readFile(filename, 'utf8'));

function validateFixture(fixture) {
  if (fixture.kind === 'catalog_item') {
    const entry = registry.classes[fixture.data.class_id];
    const structural = classSchemas[entry.catalog_schema].validator(fixture.data);
    const semantic = validateAnnotation({ kind: 'catalog_item', data: fixture.data, taxonomy, registry, schemas: classSchemas });
    return { structural, semantic };
  }
  const line = fixture.data;
  const entry = registry.classes[line.class_id];
  const structural = classSchemas[entry.request_schema].validator(line);
  const document = { schema_version:'1.1.0', taxonomy_version:'1.0.0', request_id:'synthetic', document:{source_file:'synthetic.txt',document_type:'product_request'}, lines:[line] };
  const semantic = validateAnnotation({ kind: 'request_document', data: document, taxonomy, registry, schemas: classSchemas });
  return { structural, semantic };
}

test('every production class has a complete synthetic fixture set', async () => {
  const files = (await readdir(dir)).filter(name => name.endsWith('.json')).sort();
  assert.deepEqual(files, classIds.map(classId => `${classId}.json`));
  for (const classId of classIds) {
    const fixture = await json(`${dir}/${classId}.json`);
    assert.equal(fixture.class_id, classId);
    assert.ok(fixture.valid.length >= 3, classId);
    assert.ok(fixture.valid.some(item => item.kind === 'catalog_item'), classId);
    assert.ok(fixture.valid.some(item => item.kind === 'request_line'), classId);
    for (const item of fixture.valid) {
      const { structural, semantic } = validateFixture(item);
      assert.equal(structural, true, `${classId}: ${JSON.stringify(classSchemas[registry.classes[classId][item.kind === 'catalog_item' ? 'catalog_schema' : 'request_schema']].validator.errors)}`);
      assert.equal(semantic.valid, true, `${classId}: ${JSON.stringify(semantic.issues)}`);
    }
    for (const item of [fixture.needs_review.unknown, fixture.needs_review.ambiguity]) {
      const { structural, semantic } = validateFixture(item);
      assert.equal(structural, true, classId);
      assert.equal(semantic.valid, true, `${classId}: ${JSON.stringify(semantic.issues)}`);
      assert.equal(item.data.annotation.status, 'needs_review');
    }
    for (const item of Object.values(fixture.invalid)) {
      const { structural, semantic } = validateFixture(item);
      assert.equal(structural && semantic.valid, false, `${classId}: invalid fixture was accepted`);
    }
  }
});
