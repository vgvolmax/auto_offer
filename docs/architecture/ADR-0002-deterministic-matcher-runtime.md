# ADR-0002: Deterministic matcher runtime

## Decision
The pilot matcher is a browser-first domain runtime independent of UI, React, storage, and repositories. Production bundles are validated before entry; the runtime checks only matching invariants. Projection, transient class indexing, technical evaluation, policy filtering, ordering, and result construction are separate stages. Registry rules are interpreted as data rather than class-specific code.

The catalog index exists for one invocation only. Price and stock are retained in source offers but never affect matching or ordering. Inputs are not mutated and the returned `MatchResult` contains cloned policy data. Manual `SelectionState`, persistence, export, and all operator workflow remain outside this runtime.

## Fixture blocker discovered during B3
The committed B2 golden fixtures are not executable specifications of their expected results: all sixteen `request.json` files are byte-identical, while expected request-review, identity, pressure, handle, missing-value, and port outcomes differ. Thirteen policies are also byte-identical. In addition, most one-catalog scenarios select `record-secondary` in policy although that catalog is not supplied, contradicting the required matcher invariant that every selected catalog exist in the input. Expected results cannot be reproduced deterministically from the declared matcher inputs without using scenario identity, which is outside the public API and forbidden.
