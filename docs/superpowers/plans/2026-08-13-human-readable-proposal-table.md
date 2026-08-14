# Human-readable proposal table implementation plan

1. Add tests and a pure helper for compact request-line labels.
2. Add tests and a pure proposal-table adapter covering every outcome and decision precedence.
3. Build the semantic table, row, and lazy detail components around existing callbacks.
4. Integrate the table and presentation summary into `MatchResultsPanel`; preserve toolbar, batching, diagnostics, and confirmation.
5. Add component/regression coverage, compact responsive styling, and run focused then full verification.
