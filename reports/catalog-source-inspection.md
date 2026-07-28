# Catalog source inspection

NOT APPROVED FOR MASS ANNOTATION

## rtp-main

- File: `01 ПРАЙС-ЛИСТ ООО РТП 30.06.2026.xlsm`
- SHA-256: `b772906f3937491e0012cbd33ef86b7b88a0d3a1b8404f7d4acabddef79c9626`
- Price pool: `main`

| Sheet | State | Rows | Formulas | Missing cached formulas | Disposition |
|---|---:|---:|---:|---:|---|
| Оглавление | visible | 77 | 28 | 0 | ignored — navigation and commercial controls |
| РАСПРОДАЖА!!! | visible | 334 | 2628 | 61 | ignored — commercial presentation; represented by the dedicated clearance workbook |
| α) PPR Белый ⌀ 20-63  | visible | 465 | 3659 | 31 | ignored — formatted presentation; flat catalog rows are in Лист1 |
| α) PPR Белый ⌀ 75-160  | visible | 162 | 1212 | 28 | ignored — formatted presentation; flat catalog rows are in Лист1 |
| α) PPR Серый ⌀ 20-63 | visible | 260 | 1947 | 38 | ignored — formatted presentation; flat catalog rows are in Лист1 |
| η) Трубы + Ω) Трубы | visible | 57 | 239 | 6 | ignored — formatted presentation; flat catalog rows are in Лист1 |
| δ) PEX-A и Акс. фитинги | visible | 222 | 1799 | 48 | ignored — formatted presentation; flat catalog rows are in Лист1 |
| μ) PEX-A б.EVOH и рад. фитинги | visible | 122 | 1022 | 42 | ignored — formatted presentation; flat catalog rows are in Лист1 |
| σ) Коллекторы и комплектующие | visible | 67 | 355 | 16 | ignored — formatted presentation; flat catalog rows are in Лист1 |
| σ) Краны шаровые | visible | 93 | 643 | 30 | ignored — formatted presentation; flat catalog rows are in Лист1 |
| σ) Запорная арматура | visible | 75 | 461 | 64 | ignored — formatted presentation; flat catalog rows are in Лист1 |
| σ) Латунные фитинги никель | visible | 182 | 1573 | 14 | ignored — formatted presentation; flat catalog rows are in Лист1 |
| Штучная латунь в упаковке | visible | 362 | 2824 | 12 | ignored — formatted presentation; flat catalog rows are in Лист1 |
| γ) ПНД | visible | 200 | 1578 | 28 | ignored — formatted presentation; flat catalog rows are in Лист1 |
| β) Малошумная канализация | visible | 109 | 749 | 2 | ignored — formatted presentation; flat catalog rows are in Лист1 |
| β) Внутренняя канализация | visible | 229 | 1591 | 10 | ignored — formatted presentation; flat catalog rows are in Лист1 |
| β) ТРАПЫ РТП | visible | 47 | 132 | 3 | ignored — formatted presentation; flat catalog rows are in Лист1 |
| β)  Наружная канализация | visible | 89 | 490 | 2 | ignored — formatted presentation; flat catalog rows are in Лист1 |
| Оборудование для монтажа | visible | 216 | 1289 | 23 | ignored — formatted presentation; flat catalog rows are in Лист1 |
| ЗАКАЗ | visible | 1501 | 6006 | 6002 | ignored — order form, not source catalog rows |
| Прайс списком | hidden | 3500 | 87671 | 58770 | ignored — formula-driven commercial list; flat source rows are in Лист1 |
| Лист1 | hidden | 3345 | 0 | 0 | configured |
| Для заказа | hidden | 3518 | 137284 | 7137 | ignored — order helper, not source catalog rows |

### Лист1

- Header row: 1
- Columns: `{"supplier_sku":"B","name":"C","gtin":"I"}`
- Row predicate: `sku_and_name`
- Context columns: A, D, E, J
- Carry-forward context columns: none

## rtp-new

