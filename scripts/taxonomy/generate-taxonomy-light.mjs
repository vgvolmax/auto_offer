#!/usr/bin/env node
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { jsonBytes, repositoryRoot } from '../annotation-kits/lib/annotation-kits.mjs';
import { validateProductionTaxonomy } from './validate-production-taxonomy.mjs';
import { buildTaxonomyLight } from './lib/taxonomy-light.mjs';

const validation = await validateProductionTaxonomy({ root: repositoryRoot });
if (validation.errors.length) throw new Error(`Production taxonomy is invalid: ${validation.errors.map(({ code, path: itemPath }) => `${code} ${itemPath}`).join('; ')}`);
const taxonomy = JSON.parse(await readFile(path.join(repositoryRoot, 'taxonomy/taxonomy.json'), 'utf8'));
const light = buildTaxonomyLight(taxonomy);
await writeFile(path.join(repositoryRoot, 'taxonomy/taxonomy-light.json'), jsonBytes(light));
console.log(`Generated taxonomy-light.json (${light.class_count} classes).`);
