# Catalog source inventory

**NOT APPROVED FOR MASS ANNOTATION**

- Inventory SHA-256: `ce22807e0c3dc986c4351a9e974b57a591fc8d784ad8c81d801081fddaedba81`
- Proposal input SHA-256: `ca598a7ed338eadf49cc0f89edc8fdf42841929c1a5c712fac671b6998f47be8`
- Physical non-empty rows across all sheets: 26813
- Configured non-empty rows: 4552
- Configured sheets: 9; explicitly ignored sheets: 26
- Inventory records: 4452
- Product candidates: 4113; non-product: 339
- Proposed mapped: 3333; ambiguous: 300; unsupported: 480

## Source workbooks

| Source | SHA-256 |
|---|---|
| rtp-main | `b772906f3937491e0012cbd33ef86b7b88a0d3a1b8404f7d4acabddef79c9626` |
| rtp-new | `a4b71a3caf1a5de26d5c4261991f32806be6fbdc5936ee676471818ccbcc70e9` |
| rtp-clearance | `a4a092a94b19251b7bf954d9918b1f1ea36b2cd46274e4f199d2618e392486aa` |
| rtp-distribution | `d546f898d4fc8bed9ba540ab6ca5f92aaaba3fc42b81a69541324da47a34605a` |

The private workbooks, complete row-level JSONL, class map, unresolved-case details, and full inspection payload are generated locally and excluded from Git. This report contains only aggregate counts, hashes, and representative review data.

## Proposed classes

| Class | Rows |
|---|---:|
| accessory.floor_heating | 19 |
| conduit.corrugated | 8 |
| drain.floor | 44 |
| fitting.axial | 282 |
| fitting.brass.threaded | 389 |
| fitting.compression | 222 |
| fitting.ppr | 963 |
| fitting.radial | 83 |
| fitting.sewer.external | 46 |
| fitting.sewer.internal | 190 |
| fitting.sewer.low_noise | 77 |
| insulation.pipe | 70 |
| manifold | 94 |
| pipe.hdpe | 37 |
| pipe.multilayer | 2 |
| pipe.pert | 15 |
| pipe.pex_a | 90 |
| pipe.ppr | 159 |
| pipe.sewer.external | 28 |
| pipe.sewer.internal | 80 |
| pipe.sewer.low_noise | 28 |
| sanitary.connector | 14 |
| sealant.plumbing | 86 |
| support.pipe | 105 |
| tool.mounting | 151 |
| valve.ball | 283 |
| valve.shutoff | 368 |

## Duplicate and conflict diagnostics

- CROSS_SOURCE_DUPLICATE: 1553
- EXACT_SOURCE_DUPLICATE: 2
- GTIN_CONFLICT: 85

## Review gate

- Proposed classes: 27
- Clusters: 1515
- Unresolved cases: 192
- Owner decisions are not filled automatically.
- Mass annotation remains disabled.
