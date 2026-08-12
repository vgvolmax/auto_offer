import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { buildSelectedRequestKit, validateSelectedRequestKit } from '../scripts/annotation-kits/lib/request-selected-kit.mjs';
import { buildSelectedRequestKitFromRouting } from '../scripts/chat-pipeline/lib/request-selected-kit-from-routing.mjs';
import { loadRequestRoutingValidators, projectRequestRouting } from '../scripts/chat-pipeline/lib/request-routing.mjs';

const json = (file) => readFile(new URL(`../${file}`, import.meta.url), 'utf8').then(JSON.parse);
const [fullKit, taxonomyLight, validators] = await Promise.all([
  json('annotation-kits/request-annotation-kit.json'), json('taxonomy/taxonomy-light.json'), loadRequestRoutingValidators(),
]);
const ids = taxonomyLight.classes.slice(0, 3).map(({ class_id }) => class_id);
const source = {
  kind: 'request_source', source_file: 'request.pdf', line_count: 3,
  lines: ['1', '2', '3'].map((line_id) => ({ line_id, raw_text: `line ${line_id}`, quantity_raw: null })),
};
const routing = {
  kind: 'request_routing', schema_version: '1.0.0', taxonomy_version: taxonomyLight.taxonomy_version,
  source_file: source.source_file, line_count: 3,
  routes: [
    { line_id: '1', decision: 'candidates', class_ids: [ids[0]] },
    { line_id: '2', decision: 'candidates', class_ids: [ids[1], ids[2]] },
    { line_id: '3', decision: 'unsupported', reason_code: 'NO_TAXONOMY_CLASS' },
  ],
};
const build = (overrides = {}) => buildSelectedRequestKitFromRouting({ fullKit, requestSource: source, routing, taxonomyLight, validators, ...overrides });

test('materialization delegates to the canonical builder and is deterministic and immutable', () => {
  const inputs = structuredClone({ fullKit, source, routing, taxonomyLight });
  const projection = projectRequestRouting(routing);
  const expected = buildSelectedRequestKit(fullKit, projection.selectedClassIds, projection.lineCandidates, projection.unsupportedLines);
  const actual = build();
  assert.deepEqual(actual, expected);
  assert.deepEqual(build(), actual);
  assert.equal(validateSelectedRequestKit(fullKit, actual, source), true);
  assert.deepEqual({ fullKit, source, routing, taxonomyLight }, inputs);
});

test('all-unsupported routing materializes a valid kit without selected production classes', () => {
  const unsupported = { ...routing, routes: source.lines.map(({ line_id }) => ({ line_id, decision: 'unsupported', reason_code: 'UNCLASSIFIABLE_SOURCE' })) };
  const selected = build({ routing: unsupported });
  assert.deepEqual(selected.selected_class_ids, []);
  assert.deepEqual(selected.line_candidates, []);
  assert.equal(selected.unsupported_lines.length, source.line_count);
  assert.equal(validateSelectedRequestKit(fullKit, selected, source), true);
});

test('materialization fails closed at invalid routing and full-kit version boundaries', () => {
  const alias = structuredClone(routing);
  alias.routes[0] = { line_id: '1', decision: 'candidates', candidate_class_ids: [ids[0]] };
  assert.throws(() => build({ routing: alias }), /validation failed/);
  assert.throws(() => build({ fullKit: { ...fullKit, taxonomy_version: 'different' } }), /taxonomy_version/);
});
