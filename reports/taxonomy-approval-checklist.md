# Taxonomy approval checklist

**NOT APPROVED FOR MASS ANNOTATION**

Manual owner decision is required for every class. No option is preselected.

## `accessory.floor_heating` — Комплектующее теплого пола
- Family: `floor_heating`; candidate rows: 19
- Attributes: accessory_kind, dimensions, material
- Ports: none proposed
- Overlaps: none detected; linked questions: 0
- Example: `rtp-main:Лист1:1534` — Скобы для теплого пола 16-20 (42мм, россыпь)
- [ ] approve  - [ ] revise  - [ ] reject  - [ ] split  - [ ] merge with another class

## `conduit.corrugated` — Защитная гофрированная оболочка
- Family: `protection`; candidate rows: 8
- Attributes: coil_length_m, color, inner_diameter_mm
- Ports: none proposed
- Overlaps: pipe.hdpe; linked questions: 2
- Example: `rtp-main:Лист1:1687` — Труба гофрированная ПНД 40 (вн.35),  30 м,синий, РТП
- [ ] approve  - [ ] revise  - [ ] reject  - [ ] split  - [ ] merge with another class

## `drain.floor` — Сливной трап
- Family: `drainage`; candidate rows: 44
- Attributes: adjustable, grate_material, outlet_orientation, seal_type
- Ports: sewer_outlet
- Overlaps: none detected; linked questions: 0
- Example: `rtp-distribution:АНИ пласт:21` — Трап горизонтальный не регулируемый решетка нержавеющая сталь ВК ПП 100/100х50, серый,АНИ TA5102
- [ ] approve  - [ ] revise  - [ ] reject  - [ ] split  - [ ] merge with another class

## `fitting.axial` — Аксиальный фитинг
- Family: `pressure_fittings`; candidate rows: 282
- Attributes: body_material, construction
- Ports: axial_1, axial_or_thread_2
- Overlaps: none detected; linked questions: 0
- Example: `rtp-main:Лист1:1545` — Соединитель евроконус аксиальный, латунь,16х2,0х3/4", желтый, RTP
- [ ] approve  - [ ] revise  - [ ] reject  - [ ] split  - [ ] merge with another class

## `fitting.brass.threaded` — Резьбовой латунный фитинг
- Family: `threaded_fittings`; candidate rows: 389
- Attributes: body_material, coating, construction
- Ports: thread_1, thread_2
- Overlaps: valve.shutoff; linked questions: 1
- Example: `rtp-main:Лист1:1695` — Ниппель, латунь, наружная резьба 1_1/2", никель, РТП
- [ ] approve  - [ ] revise  - [ ] reject  - [ ] split  - [ ] merge with another class

## `fitting.compression` — Компрессионный фитинг
- Family: `pressure_fittings`; candidate rows: 222
- Attributes: body_material, construction
- Ports: compression_1, compression_or_thread_2
- Overlaps: valve.ball, valve.shutoff; linked questions: 19
- Example: `rtp-main:Лист1:1000` — Муфта переходная компрессионная, полипропилен 25/20, для полиэтиленовых труб, РТП
- [ ] approve  - [ ] revise  - [ ] reject  - [ ] split  - [ ] merge with another class

## `fitting.ppr` — Фитинг PP-R
- Family: `pressure_fittings`; candidate rows: 963
- Attributes: body_material, color, construction, pressure_class
- Ports: connection_1, connection_2
- Overlaps: manifold, support.pipe, valve.ball, valve.shutoff; linked questions: 59
- Example: `rtp-clearance:РАСПРОДАЖА!!!:40` — Тройник переходной PPR  32х50х32,  белый, RTP
- [ ] approve  - [ ] revise  - [ ] reject  - [ ] split  - [ ] merge with another class

## `fitting.radial` — Радиальный пресс-фитинг
- Family: `pressure_fittings`; candidate rows: 83
- Attributes: body_material, profile
- Ports: press_1, press_or_thread_2
- Overlaps: none detected; linked questions: 0
- Example: `rtp-main:Лист1:2914` — Гильза радиальная PE 16 (5 шт), красный,RTP
- [ ] approve  - [ ] revise  - [ ] reject  - [ ] split  - [ ] merge with another class

## `fitting.sewer.external` — Фитинг наружной канализации
- Family: `sewer_fittings`; candidate rows: 46
- Attributes: angle_deg, color, ring_stiffness
- Ports: sewer_port_1, sewer_port_2
- Overlaps: none detected; linked questions: 0
- Example: `rtp-main:Лист1:1425` — Отвод НК ПП 110х15, рыжий,РТП
- [ ] approve  - [ ] revise  - [ ] reject  - [ ] split  - [ ] merge with another class

