import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { buildCatalogValidationKit } from './lib/generation-core.mjs';
import {
  buildCatalogAjvRuntimeSource,
  loadRepositoryValidationInputs,
} from './repository-inputs.mjs';
import { buildCatalogValidationKitBuilderHtml } from './generate-catalog-validation-kit-builder.mjs';

export async function checkCatalogValidationKit({ root = '.' } = {}) {
  const absoluteRoot = path.resolve(root);
  const [files, ajvRuntimeSource] = await Promise.all([
    loadRepositoryValidationInputs(absoluteRoot),
    buildCatalogAjvRuntimeSource(),
  ]);
  const [expectedKit, expectedHtml, actualKit, actualHtml] = await Promise.all([
    buildCatalogValidationKit(files, { ajvRuntimeSource }),
    buildCatalogValidationKitBuilderHtml({ root: absoluteRoot }),
    readFile(path.join(absoluteRoot, 'annotation-kits/catalog-validation-kit.mjs'), 'utf8'),
    readFile(path.join(absoluteRoot, 'tools/catalog-validation-kit-builder.html'), 'utf8'),
  ]);
  const stale = [];
  if (actualKit !== expectedKit.source) stale.push('annotation-kits/catalog-validation-kit.mjs');
  if (actualHtml !== expectedHtml) stale.push('tools/catalog-validation-kit-builder.html');
  if (stale.length) throw new Error(`Catalog validation kit artifacts are stale: ${stale.join(', ')}`);
  return {
    valid: true,
    kit_bytes: expectedKit.bytes,
    kit_sha256: expectedKit.sha256,
    builder_bytes: new TextEncoder().encode(expectedHtml).length,
  };
}

const invoked = process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (invoked) {
  try {
    const result = await checkCatalogValidationKit();
    console.log(`Catalog validation kit artifacts are current (${result.kit_sha256}).`);
  } catch (cause) {
    console.error(cause instanceof Error ? cause.message : String(cause));
    process.exitCode = 1;
  }
}
