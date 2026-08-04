import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { loadBundleValidationContext } from '../scripts/bundles/lib/bundle-schema-loader.mjs';
import { validateCatalogBundle as validateCanonical } from '../scripts/bundles/lib/bundle-validator.mjs';
import { buildCatalogValidationKit } from '../scripts/catalog-validation-kit/lib/generation-core.mjs';
import {
  buildCatalogAjvRuntimeSource,
  loadRepositoryValidationInputs,
} from '../scripts/catalog-validation-kit/repository-inputs.mjs';

const root = path.resolve(import.meta.dirname, '..');
const fixture = JSON.parse(await readFile(path.join(root, 'tests/fixtures/bundles/catalog.valid.json'), 'utf8'));
const canonicalContext = await loadBundleValidationContext({ root });
const generated = await buildCatalogValidationKit(
  await loadRepositoryValidationInputs(root),
  { ajvRuntimeSource: await buildCatalogAjvRuntimeSource() },
);
const generatedModule = await import(`data:text/javascript;base64,${Buffer.from(generated.source).toString('base64')}`);
const clone = value => structuredClone(value);
const normalized = result => ({
  valid: result.valid,
  kind: result.kind,
  summary: result.summary,
  errors: result.errors.map(({ code, path, message }) => ({ code, path, message })),
});

const scenarios = [
  ['valid fixture', () => {}],
  ['bundle schema error', bundle => { bundle.extra = true; }],
  ['unknown pointer to confirmed value', bundle => {
    const item = bundle.items[0].catalog_item;
    item.annotation.status = 'needs_review';
    item.annotation.unknown_fields.push('/attributes/body_material');
  }],
  ['ambiguity pointer to confirmed value', bundle => {
    const item = bundle.items[0].catalog_item;
    item.annotation.status = 'needs_review';
    item.annotation.ambiguities.push({
      json_pointer: '/attributes/body_material',
      code: 'MULTIPLE_POSSIBLE_VALUES',
      source_text: 'synthetic parity test',
      possible_values: ['aluminum', 'brass'],
      blocking: true,
    });
  }],
  ['missing critical field', bundle => {
    const item = bundle.items[0].catalog_item;
    item.annotation.status = 'needs_review';
    delete item.attributes.handle_type;
    item.annotation.evidence = item.annotation.evidence.filter(entry => entry.json_pointer !== '/attributes/handle_type');
  }],
  ['missing evidence', bundle => { bundle.items[0].catalog_item.annotation.evidence = []; }],
  ['taxonomy mismatch', bundle => { bundle.taxonomy_version = '9.9.9'; }],
  ['item count mismatch', bundle => { bundle.catalog.item_count = 9; }],
  ['duplicate source id', bundle => { bundle.items.push(clone(bundle.items[0])); bundle.catalog.item_count = 2; }],
];

for (const [name, mutate] of scenarios) {
  test(`generated validator matches canonical validator: ${name}`, async () => {
    const canonicalInput = clone(fixture);
    const generatedInput = clone(fixture);
    mutate(canonicalInput);
    mutate(generatedInput);
    const before = JSON.stringify(generatedInput);
    const expected = normalized(validateCanonical(canonicalInput, canonicalContext));
    const actual = normalized(await generatedModule.validateCatalogBundle(generatedInput));
    assert.deepEqual(actual, expected);
    assert.equal(JSON.stringify(generatedInput), before);
  });
}

test('targeted scenarios exercise the expected semantic codes', async () => {
  const exercised = new Set();
  for (const [, mutate] of scenarios.slice(1)) {
    const bundle = clone(fixture);
    mutate(bundle);
    for (const entry of (await generatedModule.validateCatalogBundle(bundle)).errors) exercised.add(entry.code);
  }
  for (const code of [
    'BUNDLE_SCHEMA_INVALID',
    'UNKNOWN_POINTS_TO_VALUE',
    'AMBIGUITY_POINTS_TO_CONFIRMED_VALUE',
    'MISSING_CRITICAL_FIELD',
    'MISSING_EVIDENCE',
    'TAXONOMY_VERSION_MISMATCH',
    'ITEM_COUNT_MISMATCH',
    'DUPLICATE_SOURCE_ITEM_ID',
  ]) assert.ok(exercised.has(code), `Expected ${code} to be exercised`);
});
