# Semantic matching package design

PR4 adds a provider-neutral, manual-chat semantic matcher beside (and not inside) the Pilot 1.0 deterministic matcher. Application code projects selected catalog snapshots to a safe class- and hard-policy-bounded package, fingerprints its semantic content, and validates the chat result against both source artifacts.

## Contracts and boundaries

`semantic_matching_catalog` contains immutable compound offer references, authoritative catalog facts, policy, ordered snapshot provenance, and no volatile metadata. `semantic_match_result` contains one decision per request line and never repeats price, name, SKU, provider metadata, or confidence. Both are strict, independently versioned JSON contracts.

The pure modules use JSON values and Web Crypto only. A Node wrapper owns filesystem and Ajv concerns. The existing matcher, its result schema, policies, golden scenarios, request/catalog contracts, storage, taxonomy, and UI remain unchanged.

## Determinism and validation

Classes are the sorted unique `class_id` values already annotated on non-unsupported request lines. Catalogs follow explicit priority; items retain source order. Filtering is limited to taxonomy, class, usable identity, annotation eligibility, and explicit hard brand rules. The SHA-256 input is canonical JSON over all semantic package fields except the fingerprint and summary.

Validation runs schemas first, then exact provenance, line order/coverage, request-status decisions, compound offer existence and uniqueness, same-class selection, match-level ceiling, and repeated hard-policy checks. It fails closed and never repairs artifacts.

