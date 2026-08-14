import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSemanticMatchingCatalog, computeSemanticMatchingFingerprint } from '../scripts/chat-pipeline/lib/semantic-matching.mjs';
import { canonicalJson } from '../matching/runtime/canonical-json.mjs';

const policy = { max_match_level: 'equivalent', catalog_needs_review: 'exclude', brands: { include: [], exclude: [], preferred: [], unknown: 'allow' }, catalog_priority: ['b', 'a'] };
const request = { taxonomy_version: '1.0.0', request_document: { request_id: 'r1', lines: [{ line_id: '1', class_id: 'valve.ball', annotation: { status: 'validated' } }, { line_id: '2', annotation: { status: 'unsupported' } }] } };
const entry = (id, status = 'validated', classId = 'valve.ball', brand = 'brand.ok') => ({ source: { raw_name: id }, catalog_item: { source_item_id: id, class_id: classId, annotation: { status, unknown_fields: [], issues: [], ambiguities: [] }, identity: { brand }, attributes: {}, ports: [] } });
const catalog = (recordId, items) => ({ recordId, catalogId: `cat-${recordId}`, sourceSha256: recordId === 'a' ? 'a'.repeat(64) : 'b'.repeat(64), semanticRevision: 0, bundle: { taxonomy_version: '1.0.0', catalog: { catalog_id: `cat-${recordId}` }, items } });

test('safe deterministic slice follows priority/source order and does no semantic top-N', async () => {
  const hundred = Array.from({ length: 100 }, (_, i) => entry(`b-${i}`));
  const catalogs = [catalog('a', [entry('wrong', 'validated', 'pipe.ppr'), entry('invalid', 'invalid'), entry('review', 'needs_review'), entry('a-1')]), catalog('b', hundred)];
  const snapshot = structuredClone({ request, catalogs, policy });
  const first = await buildSemanticMatchingCatalog({ requestBundle: request, catalogs, selectionPolicy: policy });
  const second = await buildSemanticMatchingCatalog({ requestBundle: request, catalogs, selectionPolicy: policy });
  assert.deepEqual({ request, catalogs, policy }, snapshot);
  assert.deepEqual(first, second); assert.equal(canonicalJson(first), canonicalJson(second));
  assert.deepEqual(first.class_ids, ['valve.ball']); assert.equal(first.items.length, 102);
  assert.equal(first.items[0].offer_ref.source_item_id, 'b-0'); assert.equal(first.items.at(-2).offer_ref.source_item_id, 'review'); assert.equal(first.items.at(-1).offer_ref.source_item_id, 'a-1');
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

test('fingerprint is key-order invariant and changes with package semantic input', async () => {
  const value = { schema_version: '1', taxonomy_version: '1', request_id: 'r', class_ids: ['x'], selection_policy: { b: 2, a: 1 }, catalog_refs: [], items: [] };
  const reordered = { ...value, selection_policy: { a: 1, b: 2 } };
  const fingerprint = (matchingCatalog, requestBundle = request) => computeSemanticMatchingFingerprint({ requestBundle, matchingCatalog });
  assert.equal(await fingerprint(value), await fingerprint(reordered));
  assert.notEqual(await fingerprint(value), await fingerprint({ ...value, request_id: 'other' }));
  assert.notEqual(await fingerprint(value), await fingerprint({ ...value, items: [{ id: 'changed' }] }));
  assert.notEqual(await fingerprint(value), await fingerprint({ ...value, selection_policy: { a: 2, b: 2 } }));
  assert.notEqual(await fingerprint(value), await fingerprint({ ...value, catalog_refs: [{ semantic_revision: 1 }] }));
});

test('fingerprint changes when request semantics change without changing request_id, line_id or class_id', async () => {
  const catalogs = [catalog('a', [entry('a-1')])];
  const selectionPolicy = { ...policy, catalog_priority: ['a'] };
  const changedRequest = structuredClone(request);
  changedRequest.request_document.lines[0].attributes = { pressure_bar: 16 };
  const packageA = await buildSemanticMatchingCatalog({ requestBundle: request, catalogs, selectionPolicy });
  const packageB = await buildSemanticMatchingCatalog({ requestBundle: changedRequest, catalogs, selectionPolicy });
  assert.notEqual(packageA.package_fingerprint, packageB.package_fingerprint);
});

test('fingerprint is invariant to request object key order and does not mutate inputs', async () => {
  const value = { schema_version: '1', taxonomy_version: '1', request_id: 'r', class_ids: ['x'], selection_policy: {}, catalog_refs: [], items: [], package_fingerprint: 'f'.repeat(64), summary: { item_count: 0 } };
  const reorderedRequest = { request_document: { lines: request.request_document.lines, request_id: 'r1' }, taxonomy_version: '1.0.0' };
  const snapshot = structuredClone({ request, value });
  assert.equal(
    await computeSemanticMatchingFingerprint({ requestBundle: request, matchingCatalog: value }),
    await computeSemanticMatchingFingerprint({ requestBundle: reorderedRequest, matchingCatalog: value }),
  );
  assert.deepEqual({ request, value }, snapshot);
});


test('legacy exclude does not hide needs_review and review metadata is preserved', async () => {
  const reviewed = entry('review', 'needs_review');
  reviewed.catalog_item.annotation = {
    status: 'needs_review',
    unknown_fields: ['/ports/0/connection_kind'],
    issues: [{ code: 'MISSING_FIELD', json_pointer: '/ports/0/connection_kind', message: 'Нужно соединение', details: { missing: true } }],
    ambiguities: [{ code: 'SIZE_AMBIGUOUS', json_pointer: '/ports/0/size', source_text: '20x1/2', possible_values: [20, '1/2'], blocking: true }],
  };
  const built = await buildSemanticMatchingCatalog({ requestBundle: request, catalogs: [catalog('a', [reviewed, entry('bad', 'invalid'), entry('unsupported', 'unsupported')])], selectionPolicy: { ...policy, catalog_priority: ['a'] } });
  assert.equal(built.items.length, 1);
  assert.equal(built.items[0].annotation_status, 'needs_review');
  assert.deepEqual(built.items[0].annotation_review, {
    unknown_fields: reviewed.catalog_item.annotation.unknown_fields,
    issues: reviewed.catalog_item.annotation.issues,
    ambiguities: reviewed.catalog_item.annotation.ambiguities,
  });
});
