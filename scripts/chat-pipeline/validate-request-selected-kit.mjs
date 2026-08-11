#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import Ajv2020 from 'ajv/dist/2020.js';
import { validateSelectedRequestKit } from '../annotation-kits/lib/request-selected-kit.mjs';

const [fullFile, selectedFile, sourceFile] = process.argv.slice(2);
if (!fullFile || !selectedFile) throw new Error('Usage: validate:request-selected-kit -- <full-kit.json> <selected-kit.json> [request-source.json]');
try {
  const [full, selected, source, schema] = await Promise.all([
    readFile(fullFile, 'utf8').then(JSON.parse), readFile(selectedFile, 'utf8').then(JSON.parse),
    sourceFile ? readFile(sourceFile, 'utf8').then(JSON.parse) : undefined,
    readFile(new URL('../../schemas/chat-pipeline/request-selected-kit.schema.json', import.meta.url), 'utf8').then(JSON.parse),
  ]);
  const shape = new Ajv2020({ allErrors: true, formats: { uri: true } }).compile(schema);
  if (!shape(selected)) throw new Error(shape.errors.map((e) => `${e.instancePath || '/'} ${e.message}`).join('; '));
  validateSelectedRequestKit(full, selected, source);
  console.log(JSON.stringify({ valid: true, selected_class_count: selected.selected_class_ids.length }));
} catch (error) {
  console.error(JSON.stringify({ valid: false, errors: [error.message] }, null, 2)); process.exitCode = 1;
}
