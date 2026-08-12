#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import { loadRequestRoutingValidators, validateRequestRoutingObjects } from './lib/request-routing.mjs';

const files = process.argv.slice(2);
if (files.length !== 3) {
  console.error(JSON.stringify({ valid: false, errors: ['Usage: validate:request-routing -- <request-routing.json> <request-source.json> <taxonomy-light.json>'] }, null, 2));
  process.exitCode = 1;
} else {
  try {
    const [routing, requestSource, taxonomyLight] = await Promise.all(files.map((file) => readFile(file, 'utf8').then(JSON.parse)));
    const validators = await loadRequestRoutingValidators();
    const result = validateRequestRoutingObjects(routing, requestSource, taxonomyLight, validators);
    const output = JSON.stringify(result, null, 2);
    if (result.valid) console.log(output);
    else { console.error(output); process.exitCode = 1; }
  } catch (error) {
    console.error(JSON.stringify({ valid: false, errors: [error.message] }, null, 2));
    process.exitCode = 1;
  }
}
