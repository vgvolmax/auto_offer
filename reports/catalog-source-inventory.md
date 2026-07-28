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

## Duplicate and identifier diagnostics

- CROSS_SOURCE_DUPLICATE: 1553
- EXACT_SOURCE_DUPLICATE: 2
- GTIN_CONFLICT: 85

## Proposed classes and representative examples

### `accessory.floor_heating` — Комплектующее теплого пола
Rows: 19. Review status: `needs_owner_approval`.
- `rtp-main:Лист1:1534` — Скобы для теплого пола 16-20 (42мм, россыпь)
- `rtp-main:Лист1:1535` — Подложка для теплого пола 3мм (1,2 х 25 м), RTP
- `rtp-main:Лист1:1538` — Шина фиксирующая для монтажа теплого пола  0,5м d16-20 мм

### `conduit.corrugated` — Защитная гофрированная оболочка
Rows: 8. Review status: `needs_owner_approval`.
- `rtp-main:Лист1:1687` — Труба гофрированная ПНД 40 (вн.35),  30 м,синий, РТП
- `rtp-main:Лист1:1688` — Труба гофрированная ПНД 40 (вн.35),  30 м,красный, РТП
- `rtp-main:Лист1:2043` — Труба гофрированная ПНД 23 (вн.19),  50 м,красный, РТП

### `drain.floor` — Сливной трап
Rows: 44. Review status: `needs_owner_approval`.
- `rtp-distribution:АНИ пласт:21` — Трап горизонтальный не регулируемый решетка нержавеющая сталь ВК ПП 100/100х50, серый,АНИ TA5102
- `rtp-distribution:АНИ пласт:22` — Трап горизонтальный не регулируемый решетка нержавеющая сталь ВК ПП 150/150х50, серый,АНИ TA5112
- `rtp-distribution:АНИ пласт:23` — Трап горизонтальный не регулируемый решетка нержавеющая сталь ВК ПП 150/150х110, серый,АНИ TA1112

### `fitting.axial` — Аксиальный фитинг
Rows: 282. Review status: `needs_owner_approval`.
- `rtp-main:Лист1:1545` — Соединитель евроконус аксиальный, латунь,16х2,0х3/4", желтый, RTP
- `rtp-main:Лист1:1546` — Соединитель евроконус аксиальный, латунь,16х2,2х3/4", желтый, RTP
- `rtp-main:Лист1:1547` — Соединитель евроконус аксиальный, латунь,20х2,0х3/4", желтый, RTP

### `fitting.brass.threaded` — Резьбовой латунный фитинг
Rows: 389. Review status: `needs_owner_approval`.
- `rtp-main:Лист1:1695` — Ниппель, латунь, наружная резьба 1_1/2", никель, РТП
- `rtp-main:Лист1:1696` — Ниппель, латунь, наружная резьба 2", никель, РТП
- `rtp-main:Лист1:1697` — Ниппель переходной, латунь, наружная резьба 1_1/2"х1", никель, РТП

### `fitting.compression` — Компрессионный фитинг
Rows: 222. Review status: `needs_owner_approval`.
- `rtp-main:Лист1:1000` — Муфта переходная компрессионная, полипропилен 25/20, для полиэтиленовых труб, РТП
- `rtp-main:Лист1:1001` — Муфта переходная компрессионная, полипропилен 32/25, для полиэтиленовых труб, РТП
- `rtp-main:Лист1:1002` — Муфта переходная компрессионная, полипропилен 40/25, для полиэтиленовых труб, РТП

### `fitting.ppr` — Фитинг PP-R
Rows: 963. Review status: `needs_owner_approval`.
- `rtp-clearance:РАСПРОДАЖА!!!:40` — Тройник переходной PPR  32х50х32,  белый, RTP
- `rtp-clearance:РАСПРОДАЖА!!!:41` — Тройник переходной PPR  40х50х40,  белый, RTP
- `rtp-clearance:РАСПРОДАЖА!!!:42` — Тройник переходной PPR  50х32х40,  белый, RTP

### `fitting.radial` — Радиальный пресс-фитинг
Rows: 83. Review status: `needs_owner_approval`.
- `rtp-main:Лист1:2914` — Гильза радиальная PE 16 (5 шт), красный,RTP
- `rtp-main:Лист1:2915` — Гильза радиальная PE 20 (5 шт), красный,RTP
- `rtp-main:Лист1:2916` — Гильза радиальная PE 25 (5 шт), красный,RTP

