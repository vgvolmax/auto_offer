# Portable Runtime Integrity — Implementation Plan

> **For Codex:** Execute inline with TDD. Do not change the fixed runtime path, BAT entry points, localhost origin, or application/domain code.

**Goal:** Make the existing Windows portable launcher reject damaged runtimes, recover an interrupted runtime publication offline, and reject type-confused manifests.

**Architecture:** Keep the current BAT → PowerShell bootstrap → portable Python launcher chain. Extend the runtime receipt to an exact file inventory, validate it before reuse, and make the existing `python.previous` backup a recoverable transaction. Tighten JSON validation at the configuration boundary.

**Tech Stack:** PowerShell 5.1+, Python 3 standard library, `unittest`, GitHub Actions on `windows-latest`.

---

### Task 1: Make manifest validation type-strict

**Files:**
- Modify: `scripts/launcher/tests/test_manifests.py`
- Modify: `scripts/launcher/config.py`

- [ ] Add failing tests proving that booleans are not integers and collection/string fields reject the wrong JSON type.

```python
def test_boolean_schema_version_is_rejected(self):
    manifest = self.valid_manifest()
    manifest["schema_version"] = True
    with self.assertRaises(ManifestError):
        validate_manifest(manifest)

def test_boolean_runtime_size_is_rejected(self):
    manifest = self.valid_manifest()
    manifest["runtimes"]["python"]["size"] = True
    with self.assertRaises(ManifestError):
        validate_manifest(manifest)

def test_runtime_files_must_be_list(self):
    manifest = self.valid_manifest()
    manifest["runtimes"]["python"]["files"] = "python.exe"
    with self.assertRaises(ManifestError):
        validate_manifest(manifest)
```

Also cover non-list `allowed_hosts`, non-object runtime entries, empty/non-string scalar fields, malformed source commit, and malformed timestamp.

- [ ] Run the launcher unit-test workflow and confirm the new tests fail against the old validator.
- [ ] Add small explicit validators in `config.py`: exact-key checks, `type(value) is int`, non-empty string checks, list/object checks, lowercase SHA/commit patterns, and parseable UTC timestamps.
- [ ] Run the launcher unit tests and confirm the strict-manifest tests pass.
- [ ] Review that every malformed input raises `ManifestError`, never `TypeError`, `KeyError`, or accidental acceptance.

### Task 2: Add RED Windows acceptance tests for runtime integrity

**Files:**
- Modify: `.github/workflows/windows-launcher.yml`

- [ ] After the successful online bootstrap and stop, record the receipt's `installed_at`, tamper with an installed regular file listed in the receipt, launch online, and assert:
  - launch succeeds;
  - the receipt timestamp changes;
  - the tampered file is restored to the recorded size/hash;
  - shutdown succeeds.

```powershell
$receipt = Get-Content .runtime\python\install-receipt.json -Raw | ConvertFrom-Json
$target = $receipt.files | Where-Object { $_.path -ne "python.exe" } | Select-Object -First 1
Add-Content -LiteralPath (Join-Path ".runtime\python" $target.path) -Value "tamper"
# start, health, stop
# assert new receipt installed_at differs and Get-FileHash matches receipt
```

- [ ] Add an exact-file-set test: create `.runtime/python/unexpected-runtime-file.txt`, launch online, and assert the file is removed by runtime repair.
- [ ] Add offline interrupted-publication recovery:
  - stop the server;
  - move `.runtime/python` to `.runtime/python.previous`;
  - block HTTP(S) via invalid local proxy;
  - run `start.bat --no-browser`;
  - assert health/root succeed and `python.previous` was restored without download;
  - stop cleanly.
- [ ] Commit only the acceptance tests and confirm the current implementation fails for the intended reason.

### Task 3: Record and verify every installed runtime file

**Files:**
- Modify: `scripts/launcher/bootstrap.ps1`
- Modify: `docs/app/WINDOWS_PORTABLE_LAUNCH.md`

- [ ] Add helpers that enumerate every regular runtime file except `install-receipt.json`, normalize relative paths to `/`, sort deterministically, and calculate size plus SHA-256.

