import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const workflowDir = path.join(root, '.github', 'workflows');
const canonicalWorkflow = '.github/workflows/ci.yml';
const expectedConcurrencyGroup = 'group: ${{ github.workflow }}-${{ github.event.pull_request.number || github.ref }}';

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

function countMatches(source, pattern) {
  return [...source.matchAll(pattern)].length;
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
  seen.add(name);
  const command = scripts[name];
  if (!command) return false;
  if (/\bnpm(?:\.cmd)?\s+test\b/.test(command)) return true;
  for (const match of command.matchAll(/\bnpm(?:\.cmd)?\s+run\s+([A-Za-z0-9:_-]+)/g)) {
    if (scriptInvokesFullSuite(match[1], scripts, seen)) return true;
  }
  return false;
}

test('full regression commands have one canonical workflow owner', async () => {
  const workflows = await loadWorkflows();
  const byPath = new Map(workflows.map((workflow) => [workflow.path, workflow]));
  assert.ok(byPath.has(canonicalWorkflow), `${canonicalWorkflow} must exist`);

  const fullSuiteOwners = workflows.filter(({ source }) => /\bnpm(?:\.cmd)?\s+test\b/.test(stripCommentLines(source)));
  assert.deepEqual(fullSuiteOwners.map(({ path: workflowPath }) => workflowPath), [canonicalWorkflow]);
  assert.equal(countMatches(stripCommentLines(byPath.get(canonicalWorkflow).source), /\bnpm(?:\.cmd)?\s+test\b/g), 1);

  const appBuildOwners = workflows.filter(({ source }) => /\bnpm(?:\.cmd)?\s+run\s+app:build\b/.test(stripCommentLines(source)));
  assert.deepEqual(appBuildOwners.map(({ path: workflowPath }) => workflowPath), [canonicalWorkflow]);
  assert.equal(countMatches(stripCommentLines(byPath.get(canonicalWorkflow).source), /\bnpm(?:\.cmd)?\s+run\s+app:build\b/g), 1);
});

test('pull request workflows cancel stale runs and every job has a timeout', async () => {
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
      assert.match(job.source, /^    timeout-minutes:\s*\d+\s*$/m, `${workflow.path} job ${job.name} must have timeout-minutes`);
    }
  }
});

test('specialized workflows cannot reach the canonical full suite indirectly', async () => {
  const workflows = await loadWorkflows();
  const packageJson = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'));
  for (const workflow of workflows.filter(({ path: workflowPath }) => workflowPath !== canonicalWorkflow)) {
    for (const scriptName of invokedNpmScripts(workflow.source)) {
      assert.equal(
        scriptInvokesFullSuite(scriptName, packageJson.scripts),
        false,
        `${workflow.path} invokes ${scriptName}, which reaches npm test`,
      );
    }
  }
});

test('catalog validation kit suite stays sequential and singly wired', async () => {
  const workflows = await loadWorkflows();
  const packageJson = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'));
  const command = packageJson.scripts['test:catalog-validation-kit'];
  assert.match(command, /^node --test --test-concurrency=1 tests\/catalog-validation-kit-\*\.test\.mjs$/);
  assert.equal(countMatches(packageJson.scripts.test, /npm run test:catalog-validation-kit\b/g), 1);

  const owners = Object.entries(packageJson.scripts)
    .filter(([name, value]) => name !== 'test:catalog-validation-kit' && /tests\/catalog-validation-kit-.*\.test\.mjs/.test(value));
  assert.deepEqual(owners, [], 'no second npm script may collect catalog-validation-kit tests');

  for (const workflow of workflows.filter(({ path: workflowPath }) => workflowPath !== canonicalWorkflow)) {
    assert.doesNotMatch(workflow.source, /test:catalog-validation-kit\b/, `${workflow.path} must not run validation-kit suite separately`);
  }
});
