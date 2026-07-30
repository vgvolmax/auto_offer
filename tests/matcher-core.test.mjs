import test from 'node:test'; import assert from 'node:assert/strict';
import {effectiveMaximumMatchLevel,evaluateConstraint,equalValue,MatchingInputError} from '../matching/runtime/index.mjs';
test('effective substitution is the stricter line/session level',()=>{for(const [line,session,want] of [['exact_only','alternative','exact'],['equivalent_allowed','alternative','equivalent'],['alternative_allowed','exact','exact'],['unspecified','equivalent','equivalent']])assert.equal(effectiveMaximumMatchLevel({policy:line},session),want)});
test('constraint operators and rational inch values',()=>{assert.equal(evaluateConstraint({operator:'eq',value:'x'},'x').outcome,'pass');assert.equal(evaluateConstraint({operator:'neq',value:'x'},'x').outcome,'fail');assert.equal(evaluateConstraint({operator:'gte',value:2},3).outcome,'pass');assert.equal(evaluateConstraint({operator:'lte',value:2},3).outcome,'fail');assert.equal(equalValue({numerator:1,denominator:2},{numerator:2,denominator:4}),true);assert.equal(evaluateConstraint({operator:'eq',value:1},undefined).code,'CATALOG_VALUE_MISSING')});
test('MatchingInputError exposes stable diagnostics',()=>{const e=new MatchingInputError('CODE','/path','message');assert.equal(e.code,'CODE');assert.equal(e.path,'/path')});

import { evaluateCandidate } from '../matching/runtime/candidate-evaluator.mjs';
import { applyPolicy } from '../matching/runtime/policy-filter.mjs';
import { determineResolution } from '../matching/runtime/result-builder.mjs';
import { candidateComparator } from '../matching/runtime/candidate-ordering.mjs';
import { readJson, loadGoldenScenario } from '../scripts/matching/lib/golden-scenario-loader.mjs';
import { runPilotMatcher } from '../matching/runtime/index.mjs';
import { loadMatchingSchemas } from '../scripts/matching/lib/matching-schema-loader.mjs';

const pilotRegistry = await readJson('matching/policies/pilot-v1.json');
const baseRequest = { class_id: 'valve.ball', constraints: { attributes: {}, ports: [] }, ports: [], requested_identity: {} };
const baseCandidate = { catalog_record_id: 'record-main', catalog_id: 'catalog', source_sha256: '0'.repeat(64), source_item_id: 'item', class_id: 'valve.ball', identity: {}, attributes: {}, ports: [], annotation_status: 'validated' };
const basePolicy = { catalog_record_ids: ['record-main'], catalog_priority: ['record-main'], brands: { include: [], exclude: [], preferred: [], unknown: 'allow' }, catalog_needs_review: 'exclude' };

function technical(requestChange = {}, candidateChange = {}) {
  return evaluateCandidate({ ...baseRequest, ...requestChange }, { ...baseCandidate, ...candidateChange }, pilotRegistry);
}

