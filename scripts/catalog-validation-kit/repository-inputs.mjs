import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { build as viteBuild } from 'vite';

const INPUTS = [
  ['catalog-annotation-kit.json', 'annotation-kits/catalog-annotation-kit.json'],
  ['class-schema-registry.json', 'schemas/annotation/class-schema-registry.json'],
  ['bundle-validator.mjs', 'scripts/bundles/lib/bundle-validator.mjs'],
  ['annotation-contract-validator.mjs', 'scripts/lib/annotation-contract-validator.mjs'],
  ['catalog-identifiers.mjs', 'scripts/lib/catalog-identifiers.mjs'],
  ['request-port-contracts.mjs', 'scripts/annotation/lib/request-port-contracts.mjs'],
];

export async function loadRepositoryValidationInputs(root = '.') {
  return Promise.all(INPUTS.map(async ([name, relativePath]) => ({
    name,
    text: await readFile(path.join(root, relativePath), 'utf8'),
  })));
}

const AJV_RUNTIME_ID = '\0catalog-validation-kit-ajv-runtime';
const AJV_RUNTIME_SOURCE = `
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';

export function createCatalogAjv() {
  const ajv = new Ajv2020({ allErrors: true, strict: false });
  addFormats(ajv);
  return ajv;
}
`;

function outputs(result) {
  const builds = Array.isArray(result) ? result : [result];
  return builds.flatMap(build => build.output ?? []);
}

export async function buildCatalogAjvRuntimeSource() {
  const result = await viteBuild({
    configFile: false,
    logLevel: 'silent',
    plugins: [{
      name: 'catalog-validation-kit-ajv-runtime',
      resolveId(id) {
        return id === 'virtual:catalog-validation-kit-ajv-runtime' ? AJV_RUNTIME_ID : null;
      },
      load(id) {
        return id === AJV_RUNTIME_ID ? AJV_RUNTIME_SOURCE : null;
      },
    }],
    build: {
      write: false,
      target: 'es2020',
      minify: true,
      sourcemap: false,
      rollupOptions: {
        input: 'virtual:catalog-validation-kit-ajv-runtime',
        preserveEntrySignatures: 'strict',
        output: {
          format: 'es',
          inlineDynamicImports: true,
          entryFileNames: 'catalog-ajv-runtime.mjs',
        },
      },
    },
  });
  const chunks = outputs(result).filter(output => output.type === 'chunk');
  if (chunks.length !== 1) throw new Error(`Expected one Ajv runtime chunk, received ${chunks.length}`);
  const source = `${chunks[0].code.trim()}\n`;
  if (/\bfrom\s+['"]|\bimport\s*\(/.test(source)) throw new Error('Ajv runtime bundle is not autonomous');
  return source;
}
