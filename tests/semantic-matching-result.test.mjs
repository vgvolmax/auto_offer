import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSemanticMatchingCatalog, loadSemanticMatchingValidators, validateSemanticMatchResultObjects } from '../scripts/chat-pipeline/lib/semantic-matching.mjs';

const request = { taxonomy_version: '1.0.0', request_document: { request_id: 'r', lines: [{ line_id: '1', class_id: 'x', annotation: { status: 'validated' } }, { line_id: '2', annotation: { status: 'unsupported' } }] } };
const policy = { max_match_level: 'exact', catalog_needs_review: 'exclude', brands: { include: [], exclude: [], preferred: [], unknown: 'allow' }, catalog_priority: ['c'] };
const record = { recordId: 'c', catalogId: 'cat', sourceSha256: 'c'.repeat(64), semanticRevision: 0, bundle: { taxonomy_version: '1.0.0', catalog: { catalog_id: 'cat' }, items: [{ source: {}, catalog_item: { source_item_id: 'i', class_id: 'x', annotation: { status: 'validated' }, identity: {}, attributes: {}, ports: [] } }] } };

test('cross-file validation accepts mixed result and rejects provenance, order, offer and level errors', async () => {
  const matchingCatalog = await buildSemanticMatchingCatalog({ requestBundle: request, catalogs: [record], selectionPolicy: policy });
  const base = { kind: 'semantic_match_result', schema_version: '1.0.0', taxonomy_version: '1.0.0', request_id: 'r', package_fingerprint: matchingCatalog.package_fingerprint, lines: [{ line_id: '1', decision: 'offer', offer_ref: { catalog_record_id: 'c', source_item_id: 'i' }, match_level: 'exact', rationale_ru: 'Совпадает', differences_ru: [] }, { line_id: '2', decision: 'request_unsupported' }] };
  const valid = await validateSemanticMatchResultObjects({ result: base, requestBundle: request, matchingCatalog });
  assert.deepEqual(valid, { valid: true, line_count: 2, offer_count: 1, no_offer_count: 0, reroute_count: 0 });
  for (const mutate of [
    (x) => { x.request_id = 'bad'; }, (x) => { x.lines.reverse(); },
    (x) => { x.lines[0].offer_ref.source_item_id = 'invented'; }, (x) => { x.lines[0].match_level = 'alternative'; },
    (x) => { x.lines[1] = { line_id: '2', decision: 'no_offer', reason_code: 'NO_TECHNICAL_MATCH', rationale_ru: 'Нет' }; },
  ]) { const value = structuredClone(base); mutate(value); assert.equal((await validateSemanticMatchResultObjects({ result: value, requestBundle: request, matchingCatalog })).valid, false); }
});

test('strict result schema supports all variants and rejects confidence', async () => {
  const { result: validate } = await loadSemanticMatchingValidators();
  const root = (line) => ({ kind: 'semantic_match_result', schema_version: '1.0.0', taxonomy_version: '1.0.0', request_id: 'r', package_fingerprint: 'a'.repeat(64), lines: [line] });
  const variants = [
    { line_id: '1', decision: 'offer', offer_ref: { catalog_record_id: 'c', source_item_id: 'i' }, match_level: 'exact', rationale_ru: 'Да', differences_ru: [] },
    { line_id: '1', decision: 'no_offer', reason_code: 'NO_TECHNICAL_MATCH', rationale_ru: 'Нет' },
    { line_id: '1', decision: 'reroute_required', reason_code: 'ROUTING_INSUFFICIENT', rationale_ru: 'Класс' },
    ...['request_review_required', 'request_invalid', 'request_unsupported'].map((decision) => ({ line_id: '1', decision })),
  ];
  variants.forEach((line) => assert.equal(validate(root(line)), true));
  assert.equal(validate(root({ ...variants[0], confidence: 0.9 })), false);
});
