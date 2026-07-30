import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { listGoldenScenarioDirectories, loadGoldenScenario, readJson } from '../scripts/matching/lib/golden-scenario-loader.mjs';
import { loadMatchingSchemas } from '../scripts/matching/lib/matching-schema-loader.mjs';
import { runPilotMatcher } from '../matching/runtime/index.mjs';

const registry = await readJson('matching/policies/pilot-v1.json');
const schemas = await loadMatchingSchemas();

for (const directory of await listGoldenScenarioDirectories()) {
  test(path.basename(directory), async () => {
    const fixture = await loadGoldenScenario(directory);
    const actual = await runPilotMatcher({
      requestBundle: fixture.request,
      catalogs: fixture.catalogs.map(({ input, bundle }) => ({ catalogRecordId: input.catalog_record_id, bundle })),
      policy: fixture.policy,
      registry,
      engineVersion: 'pilot-1.0.0',
    });
    assert.equal(schemas.result(actual), true, JSON.stringify(schemas.result.errors));
    assert.deepStrictEqual(actual, fixture.expected);
  });
}
