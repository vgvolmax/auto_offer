# PR6: AI-only user matching flow — design

## Product decision

The production session has one matching path after request preparation: configure offer rules, prepare the canonical semantic package, use a new external AI chat, import `semantic-match-result.json`, and review the locally validated result. Auto Offer does not perform the semantic decision and does not call a model API.

STEP1 (source and routing) and STEP2 (request annotation) remain unchanged. Their workspaces, prompts, schemas, bundles, taxonomy, and catalog annotation contracts are outside this change.

## UI orchestration

`SessionPage` presents sources, **Правила предложения**, **Шаг 3 — Подбор наших товаров**, and then the existing result/review. The policy form edits and saves the same domain values, but no longer exposes a Pilot run callback or action. Preparing STEP3 receives the current in-memory settings, so the existing semantic package operation validates and saves dirty settings before generating the same three canonical downloads.

The STEP3 card explains three actions: prepare files, attach all three to a new external AI chat, and upload the returned result. Confirmed sessions lock both policy editing and STEP3. Existing stale-result guidance directs users to prepare a new AI package.

## Compatibility boundary

The Pilot runtime, `runPilotMatcher()`, `runSessionMatching()`, Pilot schemas, policy registry, MatchRun storage, and golden tests remain code-only fallback and regression mechanisms. Previously stored Pilot runs continue through the existing review projection. Pilot diagnostics appear only for a Pilot run, inside service information; semantic runs do not receive synthetic Pilot diagnostics.

All PR4/PR5 semantic schemas, prompts, package generation/import functions, validation, fingerprint, and provenance behavior remain unchanged. No persistence store or database version changes are introduced.

## Explicit non-goals

- PR7's request-to-product result table redesign is out of scope.
- PR8's automatic selection and automatic no-offer decisions are out of scope.
- No model provider, API key, SDK, backend, endpoint call, or automatic chat execution is added.
- No local similarity, fuzzy, embedding, vector, scoring, keyword, or other replacement matching algorithm is added.
- STEP1 and STEP2 are not combined with STEP3.

## Verification strategy

Component regressions cover policy editing without Pilot actions, STEP3 copy and canonical downloads, dirty-settings preparation, semantic import, source-aware diagnostics, stale guidance, and old Pilot result rendering. Existing confirmation, reopen, selection, no-offer, request preparation, semantic-contract, and Pilot suites provide compatibility coverage. A production build and browser UAT verify the final visual path.
