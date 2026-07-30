import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { readFile } from 'node:fs/promises';

const schemaFiles = [
  'matching-policy.schema.json',
  'match-result.schema.json',
  'golden-scenario.schema.json',
  'matching-policy-registry.schema.json',
];
const schemaBase = 'https://example.local/schemas/matching/';

export async function loadMatchingSchemas() {
  const ajv = new Ajv2020({ allErrors: true, strict: false });
  addFormats(ajv);
  const schemas = await Promise.all(schemaFiles.map(async (file) => (
    JSON.parse(await readFile(new URL(`../../../schemas/matching/${file}`, import.meta.url)))
  )));

  for (const schema of schemas) ajv.addSchema(schema);

  return {
    ajv,
    schemas,
    policy: ajv.getSchema(`${schemaBase}matching-policy.schema.json`),
    result: ajv.getSchema(`${schemaBase}match-result.schema.json`),
    scenario: ajv.getSchema(`${schemaBase}golden-scenario.schema.json`),
    registry: ajv.getSchema(`${schemaBase}matching-policy-registry.schema.json`),
  };
}
