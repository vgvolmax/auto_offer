# Catalog source inspection

NOT APPROVED FOR MASS ANNOTATION

The complete workbook inspection is generated locally from private Excel files and excluded from Git. This committed report contains sheet-level aggregate metadata only; it contains no prices and no row-level catalog payload.

## rtp-main

- File: `01 ПРАЙС-ЛИСТ ООО РТП 30.06.2026.xlsm`
- SHA-256: `b772906f3937491e0012cbd33ef86b7b88a0d3a1b8404f7d4acabddef79c9626`
- Price pool: `main`
- Configured sheet: `Лист1`
- Other non-empty sheets are explicitly ignored in `config/catalog-sources.json` with reasons because the flat catalog is represented by `Лист1` or a dedicated workbook.

## rtp-new

- File: `02 Новинки ПРАЙСА 2026.xlsx`
- SHA-256: `a4b71a3caf1a5de26d5c4261991f32806be6fbdc5936ee676471818ccbcc70e9`
- Price pool: `new`
- Configured sheets are declared explicitly in `config/catalog-sources.json`.

## rtp-clearance

- File: `03 ПРАЙС РАСПРОДАЖА (30.06.2026).xlsx`
- SHA-256: `a4a092a94b19251b7bf954d9918b1f1ea36b2cd46274e4f199d2618e392486aa`
- Price pool: `clearance`
- Configured sheets are declared explicitly in `config/catalog-sources.json`.

## rtp-distribution

- File: `04 ПРАЙС ДИСТРИБЬЮЦИЯ 30.06.2026.xlsx`
- SHA-256: `d546f898d4fc8bed9ba540ab6ca5f92aaaba3fc42b81a69541324da47a34605a`
- Price pool: `distribution`
- Configured sheets are declared explicitly in `config/catalog-sources.json`.

## Coverage

- Source workbooks: 4
- Configured non-empty sheets: 9
- Explicitly ignored non-empty sheets: 26
- Physical non-empty rows across all sheets: 26813
- Non-empty rows on configured sheets: 4552

Every non-empty sheet is either configured for extraction or explicitly ignored with a non-empty reason. The private detailed inspection can be regenerated locally with `npm run catalog:inspect`.
