# ADR-0004: Match run selection state

## Status

Accepted for B4b.

## Decision

`MatchResult` remains immutable matcher output. Manual decisions belong to the app-owned `SelectionStateRecord`, with exactly one record per `MatchRunRecord`. The record stores run/session/fingerprint identity, an optimistic `revision`, timestamps, and a map from request `line_id` to a full four-part `OfferRef`.

IndexedDB v3 stores selection states separately. Existing B4a runs receive an empty state lazily when opened. Saving a successful new run creates its empty state and removes the previous run and state in the same transaction, so decisions are never transferred between runs. Session deletion removes both matching artifacts.

The review read model resolves offer references against the exact saved catalog record, catalog id, source hash, and item id. A stale run and its decisions remain visible but read-only. Reloading restores decisions. Export and final session approval remain planned for B5.

## Consequences

React renders typed review views and invokes an application service; it does not parse matcher JSON or access IndexedDB. Revision checks prevent one tab from overwriting another tab's newer decision.
