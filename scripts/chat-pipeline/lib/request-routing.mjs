import { readFile } from 'node:fs/promises';
import Ajv2020 from 'ajv/dist/2020.js';

export async function loadRequestRoutingValidators() {
  const schemaFiles = [
    new URL('../../../schemas/chat-pipeline/request-routing.schema.json', import.meta.url),
    new URL('../../../schemas/chat-pipeline/request-source.schema.json', import.meta.url),
    new URL('../../../schemas/chat-pipeline/taxonomy-light.schema.json', import.meta.url),
  ];
  const schemas = await Promise.all(schemaFiles.map((file) => readFile(file, 'utf8').then(JSON.parse)));
  const ajv = new Ajv2020({ allErrors: true });
  const [routing, requestSource, taxonomyLight] = schemas.map((schema) => ajv.compile(schema));
  return { routing, requestSource, taxonomyLight };
}

export { projectRequestRouting, validateRequestRoutingObjects } from './request-routing-core.mjs';
