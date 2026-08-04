import { readdir } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const tests = (await readdir(path.join(root, 'tests')))
  .filter(name => name.startsWith('catalog-'))
  .filter(name => name.endsWith('.test.mjs'))
  .filter(name => !name.startsWith('catalog-validation-kit-'))
  .sort()
  .map(name => path.join('tests', name));

if (!tests.length) throw new Error('No legacy catalog tests found');

const child = spawn(process.execPath, ['--test', ...tests], {
  cwd: root,
  stdio: 'inherit',
  shell: false,
});
child.on('error', cause => {
  console.error(cause);
  process.exitCode = 1;
});
child.on('exit', (code, signal) => {
  if (signal) {
    console.error(`Catalog test process terminated by ${signal}`);
    process.exitCode = 1;
  } else process.exitCode = code ?? 1;
});
