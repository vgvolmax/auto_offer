import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  buildCatalogValidationKit,
} from '../scripts/catalog-validation-kit/lib/generation-core.mjs';
import {
  buildCatalogAjvRuntimeSource,
  loadRepositoryValidationInputs,
} from '../scripts/catalog-validation-kit/repository-inputs.mjs';

const root = path.resolve(import.meta.dirname, '..');
const importSource = source => import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);

async function generate() {
  const files = await loadRepositoryValidationInputs(root);
  const ajvRuntimeSource = await buildCatalogAjvRuntimeSource();
  return buildCatalogValidationKit(files, { ajvRuntimeSource });
}

test('generation is byte-identical for the same source bytes', async () => {
  const first = await generate();
  const second = await generate();
  assert.equal(first.source, second.source);
  assert.equal(first.sha256, second.sha256);
  assert.equal(first.bytes, Buffer.byteLength(first.source));
});

test('metadata records contract versions, counts, generator version, and exact source hashes', async () => {
  const result = await generate();
  assert.equal(result.metadata.format_version, '1.0.0');
  assert.equal(result.metadata.generator_version, '1.0.0');
  assert.equal(result.metadata.taxonomy_version, '1.0.0');
  assert.equal(result.metadata.annotation_schema_version, '1.1.0');
  assert.equal(result.metadata.bundle_schema_version, '1.0.0');
  assert.equal(result.metadata.class_count, 41);
  assert.ok(result.metadata.schema_count >= 40);
  assert.equal(result.metadata.module_count, 4);
  assert.deepEqual(Object.keys(result.metadata.sources).sort(), [
    'annotation-contract-validator.mjs',
    'bundle-validator.mjs',
    'catalog-annotation-kit.json',
    'catalog-identifiers.mjs',
    'class-schema-registry.json',
    'request-port-contracts.mjs',
  ]);
  for (const source of Object.values(result.metadata.sources)) {
    assert.match(source.sha256, /^[0-9a-f]{64}$/);
    assert.ok(source.bytes > 0);
  }
  assert.equal(Object.hasOwn(result.metadata, 'built_at'), false);
});

test('generated module is dependency-free and exposes the stable public API', async () => {
  const result = await generate();
  assert.doesNotMatch(result.source, /\bfrom\s+['"](?:ajv|ajv-formats)/);
  assert.doesNotMatch(result.source, /\bimport\s*\(\s*['"](?:ajv|ajv-formats)/);
  assert.doesNotMatch(result.source, /https?:\/\//);
  const module = await importSource(result.source);
  assert.deepEqual(module.kitMetadata, result.metadata);
  assert.equal(typeof module.createCatalogValidator, 'function');
  assert.equal(typeof module.validateCatalogBundle, 'function');
  assert.equal(typeof module.validateCatalogFile, 'function');
});

test('generated source does not depend on repository location', async () => {
  const result = await generate();
  assert.doesNotMatch(result.source, new RegExp(root.replaceAll('\\', '\\\\')));
  assert.doesNotMatch(result.source, /taxonomy\/taxonomy\.json|schemas\/annotation|scripts\/bundles/);
  assert.notEqual(pathToFileURL(root).href, '');
});
