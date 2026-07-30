import test from 'node:test'; import assert from 'node:assert/strict'; import path from 'node:path';
import {listGoldenScenarioDirectories,loadGoldenScenario} from '../scripts/matching/lib/golden-scenario-loader.mjs';
import {runPilotMatcher} from '../matching/runtime/index.mjs'; import {readJson} from '../scripts/matching/lib/golden-scenario-loader.mjs';
const registry=await readJson('matching/policies/pilot-v1.json');
for(const directory of await listGoldenScenarioDirectories()) test(path.basename(directory),async()=>{const s=await loadGoldenScenario(directory);const actual=await runPilotMatcher({requestBundle:s.request,catalogs:s.catalogs.map(({input,bundle})=>({catalogRecordId:input.catalog_record_id,bundle})),policy:s.policy,registry,engineVersion:'pilot-1.0.0'});assert.deepStrictEqual(actual,s.expected)});