### `fitting.sewer.external` — Фитинг наружной канализации
Rows: 46. Review status: `needs_owner_approval`.
- `rtp-main:Лист1:1425` — Отвод НК ПП 110х15, рыжий,РТП
- `rtp-main:Лист1:1426` — Отвод НК ПП 110х30, рыжий,РТП
- `rtp-main:Лист1:1427` — Отвод НК ПП 110х45, рыжий,РТП

### `fitting.sewer.internal` — Фитинг внутренней канализации
Rows: 190. Review status: `needs_owner_approval`.
- `rtp-main:Лист1:1225` — Отвод ELITE МК ПП 32х45, короб, белый,РТП
- `rtp-main:Лист1:1226` — Отвод ELITE МК ПП 32х87, короб, белый,РТП
- `rtp-main:Лист1:1227` — Муфта ELITE надвижная ремонтная (без перегородки) МК ПП 32, короб, белый,РТП

### `fitting.sewer.low_noise` — Малошумный канализационный фитинг
Rows: 77. Review status: `needs_owner_approval`.
- `rtp-main:Лист1:1186` — Отвод ELITE МК МПП 50х30, белый, РТП
- `rtp-main:Лист1:1187` — Отвод ELITE МК МПП 50х45, белый, РТП
- `rtp-main:Лист1:1188` — Отвод ELITE МК МПП 50х87, белый, РТП

### `insulation.pipe` — Теплоизоляция для труб
Rows: 70. Review status: `needs_owner_approval`.
- `rtp-distribution:ENERGOFLEX:12` — Трубка утеплительная SUPER 22/6х2,ENERGOFLEX EFXT022062SU
- `rtp-distribution:ENERGOFLEX:13` — Трубка утеплительная SUPER 28/6х2,ENERGOFLEX EFXT028062SU
- `rtp-distribution:ENERGOFLEX:15` — Трубка утеплительная SUPER 22/9х2,ENERGOFLEX EFXT022092SU

