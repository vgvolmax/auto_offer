import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import {
  classifyCatalogValidationInputs,
  preflightCatalogValidationInputs,
} from '../scripts/catalog-validation-kit/lib/input-contract.mjs';

const root = path.resolve(import.meta.dirname, '..');
const file = async (name, repositoryPath = name) => ({
  name,
  text: await readFile(path.join(root, repositoryPath), 'utf8'),
});

async function validInputs() {
  return [
    await file('catalog-annotation-kit.json', 'annotation-kits/catalog-annotation-kit.json'),
    await file('class-schema-registry.json', 'schemas/annotation/class-schema-registry.json'),
    await file('bundle-validator.mjs', 'scripts/bundles/lib/bundle-validator.mjs'),
    await file('annotation-contract-validator.mjs', 'scripts/lib/annotation-contract-validator.mjs'),
    await file('catalog-identifiers.mjs', 'scripts/lib/catalog-identifiers.mjs'),
    await file('request-port-contracts.mjs', 'scripts/annotation/lib/request-port-contracts.mjs'),
  ];
}

const codes = result => new Set((result.errors ?? []).map(error => error.code));

test('input roles are detected by content and do not depend on upload order', async () => {
  const inputs = (await validInputs()).reverse();
  const classified = classifyCatalogValidationInputs(inputs);
  assert.equal(classified.errors.length, 0, JSON.stringify(classified.errors, null, 2));
  assert.deepEqual(Object.keys(classified.roles).sort(), [
    'annotation_contract_validator',
    'bundle_validator',
    'catalog_identifiers',
    'catalog_kit',
    'class_registry',
    'request_port_contracts',
  ]);
  const result = preflightCatalogValidationInputs(classified);
  assert.equal(result.ok, true, JSON.stringify(result.errors, null, 2));
  assert.equal(result.summary.class_count, 41);
  assert.equal(result.summary.taxonomy_version, '1.0.0');
});

test('nonstandard filenames are accepted with a warning when content is unambiguous', async () => {
  const inputs = await validInputs();
  inputs[2] = { ...inputs[2], name: 'semantic-root.txt' };
  const result = preflightCatalogValidationInputs(classifyCatalogValidationInputs(inputs));
  assert.equal(result.ok, true, JSON.stringify(result.errors, null, 2));
  assert.ok(result.warnings.some(warning => warning.code === 'NONSTANDARD_FILENAME'));
});

test('missing and duplicate roles are rejected before generation', async () => {
  const missing = await validInputs();
  missing.pop();
  const missingResult = preflightCatalogValidationInputs(classifyCatalogValidationInputs(missing));
  assert.equal(missingResult.ok, false);
  assert.ok(codes(missingResult).has('MISSING_INPUT_ROLE'));

  const duplicate = await validInputs();
  duplicate.push({ ...duplicate[2], name: 'bundle-copy.mjs' });
  const duplicateResult = preflightCatalogValidationInputs(classifyCatalogValidationInputs(duplicate));
  assert.equal(duplicateResult.ok, false);
  assert.ok(codes(duplicateResult).has('DUPLICATE_INPUT_ROLE'));
});

test('invalid JSON and taxonomy-registry class mismatch are rejected', async () => {
  const broken = await validInputs();
  broken[0] = { ...broken[0], text: '{"kind":' };
  const brokenResult = preflightCatalogValidationInputs(classifyCatalogValidationInputs(broken));
  assert.equal(brokenResult.ok, false);
  assert.ok(codes(brokenResult).has('INPUT_JSON_PARSE_FAILED'));

  const mismatch = await validInputs();
  const registry = JSON.parse(mismatch[1].text);
  delete registry.classes['valve.ball'];
  mismatch[1] = { ...mismatch[1], text: JSON.stringify(registry) };
  const mismatchResult = preflightCatalogValidationInputs(classifyCatalogValidationInputs(mismatch));
  assert.equal(mismatchResult.ok, false);
  assert.ok(codes(mismatchResult).has('CLASS_SET_MISMATCH'));
});

test('unresolved relative imports and external imports are rejected', async () => {
  const unresolved = await validInputs();
  unresolved[3] = {
    ...unresolved[3],
    text: unresolved[3].text.replace("./catalog-identifiers.mjs", './missing-helper.mjs'),
  };
  const unresolvedResult = preflightCatalogValidationInputs(classifyCatalogValidationInputs(unresolved));
  assert.equal(unresolvedResult.ok, false);
  assert.ok(codes(unresolvedResult).has('UNRESOLVED_LOCAL_IMPORT'));

  const external = await validInputs();
  external[2] = {
    ...external[2],
    text: `import x from 'unexpected-package';\n${external[2].text}`,
  };
  const externalResult = preflightCatalogValidationInputs(classifyCatalogValidationInputs(external));
  assert.equal(externalResult.ok, false);
  assert.ok(codes(externalResult).has('EXTERNAL_IMPORT_NOT_ALLOWED'));
});
