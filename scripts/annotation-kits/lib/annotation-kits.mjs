import { createHash } from 'node:crypto';
import { readFile, readdir, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
export const roots = {
  catalog: 'https://example.local/schemas/bundles/catalog-bundle.schema.json',
  request: 'https://example.local/schemas/bundles/request-bundle.schema.json',
};

export function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])]));
  }
  return value;
}

export function jsonBytes(value) {
  return Buffer.from(`${JSON.stringify(stable(value), null, 2)}\n`);
}

async function json(file) {
  return JSON.parse(await readFile(file, 'utf8'));
}

async function jsonFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map((entry) => {
    const target = path.join(directory, entry.name);
    return entry.isDirectory() ? jsonFiles(target) : (entry.name.endsWith('.json') ? [target] : []);
  }));
  return nested.flat();
}

export function externalRefs(schema, baseId = schema.$id) {
  const refs = new Set();
  function visit(value) {
    if (!value || typeof value !== 'object') return;
    if (typeof value.$ref === 'string' && !value.$ref.startsWith('#')) {
      refs.add(new URL(value.$ref, baseId).href.split('#')[0]);
    }
    for (const child of Object.values(value)) visit(child);
  }
  visit(schema);
  return [...refs].sort();
}

export async function buildKits(root = repositoryRoot) {
  const taxonomy = await json(path.join(root, 'taxonomy/taxonomy.json'));
  const registry = await json(path.join(root, 'schemas/annotation/class-schema-registry.json'));
  const schemaFiles = [
    ...await jsonFiles(path.join(root, 'schemas/annotation')),
    ...await jsonFiles(path.join(root, 'schemas/bundles')),
  ];
  const schemas = new Map();
  for (const file of schemaFiles.sort()) {
    const schema = await json(file);
    if (schema.$id) schemas.set(schema.$id, schema);
  }

  const kits = {};
  for (const kind of ['catalog', 'request']) {
    const classSchemaIds = {};
    for (const classId of Object.keys(taxonomy.classes).sort()) {
      const relative = registry.classes[classId]?.[`${kind}_schema`];
      if (!relative) throw new Error(`Missing ${kind} schema registry entry for ${classId}`);
      const schema = await json(path.join(root, 'schemas/annotation', relative));
      classSchemaIds[classId] = schema.$id;
    }

    const pending = [roots[kind], ...Object.values(classSchemaIds)];
    const closure = new Set();
    while (pending.length) {
      const id = pending.pop();
      if (closure.has(id)) continue;
      const schema = schemas.get(id);
      if (!schema) throw new Error(`Unresolved external schema reference: ${id}`);
      closure.add(id);
      pending.push(...externalRefs(schema));
    }
    const schemasById = Object.fromEntries([...closure].sort().map((id) => [id, schemas.get(id)]));
    for (const [id, schema] of Object.entries(schemasById)) {
      for (const ref of externalRefs(schema)) {
        if (!schemasById[ref]) throw new Error(`Reference ${ref} from ${id} is outside the ${kind} kit`);
      }
    }
    kits[kind] = {
      kit_schema_version: '1.0.0',
      kit_version: '1.0.0',
      kind: `${kind}_annotation_kit`,
      taxonomy_version: taxonomy.taxonomy_version,
      annotation_schema_version: registry.schema_version,
      bundle_schema_version: schemas.get(roots[kind]).properties.schema_version.const,
      root_schema_id: roots[kind],
      class_count: Object.keys(taxonomy.classes).length,
      taxonomy,
      class_schema_ids: classSchemaIds,
      schemas_by_id: schemasById,
    };
  }
  return kits;
}

export async function generateKits(root = repositoryRoot) {
  const kits = await buildKits(root);
  const outputDirectory = path.join(root, 'annotation-kits');
  await mkdir(outputDirectory, { recursive: true });
  const manifestKits = {};
  for (const kind of ['catalog', 'request']) {
    const bytes = jsonBytes(kits[kind]);
    const relativePath = `annotation-kits/${kind}-annotation-kit.json`;
    await writeFile(path.join(root, relativePath), bytes);
    manifestKits[kind] = {
      path: relativePath,
      sha256: createHash('sha256').update(bytes).digest('hex'),
      bytes: bytes.length,
      class_count: kits[kind].class_count,
      schema_count: Object.keys(kits[kind].schemas_by_id).length,
    };
  }
  const manifest = {
    manifest_schema_version: '1.0.0',
    kit_version: '1.0.0',
    taxonomy_version: kits.catalog.taxonomy_version,
    kits: manifestKits,
  };
  await writeFile(path.join(outputDirectory, 'annotation-kits-manifest.json'), jsonBytes(manifest));
  return { kits, manifest };
}