## `fitting.sewer.internal` — Фитинг внутренней канализации
- Family: `sewer_fittings`; candidate rows: 190
- Attributes: angle_deg, body_material, color
- Ports: sewer_port_1, sewer_port_2
- Overlaps: sanitary.connector, support.pipe; linked questions: 5
- Example: `rtp-main:Лист1:1225` — Отвод ELITE МК ПП 32х45, короб, белый,РТП
- [ ] approve  - [ ] revise  - [ ] reject  - [ ] split  - [ ] merge with another class

## `fitting.sewer.low_noise` — Малошумный канализационный фитинг
- Family: `sewer_fittings`; candidate rows: 77
- Attributes: angle_deg, color, sound_class
- Ports: sewer_port_1, sewer_port_2
- Overlaps: support.pipe; linked questions: 2
- Example: `rtp-main:Лист1:1186` — Отвод ELITE МК МПП 50х30, белый, РТП
- [ ] approve  - [ ] revise  - [ ] reject  - [ ] split  - [ ] merge with another class

## `insulation.pipe` — Теплоизоляция для труб
- Family: `insulation`; candidate rows: 70
- Attributes: inner_diameter_mm, length_m, thickness_mm
- Ports: none proposed
- Overlaps: none detected; linked questions: 0
- Example: `rtp-distribution:ENERGOFLEX:12` — Трубка утеплительная SUPER 22/6х2,ENERGOFLEX EFXT022062SU
- [ ] approve  - [ ] revise  - [ ] reject  - [ ] split  - [ ] merge with another class

