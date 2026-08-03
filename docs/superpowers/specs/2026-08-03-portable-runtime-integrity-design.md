# Portable Runtime Integrity and Recovery Design

**Date:** 2026-08-03
**Status:** Approved design
**Architecture verdict:** `REFACTOR-IN-PR`

## 1. Verdict

The launcher architecture remains appropriate: a prebuilt web application, a project-local verified Python runtime, and a standard-library server on the fixed origin `http://127.0.0.1:8765/#/`.

A bounded correction is required inside the launcher contour before merging:

1. preserve checksum-based trust when an installed runtime is reused;
2. recover the last runtime after an interrupted directory publication;
3. reject malformed JSON scalar and collection types in manifests.

The React application, matcher, taxonomy, bundle contracts, schemas, IndexedDB behavior, fixed origin, runtime version, and external dependencies remain unchanged.

## 2. Change impact

### Files in scope

- `scripts/launcher/bootstrap.ps1`
  - create and verify an exact installed-runtime receipt;
  - recover `python.previous` before any network access;
  - publish a staged runtime through a recoverable two-phase directory swap.
- `scripts/launcher/auto_offer_launcher/config.py`
  - validate every manifest collection and scalar with strict JSON types;
  - reject `bool` where an integer is required.
- `scripts/launcher/tests/test_manifests.py`
  - negative tests for boolean integers and malformed scalar/collection types.
- `.github/workflows/windows-release.yml`
  - real Windows checks for runtime corruption and offline recovery.
- `docs/app/APP_USE_CASES.md`, `docs/app/SCENARIO_MATRIX.md`, and `docs/app/WINDOWS_PORTABLE_LAUNCH.md`
  - distinguish CI-verified scenarios from manual clean-Windows acceptance.

### Invariants

- Runtime downloads remain HTTPS-only, host-allowlisted, bounded-retry, and archive-checksum verified.
- No system Python, Node.js, npm, admin rights, or third-party launcher dependency is introduced.
- `.runtime/python` remains the active runtime path used by `start.bat` and `stop.bat`.
- `.runtime/python.previous` is recovery state, never evidence of a completed installation.
- No previous known runtime is deleted before a staged replacement has passed archive, ZIP, executable, version, and file-manifest validation.
- Manual clean-Windows acceptance remains explicitly pending until performed by the product owner.

## 3. Technical design

### Installed-runtime receipt

`install-receipt.json` becomes an exact schema:

```json
{
  "schema_version": 2,
  "python_version": "3.13.7",
  "archive_sha256": "<64 lowercase hex>",
  "launcher_version": "1.0.0",
  "installed_at": "<UTC ISO-8601>",
  "files": [
    {
      "path": "python.exe",
      "size": 103192,
      "sha256": "<64 lowercase hex>"
    }
  ]
}
```

The `files` array contains every regular runtime file except `install-receipt.json`. Paths use normalized forward slashes and are sorted ordinally. Every entry has an exact relative path, non-negative integer size, and SHA-256.

A runtime is reusable only when:

1. receipt fields and JSON types are exact;
2. version, archive checksum, and launcher version match `runtime-manifest.json`;
3. the actual regular-file set exactly matches the receipt;
4. every file size and SHA-256 matches;
5. `python.exe` launches and reports the exact pinned version.

Any failure marks the runtime unusable and leads to recovery or reinstall. A failed validation never updates the receipt.

### Recovery state machine

All operations remain under the existing OS-backed mutex.

Before network access:

1. If `python` is absent and `python.previous` exists, move `python.previous` back to `python`.
2. If both exist, validate `python`.
   - If valid, keep `python.previous` until the launcher completes successfully.
   - If invalid and `python.previous` is valid, replace the invalid active directory with `python.previous`.
   - If neither is valid, preserve them until a fully staged replacement is ready.
3. Validate the resulting active runtime.
4. Download only when no valid active runtime exists.

### Recoverable publication

1. Download to `.part`; verify archive SHA-256.
2. Validate every ZIP entry before extraction.
3. Extract to a unique sibling staging directory.
4. Validate `python.exe` and the pinned version.
5. Generate the exact file manifest and receipt inside staging.
6. Validate staging using the same reuse validator.
7. Move any active runtime to `python.previous`.
8. Move staging to `python`.
9. Validate the published runtime again.
10. On publication failure, restore `python.previous`.
11. Delete `python.previous` only after `launcher.py start` returns exit code 0.

A process or machine interruption may leave `python.previous`, but the next start restores or completes publication before attempting the network. This preserves the fixed runtime path without introducing an active-pointer subsystem.

### Strict manifest types

`load_runtime()` and `load_release()` validate types before comparing values or iterating:

- dictionaries and arrays must have their exact JSON collection types;
- integer fields use `type(value) is int`, rejecting booleans;
- strings must be non-empty where required;
- SHA-256 values are 64 lowercase hexadecimal characters;
- `source_commit` is 40 lowercase hexadecimal characters;
- `build_timestamp` is a parseable ISO-8601 timestamp;
- file entries, runtime paths, and host lists reject malformed element types.

Invalid input always raises `ManifestError`, not incidental `TypeError` or `KeyError`.

## 4. Implementation order

1. Add failing manifest tests for boolean and malformed types.
2. Add failing Windows E2E steps for a corrupted installed file and offline `python.previous` recovery.
3. Implement strict Python manifest validation.
4. Implement receipt file hashing and installed-runtime verification in PowerShell.
5. Implement startup recovery and recoverable publication.
6. Update scenario documentation with the actual CI status.
7. Run the complete repository and Windows release gates.
8. Perform an independent read-only code review before finalizing the correcting PR.

## 5. Verification

### Unit and contract tests

- `schema_version: true` is rejected.
- `size: true` is rejected.
- non-list `files` and `download_hosts` are rejected with `ManifestError`.
- malformed version, source commit, timestamp, runtime path, and receipt entries are rejected.
- receipt files are sorted, normalized, exact, and exclude the receipt itself.
- a changed, missing, or extra runtime file invalidates reuse.
- recovery occurs before the first download attempt.
- a failed validation never records success.

### Windows integration

The exact release ZIP is extracted into a path with spaces and Cyrillic. The workflow verifies:

1. first download, checksum, extraction, concurrent start, health, root, assets, and stop;
2. modification of an installed runtime file causes a verified reinstall;
3. `python` moved to `python.previous` is restored while external networking is disabled;
4. no second server, partial runtime directory, leaked shutdown token, or stale server state remains;
5. the final unchanged start works offline without reinstalling Python.

### Full gate

- `npm ci --no-audit --no-fund`
- `npm run typecheck:app`
- `npm run test:app`
- `npm run test:pilot`
- `npm run app:build`
- `npm test`
- `python -m unittest discover -s scripts/launcher/tests -p "test_*.py" -v`
- `python -m unittest discover -s scripts/release/tests -p "test_*.py" -v`

Bit-for-bit reproducible ZIP output is deliberately out of scope. The existing build timestamp remains legitimate release metadata.
