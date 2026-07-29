import { spawnSync } from 'node:child_process';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { loadAnnotationSchemas } from './lib/annotation-schema-loader.mjs';
import { validateProductionTaxonomy } from './taxonomy/validate-production-taxonomy.mjs';
import { generateClassContracts } from './annotation/generate-class-contracts.mjs';

const validation = await validateProductionTaxonomy();
if (validation.errors.length) {
  for (const item of validation.errors) console.error(`${item.code} ${item.path}: ${item.message}`);
  process.exit(1);
}

const generation = await generateClassContracts();
const trackedGeneratedPaths = [
  'schemas/annotation/class-specific',
  'schemas/annotation/generated',
  'schemas/annotation/class-schema-registry.json'
];
const diff = spawnSync('git', ['diff', '--exit-code', '--', ...trackedGeneratedPaths], { stdio: 'inherit' });
if (diff.status) throw new Error('Generated annotation contracts are stale');

const { documents, productionIds, classSchemas } = await loadAnnotationSchemas();
const registry = JSON.parse(await readFile('schemas/annotation/class-schema-registry.json', 'utf8'));
const classFiles = await readdir('schemas/annotation/class-specific');
const catalogCount = classFiles.filter(name => name.endsWith('.catalog.schema.json')).length;
const requestCount = classFiles.filter(name => name.endsWith('.request.schema.json')).length;
const registryCount = Object.keys(registry.classes).length;

if (generation.classCount !== 41 || catalogCount !== 41 || requestCount !== 41 || registryCount !== 41) {
  throw new Error(`Expected 41 production classes and 41/41 schemas; got classes=${generation.classCount}, catalog=${catalogCount}, request=${requestCount}, registry=${registryCount}`);
}
if (Object.keys(classSchemas).length !== 82) throw new Error(`Expected 82 compiled class schemas, got ${Object.keys(classSchemas).length}`);

console.log(`Compiled ${documents.length} Draft 2020-12 schemas, including ${productionIds.length} production entry points.`);
console.log(`Verified ${registryCount} production classes, ${catalogCount} catalog schemas, and ${requestCount} request schemas.`);
