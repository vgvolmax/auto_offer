# Autonomous Catalog Validation Kit

## Goal

Create two generated repository artifacts:

- `annotation-kits/catalog-validation-kit.mjs` — one self-contained Node.js module that validates catalog annotation bundles with the same structural and semantic contract as the application.
- `tools/catalog-validation-kit-builder.html` — one offline HTML application that accepts the current catalog annotation inputs and produces a fresh `catalog-validation-kit.mjs` without a server, npm, internet access, or ChatGPT-assisted rebuilding.

The intended annotation workflow is:

1. Attach `CATALOG_ANNOTATION_PROMPT.md`.
2. Attach `catalog-validation-kit.mjs`.
3. Attach one or more price workbooks.
4. Require every produced catalog bundle to pass the kit before it is considered complete.

The prompt remains a separate human-readable instruction and is not embedded in the validation kit.

## Scope

The first version is catalog-only. It validates `catalog_bundle` files and does not expose request-bundle validation in its public API or CLI.

The kit must cover:

- bundle JSON Schema validation;
- catalog-item base and class-specific schema validation;
- taxonomy version agreement;
- declared item count agreement;
- duplicate `source_item_id` detection;
- class registry rules;
- canonical value validation;
- allowed annotation paths;
- critical-field explanation rules;
- evidence requirements;
- `unknown_fields` consistency;
- ambiguity consistency;
- GTIN validation required by the current annotation contract;
- the remaining catalog semantic checks already implemented by the repository validator.

The implementation must not weaken, fork, or reinterpret the existing application validator.

## Source inputs

The offline builder accepts files by drag-and-drop or file selection and identifies them by content, filename, exports, and import relationships rather than by upload order.

The current required inputs are:

- `catalog-annotation-kit.json`;
- `class-schema-registry.json`;
- `bundle-validator.mjs`;
- `annotation-contract-validator.mjs`;
- `catalog-identifiers.mjs`;
- `request-port-contracts.mjs`.

`request-port-contracts.mjs` is included because the shared semantic validator imports it statically, even though the generated public kit is catalog-only.

The builder may accept additional local helper modules in later versions. It must reject unresolved imports and any unexpected external import instead of silently producing a partial kit.

## Architecture

### 1. Shared generation core

A browser-safe generation core will own:

- input classification;
- dependency graph construction;
- version and class-set checks;
- module-source normalization;
- generated-kit assembly;
- manifest creation;
- deterministic output formatting;
- browser smoke tests.

The Node generator and the HTML builder will call the same core logic. There must not be two independently maintained assembly implementations.

### 2. Embedded structural-validation runtime

The output module cannot depend on `node_modules`, so the repository build step will bundle the required AJV 2020 and format-validation runtime into an internal JavaScript payload.

The HTML builder will contain this payload and inject it into each generated kit. At execution time, the generated kit compiles the embedded schemas from `catalog-annotation-kit.json` entirely in memory.

This design allows taxonomy and schema changes to be processed by the offline builder without rebuilding the builder itself. The builder only needs regeneration when the validation engine or source-module contract changes.

### 3. Embedded semantic modules

The uploaded repository modules will be stored inside the generated kit and linked through generated in-memory module URLs. Local imports are resolved according to a dependency graph built by the builder.

Only the approved local module graph is allowed. The builder fails when:

- an import cannot be resolved;
- an external package import is present in an uploaded semantic module;
- a required export is absent;
- duplicate candidates claim the same role;
- the dependency graph contains a cycle that cannot be linked safely.

The generated kit will expose a stable wrapper API, so consumers do not depend on internal uploaded module paths.

### 4. Generated kit API

`catalog-validation-kit.mjs` exports:

```js
export const kitMetadata;
export async function createCatalogValidator();
export async function validateCatalogBundle(bundle);
export async function validateCatalogFile(filePath);
```

`validateCatalogBundle` returns the repository validator result shape:

```json
{
  "valid": false,
  "kind": "catalog_bundle",
  "errors": [
    {
      "code": "AMBIGUITY_POINTS_TO_CONFIRMED_VALUE",
      "path": "/items/12/catalog_item/class_id",
      "message": "Ambiguity points to a confirmed value"
    }
  ],
  "summary": {
    "records": 1,
    "taxonomy_version": "1.0.0"
  }
}
```

The CLI supports:

```text
node catalog-validation-kit.mjs <catalog.json> [more-catalogs.json]
```

Behavior:

- prints one JSON result per file;
- exits `0` only when every file is valid;
- exits `1` when any catalog is invalid;
- exits `2` for invocation, unreadable-file, or malformed-JSON failures;
- never modifies the input catalog.

Node-only modules such as `node:fs/promises` are imported lazily, so the same generated module can be loaded in the browser for smoke testing.

## Builder user interface

