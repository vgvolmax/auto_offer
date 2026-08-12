import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import Ajv2020 from 'ajv/dist/2020.js';
import { projectRequestRouting, validateRequestRoutingObjects } from '../scripts/chat-pipeline/lib/request-routing.mjs';
import { buildSelectedRequestKit } from '../scripts/annotation-kits/lib/request-selected-kit.mjs';

const json = (file) => readFile(new URL(`../${file}`, import.meta.url), 'utf8').then(JSON.parse);
const [routingSchema, sourceSchema, lightSchema, light, fullKit] = await Promise.all([
  json('schemas/chat-pipeline/request-routing.schema.json'), json('schemas/chat-pipeline/request-source.schema.json'),
  json('schemas/chat-pipeline/taxonomy-light.schema.json'), json('taxonomy/taxonomy-light.json'),
  json('annotation-kits/request-annotation-kit.json'),
]);
const ajv = new Ajv2020({ allErrors: true });
const validators = {
  routing: ajv.compile(routingSchema), requestSource: ajv.compile(sourceSchema), taxonomyLight: ajv.compile(lightSchema),
};
const ids = light.classes.map(({ class_id }) => class_id);
const source = {
  kind: 'request_source', source_file: 'request.pdf', line_count: 3,
  lines: [1, 2, 3].map((line_id) => ({ line_id: String(line_id), raw_text: `line ${line_id}`, quantity_raw: null })),
};
const mixed = {
  kind: 'request_routing', schema_version: '1.0.0', taxonomy_version: light.taxonomy_version,
  source_file: source.source_file, line_count: 3,
  routes: [
    { line_id: '1', decision: 'candidates', class_ids: [ids[2]] },
    { line_id: '2', decision: 'candidates', class_ids: [ids[1], ids[0]] },
    { line_id: '3', decision: 'unsupported', reason_code: 'NO_TAXONOMY_CLASS' },
  ],
};
const validate = (routing, requestSource = source, taxonomyLight = light) => validateRequestRoutingObjects(routing, requestSource, taxonomyLight, validators);

test('routing schema accepts a strict mixed routing', () => assert.equal(validate(mixed).valid, true));

test('routing schema rejects malformed route shapes', () => {
  const invalidRoutes = [
    { line_id: '1', decision: 'candidates', class_ids: [] },
    { line_id: '1', decision: 'candidates', class_ids: ids.slice(0, 4) },
    { line_id: '1', decision: 'candidates', class_ids: [ids[0], ids[0]] },
    { line_id: '1', decision: 'other', class_ids: [ids[0]] },
    { line_id: '1', decision: 'unsupported', reason_code: 'OTHER' },
    { line_id: '1', decision: 'candidates', class_ids: [ids[0]], reason_code: 'NO_TAXONOMY_CLASS' },
    { line_id: '1', decision: 'candidates' },
    { line_id: '1', decision: 'candidates', class_ids: [ids[0]], extra: true },
    { line_id: '1', decision: 'candidates', candidate_class_ids: [ids[0]] },
  ];
  for (const route of invalidRoutes) assert.equal(validators.routing({ ...mixed, line_count: 1, routes: [route] }), false, JSON.stringify(route));
});

test('cross-file validation requires exact source coverage, identity, and taxonomy', () => {
  const changes = [
    { ...mixed, routes: mixed.routes.slice(0, 2) },
    { ...mixed, routes: [...mixed.routes, { line_id: '4', decision: 'unsupported', reason_code: 'NO_TAXONOMY_CLASS' }] },
    { ...mixed, routes: [mixed.routes[0], { ...mixed.routes[1], line_id: '1' }, mixed.routes[2]] },
    { ...mixed, routes: [mixed.routes[1], mixed.routes[0], mixed.routes[2]] },
    { ...mixed, source_file: 'other.pdf' },
    { ...mixed, line_count: 2 },
    { ...mixed, taxonomy_version: 'other' },
    { ...mixed, routes: [{ ...mixed.routes[0], class_ids: ['unknown.class'] }, ...mixed.routes.slice(1)] },
  ];
  for (const routing of changes) assert.equal(validate(routing).valid, false);
});

test('all-candidate, mixed, and all-unsupported routings are valid', () => {
  const candidate = (line_id) => ({ line_id, decision: 'candidates', class_ids: [ids[0]] });
  const unsupported = (line_id) => ({ line_id, decision: 'unsupported', reason_code: 'UNCLASSIFIABLE_SOURCE' });
  assert.equal(validate({ ...mixed, routes: ['1', '2', '3'].map(candidate) }).valid, true);
  assert.equal(validate(mixed).valid, true);
  assert.equal(validate({ ...mixed, routes: ['1', '2', '3'].map(unsupported) }).valid, true);
});

test('projection returns a sorted union, preserves route order and does not mutate input', () => {
  const duplicateAcrossRoutes = { ...mixed, routes: [
    { line_id: '1', decision: 'candidates', class_ids: [ids[2], ids[0]] },
    { line_id: '2', decision: 'unsupported', reason_code: 'AMBIGUOUS_CLASS' },
    { line_id: '3', decision: 'candidates', class_ids: [ids[2], ids[1]] },
  ] };
  const before = structuredClone(duplicateAcrossRoutes);
  const projection = projectRequestRouting(duplicateAcrossRoutes);
  assert.deepEqual(projection.selectedClassIds, [ids[0], ids[1], ids[2]].sort());
  assert.deepEqual(projection.lineCandidates.map(({ line_id }) => line_id), ['1', '3']);
  assert.deepEqual(projection.unsupportedLines, [{ line_id: '2', reason_code: 'AMBIGUOUS_CLASS' }]);
  assert.deepEqual(duplicateAcrossRoutes, before);
  assert.doesNotThrow(() => buildSelectedRequestKit(fullKit, projection.selectedClassIds, projection.lineCandidates, projection.unsupportedLines));
});
