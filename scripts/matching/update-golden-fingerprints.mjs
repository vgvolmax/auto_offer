#!/usr/bin/env node
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { listGoldenScenarioDirectories, loadGoldenScenario } from './lib/golden-scenario-loader.mjs';
import { expectedFingerprint } from './lib/golden-result-validator.mjs';

for (const directory of await listGoldenScenarioDirectories()) {
  const loaded = await loadGoldenScenario(directory);
  loaded.expected.input_fingerprint = await expectedFingerprint(loaded);
  const output = `${JSON.stringify(loaded.expected, null, 2)}\n`;
  await writeFile(path.join(directory, loaded.scenario.expected_file), output);
}
console.log('Updated committed matching golden fingerprints.');
