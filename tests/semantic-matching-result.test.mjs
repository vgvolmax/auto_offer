import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
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

test('canonical prompt result is production-schema valid', async () => {
  const { result: validate } = await loadSemanticMatchingValidators();
  const fixtureText = await readFile(new URL('./fixtures/semantic-matching/canonical-result.json', import.meta.url), 'utf8');
  const prompt = await readFile(new URL('../annotation-kits/matching/SEMANTIC_MATCH_PROMPT.md', import.meta.url), 'utf8');
  const normalizedPrompt = prompt.replace(/\r\n/g, '\n');
  const canonicalBlock = normalizedPrompt.match(/## Canonical output example[\s\S]*?```json\n([\s\S]*?)\n```/)?.[1];
  assert.ok(canonicalBlock, 'prompt contains a canonical JSON example');
  assert.deepEqual(JSON.parse(canonicalBlock), JSON.parse(fixtureText), 'prompt and canonical fixture stay synchronized');
  assert.equal(validate(JSON.parse(fixtureText)), true, JSON.stringify(validate.errors));
});

test('schema diagnostics point to missing, aliased and additional properties', async () => {
  const { result: validate } = await loadSemanticMatchingValidators();
  const root = { kind: 'semantic_match_result', schema_version: '1.0.0', taxonomy_version: '1.0.0', request_id: 'r', package_fingerprint: 'a'.repeat(64), lines: [{ line_id: '17', decision: 'request_unsupported' }] };
  const check = async (result) => validateSemanticMatchResultObjects({ result, requestBundle: {}, matchingCatalog: {}, validators: { result: validate } });

  assert.equal(validate(root), true);

  const aliased = structuredClone(root);
  aliased.results = aliased.lines;
  delete aliased.lines;
  const aliasErrors = (await check(aliased)).errors;
  assert.ok(aliasErrors.some(({ path, message }) => path === '/lines' && message.includes('required property is missing')));
  assert.ok(aliasErrors.some(({ path, message }) => path === '/results' && message.includes('additional property is not allowed')));

  const passthroughExtra = structuredClone(root);
  passthroughExtra.lines[0].rationale_ru = 'Лишнее объяснение';
  assert.ok((await check(passthroughExtra)).errors.some(({ path }) => path === '/lines/0/rationale_ru'));

  const topLevelExtra = { ...root, confidence: 0.95 };
  assert.ok((await check(topLevelExtra)).errors.some(({ path }) => path === '/confidence'));
});

test('rejects stale semantic result after request content changes', async () => {
  const matchingCatalog = await buildSemanticMatchingCatalog({ requestBundle: request, catalogs: [record], selectionPolicy: policy });
  const result = { kind: 'semantic_match_result', schema_version: '1.0.0', taxonomy_version: '1.0.0', request_id: 'r', package_fingerprint: matchingCatalog.package_fingerprint, lines: [{ line_id: '1', decision: 'no_offer', reason_code: 'NO_TECHNICAL_MATCH', rationale_ru: 'Нет' }, { line_id: '2', decision: 'request_unsupported' }] };
  assert.equal((await validateSemanticMatchResultObjects({ result, requestBundle: request, matchingCatalog })).valid, true);
  const changedRequest = structuredClone(request);
  changedRequest.request_document.lines[0].attributes = { pressure_bar: 16 };
  const stale = await validateSemanticMatchResultObjects({ result, requestBundle: changedRequest, matchingCatalog });
  assert.equal(stale.valid, false);
  assert.ok(stale.errors.some(({ code }) => code === 'PACKAGE_TAMPERED'));
});

test('needs_review request accepts offer and no_offer despite legacy exclude', async () => {
  const reviewRequest = structuredClone(request);
  reviewRequest.request_document.lines[0].annotation.status = 'needs_review';
  const reviewRecord = structuredClone(record);
  reviewRecord.bundle.items[0].catalog_item.annotation.status = 'needs_review';
  const matchingCatalog = await buildSemanticMatchingCatalog({ requestBundle: reviewRequest, catalogs: [reviewRecord], selectionPolicy: policy });
  const root = (line) => ({ kind: 'semantic_match_result', schema_version: '1.0.0', taxonomy_version: '1.0.0', request_id: 'r', package_fingerprint: matchingCatalog.package_fingerprint, lines: [line, { line_id: '2', decision: 'request_unsupported' }] });
  const offer = root({ line_id: '1', decision: 'offer', offer_ref: { catalog_record_id: 'c', source_item_id: 'i' }, match_level: 'exact', rationale_ru: 'Source подтверждает требования', differences_ru: [] });
  const noOffer = root({ line_id: '1', decision: 'no_offer', reason_code: 'CATALOG_DATA_INSUFFICIENT', rationale_ru: 'Недостаточно данных' });
  for (const result of [offer, noOffer]) {
    const validation = await validateSemanticMatchResultObjects({ result, requestBundle: reviewRequest, matchingCatalog });
    assert.equal(validation.valid, true, JSON.stringify(validation.errors));
    assert.ok(!validation.errors?.some(({ code }) => code === 'NEEDS_REVIEW_EXCLUDED'));
  }
});
