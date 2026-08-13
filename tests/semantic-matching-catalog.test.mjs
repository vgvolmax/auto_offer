import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSemanticMatchingCatalog, computeSemanticMatchingFingerprint } from '../scripts/chat-pipeline/lib/semantic-matching.mjs';
import { canonicalJson } from '../matching/runtime/canonical-json.mjs';

const policy = { max_match_level: 'equivalent', catalog_needs_review: 'exclude', brands: { include: [], exclude: [], preferred: [], unknown: 'allow' }, catalog_priority: ['b', 'a'] };
const request = { taxonomy_version: '1.0.0', request_document: { request_id: 'r1', lines: [{ line_id: '1', class_id: 'valve.ball', annotation: { status: 'validated' } }, { line_id: '2', annotation: { status: 'unsupported' } }] } };
const entry = (id, status = 'validated', classId = 'valve.ball', brand = 'brand.ok') => ({ source: { raw_name: id }, catalog_item: { source_item_id: id, class_id: classId, annotation: { status }, identity: { brand }, attributes: {}, ports: [] } });
const catalog = (recordId, items) => ({ recordId, catalogId: `cat-${recordId}`, sourceSha256: recordId === 'a' ? 'a'.repeat(64) : 'b'.repeat(64), semanticRevision: 0, bundle: { taxonomy_version: '1.0.0', catalog: { catalog_id: `cat-${recordId}` }, items } });

test('safe deterministic slice follows priority/source order and does no semantic top-N', async () => {
  const hundred = Array.from({ length: 100 }, (_, i) => entry(`b-${i}`));
  const catalogs = [catalog('a', [entry('wrong', 'validated', 'pipe.ppr'), entry('invalid', 'invalid'), entry('review', 'needs_review'), entry('a-1')]), catalog('b', hundred)];
  const snapshot = structuredClone({ request, catalogs, policy });
  const first = await buildSemanticMatchingCatalog({ requestBundle: request, catalogs, selectionPolicy: policy });
  const second = await buildSemanticMatchingCatalog({ requestBundle: request, catalogs, selectionPolicy: policy });
  assert.deepEqual({ request, catalogs, policy }, snapshot);
  assert.deepEqual(first, second); assert.equal(canonicalJson(first), canonicalJson(second));
  assert.deepEqual(first.class_ids, ['valve.ball']); assert.equal(first.items.length, 101);
  assert.equal(first.items[0].offer_ref.source_item_id, 'b-0'); assert.equal(first.items.at(-1).offer_ref.source_item_id, 'a-1');
  assert.match(first.package_fingerprint, /^[0-9a-f]{64}$/);
});

test('needs_review, brands, empty classes, priority and taxonomy fail closed', async () => {
  const manual = structuredClone(policy); manual.catalog_priority = ['a']; manual.catalog_needs_review = 'manual_only'; manual.brands.unknown = 'exclude';
  const built = await buildSemanticMatchingCatalog({ requestBundle: request, catalogs: [catalog('a', [entry('review', 'needs_review'), entry('unknown', 'validated', 'valve.ball', null)])], selectionPolicy: manual });
  assert.deepEqual(built.items.map((x) => x.offer_ref.source_item_id), ['review']);
  const emptyRequest = { ...request, request_document: { ...request.request_document, lines: [{ line_id: 'x', annotation: { status: 'unsupported' } }] } };
  const empty = await buildSemanticMatchingCatalog({ requestBundle: emptyRequest, catalogs: [catalog('a', [])], selectionPolicy: manual });
  assert.deepEqual([empty.class_ids, empty.items], [[], []]);
  await assert.rejects(buildSemanticMatchingCatalog({ requestBundle: request, catalogs: [catalog('a', [])], selectionPolicy: policy }), /catalog_priority/);
  const mismatch = catalog('a', []); mismatch.bundle.taxonomy_version = '2.0.0';
  await assert.rejects(buildSemanticMatchingCatalog({ requestBundle: request, catalogs: [mismatch], selectionPolicy: { ...policy, catalog_priority: ['a'] } }), /Taxonomy mismatch/);
  await assert.rejects(buildSemanticMatchingCatalog({ requestBundle: request, catalogs: [catalog('a', [entry('')])], selectionPolicy: { ...policy, catalog_priority: ['a'] } }), /source_item_id/);
});

test('fingerprint is key-order invariant and changes with semantic input', async () => {
  const value = { schema_version: '1', taxonomy_version: '1', request_id: 'r', class_ids: ['x'], selection_policy: { b: 2, a: 1 }, catalog_refs: [], items: [] };
  const reordered = { ...value, selection_policy: { a: 1, b: 2 } };
  assert.equal(await computeSemanticMatchingFingerprint(value), await computeSemanticMatchingFingerprint(reordered));
  assert.notEqual(await computeSemanticMatchingFingerprint(value), await computeSemanticMatchingFingerprint({ ...value, request_id: 'other' }));
});
