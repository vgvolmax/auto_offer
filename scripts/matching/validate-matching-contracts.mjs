#!/usr/bin/env node
import path from 'node:path';
import { loadBundleValidationContext } from '../bundles/lib/bundle-schema-loader.mjs';
import { validateCatalogBundle, validateRequestBundle } from '../bundles/lib/bundle-validator.mjs';
import { findForbiddenDecisionFields, validatePolicySemantics } from './lib/matching-contract-validator.mjs';
import { loadMatchingSchemas } from './lib/matching-schema-loader.mjs';
import { loadProductionClassContracts, validatePolicyRegistry } from './lib/policy-registry-validator.mjs';
import { listGoldenScenarioDirectories, loadGoldenScenario, readJson } from './lib/golden-scenario-loader.mjs';
import { validateGoldenResult } from './lib/golden-result-validator.mjs';

const requiredScenarios = [
  'D1-single-exact', 'D2-multiple-exact', 'D3-brand-equivalent', 'D3-pressure-equivalent',
  'D4-handle-alternative', 'D5-thread-no-match', 'D5-missing-value', 'D6-brand-excluded',
  'D6-brand-not-included', 'D9-two-offers', 'D10-policy-fingerprint', 'C10-review-excluded',
  'C10-review-manual', 'B5-request-review', 'identity-neq-hard', 'determinism-catalog-order',
];

const errors = [];
const schemas = await loadMatchingSchemas();
const registry = await readJson('matching/policies/pilot-v1.json');
if (!schemas.registry(registry)) {
  errors.push(`registry schema: ${JSON.stringify(schemas.registry.errors)}`);
} else {
  errors.push(...await validatePolicyRegistry(registry, await loadProductionClassContracts()));
}

const bundleContext = await loadBundleValidationContext();
const scenarioIds = new Set();
for (const directory of await listGoldenScenarioDirectories()) {
  const loaded = await loadGoldenScenario(directory);
  const { scenario, request, policy, expected, catalogs } = loaded;
  const scenarioId = scenario.scenario_id ?? path.basename(directory);

  if (!schemas.scenario(scenario)) errors.push(`${scenarioId}: scenario schema ${JSON.stringify(schemas.scenario.errors)}`);
  if (scenarioIds.has(scenarioId)) errors.push(`${scenarioId}: duplicate scenario ID`);
  scenarioIds.add(scenarioId);

  const requestValidation = validateRequestBundle(request, bundleContext);
  if (!requestValidation.valid) errors.push(`${scenarioId}: invalid request bundle ${JSON.stringify(requestValidation.errors)}`);
  for (const { input, bundle } of catalogs) {
    const validation = validateCatalogBundle(bundle, bundleContext);
    if (!validation.valid) errors.push(`${scenarioId}: invalid catalog bundle ${input.file}: ${JSON.stringify(validation.errors)}`);
  }

  if (!schemas.policy(policy)) errors.push(`${scenarioId}: policy schema ${JSON.stringify(schemas.policy.errors)}`);
  errors.push(...validatePolicySemantics(policy).map((error) => `${scenarioId}: ${error}`));
  if (!schemas.result(expected)) errors.push(`${scenarioId}: result schema ${JSON.stringify(schemas.result.errors)}`);
  errors.push(...findForbiddenDecisionFields(expected).map((field) => `${scenarioId}: forbidden ${field}`));
  errors.push(...await validateGoldenResult(loaded));

  const serializedResult = JSON.stringify(expected);
  for (const code of scenario.required_reason_codes) {
    if (!serializedResult.includes(code)) errors.push(`${scenarioId}: missing required reason ${code}`);
  }
}
for (const scenarioId of requiredScenarios) {
  if (!scenarioIds.has(scenarioId)) errors.push(`missing mandatory scenario ${scenarioId}`);
}

if (errors.length) {
  console.error(errors.join('\n'));
  process.exit(1);
}
console.log(`Matching contracts valid: ${scenarioIds.size} golden scenarios, pilot-1.0.0`);
