#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { repositoryRoot } from './lib/annotation-kits.mjs';

const generation = spawnSync(process.execPath, ['scripts/annotation-kits/generate-annotation-kits.mjs'], {
  cwd: repositoryRoot,
  encoding: 'utf8',
});
if (generation.stdout) process.stdout.write(generation.stdout);
if (generation.stderr) process.stderr.write(generation.stderr);
if (generation.status !== 0) process.exit(generation.status ?? 1);

const diff = spawnSync('git', ['diff', '--exit-code', '--', 'annotation-kits'], {
  cwd: repositoryRoot,
  stdio: 'inherit',
});
if (diff.error) throw diff.error;
if (diff.status !== 0) {
  console.error('Annotation kits are stale. Run npm run generate:annotation-kits and commit the result.');
  process.exit(diff.status ?? 1);
}
console.log('Annotation kits are up to date.');
