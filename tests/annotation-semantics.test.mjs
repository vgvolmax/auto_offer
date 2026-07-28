import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { getCanonicalValueIds, isValidGtin, validateAnnotation } from '../scripts/lib/annotation-contract-validator.mjs';
import { loadAnnotationSchemas } from '../scripts/lib/annotation-schema-loader.mjs';

const fixtureRoot = 'tests/fixtures/annotation';
const taxonomy = JSON.parse(await readFile(`${fixtureRoot}/taxonomy.fixture.json`, 'utf8'));
const registry = JSON.parse(await readFile('schemas/annotation/class-schema-registry.json', 'utf8'));
const { ajv, classSchemas } = await loadAnnotationSchemas();
const entryPoints = {
  document_segmentation: 'https://example.local/schemas/annotation/document-segmentation.schema.json',
  request_document: 'https://example.local/schemas/annotation/request-document.base.schema.json',
  catalog_item: 'https://example.local/schemas/annotation/generated/catalog-item.dispatch.schema.json'
};

test('GTIN-8/12/13/14 checksum vectors use right-to-left weights', () => {
  for (const value of ['96385074', '036000291452', '4006381333931', '10012345000017']) assert.equal(isValidGtin(value), true, value);
  for (const value of ['96385075', '036000291453', '4006381333932', '10012345000018']) assert.equal(isValidGtin(value), false, value);
});

test('taxonomy accepts only normative object-based value sets', () => {
  assert.deepEqual([...getCanonicalValueIds(taxonomy, 'brands')], ['valtec', 'rtp']);
  assert.throws(() => getCanonicalValueIds({ value_sets: { brands: ['valtec'] } }, 'brands'), /normative object-based format/);
});

for (const group of ['valid', 'needs-review', 'invalid']) {
  for (const filename of (await readdir(path.join(fixtureRoot, group))).sort()) {
    const fixture = JSON.parse(await readFile(path.join(fixtureRoot, group, filename), 'utf8'));
    test(`${group}/${filename} passes the structural → semantic contract pipeline`, () => {
      const structural = ajv.getSchema(entryPoints[fixture.kind]);
      const schemaValid = structural(fixture.data);
      assert.equal(schemaValid, fixture.expected_schema_valid, JSON.stringify(structural.errors, null, 2));
      const localRegistry = structuredClone(registry); const localSchemas = { ...classSchemas };
      if (filename === 'missing-class-schema.json') delete localRegistry.classes['fitting.adapter.ppr.male_thread'].request_schema;
      const result = validateAnnotation({ kind: fixture.kind, data: fixture.data, taxonomy, registry: localRegistry, schemas: localSchemas });
      const codes = result.issues.map(x => x.code);
      for (const code of fixture.expected_semantic_codes ?? []) assert.ok(codes.includes(code), `${code} not in ${codes.join(', ')}`);
      if (group !== 'invalid') assert.deepEqual(result.issues, []);
      if (group === 'valid') assert.equal(schemaValid && result.valid, true);
      if (group === 'needs-review') assert.equal(fixture.data.annotation?.status ?? fixture.data.lines?.[0]?.annotation.status, 'needs_review');
    });
  }
}
