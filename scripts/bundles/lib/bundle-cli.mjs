import { readFile } from 'node:fs/promises';
import { loadBundleValidationContext } from './bundle-schema-loader.mjs';
import { validateCatalogBundle, validateRequestBundle } from './bundle-validator.mjs';

const outputError = (stderr, kind, code, message) => stderr.write(`${JSON.stringify({ valid: false, kind, errors: [{ code, path: '/', message }] }, null, 2)}\n`);
export async function runBundleValidationCli({ kind, argv, stdout, stderr }) {
  if (argv.length !== 1) { outputError(stderr, kind, 'BUNDLE_USAGE_ERROR', 'Exactly one JSON file path is required'); return 2; }
  let text; try { text = await readFile(argv[0], 'utf8'); } catch { outputError(stderr, kind, 'BUNDLE_FILE_READ_FAILED', `Unable to read ${argv[0]}`); return 2; }
  let bundle; try { bundle = JSON.parse(text); } catch { outputError(stderr, kind, 'BUNDLE_JSON_PARSE_FAILED', 'File is not valid JSON'); return 2; }
  const context = await loadBundleValidationContext();
  const result = kind === 'catalog_bundle' ? validateCatalogBundle(bundle, context) : validateRequestBundle(bundle, context);
  if (!result.valid) { stderr.write(`${JSON.stringify(result, null, 2)}\n`); return 1; }
  stdout.write(`VALID ${kind} records=${result.summary.records} taxonomy=${result.summary.taxonomy_version}\n`); return 0;
}
