# B4b result review and selection implementation plan

1. Add app-owned OfferRef, SelectionState, labels, and defensive typed result read model.
2. Upgrade IndexedDB from v2 to v3 and make MatchRun/SelectionState lifecycle atomic.
3. Add the selection application service with current-run and candidate eligibility checks.
4. Add a focused results hook and component tree; keep SessionPage as composition root.
5. Verify domain, persistence, UI, protected paths, formatting, and documentation.

The implementation deliberately excludes automatic confirmation, decision transfer, final approval, and export.