```powershell
function Get-RuntimeFiles([string]$Root) {
    @(Get-ChildItem -LiteralPath $Root -File -Recurse | Where-Object {
        $_.FullName -ne (Join-Path $Root "install-receipt.json")
    } | ForEach-Object {
        [ordered]@{
            path = $_.FullName.Substring($Root.Length).TrimStart("\").Replace("\", "/")
            size = [int64]$_.Length
            sha256 = (Get-FileHash -LiteralPath $_.FullName -Algorithm SHA256).Hash.ToLowerInvariant()
        }
    } | Sort-Object path)
}
```

- [ ] Write receipt schema v2 only after extraction and executable/version checks succeed:
  - `schema_version: 2`
  - pinned Python version and archive SHA
  - launcher version
  - UTC `installed_at`
  - exact `files` inventory.
- [ ] In `Test-InstalledRuntime`, reject wrong receipt keys/types, old schema, missing/extra files, changed sizes/hashes, mismatched pinned values, or a Python executable that does not report the exact pinned version.
- [ ] Keep verification fail-closed: return false with a safe log message and reinstall; never silently “repair” a receipt around unverified files.
- [ ] Run the Windows integrity acceptance tests and confirm both modified-file and extra-file cases are repaired.

### Task 4: Make publication recoverable before network access

**Files:**
- Modify: `scripts/launcher/bootstrap.ps1`
- Modify: `.github/workflows/windows-launcher.yml`

- [ ] Under the existing launcher mutex, call recovery before any download:
  - if active is absent and `python.previous` is valid, atomically restore it;
  - if both exist and active is valid, retain the backup until the launcher succeeds;
  - if active is invalid and backup is valid, quarantine/remove active and restore backup;
  - never delete the only valid runtime before a staged replacement is fully verified.
- [ ] Publish a verified stage with rollback:
  1. keep or create `python.previous`;
  2. rename verified stage to `python`;
  3. on publication failure restore the previous runtime;
  4. remove `python.previous` only after the portable launcher exits with code 0.
- [ ] Ensure cleanup is idempotent and limited to the known sibling paths `python`, `python.previous`, and unique stage directories.
- [ ] Run the offline recovery test with outbound HTTP(S) blocked and confirm startup succeeds without a download.
- [ ] Re-run the first-install and unchanged offline-repeat scenarios to ensure no regression.

### Task 5: Align documentation and status with evidence

**Files:**
- Modify: `README.md`
- Modify: `docs/app/WINDOWS_PORTABLE_LAUNCH.md`
- Modify: `docs/app/SCENARIO_MATRIX.md`
- Modify only if status text is present: `docs/app/APP_USE_CASES.md`, `docs/app/APP_UX_ARCHITECTURE.md`

- [ ] Describe receipt v2, full-file verification, automatic recovery from `python.previous`, and the distinction between CI verification and clean-machine manual acceptance.
- [ ] Replace stale “execution pending” or obsolete test-count claims with exact current facts.
- [ ] Keep `Manual clean-Windows acceptance pending` unless a real clean Windows machine was tested.
- [ ] Do not claim bit-for-bit ZIP reproducibility and do not expand scope into UI, matcher, taxonomy, schemas, bundles, or IndexedDB.

### Task 6: Full verification and review

- [ ] Run/observe the complete repository gate on the final head:
  - `python -m unittest discover -s scripts/launcher/tests -p "test_*.py" -v`
  - `npm run typecheck:app`
  - `npm run test:app`
  - `npm run test:pilot`
  - `npm run app:build`
  - `npm test`
  - `git diff --check`
  - `rg -n "(?:skip|only)\\(" scripts/launcher app/src tests || true`
- [ ] Confirm the Windows workflow executes, rather than skips:
  - strict unit tests;
  - path with spaces and Cyrillic;
  - fresh pinned-runtime bootstrap;
  - runtime tamper repair;
  - unexpected-file repair;
  - offline `python.previous` recovery;
  - health/root/stop;
  - unchanged offline repeat.
- [ ] Inspect the final diff for generated runtime archives, `.runtime`, `node_modules`, `dist`, logs, secrets, protected domain files, or unrelated changes.
- [ ] Request independent code review and address every high/medium correctness finding.
- [ ] Create a draft correction PR targeting `codex/-portable-windows-auto-offer`, including exact checks, Windows CI URL, and `Manual clean-Windows acceptance pending`.
