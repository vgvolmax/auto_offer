# Catalog Validation Kit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build one dependency-free `catalog-validation-kit.mjs` and one offline HTML builder that recreate the application’s complete catalog bundle validation contract from the current annotation kit, registry, and semantic modules.

**Architecture:** A browser-safe generation core classifies the uploaded inputs, verifies the local module graph, compiles all catalog schemas with Ajv 2020 into standalone ESM validators, rewrites the few generated Ajv runtime imports to embedded `data:` modules, and links the canonical repository semantic modules through deterministic `data:` URLs. The Node generator and the offline HTML application call the same core; committed artifacts are checked for staleness in CI.

**Tech Stack:** Node.js 20+, native ESM, Ajv 8 standalone code generation, Vite 7 programmatic bundling for the single-file HTML, Node test runner, existing repository validators and fixtures.

## Global Constraints

- Catalog-only public API and CLI in version 1.
- Generated `catalog-validation-kit.mjs` must run on Node 20+ without `node_modules`.
- The semantic rules remain sourced from `bundle-validator.mjs` and `annotation-contract-validator.mjs`; no duplicated semantic implementation.
- The builder is one offline HTML file with no network calls, CDN assets, analytics, or remote fonts.
- Input limits are 50 MiB per file and 150 MiB total.
- Identical inputs and generator version produce byte-identical MJS output.
- The prompt remains separate and is not embedded.
- Every production behavior is introduced by a failing test first.

---

### Task 1: Input classification and preflight contract

**Files:**
- Create: `scripts/catalog-validation-kit/lib/input-contract.mjs`
- Test: `tests/catalog-validation-kit-inputs.test.mjs`

**Interfaces:**
- Produces: `classifyCatalogValidationInputs(files)` and `preflightCatalogValidationInputs(classified)`.
- `files` is an array of `{ name: string, text: string }`.
- Successful preflight returns `{ ok: true, kit, registry, modules, warnings, summary }`; failure returns `{ ok: false, errors, warnings }` with stable codes.

- [ ] **Step 1: Write failing tests** for content-based role detection, upload-order independence, missing role, duplicate role, JSON parse failure, class-set mismatch, unresolved relative import, external import rejection, and nonstandard filename warning.
- [ ] **Step 2: Run** `node --test tests/catalog-validation-kit-inputs.test.mjs` and confirm failures are caused by missing module exports.
- [ ] **Step 3: Implement minimal classification** using required exported symbols: `validateCatalogBundle`, `validateAnnotation`, `classifyGtin`, and `buildRequestPortContracts`.
- [ ] **Step 4: Implement preflight** for kit kind/root/schema closure, registry/class consistency, catalog schema availability, import graph, expected exports, and deterministic role ordering.
- [ ] **Step 5: Run the test file** and commit the green result.

### Task 2: Deterministic autonomous MJS generation

**Files:**
- Create: `scripts/catalog-validation-kit/lib/generation-core.mjs`
- Create: `scripts/catalog-validation-kit/lib/runtime-modules.mjs`
- Create: `scripts/catalog-validation-kit/repository-inputs.mjs`
- Create: `scripts/catalog-validation-kit/generate-catalog-validation-kit.mjs`
- Test: `tests/catalog-validation-kit-generation.test.mjs`

**Interfaces:**
- Consumes: successful preflight from Task 1.
- Produces: `buildCatalogValidationKit(files, options)` returning `{ source, bytes, sha256, metadata, diagnostics }`.
- Produces repository adapter `loadRepositoryValidationInputs(root)` and `buildAjvRuntimeModuleMap()`.

- [ ] **Step 1: Write failing tests** proving two generations are byte-identical, metadata contains exact source hashes and versions, generated source has no bare package import, and the output exports `kitMetadata`, `createCatalogValidator`, `validateCatalogBundle`, and `validateCatalogFile`.
- [ ] **Step 2: Run** `node --test tests/catalog-validation-kit-generation.test.mjs` and confirm missing generation functions fail.
- [ ] **Step 3: Compile schemas** with `Ajv2020({ allErrors: true, strict: false, code: { source: true, esm: true } })`, `ajv-formats`, and `standaloneCode`; export the bundle validator, catalog-item base validator, and every class-specific validator under stable generated identifiers.
- [ ] **Step 4: Embed generated runtime dependencies** by resolving and bundling any Ajv/Ajv-formats runtime imports into deterministic `data:text/javascript;base64,...` URLs; reject any unexpected runtime package.
- [ ] **Step 5: Link semantic modules** by parsing static imports, resolving imported symbols to classified local modules, recursively rewriting relative imports to deterministic data URLs, and rejecting cycles or unresolved imports.
- [ ] **Step 6: Assemble the wrapper API and CLI**. CLI prints one JSON result per input file, exits 0 only when all are valid, 1 for contract-invalid files, and 2 for usage/read/JSON failures.
- [ ] **Step 7: Run generation tests** and commit the green result.

### Task 3: Parity with the canonical application validator

**Files:**
- Create: `tests/catalog-validation-kit-parity.test.mjs`
- Create: `tests/catalog-validation-kit-cli.test.mjs`
- Modify: `scripts/catalog-validation-kit/generate-catalog-validation-kit.mjs`
- Generate: `annotation-kits/catalog-validation-kit.mjs`

