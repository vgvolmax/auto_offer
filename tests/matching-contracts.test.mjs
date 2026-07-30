import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { canonicalJson } from '../matching/runtime/canonical-json.mjs';
import { matchingInputFingerprint } from '../matching/runtime/matching-fingerprint.mjs';
import { loadMatchingSchemas } from '../scripts/matching/lib/matching-schema-loader.mjs';
import { validatePolicySemantics } from '../scripts/matching/lib/matching-contract-validator.mjs';
import { validatePolicyRegistry } from '../scripts/matching/lib/policy-registry-validator.mjs';
import { listGoldenScenarioDirectories, loadGoldenScenario } from '../scripts/matching/lib/golden-scenario-loader.mjs';
import { validateGoldenResult } from '../scripts/matching/lib/golden-result-validator.mjs';

const read = async (file) => JSON.parse(await readFile(file));
const schemas = await loadMatchingSchemas();
const registry = await read('matching/policies/pilot-v1.json');
const policy = await read('tests/fixtures/matching/golden/D1-single-exact/policy.json');

function schemaRejects(change) {
  const value = structuredClone(registry);
  change(value);
  assert.equal(schemas.registry(value), false);
}

async function registryErrors(change) {
  const value = structuredClone(registry);
  change(value);
  return validatePolicyRegistry(value);
}

async function changedGolden(name, change) {
  const loaded = await loadGoldenScenario(`tests/fixtures/matching/golden/${name}`);
  change(loaded);
  return validateGoldenResult(loaded);
}

test('all schemas compile and all 16 golden scenarios validate', () => {
  assert.doesNotThrow(() => execFileSync(process.execPath, ['scripts/matching/validate-matching-contracts.mjs']));
});

test('registry schema rejects a direction typo', () => schemaRejects((value) => { value.class_rules['valve.ball'].equivalent_rules[0].direction = 'catalog_greater_typo'; }));
test('registry schema rejects an unknown equivalent operator', () => schemaRejects((value) => { value.class_rules['valve.ball'].equivalent_rules[0].operator = 'gte'; }));
test('registry schema rejects an extra rule field', () => schemaRejects((value) => { value.class_rules['valve.ball'].alternative_rules[0].extra = true; }));
test('registry schema rejects a target without field', () => schemaRejects((value) => { delete value.class_rules['valve.ball'].hard_targets[0].field; }));
test('registry schema rejects a port target without role', () => schemaRejects((value) => { delete value.class_rules['valve.ball'].hard_targets[1].role; }));
test('registry schema rejects an unknown defaults value', () => schemaRejects((value) => { value.defaults.unspecified_fields = 'match'; }));

test('registry semantics reject an unknown class', async () => assert.match((await registryErrors((value) => { value.class_rules['unknown.class'] = value.class_rules['valve.ball']; delete value.class_rules['valve.ball']; })).join('\n'), /unknown class/));
test('registry semantics reject an unknown attribute', async () => assert.match((await registryErrors((value) => { value.class_rules['valve.ball'].hard_targets[0].field = 'typo'; })).join('\n'), /unknown attribute/));
test('registry semantics reject an unknown port field', async () => assert.match((await registryErrors((value) => { value.class_rules['valve.ball'].hard_targets[1].field = 'typo'; })).join('\n'), /unknown port field/));
test('registry semantics reject an unsupported port role', async () => assert.match((await registryErrors((value) => { value.class_rules['valve.ball'].hard_targets[1].role = 'side'; })).join('\n'), /unsupported port role/));
test('registry semantics check equivalent targets', async () => assert.match((await registryErrors((value) => { value.class_rules['valve.ball'].equivalent_rules[0].target.field = 'typo'; })).join('\n'), /unknown attribute/));
test('registry semantics check alternative targets', async () => assert.match((await registryErrors((value) => { value.class_rules['valve.ball'].alternative_rules[0].target.field = 'typo'; })).join('\n'), /unknown attribute/));
test('registry semantics reject a duplicate target', async () => assert.match((await registryErrors((value) => { value.class_rules['valve.ball'].hard_targets.push(structuredClone(value.class_rules['valve.ball'].hard_targets[0])); })).join('\n'), /duplicate target/));
test('registry semantics reject ordered values outside the canonical enum', async () => assert.match((await registryErrors((value) => { value.class_rules['valve.ball'].equivalent_rules[0].ordered_values.push('pn_typo'); })).join('\n'), /non-canonical value/));

test('policy brand conflicts are rejected semantically', () => {
  const changed = structuredClone(policy);
  changed.brands.include = changed.brands.exclude = ['x'];
  assert.ok(validatePolicySemantics(changed).length);
});

test('canonical JSON ignores object key order', () => assert.equal(canonicalJson({ b: 1, a: { d: 2, c: 3 } }), canonicalJson({ a: { c: 3, d: 2 }, b: 1 })));
test('canonical JSON rejects non-finite numbers', () => assert.throws(() => canonicalJson({ value: Infinity }), /finite/));

