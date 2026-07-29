# Taxonomy review process

This gate produces evidence for a private, manual review. It does not approve the proposed taxonomy, and `proposed_mapped` is a deterministic rule outcome—not AI annotation. Codex and generators do not make owner decisions. Mass annotation remains prohibited (`mass_annotation_allowed=false`).

## Private review workflow

1. In an environment containing the private source Excel workbooks, run `npm run catalog:inventory`.
2. Run `npm run taxonomy:review-pack`.
3. Manually inspect `reports/local/taxonomy-review-pack.md`.
4. Run `npm run taxonomy:create-approval-draft`.
5. Manually fill every class and unresolved-case decision in `taxonomy/local/taxonomy.approval.draft.json`.
6. Run `npm run taxonomy:validate-approval` while the document is a draft.
7. The owner manually adds the dated signoff, changes the status to `approved`, and validates again. `approved_at` is an audit value and is never generated from the clock.
8. Create production taxonomy in a separate PR after approval.

The inventory, review pack, full payloads, and working approval are local-only and ignored by Git. Compact indexes contain hashes and regeneration instructions, not misleading committed-file paths. The review tooling never substitutes compact aggregates for row-level evidence.

Production class-specific schemas are created only after owner approval. This change does not create production taxonomy, annotation prompts, batch annotation, or automatic decisions.
