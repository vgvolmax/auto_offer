# Human-readable proposal table design

## Product contract

- One request line is rendered as exactly one business table row, in source order.
- The primary reading path is **Request → Our product**. Compact request and authoritative catalog product labels dominate the page.
- An AI/system recommendation is presentation data, not an operator decision. This change never writes or synthesizes `SelectionState` decisions.
- An existing operator `selected_offer` or `no_offer` always takes precedence over a recommendation.
- No matching, routing, contract, persistence, confirmation, or catalog-resolution behavior changes. In particular, PR8 auto-decisions are out of scope.
- Raw requests, rationale, differences, matching levels, actions, feedback, and diagnostics remain available only in collapsed row/service details.

## Presentation model

Pure adapters transform the already resolved `MatchResultReviewView` into ordered proposal rows and summary counts. The adapter has no storage or catalog access. A small deterministic request-label helper removes the known source-column prefix and uses the first pipe-delimited segment, preserving the complete raw value for details.

The row offer kind captures selected/recommended offers, operator/recommended no-offer, reroute/review/invalid/unsupported outcomes, and undecided lines. Operator decisions are evaluated first. Summary values derive from these rows rather than rendered DOM.

## UI

`MatchResultsPanel` remains the orchestrator for loading, persistence callbacks, toolbar, confirmation, and service diagnostics. It delegates rows to a semantic `<table>` with the columns `№`, `Запрос клиента`, `Количество`, `Наш товар`, and `Статус`. A per-row button controls a lazily rendered detail row with `aria-expanded` and `aria-controls`. Existing selection, no-offer, and feedback callbacks are reused without a second state layer.

## Self-review

The design preserves row cardinality and ordering, does not expose raw IDs in primary cells, distinguishes recommendations from decisions, keeps problematic outcomes distinct from no-offer, and keeps all technical content collapsed by default.
