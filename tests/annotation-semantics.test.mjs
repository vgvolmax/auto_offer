import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { getCanonicalValueIds, validateAnnotation } from '../scripts/lib/annotation-contract-validator.mjs';
import { loadAnnotationSchemas } from '../scripts/lib/annotation-schema-loader.mjs';

const fixtureRoot = 'tests/fixtures/annotation';
const taxonomy = JSON.parse(await readFile(`${fixtureRoot}/taxonomy.fixture.json`, 'utf8'));
const registry = JSON.parse(await readFile('schemas/annotation/class-schema-registry.json', 'utf8'));
const { ajv, classSchemas } = await loadAnnotationSchemas();
const sparseRequest = JSON.parse(await readFile(`${fixtureRoot}/valid/request-sparse-identity.json`, 'utf8'));
const completeCatalog = JSON.parse(await readFile(`${fixtureRoot}/valid/catalog-complete-ppr-adapter.json`, 'utf8'));
const entryPoints = {
  document_segmentation: 'https://example.local/schemas/annotation/document-segmentation.schema.json',
  request_document: 'https://example.local/schemas/annotation/request-document.base.schema.json',
  catalog_item: 'https://example.local/schemas/annotation/generated/catalog-item.dispatch.schema.json'
};

test('taxonomy accepts only normative object-based value sets', () => {
  assert.deepEqual([...getCanonicalValueIds(taxonomy, 'brands')], ['valtec', 'rtp']);
  assert.throws(() => getCanonicalValueIds({ value_sets: { brands: ['valtec'] } }, 'brands'), /normative object-based format/);
});

function validateRequestGtin(gtin, status = 'validated') {
  const data = structuredClone(sparseRequest.data);
  const line = data.lines[0];
  if (gtin !== undefined) {
    line.requested_identity.gtin = gtin;
    line.annotation.evidence.push({ json_pointer: '/requested_identity/gtin', source_text: 'source' });
  }
  line.annotation.status = status;
  if (status === 'needs_review') {
    line.annotation.issues.push({ code: 'INVALID_REQUEST_GTIN', json_pointer: '/requested_identity/gtin' });
  }
  return validateAnnotation({ kind: 'request_document', data, taxonomy, registry, schemas: classSchemas });
}

test('implicit unspecified substitution policy does not require fabricated evidence', () => {
  const result = validateAnnotation({ kind: 'request_document', data: sparseRequest.data, taxonomy, registry, schemas: classSchemas });
  assert.equal(result.valid, true);
  assert.ok(!result.issues.some(({ code }) => code === 'MISSING_EVIDENCE'));
});

test('request port role does not require separate evidence', () => {
  const data = structuredClone(sparseRequest.data);
  const line = data.lines[0];
  line.constraints.ports = [{
    role: 'pipe',
    pipe_outer_diameter_mm: { operator: 'between', min: 25, max: 40 }
  }];
  line.annotation.evidence.push({
    json_pointer: '/constraints/ports/0/pipe_outer_diameter_mm',
    source_text: '25–40 мм'
  });
  const result = validateAnnotation({ kind: 'request_document', data, taxonomy, registry, schemas: classSchemas });
  assert.equal(result.valid, true);
  assert.ok(!result.issues.some(({ code, path }) => code === 'MISSING_EVIDENCE' && path.endsWith('/role')));
});

test('request port technical field still requires evidence', () => {
  const data = structuredClone(sparseRequest.data);
  data.lines[0].constraints.ports = [{
    role: 'pipe',
    pipe_outer_diameter_mm: { operator: 'between', min: 25, max: 40 }
  }];
  const result = validateAnnotation({ kind: 'request_document', data, taxonomy, registry, schemas: classSchemas });
  assert.ok(result.issues.some(({ code, path }) =>
    code === 'MISSING_EVIDENCE' && path === '/lines/0/constraints/ports/0/pipe_outer_diameter_mm'));
  assert.ok(!result.issues.some(({ code, path }) => code === 'MISSING_EVIDENCE' && path.endsWith('/role')));
});

test('warnings are nonblocking while issues are always blocking', () => {
  const data = structuredClone(sparseRequest.data);
  const annotation = data.lines[0].annotation;
  annotation.warnings = [{ code: 'CHECK_SOURCE' }];
  assert.equal(validateAnnotation({ kind: 'request_document', data, taxonomy, registry, schemas: classSchemas }).valid, true);
  annotation.issues.push({ code: 'BAD_VALUE' });
  assert.ok(validateAnnotation({ kind: 'request_document', data, taxonomy, registry, schemas: classSchemas }).issues.some(({ code }) => code === 'VALIDATED_WITH_ISSUES'));
});

test('a present catalog series requires evidence', () => {
  const data = structuredClone(completeCatalog.data);
  data.annotation.evidence = data.annotation.evidence.filter(({ json_pointer }) => json_pointer !== '/identity/series');
  const result = validateAnnotation({ kind: 'catalog_item', data, taxonomy, registry, schemas: classSchemas });
  assert.ok(result.issues.some(({ code, path }) => code === 'MISSING_EVIDENCE' && path === '/identity/series'));
});

test('absent request GTIN is not treated as invalid', () => {
  const result = validateRequestGtin(undefined);
  assert.equal(result.valid, true);
  assert.ok(!result.issues.some(({ code }) => code === 'INVALID_REQUEST_GTIN_REQUIRES_REVIEW'));
});

test('valid explicit request GTIN constraints are accepted', () => {
  for (const gtin of [
    { operator: 'eq', value: '4006381333931' },
    { operator: 'in', values: ['4006381333931', '036000291452'] }
  ]) {
    const result = validateRequestGtin(gtin);
    assert.equal(result.valid, true);
    assert.ok(!result.issues.some(({ code }) => code === 'INVALID_REQUEST_GTIN_REQUIRES_REVIEW'));
  }
});

test('an invalid explicit request GTIN requires review', () => {
  for (const gtin of [
    { operator: 'eq', value: '4006381333932' },
    { operator: 'in', values: ['4006381333931', '4006381333932'] }
  ]) {
    const result = validateRequestGtin(gtin);
    assert.ok(result.issues.some(({ code }) => code === 'INVALID_REQUEST_GTIN_REQUIRES_REVIEW'));
  }
});

test('an invalid request GTIN already marked for review does not add a semantic issue', () => {
  const result = validateRequestGtin({ operator: 'eq', value: '4006381333932' }, 'needs_review');
  assert.equal(result.valid, true);
  assert.ok(!result.issues.some(({ code }) => code === 'INVALID_REQUEST_GTIN_REQUIRES_REVIEW'));
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
