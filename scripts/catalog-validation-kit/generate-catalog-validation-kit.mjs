import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { buildCatalogValidationKit } from './lib/generation-core.mjs';
import {
  buildCatalogAjvRuntimeSource,
  loadRepositoryValidationInputs,
} from './repository-inputs.mjs';

export async function generateCatalogValidationKit({ root = '.', output } = {}) {
  const absoluteRoot = path.resolve(root);
  const target = output ? path.resolve(output) : path.join(absoluteRoot, 'annotation-kits/catalog-validation-kit.mjs');
  const [files, ajvRuntimeSource] = await Promise.all([
    loadRepositoryValidationInputs(absoluteRoot),
    buildCatalogAjvRuntimeSource(),
  ]);
  const result = await buildCatalogValidationKit(files, { ajvRuntimeSource });
  await writeFile(target, result.source, 'utf8');
  return { ...result, path: target };
}

const invoked = process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (invoked) {
  const result = await generateCatalogValidationKit();
  console.log(`Generated ${result.path} (${result.bytes} bytes, sha256 ${result.sha256}).`);
}
