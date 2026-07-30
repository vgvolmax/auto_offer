import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';

export const goldenRoot = 'tests/fixtures/matching/golden';

export async function readJson(file) {
  return JSON.parse(await readFile(file, 'utf8'));
}

export async function listGoldenScenarioDirectories(root = goldenRoot) {
  const entries = await readdir(root, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isDirectory() && entry.name !== 'shared')
    .map((entry) => path.join(root, entry.name))
    .sort();
}

export async function loadGoldenScenario(directory) {
  const scenario = await readJson(path.join(directory, 'scenario.json'));
  const catalogs = await Promise.all(scenario.catalog_inputs.map(async (input) => ({
    input,
    bundle: await readJson(path.resolve(directory, input.file)),
  })));

  return {
    directory,
    scenario,
    catalogs,
    request: await readJson(path.join(directory, scenario.request_file)),
    policy: await readJson(path.join(directory, scenario.policy_file)),
    expected: await readJson(path.join(directory, scenario.expected_file)),
  };
}

export function catalogReferences(catalogs) {
  return catalogs.map(({ input, bundle }) => ({
    catalog_record_id: input.catalog_record_id,
    catalog_id: bundle.catalog.catalog_id,
    source_sha256: bundle.catalog.source_sha256,
  }));
}
