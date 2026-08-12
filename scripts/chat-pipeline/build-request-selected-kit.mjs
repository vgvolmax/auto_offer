#!/usr/bin/env node
import { readFile, writeFile } from 'node:fs/promises';
import { loadRequestRoutingValidators } from './lib/request-routing.mjs';
import { buildSelectedRequestKitFromRouting } from './lib/request-selected-kit-from-routing.mjs';

const files = process.argv.slice(2);
if (files.length !== 5) {
  console.error(JSON.stringify({ valid: false, errors: ['Usage: build:request-selected-kit -- <request-annotation-kit.json> <request-source.json> <request-routing.json> <taxonomy-light.json> <request-selected-kit.json>'] }, null, 2));
  process.exitCode = 1;
} else {
  try {
    const [fullFile, sourceFile, routingFile, lightFile, output] = files;
    const [fullKit, requestSource, routing, taxonomyLight, validators] = await Promise.all([
      ...[fullFile, sourceFile, routingFile, lightFile].map((file) => readFile(file, 'utf8').then(JSON.parse)),
      loadRequestRoutingValidators(),
    ]);
    const selectedKit = buildSelectedRequestKitFromRouting({ fullKit, requestSource, routing, taxonomyLight, validators });
    await writeFile(output, `${JSON.stringify(selectedKit, null, 2)}\n`, 'utf8');
    console.log(JSON.stringify({ valid: true, line_count: routing.line_count, selected_class_count: selectedKit.selected_class_ids.length, unsupported_count: selectedKit.unsupported_lines.length, output }, null, 2));
  } catch (error) {
    console.error(JSON.stringify({ valid: false, errors: [error.message] }, null, 2));
    process.exitCode = 1;
  }
}
