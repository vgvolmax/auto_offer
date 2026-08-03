# Source Repository Windows Startup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make a normal extracted GitHub repository start by double-clicking `start.bat` without a prebuilt release artifact.

**Architecture:** Restore the source-bootstrap launcher boundary: PowerShell owns the first portable-Python bootstrap and an OS-backed lock; the Python launcher owns portable Node, dependency/build fingerprints, atomic build replacement, server health and browser launch. Keep the fixed origin and application code unchanged.

**Tech Stack:** Windows batch, Windows PowerShell 5.1, Python standard library, portable Node.js/npm, Vite/TypeScript, GitHub Actions.

## Global Constraints

- No system Python, Node.js or npm dependency for the user flow.
- No administrator rights.
- Bind only to `127.0.0.1:8765`.
- Do not modify matcher, taxonomy, bundle contracts, IndexedDB or React behavior.
- Do not require `release-manifest.json` or a CI release artifact.
- Do not commit `.runtime`, `node_modules` or `dist`.

---

### Task 1: Restore the source-bootstrap contract

**Files:**
- Modify: `scripts/launcher/runtime-manifest.json`
- Modify: `scripts/launcher/auto_offer_launcher/config.py`
- Modify: `scripts/launcher/bootstrap.ps1`
- Modify: `scripts/launcher/launcher.py`
- Test: `scripts/launcher/tests/test_config.py`
- Test: `scripts/launcher/tests/test_batch_entries.py`

**Interfaces:**
- Consumes: repository root containing `app/`, `package.json`, and `package-lock.json`.
- Produces: validated runtime configuration and `start.bat --no-browser` entry point independent of `release-manifest.json`.

- [ ] Add a failing launcher test proving startup configuration includes pinned Python and Node plus source/build paths and never loads `release-manifest.json`.
- [ ] Run the focused test and verify the expected failure.
- [ ] Restore strict source-bootstrap manifest loading and BAT/PowerShell argument forwarding.
- [ ] Run the focused tests and verify they pass.

### Task 2: Restore portable Node and deterministic local build

**Files:**
- Create: `scripts/launcher/auto_offer_launcher/download.py`
- Create: `scripts/launcher/auto_offer_launcher/build.py`
- Create: `scripts/launcher/auto_offer_launcher/environment.py`
- Create: `scripts/launcher/auto_offer_launcher/progress.py`
- Modify: `scripts/launcher/launcher.py`
- Test: `scripts/launcher/tests/test_download.py`
- Test: `scripts/launcher/tests/test_build.py`
- Test: `scripts/launcher/tests/test_progress.py`

**Interfaces:**
- Consumes: pinned runtime manifest, portable `npm.cmd`, source files and prior confirmed state.
- Produces: verified runtimes, dependency state and validated `dist/app`.

- [ ] Add failing tests for checksum enforcement, unsafe ZIP rejection, dependency fingerprinting, mtime-independent build fingerprints and failed-build rollback.
- [ ] Run the focused tests and verify the expected failures.
- [ ] Implement verified download/extraction, dependency reuse, honest activity output, temporary Vite output validation and atomic `dist/app` replacement.
- [ ] Run the focused tests and verify they pass.

### Task 3: Preserve server ownership and recovery

**Files:**
- Modify: `scripts/launcher/auto_offer_launcher/server.py`
- Modify: `stop.bat`
- Test: `scripts/launcher/tests/test_server.py`
- Test: `scripts/launcher/tests/test_lock.py`

**Interfaces:**
- Consumes: validated local build and server state.
- Produces: one authenticated server on the stable origin and idempotent stop behavior.

- [ ] Run the lifecycle, foreign-listener, lock and authenticated-shutdown tests against the restored launcher.
- [ ] Retain the bounded Windows cleanup and OS-backed locking behavior required by those tests.
- [ ] Verify repeated start/health/stop cycles.

### Task 4: Replace the release-only CI and documentation contract

**Files:**
- Create: `.github/workflows/windows-launcher.yml`
- Delete: `.github/workflows/windows-release.yml`
- Delete: `scripts/release/build_windows_release.py`
- Delete: `scripts/release/verify_windows_release.py`
- Delete: `scripts/release/tests/test_release_contract.py`
- Modify: `README.md`
- Modify: `docs/app/WINDOWS_PORTABLE_LAUNCH.md`
- Modify: `docs/app/APP_USE_CASES.md`
- Modify: `docs/app/APP_UX_ARCHITECTURE.md`
- Modify: `docs/app/SCENARIO_MATRIX.md`

**Interfaces:**
- Consumes: a normal repository checkout.
- Produces: a BAT-level Windows acceptance gate matching the user flow.

- [ ] Make CI copy the checkout into a clean Unicode path and invoke the public BAT files.
- [ ] Verify fresh bootstrap, health/root/assets, authenticated stop and unchanged offline restart.
- [ ] Remove wording that directs users to a separate release artifact.
- [ ] Keep manual clean-Windows acceptance marked pending.

### Task 5: Repository gate

**Files:** all changed files.

- [ ] Run launcher unit tests.
- [ ] Run `npm run typecheck:app`.
- [ ] Run `npm run test:app`.
- [ ] Run `npm run test:pilot`.
- [ ] Run `npm run app:build`.
- [ ] Run `npm test`.
- [ ] Check for disabled tests and forbidden generated/runtime files.
- [ ] Open a draft PR and use its exact-head Windows workflow as the final automated acceptance evidence.
