# PR8: Semantic result as the ready proposal

## Decision

`SemanticMatchResult` is the immutable baseline commercial proposal. For a
semantic run, `SelectionState` contains only operator overrides and feedback;
an empty `decisions` object can therefore describe a completely ready review.
The final session confirmation, rather than per-line AI timestamps, records the
human approval of the effective proposal. We never synthesize `confirmedAt`
values for AI outcomes.

A pure effective-review resolver combines persisted run data, authoritative
catalog snapshots, and operator state. Operator overrides take precedence over
the AI baseline where a line is commercially resolvable. Eligible AI offers and
AI `no_offer` are ready. `request_unsupported` has a ready commercial
`no_offer` disposition while retaining its distinct unsupported presentation.
`manual_only` blocks until the exact proposed product is explicitly approved
(or the operator records no offer). `reroute_required`,
`request_review_required`, and `request_invalid` remain unresolved and block
confirmation.

Pilot runs retain their existing semantics: every request line needs an
operator decision. Both presentation and confirmation consume the same
canonical resolver so readiness cannot diverge between them. Confirmation
still rebuilds the effective review from raw persisted data and repeats run,
fingerprint, coverage, catalog, candidate, and revision validation.

## Persistence and audit boundaries

There is no IndexedDB migration, store, schema-version change, or mass write.
Semantic imports continue to create revision-zero selection state with empty
decisions. Existing semantic operator decisions remain valid overrides, and
clearing one exposes the AI baseline again. Reopen retains both baseline and
overrides. Feedback remains independent of readiness.

## Scope boundaries

STEP1–STEP3, semantic schemas, prompts, and matching are unchanged. This work
adds no provider API, backend, matching heuristic, or arbitrary catalog product
picker. Replacing an AI offer with an unrelated product is explicitly out of
scope.

## Self-review

The apparent tension between `request_unsupported` and `no_offer` is resolved
by keeping semantic presentation separate from confirmation disposition. Hard
problem statuses cannot be bypassed by an old decision; they require corrected
input or a new semantic result. `manual_only` is different because its contract
explicitly permits approval of the exact AI candidate. These rules preserve the
audit meaning of selection decisions and do not make Pilot runs auto-ready.
