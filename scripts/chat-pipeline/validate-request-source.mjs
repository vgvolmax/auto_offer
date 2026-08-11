#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import Ajv2020 from 'ajv/dist/2020.js';

const [file] = process.argv.slice(2);
if (!file) throw new Error('Usage: validate:request-source -- <request-source.json>');
const [schema, value] = await Promise.all([
  readFile(new URL('../../schemas/chat-pipeline/request-source.schema.json', import.meta.url), 'utf8').then(JSON.parse),
  readFile(file, 'utf8').then(JSON.parse),
]);
const validate = new Ajv2020({ allErrors: true }).compile(schema);
const errors = [];
if (!validate(value)) errors.push(...validate.errors.map((error) => `${error.instancePath || '/'} ${error.message}`));
if (value.line_count !== value.lines?.length) errors.push('/line_count must equal lines.length');
if (new Set(value.lines?.map((line) => line.line_id)).size !== value.lines?.length) errors.push('/lines line_id values must be unique');
if (errors.length) { console.error(JSON.stringify({ valid: false, errors }, null, 2)); process.exitCode = 1; }
else console.log(JSON.stringify({ valid: true, line_count: value.line_count }));
