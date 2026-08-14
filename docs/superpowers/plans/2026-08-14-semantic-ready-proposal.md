# PR8 implementation plan

1. Add a synchronous, immutable effective-review domain resolver and cover AI,
   operator precedence, unsupported, hard problems, manual-only, Pilot, and
   volume behavior with tests.
2. Rebuild completed-review validation and counts from effective outcomes while
   preserving current/stale/fingerprint/revision checks.
3. Feed the effective review into the proposal presentation, filters, export
   gating, and session confirmation summary.
4. Update semantic row actions and vocabulary so eligible AI outcomes are ready,
   manual-only offers require explicit approval, and overrides can be cleared.
5. Run focused and full verification, review the diff, commit, and open the PR.