**Interfaces:**
- Consumes: generated source from Task 2.
- Produces: committed autonomous kit and parity guarantees.

- [ ] **Step 1: Write failing parity tests** comparing normalized canonical and generated results for the valid fixture and mutations producing `BUNDLE_SCHEMA_INVALID`, `UNKNOWN_POINTS_TO_VALUE`, `AMBIGUITY_POINTS_TO_CONFIRMED_VALUE`, `MISSING_CRITICAL_FIELD`, `MISSING_EVIDENCE`, taxonomy mismatch, item-count mismatch, and duplicate source IDs.
- [ ] **Step 2: Write failing CLI tests** for multiple valid files, mixed valid/invalid files, malformed JSON, unreadable file, missing arguments, and input immutability.
- [ ] **Step 3: Run** `node --test tests/catalog-validation-kit-parity.test.mjs tests/catalog-validation-kit-cli.test.mjs` and confirm failures.
- [ ] **Step 4: Fix only generation/wrapper defects** until generated and canonical results match by `valid`, `kind`, sorted `code`, `path`, and `message`.
- [ ] **Step 5: Generate and commit** `annotation-kits/catalog-validation-kit.mjs`.
- [ ] **Step 6: Re-run parity and CLI tests** and commit the green result.

### Task 4: Single-file offline HTML builder

**Files:**
- Create: `tools/catalog-validation-kit-builder.entry.mjs`
- Create: `scripts/catalog-validation-kit/generate-catalog-validation-kit-builder.mjs`
- Generate: `tools/catalog-validation-kit-builder.html`
- Test: `tests/catalog-validation-kit-builder.test.mjs`

**Interfaces:**
- Consumes: `buildCatalogValidationKit` from Task 2 and embedded Ajv runtime modules.
- Produces: offline HTML accepting drag/drop or file selection and downloading the generated MJS or diagnostics JSON.

- [ ] **Step 1: Write failing tests** requiring a single HTML file, no remote URLs/network APIs, Russian labels, size limits, role/status table, disabled build before preflight, diagnostics download, source hash summary, and inclusion of the shared generator bundle.
- [ ] **Step 2: Run** `node --test tests/catalog-validation-kit-builder.test.mjs` and confirm missing artifact failures.
- [ ] **Step 3: Implement the browser entry** with file picker/drop zone, size enforcement, content-only processing, preflight rendering, build action, Blob download, and diagnostics handling.
- [ ] **Step 4: Generate the HTML** using Vite programmatic build with `write:false`, one IIFE chunk, inline CSS/template, embedded runtime module map, and no emitted assets.
- [ ] **Step 5: Add smoke-test worker** that imports the generated MJS and runs the valid fixture plus targeted semantic and structural mutations before enabling download.
- [ ] **Step 6: Verify Node-generated and browser-core-generated MJS bytes are identical** for the same inputs.
- [ ] **Step 7: Run builder tests** and commit the green result.

### Task 5: Repository integration, workflow, and documentation

**Files:**
- Create: `scripts/catalog-validation-kit/check-catalog-validation-kit.mjs`
- Modify: `package.json`
- Modify: `.github/workflows/annotation-contract.yml`
- Modify: `annotation-kits/catalog/CATALOG_ANNOTATION_PROMPT.md`
- Modify: `docs/CHAT_ANNOTATION_WORKFLOW.md`
- Test: `tests/chat-annotation-prompts.test.mjs`

**Interfaces:**
- Produces npm scripts:
  - `generate:catalog-validation-kit`
  - `generate:catalog-validation-kit-builder`
  - `check:catalog-validation-kit`
  - `test:catalog-validation-kit`

- [ ] **Step 1: Write failing prompt/workflow tests** requiring the new three-attachment catalog flow and explicit full-kit validation before completion.
- [ ] **Step 2: Add npm scripts and stale checker** that regenerates both artifacts and fails on a Git diff.
- [ ] **Step 3: Add validation-kit checks to the normal test pipeline and annotation workflow**.
- [ ] **Step 4: Update the catalog prompt** so the chat must use `catalog-validation-kit.mjs`, call its full validator, and refuse to mark output complete unless `valid: true`.
- [ ] **Step 5: Update operator documentation** to use prompt + autonomous validation kit + price files.
- [ ] **Step 6: Run focused tests**, then `npm test`, `npm run test:catalog-validation-kit`, `npm run check:catalog-validation-kit`, `npm run typecheck:app`, and `npm run app:build`.
- [ ] **Step 7: Commit the verified integration.

## Plan self-review

- Spec coverage: input classification, complete schema and semantic validation, autonomous Node API/CLI, offline HTML, smoke tests, determinism, provenance, security limits, parity, stale artifact detection, and user workflow are each assigned to a task.
- Placeholder scan: no implementation placeholder remains; each task names exact files, interfaces, commands, and expected behavior.
- Type consistency: all later tasks consume the same `files -> preflight -> buildCatalogValidationKit` contract defined in Tasks 1 and 2.
- Scope: request-bundle validation, taxonomy expansion, Excel parsing, and annotation repair remain explicitly outside this plan.
