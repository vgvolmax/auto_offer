import { readFile, writeFile, mkdir, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateProductionTaxonomy } from '../taxonomy/validate-production-taxonomy.mjs';
import { buildCatalogSchema } from './lib/catalog-schema-generator.mjs';
import { buildRequestSchema } from './lib/request-schema-generator.mjs';
import { buildRegistry } from './lib/registry-generator.mjs';
import { canonicalJson } from './lib/schema-utils.mjs';

const readJson = async filename => JSON.parse(await readFile(filename, 'utf8'));

export async function generateClassContracts({ root = '.' } = {}) {
  const validation = await validateProductionTaxonomy({ root });
  if (validation.errors.length) throw new Error(validation.errors.map(item => `${item.code} ${item.path}`).join('\n'));
  const taxonomy = await readJson(path.join(root, 'taxonomy/taxonomy.json'));
  const annotationRoot = path.join(root, 'schemas/annotation');
  const classDir = path.join(annotationRoot, 'class-specific');
  const generatedDir = path.join(annotationRoot, 'generated');
  await rm(classDir, { recursive: true, force: true });
  await mkdir(classDir, { recursive: true });
  await mkdir(generatedDir, { recursive: true });
  const registry = buildRegistry(taxonomy);
  for (const classId of Object.keys(taxonomy.classes)) {
    const definition = taxonomy.classes[classId];
    await writeFile(path.join(classDir, `${classId}.catalog.schema.json`), canonicalJson(buildCatalogSchema(definition, taxonomy)));
    await writeFile(path.join(classDir, `${classId}.request.schema.json`), canonicalJson(buildRequestSchema(definition, taxonomy)));
  }
  await writeFile(path.join(annotationRoot, 'class-schema-registry.json'), canonicalJson(registry));
  for (const [kind, filename, title] of [
    ['catalog','catalog-item.dispatch.schema.json','Generated catalog class dispatcher'],
    ['request','request-line.dispatch.schema.json','Generated request class dispatcher']
  ]) {
    const oneOf = Object.values(registry.classes).map(entry => ({ $ref: `../${entry[`${kind}_schema`]}` }));
    const schema = { $schema:'https://json-schema.org/draft/2020-12/schema', $id:`https://example.local/schemas/annotation/generated/${filename}`, title, oneOf };
    await writeFile(path.join(generatedDir, filename), canonicalJson(schema));
  }
  return { classCount: Object.keys(taxonomy.classes).length, catalogSchemaCount: Object.keys(taxonomy.classes).length, requestSchemaCount: Object.keys(taxonomy.classes).length };
}

const invoked = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invoked) {
  const result = await generateClassContracts();
  console.log(`Generated ${result.catalogSchemaCount} catalog and ${result.requestSchemaCount} request schemas.`);
}