test('exact string constraint creates a real attribute check', () => assert.equal(technical({ constraints: { attributes: { body_material: { operator: 'eq', value: 'aluminum' } } } }, { attributes: { body_material: 'aluminum' } }).checks.at(-1).code, 'ATTRIBUTE_MATCH'));
test('numeric gte constraint passes', () => assert.equal(evaluateConstraint({ operator: 'gte', value: 10 }, 11).outcome, 'pass'));
test('numeric lte constraint passes', () => assert.equal(evaluateConstraint({ operator: 'lte', value: 10 }, 9).outcome, 'pass'));
test('rational inch equality is normalized', () => assert.equal(equalValue({ numerator: 1, denominator: 2 }, { numerator: 2, denominator: 4 }), true));
test('missing requested value rejects with CATALOG_VALUE_MISSING', () => assert.ok(technical({ constraints: { attributes: { pressure_class: { operator: 'eq', value: 'pn16' } } } }).rejectionCodes.has('CATALOG_VALUE_MISSING')));
test('neq is never relaxed', () => assert.ok(technical({ requested_identity: { brand: { operator: 'neq', value: 'blocked' } } }, { identity: { brand: 'blocked' } }).rejectionCodes.has('IDENTITY_EXCLUDED')));
test('port matching uses role', () => assert.equal(technical({ ports: [{ role: 'inlet', system: { operator: 'eq', value: 'hdpe' } }] }, { ports: [{ role: 'inlet', system: 'hdpe' }] }).checks.at(-1).code, 'PORT_MATCH'));
test('inlet and outlet are not swapped', () => assert.ok(technical({ ports: [{ role: 'inlet', system: { operator: 'eq', value: 'hdpe' } }] }, { ports: [{ role: 'outlet', system: 'hdpe' }] }).rejectionCodes.has('PORT_ROLE_MISSING')));
test('registry pressure rule produces equivalent', () => assert.equal(technical({ constraints: { attributes: { pressure_class: { operator: 'eq', value: 'pn16' } } } }, { attributes: { pressure_class: 'pn25' } }).level, 'equivalent'));
test('registry handle rule produces alternative', () => assert.equal(technical({ constraints: { attributes: { handle_type: { operator: 'eq', value: 'lever' } } } }, { attributes: { handle_type: 'butterfly' } }).level, 'alternative'));
test('class without override rejects technical mismatch', () => assert.ok(technical({ constraints: { attributes: { unknown: { operator: 'eq', value: 'a' } } } }, { attributes: { unknown: 'b' } }).rejectionCodes.has('ATTRIBUTE_CONSTRAINT_FAILED')));
test('brand include accepts included brand', () => assert.deepEqual(applyPolicy({ ...baseCandidate, identity: { brand: 'allowed' } }, { level: 'exact' }, { ...basePolicy, brands: { ...basePolicy.brands, include: ['allowed'] } }, 'exact').exclusionCodes, []));
test('brand exclude rejects excluded brand', () => assert.deepEqual(applyPolicy({ ...baseCandidate, identity: { brand: 'blocked' } }, { level: 'exact' }, { ...basePolicy, brands: { ...basePolicy.brands, exclude: ['blocked'] } }, 'exact').exclusionCodes, ['BRAND_EXCLUDED']));
test('unknown brand exclude is enforced', () => assert.deepEqual(applyPolicy(baseCandidate, { level: 'exact' }, { ...basePolicy, brands: { ...basePolicy.brands, unknown: 'exclude' } }, 'exact').exclusionCodes, ['BRAND_UNKNOWN_EXCLUDED']));
test('preferred brand ordering precedes catalog priority', () => { const compare = candidateComparator({ ...basePolicy, brands: { ...basePolicy.brands, preferred: ['preferred'] } }); assert.ok(compare({ match_level: 'exact', brand: 'preferred', offer_ref: { catalog_record_id: 'record-main', catalog_id: 'z', source_item_id: 'z' } }, { match_level: 'exact', brand: 'other', offer_ref: { catalog_record_id: 'record-main', catalog_id: 'a', source_item_id: 'a' } }) < 0); });
test('catalog priority ordering is deterministic', () => { const compare = candidateComparator({ ...basePolicy, catalog_priority: ['second', 'first'] }); assert.ok(compare({ match_level: 'exact', brand: null, offer_ref: { catalog_record_id: 'second', catalog_id: 'z', source_item_id: 'z' } }, { match_level: 'exact', brand: null, offer_ref: { catalog_record_id: 'first', catalog_id: 'a', source_item_id: 'a' } }) < 0); });
test('ordinal string ordering is lexical', () => assert.ok(candidateComparator(basePolicy)({ match_level: 'exact', brand: null, offer_ref: { catalog_record_id: 'record-main', catalog_id: 'a', source_item_id: '2' } }, { match_level: 'exact', brand: null, offer_ref: { catalog_record_id: 'record-main', catalog_id: 'b', source_item_id: '1' } }) < 0));
test('max match level uses normative exclusion code', () => assert.deepEqual(applyPolicy(baseCandidate, { level: 'equivalent' }, basePolicy, 'exact').exclusionCodes, ['MATCH_LEVEL_NOT_ALLOWED']));
test('catalog needs-review exclude preserves technical level', () => { const result = applyPolicy({ ...baseCandidate, annotation_status: 'needs_review' }, { level: 'equivalent' }, basePolicy, 'alternative'); assert.equal(result.exclusionCodes[0], 'CATALOG_ITEM_NEEDS_REVIEW'); });
test('catalog needs-review manual-only returns manual availability', () => assert.equal(applyPolicy({ ...baseCandidate, annotation_status: 'needs_review' }, { level: 'exact' }, { ...basePolicy, catalog_needs_review: 'manual_only' }, 'alternative').availability, 'manual_only'));
test('resolution supports every automatic outcome', () => { assert.equal(determineResolution([{ match_level: 'exact', availability: 'eligible' }], []), 'single_exact'); assert.equal(determineResolution([{ match_level: 'exact', availability: 'eligible' }, { match_level: 'exact', availability: 'eligible' }], []), 'multiple_exact'); assert.equal(determineResolution([{ match_level: 'equivalent', availability: 'eligible' }], []), 'equivalent_only'); assert.equal(determineResolution([{ match_level: 'alternative', availability: 'eligible' }], []), 'alternative_only'); assert.equal(determineResolution([], [{}]), 'excluded_by_policy'); assert.equal(determineResolution([], []), 'no_match'); assert.equal(determineResolution([], [], false), 'request_review_required'); });
test('manual-only exact does not become single_exact', () => assert.equal(determineResolution([{ match_level: 'exact', availability: 'manual_only' }], []), 'no_match'));
test('repeated matcher run is immutable and deterministic', async () => { const fixture = await loadGoldenScenario('tests/fixtures/matching/golden/D1-single-exact'); const input = { requestBundle: fixture.request, catalogs: fixture.catalogs.map(({ input, bundle }) => ({ catalogRecordId: input.catalog_record_id, bundle })), policy: fixture.policy, registry: pilotRegistry, engineVersion: 'pilot-1.0.0' }; const before = JSON.stringify(input); assert.deepEqual(await runPilotMatcher(input), await runPilotMatcher(input)); assert.equal(JSON.stringify(input), before); });
test('matcher result passes match-result schema', async () => { const fixture = await loadGoldenScenario('tests/fixtures/matching/golden/D3-pressure-equivalent'); const result = await runPilotMatcher({ requestBundle: fixture.request, catalogs: fixture.catalogs.map(({ input, bundle }) => ({ catalogRecordId: input.catalog_record_id, bundle })), policy: fixture.policy, registry: pilotRegistry, engineVersion: 'pilot-1.0.0' }); const schemas = await loadMatchingSchemas(); assert.equal(schemas.result(result), true, JSON.stringify(schemas.result.errors)); assert.equal(result.lines[0].excluded_candidates[0]?.exclusion_codes.includes('MATCH_LEVEL_NOT_ALLOWED') ?? true, true); });

test('equivalent candidate above exact policy is excluded and schema-compatible', async () => {
  const fixture = await loadGoldenScenario('tests/fixtures/matching/golden/D3-pressure-equivalent');
  const exactPolicy = { ...fixture.policy, max_match_level: 'exact' };
  const result = await runPilotMatcher({ requestBundle: fixture.request, catalogs: fixture.catalogs.map(({ input, bundle }) => ({ catalogRecordId: input.catalog_record_id, bundle })), policy: exactPolicy, registry: pilotRegistry, engineVersion: 'pilot-1.0.0' });
  assert.equal(result.lines[0].resolution, 'excluded_by_policy');
  assert.equal(result.lines[0].excluded_candidates[0].match_level, 'equivalent');
  assert.deepEqual(result.lines[0].excluded_candidates[0].exclusion_codes, ['MATCH_LEVEL_NOT_ALLOWED']);
  const schemas = await loadMatchingSchemas();
  assert.equal(schemas.result(result), true, JSON.stringify(schemas.result.errors));
});

test('class mismatch is a technical rejection', () => assert.ok(technical({}, { class_id: 'valve.check' }).rejectionCodes.has('CLASS_MISMATCH')));
