import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';

async function files(directory) {
  return (await Promise.all((await readdir(directory, { withFileTypes: true })).map(entry => entry.isDirectory() ? files(path.join(directory, entry.name)) : path.join(directory, entry.name)))).flat();
}

export async function loadAnnotationSchemas(root = 'schemas/annotation') {
  const filenames = (await files(root)).filter(filename => filename.endsWith('.schema.json'));
  const documents = await Promise.all(filenames.map(async filename => ({ filename, schema: JSON.parse(await readFile(filename, 'utf8')) })));
  const ajv = new Ajv2020({ allErrors: true, strict: false }); addFormats(ajv);
  for (const { schema } of documents) ajv.addSchema(schema);
  const productionIds = [
    'https://example.local/schemas/annotation/document-segmentation.schema.json',
    'https://example.local/schemas/annotation/request-document.base.schema.json',
    'https://example.local/schemas/annotation/generated/request-line.dispatch.schema.json',
    'https://example.local/schemas/annotation/generated/catalog-item.dispatch.schema.json'
  ];
  for (const schemaId of productionIds) if (!ajv.getSchema(schemaId)) throw new Error(`Production schema was not compiled: ${schemaId}`);
  const classSchemas = {};
  for (const { filename, schema } of documents.filter(x => x.filename.includes(`${path.sep}class-specific${path.sep}`))) {
    const relative = path.relative(root, filename).split(path.sep).join('/');
    const validator = ajv.getSchema(schema.$id);
    const classId = schema.allOf?.map(x => x.properties?.class_id?.const).find(Boolean);
    classSchemas[relative] = { validator, classId, schema };
  }
  return { ajv, documents, productionIds, classSchemas };
}
