# Production taxonomy 1.0.0

## Status

The repository contains a production taxonomy contract with 41 active classes. The taxonomy and all class-specific annotation contracts are approved for schema design and pilot validation. Mass annotation remains disabled: `mass_annotation_allowed=false`.

The approval is anchored by `taxonomy/production-approval-manifest.json` and the proposed-to-production mapping by `taxonomy/lineage.proposed-to-production.json`. The private owner approval and row-level review evidence are not committed.

## Classification principle

Product function has priority over source section, material, or connection system. A ball valve remains `valve.ball` whether it uses threads, PP-R socket fusion, or compression ends. A manifold remains a manifold even when it is manufactured from PP-R. Pipe supports remain `support.pipe` even when they are compatible with PP-R or sewer systems.

Connection technology, system, dimensions, and thread sizes are represented by ordered `ports`. They do not create a new functional class unless the approved taxonomy explicitly separates the product family.

## Floor-heating panel resolution

A studded floor-heating panel is not a separate class. It belongs to `accessory.floor_heating` with:

```json
{
  "accessory_kind": "panel"
}
```

The superseded identifier `accessory.floor_heating.panel` is recorded only as a folded lineage resolution and is not an active class.

## Active classes

The exact active class set is defined in `taxonomy/taxonomy.json` and validated against a fixed 41-class allowlist by `scripts/taxonomy/validate-production-taxonomy.mjs`. The old reference class `fitting.adapter.ppr.male_thread` is not a production class.

## Generated contracts

`npm run generate:annotation-schemas` reads `taxonomy/taxonomy.json` and deterministically generates:

- 41 catalog class schemas;
- 41 request class schemas;
- the 41-class registry;
- catalog and request dispatchers.

Generated class schemas must not be edited by hand. Production validation enters through the generated dispatchers, not through base schemas alone.

## Unknowns, ambiguity, and evidence

Unknown values are omitted and identified through `annotation.unknown_fields`. Competing interpretations use blocking `annotation.ambiguities` and `needs_review`. The taxonomy does not define `unknown`, `unspecified`, or `other` enum values. Every present AI-derived semantic value requires source evidence unless the field is fixed by the class contract.

## Fixtures and golden tests

Every active class has a synthetic fixture set with valid catalog/request examples, unknown and ambiguity cases, three invalid cases, and a deterministic golden prompt/output pair. Fixtures contain no real product rows, SKU, or GTIN.

## Next gate

The next stage is a small AI annotation pilot with mandatory human review and measured schema-valid, needs-review, and repeatability rates. This document does not authorize a batch annotation runner or mass processing of the catalog.
