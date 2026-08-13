# PR6: AI-only user matching flow — implementation plan

1. Add failing UI regressions for the absence of Pilot actions, user-facing offer-rule copy, STEP3 instructions/actions, current dirty settings, old Pilot display, semantic diagnostic suppression, and stale AI guidance.
2. Remove `onRun` from `MatchingPolicyForm` and `SessionPage`, retain independent settings save/edit behavior, and update the user-facing policy language without changing domain values.
3. Reframe `SemanticMatchingWorkspace` as STEP3 while retaining the existing semantic preparation/import functions and exact three-file package.
4. Make run summaries and service diagnostics source-aware; preserve legacy Pilot review while showing no Pilot diagnostics for semantic runs.
5. Update only workflow documentation that presents Pilot as a normal production path; explicitly describe Pilot as internal fallback.
6. Run focused tests, full required verification, `git diff --check`, and manual browser UAT. Review the diff for STEP1/STEP2 and semantic-contract scope violations before committing.
