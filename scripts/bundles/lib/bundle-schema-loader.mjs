import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { loadAnnotationSchemas } from '../../lib/annotation-schema-loader.mjs';

const CATALOG_ID = 'https://example.local/schemas/bundles/catalog-bundle.schema.json';
const REQUEST_ID = 'https://example.local/schemas/bundles/request-bundle.schema.json';
const CATALOG_ITEM_ID = 'https://example.local/schemas/annotation/generated/catalog-item.dispatch.schema.json';
const REQUEST_DOCUMENT_ID = 'https://example.local/schemas/annotation/request-document.base.schema.json';
const CATALOG_ITEM_BASE_ID = 'https://example.local/schemas/annotation/catalog-item-annotation.base.schema.json';
const REQUEST_LINE_BASE_ID = 'https://example.local/schemas/annotation/request-line-annotation.base.schema.json';

export async function loadBundleValidationContext(options = {}) {
  const { taxonomyPath = 'taxonomy/taxonomy.json', registryPath = 'schemas/annotation/class-schema-registry.json', bundleSchemaRoot = 'schemas/bundles' } = options;
  const [{ ajv, classSchemas }, taxonomyText, registryText, names] = await Promise.all([
    loadAnnotationSchemas(), readFile(taxonomyPath, 'utf8'), readFile(registryPath, 'utf8'), readdir(bundleSchemaRoot)
  ]);
  const taxonomy = JSON.parse(taxonomyText); const registry = JSON.parse(registryText);
  for (const name of names.filter(name => name.endsWith('.schema.json')).sort()) {
    const schema = JSON.parse(await readFile(path.join(bundleSchemaRoot, name), 'utf8'));
    ajv.addSchema(schema);
  }
  const catalogItemValidator = ajv.getSchema(CATALOG_ITEM_ID); const requestDocumentValidator = ajv.getSchema(REQUEST_DOCUMENT_ID);
  const catalogItemBaseValidator = ajv.getSchema(CATALOG_ITEM_BASE_ID); const requestLineBaseValidator = ajv.getSchema(REQUEST_LINE_BASE_ID);
  const catalogBundleValidator = ajv.getSchema(CATALOG_ID); const requestBundleValidator = ajv.getSchema(REQUEST_ID);
  if (!catalogItemValidator) throw new Error(`Production schema was not compiled: ${CATALOG_ITEM_ID}`);
  if (!requestDocumentValidator) throw new Error(`Production schema was not compiled: ${REQUEST_DOCUMENT_ID}`);
  if (!catalogItemBaseValidator) throw new Error(`Production schema was not compiled: ${CATALOG_ITEM_BASE_ID}`);
  if (!requestLineBaseValidator) throw new Error(`Production schema was not compiled: ${REQUEST_LINE_BASE_ID}`);
  if (!catalogBundleValidator) throw new Error(`Bundle schema was not compiled: ${CATALOG_ID}`);
  if (!requestBundleValidator) throw new Error(`Bundle schema was not compiled: ${REQUEST_ID}`);
  return { taxonomy, registry, ajv, classSchemas, catalogItemValidator, requestDocumentValidator, catalogItemBaseValidator, requestLineBaseValidator, catalogBundleValidator, requestBundleValidator };
}
