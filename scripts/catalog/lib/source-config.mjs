import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

export async function loadJson(filePath) {
  return JSON.parse(await readFile(filePath, 'utf8'));
}

export async function sha256File(filePath) {
  return createHash('sha256').update(await readFile(filePath)).digest('hex');
}

export async function loadCatalogSources({configPath = 'config/catalog-sources.json', sourceRoot} = {}) {
  const config = await loadJson(configPath);
  const resolvedRoot = sourceRoot ?? process.env.CATALOG_SOURCE_DIR ?? config.source_root ?? 'data/source';
  return {
    ...config,
    source_root: resolvedRoot,
    sources: config.sources.map(source => ({...source, file_path: path.join(resolvedRoot, source.filename)}))
  };
}
