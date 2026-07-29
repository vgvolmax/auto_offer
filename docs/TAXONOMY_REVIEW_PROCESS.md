# Taxonomy review process

The taxonomy proposal is a review artifact, not an authorization for production taxonomy generation or mass annotation. `mass_annotation_allowed` remains `false` throughout this process, and Codex must not make owner decisions or recommendations.

## Required local pipeline

1. Run `npm run catalog:inventory` to regenerate the inventory, compact indexes, and all private full payloads.
2. Run `npm run taxonomy:review-pack`.
3. Manually inspect the private review pack in `reports/local/`.
4. Run `npm run taxonomy:create-approval-draft`; this is the only supported way to create `taxonomy/local/taxonomy.approval.draft.json`.
5. Fill in the real class and case decisions manually.
6. Run `npm run taxonomy:validate-approval`.
7. Add the taxonomy owner's signoff only after every required decision is complete.
8. Submit production taxonomy changes in a separate pull request.

## Private payload boundary and ID continuity

Review-pack generation requires all three local gzip payloads: the full taxonomy proposal, full class map, and full unresolved-case set. Their committed compact indexes contain hashes and counts only and are insufficient for review. Every compressed and uncompressed hash and the exact inventory JSONL hash is verified before the review pack is built.

Class definitions come from the full taxonomy, cluster relations from the full class map, and unresolved questions and candidate options from the full unresolved payload. Review tooling never reconstructs missing content from compact indexes and never generates fallback cases, IDs, questions, options, recommendations, or decisions. A missing, corrupt, stale, or inconsistent private input is a hard failure.

Case IDs are preserved without change from the inventory proposal stage through the review pack, local approval draft, and approval validator. Because the real unresolved payload is private and local-only, there is no committed fake approval template or committed production draft. Synthetic examples belong only in tests.

The review pack and approval draft remain private. Codex may help enforce structural and continuity checks, but it cannot choose owner decisions, add owner signoff, enable mass annotation, or authorize a production taxonomy.
