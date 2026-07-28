import test from 'node:test';
import assert from 'node:assert/strict';
import { loadAnnotationSchemas } from '../scripts/lib/annotation-schema-loader.mjs';

test('all production entry points and references compile with Ajv', async () => {
  const { ajv, productionIds } = await loadAnnotationSchemas();
  for (const schemaId of productionIds) assert.equal(typeof ajv.getSchema(schemaId), 'function', schemaId);
});
