import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import Ajv2020 from 'ajv/dist/2020.js';
import { buildSelectedRequestKit, validateSelectedRequestKit } from '../scripts/annotation-kits/lib/request-selected-kit.mjs';

const load = (relative) => readFile(new URL(`../${relative}`, import.meta.url), 'utf8').then(JSON.parse);
const source = { kind: 'request_source', source_file: 'request.pdf', line_count: 2, lines: [
  { line_id: '1', raw_text: 'Кран шаровой 1/2, 10 шт.', quantity_raw: '10 шт.', source_position: { page: 1, row: 1 } },
  { line_id: '2', raw_text: 'Фитинг радиальный', quantity_raw: null, source_position: { sheet: 'Лист1', cell: 'A2', bounding_box: [1, 2, 3, 4] } },
] };

test('request source schema and cross-field invariants preserve intermediate data', async () => {
  const schema = await load('schemas/chat-pipeline/request-source.schema.json');
  const validate = new Ajv2020().compile(schema);
  assert.equal(validate(source), true);
  assert.deepEqual(source.lines.map(({ line_id, raw_text, quantity_raw, source_position }) => ({ line_id, raw_text, quantity_raw, source_position })), source.lines);
  for (const bad of [
    { ...source, lines: [] }, { ...source, lines: [{ ...source.lines[0], raw_text: undefined }] },
    { ...source, lines: [{ ...source.lines[0], source_position: { page: 0 } }] },
  ]) assert.equal(validate(bad), false);
  assert.notEqual(source.line_count, source.lines.slice(1).length);
  assert.equal(new Set(['1', '1']).size, 1);
});

test('selected request kit is stable, closed, filtered, and tamper evident', async () => {
  const full = await load('annotation-kits/request-annotation-kit.json');
  const candidates = [{ line_id: '1', class_ids: ['valve.ball'] }, { line_id: '2', class_ids: ['fitting.radial'] }];
  const selected = buildSelectedRequestKit(full, ['valve.ball', 'fitting.radial'], candidates);
  assert.deepEqual(selected, buildSelectedRequestKit(full, ['fitting.radial', 'valve.ball'], candidates));
  assert.equal(validateSelectedRequestKit(full, selected, source), true);
  for (const id of selected.selected_class_ids) assert.deepEqual(selected.schemas_by_id[selected.class_schema_ids[id]], full.schemas_by_id[full.class_schema_ids[id]]);
  assert.equal(Object.values(selected.class_schema_ids).some((id) => id.includes('pipe.hdpe')), false);
  const dispatchId = 'https://example.local/schemas/annotation/generated/request-line.dispatch.schema.json';
  assert.deepEqual(selected.schemas_by_id[dispatchId].oneOf.map((x) => x.$ref), ['../class-specific/fitting.radial.request.schema.json', '../class-specific/valve.ball.request.schema.json']);
  const tampered = structuredClone(selected);
  tampered.schemas_by_id[selected.class_schema_ids['valve.ball']].allOf[1].properties.class_id.const = 'falsified';
  assert.throws(() => validateSelectedRequestKit(full, tampered, source), /tampering/);
  for (const invalid of [
    [{ line_id: '1', class_ids: [] }],
    [{ line_id: '1', class_ids: ['valve.ball', 'fitting.radial', 'pipe.hdpe', 'pipe.ppr'] }],
    [{ line_id: '1', class_ids: ['valve.ball', 'valve.ball'] }],
    [{ line_id: '1', class_ids: ['not.real'] }],
  ]) assert.throws(() => buildSelectedRequestKit(full, [...new Set(invalid.flatMap((x) => x.class_ids))], invalid));
  assert.throws(() => validateSelectedRequestKit(full, selected), /required/);
  assert.throws(() => validateSelectedRequestKit(full, selected, { ...source, line_count: 3, lines: [...source.lines, { line_id: '3', raw_text: 'Extra', quantity_raw: null }] }), /exactly/);
  assert.throws(() => validateSelectedRequestKit(full, selected, { ...source, lines: [{ ...source.lines[0], line_id: 'unknown' }, source.lines[1]] }), /exactly/);
});

test('selected-kit CLI requires request source', () => {
  const result = spawnSync(process.execPath, ['scripts/chat-pipeline/validate-request-selected-kit.mjs', 'full.json', 'selected.json'], { cwd: new URL('..', import.meta.url), encoding: 'utf8' });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Usage: validate:request-selected-kit -- <full-kit\.json> <selected-kit\.json> <request-source\.json>/);
});
