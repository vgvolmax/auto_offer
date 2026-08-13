#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import { loadSemanticMatchingValidators, validateSemanticMatchResultObjects } from './lib/semantic-matching.mjs';

const paths = process.argv.slice(2);
if (paths.length !== 3) {
  console.error(JSON.stringify({ valid: false, errors: [{ code: 'USAGE', message: 'Usage: validate-semantic-match-result <result.json> <request_bundle.json> <semantic-matching-catalog.json>' }] }, null, 2));
  process.exitCode = 1;
} else {
  try {
    const [result, requestBundle, matchingCatalog] = await Promise.all(paths.map((path) => readFile(path, 'utf8').then(JSON.parse)));
    const validators = await loadSemanticMatchingValidators();
    const report = await validateSemanticMatchResultObjects({ result, requestBundle, matchingCatalog, validators });
    console.log(JSON.stringify(report, null, 2));
    if (!report.valid) process.exitCode = 1;
  } catch (caught) {
    console.error(JSON.stringify({ valid: false, errors: [{ code: 'INPUT_ERROR', message: caught instanceof Error ? caught.message : String(caught) }] }, null, 2));
    process.exitCode = 1;
  }
}