- File: `02 Новинки ПРАЙСА 2026.xlsx`
- SHA-256: `a4b71a3caf1a5de26d5c4261991f32806be6fbdc5936ee676471818ccbcc70e9`
- Price pool: `new`

| Sheet | State | Rows | Formulas | Missing cached formulas | Disposition |
|---|---:|---:|---:|---:|---|
| НОВИНКИ | visible | 381 | 1738 | 266 | configured |
| Лист1 | hidden | 3346 | 0 | 0 | ignored — complete lookup mirror; not the new-products subset |

### НОВИНКИ

- Header row: 12
- Columns: `{"supplier_sku":"C","name":"A","gtin":"D","unit":"E"}`
- Row predicate: `sku_and_name`
- Context columns: none
- Carry-forward context columns: A

## rtp-clearance

- File: `03 ПРАЙС РАСПРОДАЖА (30.06.2026).xlsx`
- SHA-256: `a4a092a94b19251b7bf954d9918b1f1ea36b2cd46274e4f199d2618e392486aa`
- Price pool: `clearance`

| Sheet | State | Rows | Formulas | Missing cached formulas | Disposition |
|---|---:|---:|---:|---:|---|
| РАСПРОДАЖА!!! | visible | 345 | 2750 | 111 | configured |
| Лист1 | hidden | 3339 | 0 | 0 | ignored — complete lookup mirror; not the clearance subset |

### РАСПРОДАЖА!!!

- Header row: 11
- Columns: `{"supplier_sku":"A","name":"I","gtin":"E"}`
- Row predicate: `sku_and_name`
- Context columns: none
- Carry-forward context columns: none

## rtp-distribution

- File: `04 ПРАЙС ДИСТРИБЬЮЦИЯ 30.06.2026.xlsx`
- SHA-256: `d546f898d4fc8bed9ba540ab6ca5f92aaaba3fc42b81a69541324da47a34605a`
- Price pool: `distribution`

| Sheet | State | Rows | Formulas | Missing cached formulas | Disposition |
|---|---:|---:|---:|---:|---|
| SANFIX | visible | 102 | 718 | 0 | configured |
| BAREON | visible | 24 | 135 | 0 | configured |
| ROTORICA | visible | 88 | 779 | 120 | configured |
| ARROWHEAD | visible | 171 | 1179 | 54 | configured |
| АНИ пласт | visible | 42 | 224 | 0 | configured |
| ENERGOFLEX | visible | 54 | 384 | 0 | configured |
| Описание | visible | 344 | 59 | 0 | ignored — supplemental descriptions without an independent complete product-row contract |
| Лист1 | visible | 3345 | 0 | 0 | ignored — complete lookup mirror; distribution subsets are represented by brand sheets |

### SANFIX

- Header row: 10
- Columns: `{"supplier_sku":"A","name":"D","gtin":"E","description":"F"}`
- Row predicate: `sku_and_name`
- Context columns: none
- Carry-forward context columns: A

### BAREON

- Header row: 10
- Columns: `{"supplier_sku":"A","name":"D","gtin":"E","description":"F"}`
- Row predicate: `sku_and_name`
- Context columns: none
- Carry-forward context columns: A

### ROTORICA

- Header row: 10
- Columns: `{"supplier_sku":"A","name":"D","gtin":"E","description":"F"}`
- Row predicate: `sku_and_name`
- Context columns: none
- Carry-forward context columns: A

### ARROWHEAD

- Header row: 10
- Columns: `{"supplier_sku":"A","name":"D","gtin":"E","description":"F"}`
- Row predicate: `sku_and_name`
- Context columns: none
- Carry-forward context columns: A

### АНИ пласт

- Header row: 10
- Columns: `{"supplier_sku":"A","name":"D","gtin":"E","description":"F"}`
- Row predicate: `sku_and_name`
- Context columns: none
- Carry-forward context columns: A

### ENERGOFLEX

- Header row: 10
- Columns: `{"supplier_sku":"A","name":"D","gtin":"E","description":"F"}`
- Row predicate: `sku_and_name`
- Context columns: none
- Carry-forward context columns: A