test('browser-compatible SHA-256 is stable and lowercase hexadecimal', async () => {
  const input = { requestBundle: { b: 2, a: 1 }, catalogRefs: [], policy, policyRegistryVersion: 'pilot-1.0.0', engineVersion: 'pilot-1.0.0' };
  const first = await matchingInputFingerprint(input);
  assert.equal(first, await matchingInputFingerprint(input));
  assert.match(first, /^[0-9a-f]{64}$/);
});

test('fingerprint ignores catalog reference order', async () => {
  const base = { requestBundle: {}, policy, policyRegistryVersion: 'pilot-1.0.0', engineVersion: 'pilot-1.0.0' };
  const refs = [{ catalog_id: 'b' }, { catalog_id: 'a' }];
  assert.equal(await matchingInputFingerprint({ ...base, catalogRefs: refs }), await matchingInputFingerprint({ ...base, catalogRefs: [...refs].reverse() }));
});

test('fingerprint preserves other array order', async () => {
  const base = { catalogRefs: [], policy, policyRegistryVersion: 'pilot-1.0.0', engineVersion: 'pilot-1.0.0' };
  assert.notEqual(await matchingInputFingerprint({ ...base, requestBundle: { values: [1, 2] } }), await matchingInputFingerprint({ ...base, requestBundle: { values: [2, 1] } }));
});

test('policy changes fingerprint', async () => {
  const base = { requestBundle: {}, catalogRefs: [], policyRegistryVersion: 'pilot-1.0.0', engineVersion: 'pilot-1.0.0' };
  assert.notEqual(await matchingInputFingerprint({ ...base, policy }), await matchingInputFingerprint({ ...base, policy: { ...policy, max_match_level: 'exact' } }));
});

test('fingerprint does not mutate its inputs', async () => {
  const input = { requestBundle: { values: [2, 1] }, catalogRefs: [{ z: 1 }, { a: 2 }], policy, policyRegistryVersion: 'pilot-1.0.0', engineVersion: 'pilot-1.0.0' };
  const before = JSON.stringify(input);
  await matchingInputFingerprint(input);
  assert.equal(JSON.stringify(input), before);
});

test('matching runtime does not import node:crypto', () => {
  assert.throws(() => execFileSync('grep', ['-RIn', 'node:crypto', 'scripts/matching']), /Command failed/);
});

test('every committed golden fingerprint is real', async () => {
  for (const directory of await listGoldenScenarioDirectories()) assert.deepEqual(await validateGoldenResult(await loadGoldenScenario(directory)), []);
});
test('incorrect fingerprint is rejected', async () => assert.match((await changedGolden('D1-single-exact', ({ expected }) => { expected.input_fingerprint = 'f'.repeat(64); })).join('\n'), /fingerprint mismatch/));
test('incorrect catalog_record_id is rejected', async () => assert.match((await changedGolden('D1-single-exact', ({ expected }) => { expected.lines[0].candidates[0].offer_ref.catalog_record_id = 'wrong'; })).join('\n'), /unknown offer reference/));
test('incorrect catalog_id is rejected', async () => assert.match((await changedGolden('D1-single-exact', ({ expected }) => { expected.lines[0].candidates[0].offer_ref.catalog_id = 'wrong'; })).join('\n'), /unknown offer reference/));
test('incorrect source_sha256 is rejected', async () => assert.match((await changedGolden('D1-single-exact', ({ expected }) => { expected.lines[0].candidates[0].offer_ref.source_sha256 = 'f'.repeat(64); })).join('\n'), /unknown offer reference/));
test('source_item_id from another catalog is rejected', async () => assert.match((await changedGolden('D2-multiple-exact', ({ expected }) => { expected.lines[0].candidates[0].offer_ref.source_item_id = 'secondary-valve.ball-1'; })).join('\n'), /unknown offer reference/));
test('unknown line_id is rejected', async () => assert.match((await changedGolden('D1-single-exact', ({ expected }) => { expected.lines[0].line_id = 'wrong'; })).join('\n'), /unknown request line/));
test('missing request line is rejected', async () => assert.match((await changedGolden('D1-single-exact', ({ expected }) => { expected.lines = []; expected.summary.lines = 0; })).join('\n'), /missing result line/));
test('duplicate result line is rejected', async () => assert.match((await changedGolden('D1-single-exact', ({ expected }) => { expected.lines.push(structuredClone(expected.lines[0])); expected.summary.lines = 2; })).join('\n'), /duplicate result line/));

test('forbidden decision fields remain rejected by result schema', async () => {
  const loaded = await loadGoldenScenario('tests/fixtures/matching/golden/D1-single-exact');
  loaded.expected.selected_candidate = {};
  assert.equal(schemas.result(loaded.expected), false);
});
