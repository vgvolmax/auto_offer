import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const workflowDir = path.join(root, '.github', 'workflows');
const canonicalWorkflow = '.github/workflows/ci.yml';
const expectedConcurrencyGroup = 'group: ${{ github.workflow }}-${{ github.event.pull_request.number || github.ref }}';

const requiredFullSuiteScripts = [
  'test:ci-workflows',
  'validate:matching-contracts',
  'test:matching-contracts',
  'test:matcher-core',
  'test:matcher-golden',
  'check:annotation-schemas',
  'check:annotation-kits',
  'check:catalog-validation-kit',
  'test:annotation-kits',
  'test:chat-prompts',
  'test:production-taxonomy',
  'test:annotation',
  'test:bundles',
  'test:catalog',
  'test:catalog-validation-kit',
  'test:inventory',
  'test:taxonomy-review',
  'typecheck:app',
  'test:app',
];

const expectedSpecializedScripts = new Map([
  ['.github/workflows/annotation-contract.yml', [
    'taxonomy:validate-production',
    'generate:annotation-schemas',
    'generate:annotation-kits',
    'generate:catalog-validation-kit',
    'generate:catalog-validation-kit-builder',
    'check:annotation-schemas',
    'check:annotation-kits',
    'check:catalog-validation-kit',
  ]],
  ['.github/workflows/catalog-inventory.yml', ['test:inventory']],
  ['.github/workflows/taxonomy-review.yml', ['test:taxonomy-review']],
  ['.github/workflows/windows-launcher.yml', []],
]);

const maxTimeoutByWorkflow = new Map([
  ['.github/workflows/ci.yml', 30],
  ['.github/workflows/annotation-contract.yml', 20],
  ['.github/workflows/catalog-inventory.yml', 20],
  ['.github/workflows/taxonomy-review.yml', 20],
  ['.github/workflows/windows-launcher.yml', 20],
]);

async function loadWorkflows() {
  const names = (await readdir(workflowDir)).filter((name) => /\.ya?ml$/i.test(name)).sort();
  return Promise.all(names.map(async (name) => ({
    path: `.github/workflows/${name}`,
    source: await readFile(path.join(workflowDir, name), 'utf8'),
  })));
}