`tools/catalog-validation-kit-builder.html` is a single offline file with:

- a drop zone and file picker;
- a table of detected roles, filenames, versions, hashes, and status;
- explicit missing, duplicate, incompatible, and unresolved-import messages;
- a `Собрать validation kit` action enabled only after preflight succeeds;
- a build summary containing taxonomy version, class count, schema count, module count, byte size, and SHA-256;
- a `Скачать catalog-validation-kit.mjs` action;
- a diagnostics download when build or smoke tests fail.

No uploaded content leaves the browser. The page contains no network calls, analytics, CDN links, or remote fonts.

## Preflight validation

Before generating output, the builder checks:

- all JSON inputs parse;
- annotation kit kind is `catalog_annotation_kit`;
- root schema and all referenced schemas exist in the kit;
- registry class set matches taxonomy class set;
- registry schema paths resolve to schemas in the kit;
- taxonomy, annotation schema, and bundle schema versions are internally consistent;
- expected module exports exist;
- every relative module import resolves exactly once;
- no disallowed external import remains;
- semantic source files contain no filename collision;
- generated metadata is deterministic for identical inputs.

A warning is shown, but generation remains possible, when filenames differ from the conventional repository filenames and content classification is otherwise unambiguous.

## Self-tests and parity

The generated kit must pass these checks before download:

1. Browser import smoke test of the generated module.
2. A known-valid catalog fixture returns `valid: true`.
3. A fixture with `unknown_fields` pointing to a populated value reports `UNKNOWN_POINTS_TO_VALUE`.
4. A fixture with a confirmed value and unresolved ambiguity reports `AMBIGUITY_POINTS_TO_CONFIRMED_VALUE`.
5. A fixture missing an unexplained critical field reports `MISSING_CRITICAL_FIELD`.
6. A structurally invalid fixture reports `BUNDLE_SCHEMA_INVALID`.

Repository tests must also compare the generated kit against the canonical repository `validateCatalogBundle` implementation on the existing catalog fixtures. Results must match after deterministic sorting, including error codes and paths.

## Determinism and provenance

The generated kit includes metadata containing:

- validation-kit format version;
- taxonomy version;
- annotation schema version;
- bundle schema version;
- class count;
- schema count;
- source filenames;
- SHA-256 for each source input;
- build timestamp only in a non-hashed informational field, or omitted from canonical bytes;
- generator version.

Identical input bytes and generator version must produce identical canonical kit bytes and SHA-256. The HTML displays the output hash after generation.

## Repository integration

Add npm scripts for:

```text
npm run generate:catalog-validation-kit
npm run generate:catalog-validation-kit-builder
npm run check:catalog-validation-kit
npm run test:catalog-validation-kit
```

The normal test pipeline will check that committed generated artifacts match current sources. Changes to taxonomy, schemas, registry, or validator modules must fail CI until the validation kit is regenerated.

The current generated artifacts are committed so they can be taken directly from the repository without running the build tool.

## Error handling

The builder and generated kit use stable machine-readable codes and human-readable Russian UI messages.

The builder never produces a downloadable kit after a failed preflight or smoke test. It preserves all diagnostics in memory and allows downloading a JSON diagnostics report.

The generated CLI reports every validator error rather than stopping at the first one. Malformed input JSON is reported separately from catalog-contract violations.

## Security constraints

- The HTML never executes uploaded source modules directly in the page's main context.
- Uploaded modules are treated as build inputs and are accepted only when their imports and exports match the allowed local contract.
- The generated smoke-test module executes in an isolated worker or equivalent isolated browser context.
- No `eval` of arbitrary uploaded text is used in the page UI context.
- Generated output contains no network-dependent import.
- Input and output size limits prevent accidental browser exhaustion; the initial defaults are 50 MiB per file and 150 MiB total, with clear errors when exceeded.

## Non-goals

The first version does not:

- edit or repair catalog annotations;
- expand taxonomy classes;
- generate the annotation prompt;
- process Excel files;
- validate request bundles;
- provide a hosted web service;
- automatically read files from GitHub;
- allow arbitrary third-party JavaScript packages in uploaded modules.

## Acceptance criteria

The work is complete when:

1. The committed `catalog-validation-kit.mjs` runs on Node 20+ with no installed dependencies.
2. It produces the same catalog validation results as the application validator for repository fixtures and targeted semantic-error fixtures.
3. The committed HTML opens locally with networking disabled and generates a working kit from the required current inputs.
4. The HTML-generated kit is byte-identical to the Node-generated kit for the same inputs.
5. Missing or incompatible inputs are explained before generation.
6. The generated kit exposes complete error codes, paths, and messages.
7. CI detects stale generated artifacts.
8. The user can perform future rebuilds by opening the HTML, dropping current repository inputs, and downloading the resulting single MJS file.