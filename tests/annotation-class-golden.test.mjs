import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { buildClassAnnotationPrompt } from '../scripts/lib/class-annotation-prompt.mjs';
import { loadAnnotationSchemas } from '../scripts/lib/annotation-schema-loader.mjs';
import { validateAnnotation } from '../scripts/lib/annotation-contract-validator.mjs';

const taxonomy = JSON.parse(await readFile('taxonomy/taxonomy.json', 'utf8'));
const registry = JSON.parse(await readFile('schemas/annotation/class-schema-registry.json', 'utf8'));
const { classSchemas } = await loadAnnotationSchemas();

for (const classId of Object.keys(taxonomy.classes)) {
  test(`golden catalog prompt/output is deterministic and valid for ${classId}`, async () => {
    const fixture = JSON.parse(await readFile(`tests/fixtures/annotation/classes/${classId}.json`, 'utf8'));
    const entry = registry.classes[classId];
    const classSchema = classSchemas[entry.catalog_schema].schema;
    const args = { kind:'catalog_item', classId, rawText: fixture.golden.input_text_ru, taxonomy, classSchema };
    const prompt = buildClassAnnotationPrompt(args);
    assert.equal(prompt, buildClassAnnotationPrompt(args));
    assert.match(prompt, new RegExp(classId.replaceAll('.', '\\.')));
    for (const forbidden of ['product_id','offer_id','match_level']) assert.equal(prompt.includes(forbidden), true);
    const output = fixture.golden.expected_output;
    assert.equal(classSchemas[entry.catalog_schema].validator(output), true);
    const semantic = validateAnnotation({ kind:'catalog_item', data:output, taxonomy, registry, schemas:classSchemas });
    assert.equal(semantic.valid, true, JSON.stringify(semantic.issues));
    for (const forbidden of ['product_id','offer_id','match_level','gtin','supplier_sku']) assert.equal(Object.hasOwn(output, forbidden), false);
  });
}
