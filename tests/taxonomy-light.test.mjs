import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import Ajv2020 from 'ajv/dist/2020.js';
import { buildTaxonomyLight } from '../scripts/taxonomy/lib/taxonomy-light.mjs';

const json = (file) => readFile(new URL(`../${file}`, import.meta.url), 'utf8').then(JSON.parse);
const [taxonomy, light, schema] = await Promise.all([
  json('taxonomy/taxonomy.json'), json('taxonomy/taxonomy-light.json'), json('schemas/chat-pipeline/taxonomy-light.schema.json'),
]);

test('generated taxonomy light is schema-valid and is the exact production projection', () => {
  const validate = new Ajv2020({ allErrors: true }).compile(schema);
  assert.equal(validate(light), true, JSON.stringify(validate.errors));
  assert.equal(light.taxonomy_version, taxonomy.taxonomy_version);
  assert.equal(light.taxonomy_schema_version, taxonomy.taxonomy_schema_version);
  assert.equal(light.class_count, Object.keys(taxonomy.classes).length);
  assert.deepEqual(light.classes.map(({ class_id }) => class_id), Object.keys(taxonomy.classes).sort());
  for (const projected of light.classes) {
    const source = taxonomy.classes[projected.class_id];
    assert.deepEqual(projected, {
      class_id: source.class_id, family_id: source.family_id, name_ru: source.name_ru,
      definition_ru: source.definition_ru, include_rules_ru: source.include_rules_ru,
      exclude_rules_ru: source.exclude_rules_ru,
    });
    for (const forbidden of ['attributes', 'ports', 'matching_critical_paths']) assert.equal(Object.hasOwn(projected, forbidden), false);
  }
  assert.equal(Object.hasOwn(light, 'value_sets'), false);
});

test('taxonomy light generation is deterministic and does not mutate its source', () => {
  const before = structuredClone(taxonomy);
  assert.deepEqual(buildTaxonomyLight(taxonomy), buildTaxonomyLight(taxonomy));
  assert.deepEqual(taxonomy, before);
});

test('taxonomy light generation fails closed on incomplete or inconsistent input', () => {
  assert.throws(() => buildTaxonomyLight({ status: 'production', classes: {} }), /taxonomy_schema_version/);
  const damaged = structuredClone(taxonomy);
  delete damaged.classes[Object.keys(damaged.classes)[0]].definition_ru;
  assert.throws(() => buildTaxonomyLight(damaged), /definition_ru/);
  assert.throws(() => buildTaxonomyLight({ ...taxonomy, class_count: -1 }), /class_count/);
});
