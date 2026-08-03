# Source-repository Windows startup design

## Product requirement

The supported Windows user flow is:

1. Download the standard GitHub repository ZIP.
2. Fully extract it into a writable directory.
3. Double-click `start.bat`.
4. Let the launcher prepare project-local runtimes, dependencies and the frontend build.
5. Open Auto Offer at `http://127.0.0.1:8765/#/`.

A separately built release artifact and `release-manifest.json` must not be prerequisites.

## Verdict

`REFACTOR-IN-PR`.

The merged launcher assumes a CI-built release tree. That assumption directly conflicts with the confirmed product flow and fails on a normal source ZIP before runtime preparation. The correction is bounded to the Windows launcher, its state/build modules, tests, workflow and documentation.

## Architecture

`start.bat` invokes Windows PowerShell. The bootstrap validates the runtime manifest, takes the process lock before changing shared state, installs a pinned project-local Python when required, then invokes the dependency-free Python launcher.

The Python launcher validates or installs pinned portable Node.js, runs only the required dependency and build stages, validates the temporary Vite output, atomically replaces `dist/app`, starts the standard-library HTTP server on the fixed origin, and opens the default browser after health succeeds.

The local `dist/app` directory is an internal cache produced from repository sources. It is not a published release and is never a manual user input.

## State and recovery

`.runtime/state.json` records only completed stages. Dependency reuse is keyed by the lockfile hash and Node version. Build reuse is keyed by a deterministic content fingerprint over `app/**`, `package.json`, `package-lock.json` and manifest build settings.

Failed dependency installation does not update dependency state. Failed typecheck or build leaves the previous successful `dist/app` untouched. Runtime downloads use pinned HTTPS URLs and SHA-256 verification.

## Compatibility

The React application, matcher, taxonomy, bundle contracts, IndexedDB schema and stable origin remain unchanged. Existing user browser data remains available because the origin stays `http://127.0.0.1:8765`.

## Verification

The Windows workflow must copy the checked-out repository into a path containing spaces and Cyrillic, remove `.runtime`, `node_modules` and `dist`, run `start.bat --no-browser`, verify health/root/assets, stop, then repeat with external networking unavailable without reinstalling unchanged components.

Manual clean-Windows acceptance remains pending until performed outside GitHub Actions.
