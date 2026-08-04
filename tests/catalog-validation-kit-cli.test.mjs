import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { buildCatalogValidationKit } from '../scripts/catalog-validation-kit/lib/generation-core.mjs';
import {
  buildCatalogAjvRuntimeSource,
  loadRepositoryValidationInputs,
} from '../scripts/catalog-validation-kit/repository-inputs.mjs';

const root = path.resolve(import.meta.dirname, '..');
const fixtureText = await readFile(path.join(root, 'tests/fixtures/bundles/catalog.valid.json'), 'utf8');
const generated = await buildCatalogValidationKit(
  await loadRepositoryValidationInputs(root),
  { ajvRuntimeSource: await buildCatalogAjvRuntimeSource() },
);

async function workspace() {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'catalog-validation-kit-'));
  const kit = path.join(directory, 'catalog-validation-kit.mjs');
  const valid = path.join(directory, 'valid.json');
  await writeFile(kit, generated.source);
  await writeFile(valid, fixtureText);
  return { directory, kit, valid };
}

const lines = text => text.trim().split(/\r?\n/).filter(Boolean).map(line => JSON.parse(line));

test('CLI validates multiple files and leaves source bytes unchanged', async t => {
  const files = await workspace();
  t.after(() => rm(files.directory, { recursive: true, force: true }));
  const before = await readFile(files.valid);
  const stdout = execFileSync(process.execPath, [files.kit, files.valid, files.valid], { encoding: 'utf8' });
  const results = lines(stdout);
  assert.equal(results.length, 2);
  assert.ok(results.every(result => result.valid === true && result.kind === 'catalog_bundle'));
  assert.deepEqual(await readFile(files.valid), before);
});

test('CLI returns 1 when at least one readable catalog is contract-invalid', async t => {
  const files = await workspace();
  t.after(() => rm(files.directory, { recursive: true, force: true }));
  const invalid = path.join(files.directory, 'invalid.json');
  const bundle = JSON.parse(fixtureText);
  bundle.extra = true;
  await writeFile(invalid, JSON.stringify(bundle));
  const run = spawnSync(process.execPath, [files.kit, files.valid, invalid], { encoding: 'utf8' });
  assert.equal(run.status, 1, run.stderr);
  const results = lines(run.stdout);
  assert.equal(results.length, 2);
  assert.equal(results[0].valid, true);
  assert.equal(results[1].valid, false);
  assert.ok(results[1].errors.some(error => error.code === 'BUNDLE_SCHEMA_INVALID'));
});

test('CLI returns 2 for usage, JSON parse, and file read errors', async t => {
  const files = await workspace();
  t.after(() => rm(files.directory, { recursive: true, force: true }));
  const malformed = path.join(files.directory, 'malformed.json');
  await writeFile(malformed, '{');
  for (const [args, expectedCode] of [
    [[], 'USAGE_ERROR'],
    [[malformed], 'JSON_PARSE_ERROR'],
    [[path.join(files.directory, 'missing.json')], 'FILE_READ_ERROR'],
  ]) {
    const run = spawnSync(process.execPath, [files.kit, ...args], { encoding: 'utf8' });
    assert.equal(run.status, 2);
    const diagnostics = lines(run.stderr);
    assert.equal(diagnostics.length, 1);
    assert.equal(diagnostics[0].code, expectedCode);
    assert.doesNotMatch(run.stderr, /\n\s+at\s/);
  }
});
