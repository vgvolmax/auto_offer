#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import Ajv2020 from 'ajv/dist/2020.js';
import { validateRequestRoutingObjects } from './lib/request-routing.mjs';

const files = process.argv.slice(2);
if (files.length !== 3) {
  console.error(JSON.stringify({ valid: false, errors: ['Usage: validate:request-routing -- <request-routing.json> <request-source.json> <taxonomy-light.json>'] }, null, 2));
  process.exitCode = 1;
} else {
  try {
    const [routing, requestSource, taxonomyLight] = await Promise.all(files.map((file) => readFile(file, 'utf8').then(JSON.parse)));
    const schemaFiles = [
      new URL('../../schemas/chat-pipeline/request-routing.schema.json', import.meta.url),
      new URL('../../schemas/chat-pipeline/request-source.schema.json', import.meta.url),
      new URL('../../schemas/chat-pipeline/taxonomy-light.schema.json', import.meta.url),
    ];
    const schemas = await Promise.all(schemaFiles.map((file) => readFile(file, 'utf8').then(JSON.parse)));
    const ajv = new Ajv2020({ allErrors: true });
    const [routingValidator, sourceValidator, taxonomyValidator] = schemas.map((schema) => ajv.compile(schema));
    const result = validateRequestRoutingObjects(routing, requestSource, taxonomyLight, {
      routing: routingValidator, requestSource: sourceValidator, taxonomyLight: taxonomyValidator,
    });
    const output = JSON.stringify(result, null, 2);
    if (result.valid) console.log(output);
    else { console.error(output); process.exitCode = 1; }
  } catch (error) {
    console.error(JSON.stringify({ valid: false, errors: [error.message] }, null, 2));
    process.exitCode = 1;
  }
}