function hasPullRequestTrigger(source) {
  return /^on:\s*\[[^\]\n]*\bpull_request\b[^\]\n]*\]\s*$/m.test(source)
    || /^  pull_request:\s*(?:$|\{?|\[?)/m.test(source);
}

function stripCommentLines(source) {
  return source.split(/\r?\n/).filter((line) => !/^\s*#/.test(line)).join('\n');
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function countMatches(source, pattern) {
  return [...source.matchAll(pattern)].length;
}

function countNpmRun(command, scriptName) {
  return countMatches(
    command,
    new RegExp(`\\bnpm(?:\\.cmd)?\\s+run\\s+${escapeRegExp(scriptName)}(?=\\s|&&|\\|\\||;|$)`, 'g'),
  );
}

function getJobBlocks(source) {
  const lines = source.split(/\r?\n/);
  const jobsIndex = lines.findIndex((line) => line === 'jobs:');
  assert.notEqual(jobsIndex, -1, 'workflow must define a top-level jobs block');
  const blocks = [];
  for (let i = jobsIndex + 1; i < lines.length; i += 1) {
    const match = /^  ([A-Za-z0-9_-]+):\s*$/.exec(lines[i]);
    if (!match) continue;
    const start = i;
    let end = lines.length;
    for (let j = i + 1; j < lines.length; j += 1) {
      if (/^  [A-Za-z0-9_-]+:\s*$/.test(lines[j])) {
        end = j;
        break;
      }
    }
    blocks.push({ name: match[1], source: lines.slice(start, end).join('\n') });
  }
  return blocks;
}

function invokedNpmScripts(source) {
  const result = [];
  for (const match of stripCommentLines(source).matchAll(/\bnpm(?:\.cmd)?\s+run\s+([A-Za-z0-9:_-]+)/g)) {
    result.push(match[1]);
  }
  return result;
}

function scriptInvokesFullSuite(name, scripts, seen = new Set()) {
  if (name === 'test') return true;
  if (seen.has(name)) return false;
  const nextSeen = new Set(seen);
  nextSeen.add(name);
  const command = scripts[name];
  if (!command) return false;
  if (/\bnpm(?:\.cmd)?\s+test\b/.test(command)) return true;
  for (const match of command.matchAll(/\bnpm(?:\.cmd)?\s+run\s+([A-Za-z0-9:_-]+)/g)) {
    if (scriptInvokesFullSuite(match[1], scripts, nextSeen)) return true;
  }
  return false;
}

test('canonical workflow owns heavy regression and repository hygiene', async () => {
  const workflows = await loadWorkflows();
  const byPath = new Map(workflows.map((workflow) => [workflow.path, workflow]));
  assert.ok(byPath.has(canonicalWorkflow), `${canonicalWorkflow} must exist`);
  const canonical = stripCommentLines(byPath.get(canonicalWorkflow).source);

  const fullSuiteOwners = workflows.filter(({ source }) => /\bnpm(?:\.cmd)?\s+test\b/.test(stripCommentLines(source)));
  assert.deepEqual(fullSuiteOwners.map(({ path: workflowPath }) => workflowPath), [canonicalWorkflow]);
  assert.equal(countMatches(canonical, /\bnpm(?:\.cmd)?\s+test\b/g), 1, 'canonical workflow must run npm test once');

  const appBuildOwners = workflows.filter(({ source }) => /\bnpm(?:\.cmd)?\s+run\s+app:build\b/.test(stripCommentLines(source)));
  assert.deepEqual(appBuildOwners.map(({ path: workflowPath }) => workflowPath), [canonicalWorkflow]);
  assert.equal(countMatches(canonical, /\bnpm(?:\.cmd)?\s+run\s+app:build\b/g), 1, 'canonical workflow must build the app once');
  assert.deepEqual(invokedNpmScripts(canonical), ['app:build'], 'canonical workflow must not repeat npm test children directly');

  assert.equal(countMatches(canonical, /\bnpm(?:\.cmd)?\s+ci\b/g), 1, 'canonical workflow must install from the lockfile once');
  assert.match(canonical, /node-version:\s*20\b/, 'canonical workflow must use Node.js 20');
  assert.match(canonical, /cache:\s*npm\b/, 'canonical workflow must use the npm cache');
  assert.match(canonical, /name:\s*Reject disabled or focused tests\b/, 'canonical workflow must keep the disabled/focused-test guard');
  assert.match(
    canonical,
    /git\s+grep\s+-n\s+-E[^\n]*--\s+scripts\/launcher\s+app\/src\s+tests\b/,
    'canonical workflow must scan all established regression paths for disabled/focused tests',
  );
  assert.match(canonical, /git\s+diff\s+--check\b/, 'canonical workflow must keep the repository whitespace check');
});

test('npm test preserves every existing correctness gate exactly once', async () => {
  const packageJson = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'));
  const fullSuite = packageJson.scripts.test;
  assert.equal(typeof fullSuite, 'string');

  for (const scriptName of requiredFullSuiteScripts) {
    assert.equal(typeof packageJson.scripts[scriptName], 'string', `${scriptName} must remain defined`);
    assert.equal(
      countNpmRun(fullSuite, scriptName),
      1,
      `npm test must invoke ${scriptName} exactly once`,
    );
  }

  assert.equal(
    requiredFullSuiteScripts.reduce((total, scriptName) => total + countNpmRun(fullSuite, scriptName), 0),
    requiredFullSuiteScripts.length,
    'the protected regression gates must not be duplicated inside npm test',
  );
});

test('specialized workflows stay targeted instead of becoming second regressions', async () => {
  const workflows = await loadWorkflows();
  const byPath = new Map(workflows.map((workflow) => [workflow.path, workflow]));
  const packageJson = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'));

  for (const [workflowPath, expectedScripts] of expectedSpecializedScripts) {
    const workflow = byPath.get(workflowPath);
    assert.ok(workflow, `${workflowPath} must exist`);
    assert.deepEqual(
      invokedNpmScripts(workflow.source),
      expectedScripts,
      `${workflowPath} must contain only its reviewed focused npm scripts`,
    );
    for (const scriptName of expectedScripts) {
      assert.equal(
        scriptInvokesFullSuite(scriptName, packageJson.scripts),
        false,
        `${workflowPath} invokes ${scriptName}, which reaches npm test`,
      );
    }
  }

  for (const workflow of workflows.filter(({ path: workflowPath }) => workflowPath !== canonicalWorkflow)) {
    assert.doesNotMatch(workflow.source, /\bnpm(?:\.cmd)?\s+test\b/, `${workflow.path} must not run the full suite directly`);
    assert.doesNotMatch(workflow.source, /\bnpm(?:\.cmd)?\s+run\s+app:build\b/, `${workflow.path} must not repeat the app build`);
    assert.doesNotMatch(workflow.source, /\bnpm(?:\.cmd)?\s+run\s+(?:typecheck:app|test:app|test:pilot)\b/, `${workflow.path} must not repeat app regression`);
  }
});

test('pull request workflows cancel stale runs and jobs have bounded timeouts', async () => {
  const workflows = await loadWorkflows();
  for (const workflow of workflows) {
    if (hasPullRequestTrigger(workflow.source)) {
      assert.match(workflow.source, /^concurrency:\s*$/m, `${workflow.path} must define top-level concurrency`);
      assert.ok(workflow.source.includes(expectedConcurrencyGroup), `${workflow.path} must isolate concurrency by workflow and PR/ref`);
      assert.match(workflow.source, /^  cancel-in-progress:\s*true\s*$/m, `${workflow.path} must cancel stale runs`);
    }

    const jobs = getJobBlocks(workflow.source);
    assert.ok(jobs.length > 0, `${workflow.path} must define at least one job`);
    for (const job of jobs) {
      const match = /^    timeout-minutes:\s*(\d+)\s*$/m.exec(job.source);
      assert.ok(match, `${workflow.path} job ${job.name} must have timeout-minutes`);
      const timeout = Number(match[1]);
      assert.ok(timeout > 0, `${workflow.path} job ${job.name} timeout must be positive`);
      const maximum = maxTimeoutByWorkflow.get(workflow.path);
      if (maximum !== undefined) {
        assert.ok(timeout <= maximum, `${workflow.path} job ${job.name} timeout must not exceed ${maximum} minutes`);
      }
    }
  }
});

test('catalog validation kit suite stays sequential and singly wired', async () => {
  const workflows = await loadWorkflows();
  const packageJson = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'));
  const command = packageJson.scripts['test:catalog-validation-kit'];
  assert.match(command, /^node --test --test-concurrency=1 tests\/catalog-validation-kit-\*\.test\.mjs$/);
  assert.equal(countNpmRun(packageJson.scripts.test, 'test:catalog-validation-kit'), 1);

  const owners = Object.entries(packageJson.scripts)
    .filter(([name, value]) => name !== 'test:catalog-validation-kit' && /tests\/catalog-validation-kit-.*\.test\.mjs/.test(value));
  assert.deepEqual(owners, [], 'no second npm script may collect catalog-validation-kit tests');

  for (const workflow of workflows.filter(({ path: workflowPath }) => workflowPath !== canonicalWorkflow)) {
    assert.doesNotMatch(workflow.source, /test:catalog-validation-kit\b/, `${workflow.path} must not run validation-kit suite separately`);
  }
});
