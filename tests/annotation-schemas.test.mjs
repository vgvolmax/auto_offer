import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import Ajv2020 from 'ajv/dist/2020.js';
import { loadAnnotationSchemas } from '../scripts/lib/annotation-schema-loader.mjs';

test('all production entry points and references compile with Ajv', async () => {
  const { ajv, productionIds } = await loadAnnotationSchemas();
  for (const schemaId of productionIds) assert.equal(typeof ajv.getSchema(schemaId), 'function', schemaId);
});


test('all catalog builder schemas compile with Ajv', async () => {
  const ajv = new Ajv2020({ allErrors: true, strict: false });
  for (const filename of await readdir('schemas/catalog')) ajv.compile(JSON.parse(await readFile(`schemas/catalog/${filename}`, 'utf8')));
});
