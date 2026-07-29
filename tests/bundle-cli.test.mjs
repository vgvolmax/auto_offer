import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

const catalogScript = 'scripts/bundles/validate-catalog-bundle.mjs';
const requestScript = 'scripts/bundles/validate-request-bundle.mjs';
const run = (script, filePath) => spawnSync(process.execPath, filePath === undefined ? [script] : [script, filePath], { encoding: 'utf8' });
const load = async name => JSON.parse(await readFile(`tests/fixtures/bundles/${name}.valid.json`, 'utf8'));
const withTemporaryFile = async (contents, callback) => {
  const directory = await mkdtemp(path.join(tmpdir(), 'bundle-cli-'));
  const filePath = path.join(directory, 'bundle.json');
  try { await writeFile(filePath, contents); return await callback(filePath); }
  finally { await rm(directory, { recursive: true, force: true }); }
};
const assertStructuralDiagnostic = (result, kind) => {
  assert.equal(result.status, 1); assert.equal(result.stdout, '');
  const diagnostic = JSON.parse(result.stderr);
  assert.equal(diagnostic.valid, false); assert.equal(diagnostic.kind, kind);
  assert.ok(diagnostic.errors.some(error => error.code === 'BUNDLE_SCHEMA_INVALID'));
  assert.doesNotMatch(result.stderr, /TypeError/); assert.doesNotMatch(result.stderr, /\n\s+at\s/);
};

test('valid catalog CLI output is unchanged',()=>{const result=run(catalogScript,'tests/fixtures/bundles/catalog.valid.json');assert.equal(result.status,0);assert.equal(result.stderr,'');assert.equal(result.stdout,'VALID catalog_bundle records=1 taxonomy=1.0.0\n')});
test('valid request CLI output is unchanged',()=>{const result=run(requestScript,'tests/fixtures/bundles/request.valid.json');assert.equal(result.status,0);assert.equal(result.stderr,'');assert.equal(result.stdout,'VALID request_bundle records=1 taxonomy=1.0.0\n')});
test('structurally invalid catalog CLI emits JSON without a stack trace',async()=>{const bundle=await load('catalog');bundle.items[0].catalog_item.ports=[null];await withTemporaryFile(JSON.stringify(bundle),filePath=>assertStructuralDiagnostic(run(catalogScript,filePath),'catalog_bundle'))});
test('structurally invalid request CLI emits JSON without a stack trace',async()=>{const bundle=await load('request');bundle.request_document.lines=[null];bundle.source.line_count=1;await withTemporaryFile(JSON.stringify(bundle),filePath=>assertStructuralDiagnostic(run(requestScript,filePath),'request_bundle'))});
test('invalid JSON returns a parse diagnostic',async()=>{await withTemporaryFile('{"broken":',filePath=>{const result=run(catalogScript,filePath);assert.equal(result.status,2);assert.equal(JSON.parse(result.stderr).errors[0].code,'BUNDLE_JSON_PARSE_FAILED')})});
test('missing argument returns a usage diagnostic',()=>{const result=run(catalogScript);assert.equal(result.status,2);assert.equal(JSON.parse(result.stderr).errors[0].code,'BUNDLE_USAGE_ERROR')});
test('missing file returns a read diagnostic',()=>{const result=run(requestScript,path.join(tmpdir(),'definitely-missing-auto-offer-bundle.json'));assert.equal(result.status,2);assert.equal(JSON.parse(result.stderr).errors[0].code,'BUNDLE_FILE_READ_FAILED')});
