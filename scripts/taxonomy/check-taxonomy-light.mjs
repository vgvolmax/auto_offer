#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { repositoryRoot } from '../annotation-kits/lib/annotation-kits.mjs';

const generation = spawnSync(process.execPath, ['scripts/taxonomy/generate-taxonomy-light.mjs'], { cwd: repositoryRoot, encoding: 'utf8' });
if (generation.stdout) process.stdout.write(generation.stdout);
if (generation.stderr) process.stderr.write(generation.stderr);
if (generation.status !== 0) process.exit(generation.status ?? 1);
const diff = spawnSync('git', ['diff', '--exit-code', '--', 'taxonomy/taxonomy-light.json'], { cwd: repositoryRoot, stdio: 'inherit' });
if (diff.error) throw diff.error;
if (diff.status !== 0) {
  console.error('taxonomy-light.json is stale. Run npm run generate:taxonomy-light and commit the result.');
  process.exit(diff.status ?? 1);
}
console.log('taxonomy-light.json is up to date.');