### `manifold` — Коллектор и коллекторная группа
Rows: 94. Review status: `needs_owner_approval`.
- `rtp-clearance:РАСПРОДАЖА!!!:74` — Коллекторная группа с ручными регулирующими клапанами и кронштейном (евроконус 3/4") нержавеющая сталь SUS 304 1"х4 выхода, RTP
- `rtp-clearance:РАСПРОДАЖА!!!:75` — Коллекторная группа с ручными регулирующими клапанами и кронштейном (евроконус 3/4") нержавеющая сталь SUS 304 1"х5 выходов, RTP
- `rtp-clearance:РАСПРОДАЖА!!!:76` — Коллекторная группа с ручными регулирующими клапанами и кронштейном (евроконус 3/4") нержавеющая сталь SUS 304 1"х6 выходов, RTP

### `pipe.hdpe` — Труба ПНД
Rows: 37. Review status: `needs_owner_approval`.
- `rtp-clearance:РАСПРОДАЖА!!!:14` — Труба ПНД питьевая напорная ПЭ100 40х3,7х100, SDR11,PN16,черный, РТП
- `rtp-clearance:РАСПРОДАЖА!!!:15` — Труба ПНД напорная ПИАРКОМ ПЭ80 40х3,0х200, SDR13,6,PN10,черный
- `rtp-clearance:РАСПРОДАЖА!!!:16` — Труба ПНД питьевая напорная ПЭ100 63х4,7х 50, SDR13,6,PN12,5,черный, РТП

### `pipe.multilayer` — Многослойная труба
Rows: 2. Review status: `needs_owner_approval`.
- `rtp-main:Лист1:2912` — Труба металлопластиковая PERT-AL-PERT 16х2,0х200, белый, РТП
- `rtp-main:Лист1:2913` — Труба металлопластиковая PERT-AL-PERT 16х2,0х100+, белый, РТП

### `pipe.pert` — Труба PE-RT
Rows: 15. Review status: `needs_owner_approval`.
- `rtp-main:Лист1:13` — Труба PERT 16х2,0х100, серый, РТП
- `rtp-main:Лист1:14` — Труба PERT 16х2,0х200, серый, РТП
- `rtp-main:Лист1:15` — Труба PERT 20х2,0х100, серый, РТП

### `pipe.pex_a` — Труба PE-Xa
Rows: 90. Review status: `needs_owner_approval`.
- `rtp-clearance:РАСПРОДАЖА!!!:13` — Труба PE-Xa 20х2,8 EVOH 44м, серый металлик
- `rtp-clearance:РАСПРОДАЖА!!!:241` — Труба EVOH PE-Xa 16х2,0,  50м оранжевый, RTP
- `rtp-clearance:РАСПРОДАЖА!!!:242` — Труба EVOH PE-Xa 20х2,0,  50м оранжевый, RTP

### `pipe.ppr` — Труба PP-R
Rows: 159. Review status: `needs_owner_approval`.
- `rtp-main:Лист1:100` — Труба PPR  63х10,5 PN20 белый 4м РТП
- `rtp-main:Лист1:101` — Труба PPR/GF/PPR  20х2,8 PN20 белый 4м РТП
- `rtp-main:Лист1:102` — Труба PPR/GF/PPR  25х3,5 PN20 белый 4м РТП

### `pipe.sewer.external` — Труба наружной канализации
Rows: 28. Review status: `needs_owner_approval`.
- `rtp-main:Лист1:1411` — Труба НК ПП 110х3,4х500, рыжий,РТП
- `rtp-main:Лист1:1412` — Труба НК ПП 110х3,4х1000, рыжий,РТП
- `rtp-main:Лист1:1413` — Труба НК ПП 110х3,4х2000, рыжий,РТП

### `pipe.sewer.internal` — Труба внутренней канализации
Rows: 80. Review status: `needs_owner_approval`.
- `rtp-main:Лист1:1218` — Труба ELITE МК ПП 32х1,8х150, белый,РТП
- `rtp-main:Лист1:1219` — Труба ELITE МК ПП 32х1,8х250, белый,РТП
- `rtp-main:Лист1:1220` — Труба ELITE МК ПП 32х1,8х500, белый,РТП

### `pipe.sewer.low_noise` — Малошумная канализационная труба
Rows: 28. Review status: `needs_owner_approval`.
- `rtp-main:Лист1:1176` — Труба ELITE МК МПП 50х1,8х250, белый, РТП
- `rtp-main:Лист1:1177` — Труба ELITE МК МПП 50х1,8х500, белый, РТП
- `rtp-main:Лист1:1178` — Труба ELITE МК МПП 50х1,8х1000, белый, РТП

### `sanitary.connector` — Санитарный соединитель и сифон
Rows: 14. Review status: `needs_owner_approval`.
- `rtp-distribution:АНИ пласт:15` — Труба фановая ВК 110х125, белый,АНИ W1218
- `rtp-distribution:АНИ пласт:16` — Труба фановая ВК 110х250, белый,АНИ W1220
- `rtp-distribution:АНИ пласт:17` — Труба фановая ВК 110х22, белый,АНИ W2220

### `sealant.plumbing` — Герметизирующий материал для сантехники
Rows: 86. Review status: `needs_owner_approval`.
- `rtp-clearance:РАСПРОДАЖА!!!:32` — Нить универсальная для герметизации резьбовых соединений (нейлон+герметизирующая паста) 20, блистер, SANFIX
- `rtp-clearance:РАСПРОДАЖА!!!:33` — Нить универсальная для герметизации резьбовых соединений (нейлон+герметизирующая паста) 50, блистер, SANFIX
- `rtp-clearance:РАСПРОДАЖА!!!:34` — Герметик анаэробный разборный, средней прочности, высокой вязкости, для соединений больших диаметров (от 1") 250 мл., желтый, SANFIX

### `support.pipe` — Крепление и опора для труб
Rows: 105. Review status: `needs_owner_approval`.
- `rtp-main:Лист1:1216` — Хомут ELITE МК МПП 50, белый, РТП
- `rtp-main:Лист1:1217` — Хомут ELITE МК МПП 110, белый, РТП
- `rtp-main:Лист1:1376` — Хомут ВК ПП 40, серый,РТП

### `tool.mounting` — Инструмент для монтажа труб
Rows: 151. Review status: `needs_owner_approval`.
- `rtp-distribution:ROTORICA:12` — Сварочный аппарат Rocket Welder Blue серия TOP 600W 20-40, ROTORICA RT.3111240
- `rtp-distribution:ROTORICA:13` — Сварочный аппарат Rocket Welder Blue серия TOP 800W 20-63, ROTORICA RT.3111263
- `rtp-distribution:ROTORICA:14` — Сварочный аппарат Rocket Welder Blue серия TOP 1200W 16-110, ROTORICA RT.3111110

### `valve.ball` — Кран шаровой
Rows: 283. Review status: `needs_owner_approval`.
- `rtp-clearance:РАСПРОДАЖА!!!:100` — Кран шаровой ручка бабочка, латунь, внутренняя/внутренняя резьба 1",PN40 никель, RTP
- `rtp-clearance:РАСПРОДАЖА!!!:101` — Кран шаровой ручка бабочка, латунь, внутренняя/внутренняя резьба 1_1/4",PN40 индивидуальная упаковка, никель, RTP
- `rtp-clearance:РАСПРОДАЖА!!!:102` — Кран шаровой ручка рычаг, латунь, внутренняя/внутренняя резьба  1/2",PN40 никель, РТП

### `valve.shutoff` — Запорная и регулирующая арматура
Rows: 368. Review status: `needs_owner_approval`.
- `rtp-clearance:РАСПРОДАЖА!!!:129` — Вентиль для радиатора прямой с прокладкой, латунь  1/2", никель, РТП
- `rtp-clearance:РАСПРОДАЖА!!!:130` — Вентиль для радиатора прямой, латунь  1/2", никель, РТП
- `rtp-clearance:РАСПРОДАЖА!!!:163` — Вентиль для радиатора прямой с прокладкой, латунь  1/2", еврослот, никель, RTP

## Unresolved cases sample

Total unresolved cases: 192. Full deterministic payload: `taxonomy/generated/unresolved-cases.full.json.gz`.

- `case:025ac4e9706fa7e1` — Какой класс следует утвердить для кластера cluster:1de9ac5bee32f6bd?
- `case:02bdc56b497c745a` — Какой класс следует утвердить для кластера cluster:99ffb885cf994f54?
- `case:04c32ea0b995fbdf` — Какой класс следует утвердить для кластера cluster:01cc22b71cd42fb6?
- `case:066cd3e7e25eaba2` — Какой класс следует утвердить для кластера cluster:92e9ae8678758ec8?
- `case:069d2954f8e63eb1` — Какой класс следует утвердить для кластера cluster:892713b8e239b281?
- `case:075d14ebbc84f46c` — Какой класс следует утвердить для кластера cluster:f58eaea0e1f8132e?
- `case:0b67dd35556edd59` — Какой класс следует утвердить для кластера cluster:e75d214a7fe837e0?
- `case:0bf6b6bfc337713e` — Какой класс следует утвердить для кластера cluster:6a058e58c1826005?
- `case:0c598e055c02f1a6` — Какой класс следует утвердить для кластера cluster:3f4cacd081fa5d74?
- `case:0c85e41b74897060` — Какой класс следует утвердить для кластера cluster:a7787e79798466fa?
- `case:0cb400a42024cb96` — Какой класс следует утвердить для кластера cluster:c5a432a181978b1d?
- `case:0cf6620f72570b71` — Как обработать конфликт gtin 4640014211410, связанный с разными наименованиями?
- `case:131ca2f270c3072b` — Какой класс следует утвердить для кластера cluster:92a7f6606e8a259b?
- `case:14d74e06d2693f30` — Какой класс следует утвердить для кластера cluster:246b0300c28214c8?
- `case:199ac2841ffc2e0e` — Какой класс следует утвердить для кластера cluster:aa370c283220b82e?
- `case:1a4310292ae59aca` — Какой класс следует утвердить для кластера cluster:6ae803c01fe5b6bc?
- `case:1af77cafb0b196af` — Какой класс следует утвердить для кластера cluster:3b94ac5b16cbd401?
- `case:1bcde3f215dd400a` — Какой класс следует утвердить для кластера cluster:c845cd959bb1e681?
- `case:1d7818b907ec908c` — Какой класс следует утвердить для кластера cluster:afe4af2569743f5a?
- `case:1d817ca9ffffc731` — Какой класс следует утвердить для кластера cluster:4ac59c0ebab3fc92?
- `case:1f80c070991f0d54` — Какой класс следует утвердить для кластера cluster:dfbc062d6b736e58?
- `case:1f8f174feba9e16b` — Какой класс следует утвердить для кластера cluster:2f036dcb49970420?
- `case:207d226a5440ae08` — Какой новый или существующий класс покрывает кластер cluster:78e0d941cfb4b405?
- `case:23bbdfe54a5b5072` — Какой класс следует утвердить для кластера cluster:e51e4fdfe137e3dc?
- `case:25048b2961492f45` — Как обработать конфликт gtin 4640014217887, связанный с разными наименованиями?
- `case:27fd7478eaca76fa` — Какой класс следует утвердить для кластера cluster:5b94b8e816ba54ac?
- `case:2912780cf23e67ed` — Какой класс следует утвердить для кластера cluster:41239247e82bac2f?
- `case:2a632e0fc46b1c3b` — Какой класс следует утвердить для кластера cluster:b520860b12dd888c?
- `case:2afa2542ce3cce99` — Какой класс следует утвердить для кластера cluster:2399ea4d649d10b4?
- `case:2d653e4e4f5859a1` — Какой класс следует утвердить для кластера cluster:f728e719c872bd54?