## `manifold` — Коллектор и коллекторная группа
- Family: `manifolds`; candidate rows: 94
- Attributes: control_equipment, outlet_count
- Ports: branches, main_inlet, main_outlet
- Overlaps: fitting.ppr, valve.shutoff; linked questions: 23
- Example: `rtp-clearance:РАСПРОДАЖА!!!:74` — Коллекторная группа с ручными регулирующими клапанами и кронштейном (евроконус 3/4") нержавеющая сталь SUS 304 1"х4 выхода, RTP
- [ ] approve  - [ ] revise  - [ ] reject  - [ ] split  - [ ] merge with another class

## `pipe.hdpe` — Труба ПНД
- Family: `pressure_pipes`; candidate rows: 37
- Attributes: coil_length_m, pe_grade, pressure_class, sdr, wall_thickness_mm
- Ports: pipe_end, pipe_end
- Overlaps: conduit.corrugated; linked questions: 8
- Example: `rtp-clearance:РАСПРОДАЖА!!!:14` — Труба ПНД питьевая напорная ПЭ100 40х3,7х100, SDR11,PN16,черный, РТП
- [ ] approve  - [ ] revise  - [ ] reject  - [ ] split  - [ ] merge with another class

## `pipe.multilayer` — Многослойная труба
- Family: `pressure_pipes`; candidate rows: 2
- Attributes: coil_length_m, layer_structure, wall_thickness_mm
- Ports: pipe_end, pipe_end
- Overlaps: pipe.pert; linked questions: 2
- Example: `rtp-main:Лист1:2912` — Труба металлопластиковая PERT-AL-PERT 16х2,0х200, белый, РТП
- [ ] approve  - [ ] revise  - [ ] reject  - [ ] split  - [ ] merge with another class

## `pipe.pert` — Труба PE-RT
- Family: `pressure_pipes`; candidate rows: 15
- Attributes: barrier_layer, coil_length_m, color, wall_thickness_mm
- Ports: pipe_end, pipe_end
- Overlaps: pipe.multilayer; linked questions: 6
- Example: `rtp-main:Лист1:13` — Труба PERT 16х2,0х100, серый, РТП
- [ ] approve  - [ ] revise  - [ ] reject  - [ ] split  - [ ] merge with another class

## `pipe.pex_a` — Труба PE-Xa
- Family: `pressure_pipes`; candidate rows: 90
- Attributes: barrier_layer, coil_length_m, color, wall_thickness_mm
- Ports: pipe_end, pipe_end
- Overlaps: none detected; linked questions: 7
- Example: `rtp-clearance:РАСПРОДАЖА!!!:13` — Труба PE-Xa 20х2,8 EVOH 44м, серый металлик
- [ ] approve  - [ ] revise  - [ ] reject  - [ ] split  - [ ] merge with another class

## `pipe.ppr` — Труба PP-R
- Family: `pressure_pipes`; candidate rows: 159
- Attributes: body_material, color, length_m, pressure_class, sdr, wall_thickness_mm
- Ports: pipe_end, pipe_end
- Overlaps: none detected; linked questions: 0
- Example: `rtp-main:Лист1:100` — Труба PPR  63х10,5 PN20 белый 4м РТП
- [ ] approve  - [ ] revise  - [ ] reject  - [ ] split  - [ ] merge with another class

## `pipe.sewer.external` — Труба наружной канализации
- Family: `sewer_pipes`; candidate rows: 28
- Attributes: color, length_mm, ring_stiffness
- Ports: socket, spigot
- Overlaps: none detected; linked questions: 0
- Example: `rtp-main:Лист1:1411` — Труба НК ПП 110х3,4х500, рыжий,РТП
- [ ] approve  - [ ] revise  - [ ] reject  - [ ] split  - [ ] merge with another class

## `pipe.sewer.internal` — Труба внутренней канализации
- Family: `sewer_pipes`; candidate rows: 80
- Attributes: body_material, color, length_mm
- Ports: socket, spigot
- Overlaps: none detected; linked questions: 1
- Example: `rtp-main:Лист1:1218` — Труба ELITE МК ПП 32х1,8х150, белый,РТП
- [ ] approve  - [ ] revise  - [ ] reject  - [ ] split  - [ ] merge with another class

## `pipe.sewer.low_noise` — Малошумная канализационная труба
- Family: `sewer_pipes`; candidate rows: 28
- Attributes: color, length_mm, sound_class
- Ports: socket, spigot
- Overlaps: none detected; linked questions: 1
- Example: `rtp-main:Лист1:1176` — Труба ELITE МК МПП 50х1,8х250, белый, РТП
- [ ] approve  - [ ] revise  - [ ] reject  - [ ] split  - [ ] merge with another class

## `sanitary.connector` — Санитарный соединитель и сифон
- Family: `sanitary_drainage`; candidate rows: 14
- Attributes: connector_kind, material, outlet_diameter_mm
- Ports: fixture_port, sewer_port
- Overlaps: fitting.sewer.internal; linked questions: 1
- Example: `rtp-distribution:АНИ пласт:15` — Труба фановая ВК 110х125, белый,АНИ W1218
- [ ] approve  - [ ] revise  - [ ] reject  - [ ] split  - [ ] merge with another class

## `sealant.plumbing` — Герметизирующий материал для сантехники
- Family: `consumables`; candidate rows: 86
- Attributes: sealant_kind, strength, viscosity, volume_ml
- Ports: none proposed
- Overlaps: none detected; linked questions: 0
- Example: `rtp-clearance:РАСПРОДАЖА!!!:32` — Нить универсальная для герметизации резьбовых соединений (нейлон+герметизирующая паста) 20, блистер, SANFIX
- [ ] approve  - [ ] revise  - [ ] reject  - [ ] split  - [ ] merge with another class

## `support.pipe` — Крепление и опора для труб
- Family: `mounting_accessories`; candidate rows: 105
- Attributes: diameter_mm, material, support_kind
- Ports: none proposed
- Overlaps: fitting.ppr, fitting.sewer.internal, fitting.sewer.low_noise; linked questions: 17
- Example: `rtp-main:Лист1:1216` — Хомут ELITE МК МПП 50, белый, РТП
- [ ] approve  - [ ] revise  - [ ] reject  - [ ] split  - [ ] merge with another class

## `tool.mounting` — Инструмент для монтажа труб
- Family: `tools`; candidate rows: 151
- Attributes: drive_type, supported_diameters, tool_kind
- Ports: none proposed
- Overlaps: none detected; linked questions: 0
- Example: `rtp-distribution:ROTORICA:12` — Сварочный аппарат Rocket Welder Blue серия TOP 600W 20-40, ROTORICA RT.3111240
- [ ] approve  - [ ] revise  - [ ] reject  - [ ] split  - [ ] merge with another class

## `valve.ball` — Кран шаровой
- Family: `valves`; candidate rows: 283
- Attributes: body_material, coating, handle_type, pressure_class
- Ports: thread_1, thread_2
- Overlaps: fitting.compression, fitting.ppr, valve.shutoff; linked questions: 92
- Example: `rtp-clearance:РАСПРОДАЖА!!!:100` — Кран шаровой ручка бабочка, латунь, внутренняя/внутренняя резьба 1",PN40 никель, RTP
- [ ] approve  - [ ] revise  - [ ] reject  - [ ] split  - [ ] merge with another class

## `valve.shutoff` — Запорная и регулирующая арматура
- Family: `valves`; candidate rows: 368
- Attributes: body_material, control_type, valve_kind
- Ports: connection_1, connection_2
- Overlaps: fitting.brass.threaded, fitting.compression, fitting.ppr, manifold, valve.ball; linked questions: 87
- Example: `rtp-clearance:РАСПРОДАЖА!!!:129` — Вентиль для радиатора прямой с прокладкой, латунь  1/2", никель, РТП
- [ ] approve  - [ ] revise  - [ ] reject  - [ ] split  - [ ] merge with another class
