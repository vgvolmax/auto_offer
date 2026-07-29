# Taxonomy approval checklist

**NOT APPROVED FOR MASS ANNOTATION**

Manual owner decision is required for every class.
No option is preselected.
Detailed evidence is available only in the private local review-pack.

## accessory.floor_heating — Комплектующее теплого пола

- Family: `floor_heating`
- Candidate rows: 19
- Candidate attributes: accessory_kind, dimensions, material
- Candidate ports: none proposed
- Overlaps: none proposed
- Open questions: 0

- [ ] approve
- [ ] revise
- [ ] reject
- [ ] split
- [ ] merge with another class

## conduit.corrugated — Защитная гофрированная оболочка

- Family: `protection`
- Candidate rows: 8
- Candidate attributes: coil_length_m, color, inner_diameter_mm
- Candidate ports: none proposed
- Overlaps: pipe.hdpe
- Open questions: 2

- [ ] approve
- [ ] revise
- [ ] reject
- [ ] split
- [ ] merge with another class

## drain.floor — Сливной трап

- Family: `drainage`
- Candidate rows: 44
- Candidate attributes: adjustable, grate_material, outlet_orientation, seal_type
- Candidate ports: sewer_outlet
- Overlaps: none proposed
- Open questions: 0

- [ ] approve
- [ ] revise
- [ ] reject
- [ ] split
- [ ] merge with another class

## fitting.axial — Аксиальный фитинг

- Family: `pressure_fittings`
- Candidate rows: 282
- Candidate attributes: body_material, construction
- Candidate ports: axial_1, axial_or_thread_2
- Overlaps: none proposed
- Open questions: 0

- [ ] approve
- [ ] revise
- [ ] reject
- [ ] split
- [ ] merge with another class

## fitting.brass.threaded — Резьбовой латунный фитинг

- Family: `threaded_fittings`
- Candidate rows: 389
- Candidate attributes: body_material, coating, construction
- Candidate ports: thread_1, thread_2
- Overlaps: valve.shutoff
- Open questions: 1

- [ ] approve
- [ ] revise
- [ ] reject
- [ ] split
- [ ] merge with another class

## fitting.compression — Компрессионный фитинг

- Family: `pressure_fittings`
- Candidate rows: 222
- Candidate attributes: body_material, construction
- Candidate ports: compression_1, compression_or_thread_2
- Overlaps: valve.ball, valve.shutoff
- Open questions: 19

- [ ] approve
- [ ] revise
- [ ] reject
- [ ] split
- [ ] merge with another class

## fitting.ppr — Фитинг PP-R

- Family: `pressure_fittings`
- Candidate rows: 963
- Candidate attributes: body_material, color, construction, pressure_class
- Candidate ports: connection_1, connection_2
- Overlaps: manifold, support.pipe, valve.ball, valve.shutoff
- Open questions: 59

- [ ] approve
- [ ] revise
- [ ] reject
- [ ] split
- [ ] merge with another class

## fitting.radial — Радиальный пресс-фитинг

- Family: `pressure_fittings`
- Candidate rows: 83
- Candidate attributes: body_material, profile
- Candidate ports: press_1, press_or_thread_2
- Overlaps: none proposed
- Open questions: 0

- [ ] approve
- [ ] revise
- [ ] reject
- [ ] split
- [ ] merge with another class

## fitting.sewer.external — Фитинг наружной канализации

- Family: `sewer_fittings`
- Candidate rows: 46
- Candidate attributes: angle_deg, color, ring_stiffness
- Candidate ports: sewer_port_1, sewer_port_2
- Overlaps: none proposed
- Open questions: 0

- [ ] approve
- [ ] revise
- [ ] reject
- [ ] split
- [ ] merge with another class

## fitting.sewer.internal — Фитинг внутренней канализации

- Family: `sewer_fittings`
- Candidate rows: 190
- Candidate attributes: angle_deg, body_material, color
- Candidate ports: sewer_port_1, sewer_port_2
- Overlaps: sanitary.connector, support.pipe
- Open questions: 5

- [ ] approve
- [ ] revise
- [ ] reject
- [ ] split
- [ ] merge with another class

## fitting.sewer.low_noise — Малошумный канализационный фитинг

- Family: `sewer_fittings`
- Candidate rows: 77
- Candidate attributes: angle_deg, color, sound_class
- Candidate ports: sewer_port_1, sewer_port_2
- Overlaps: support.pipe
- Open questions: 2

- [ ] approve
- [ ] revise
- [ ] reject
- [ ] split
- [ ] merge with another class

## insulation.pipe — Теплоизоляция для труб

- Family: `insulation`
- Candidate rows: 70
- Candidate attributes: inner_diameter_mm, length_m, thickness_mm
- Candidate ports: none proposed
- Overlaps: none proposed
- Open questions: 0

- [ ] approve
- [ ] revise
- [ ] reject
- [ ] split
- [ ] merge with another class

## manifold — Коллектор и коллекторная группа

- Family: `manifolds`
- Candidate rows: 94
- Candidate attributes: control_equipment, outlet_count
- Candidate ports: branches, main_inlet, main_outlet
- Overlaps: fitting.ppr, valve.shutoff
- Open questions: 23

- [ ] approve
- [ ] revise
- [ ] reject
- [ ] split
- [ ] merge with another class

## pipe.hdpe — Труба ПНД

- Family: `pressure_pipes`
- Candidate rows: 37
- Candidate attributes: coil_length_m, pe_grade, pressure_class, sdr, wall_thickness_mm
- Candidate ports: pipe_end, pipe_end
- Overlaps: conduit.corrugated
- Open questions: 8

- [ ] approve
- [ ] revise
- [ ] reject
- [ ] split
- [ ] merge with another class

## pipe.multilayer — Многослойная труба

- Family: `pressure_pipes`
- Candidate rows: 2
- Candidate attributes: coil_length_m, layer_structure, wall_thickness_mm
- Candidate ports: pipe_end, pipe_end
- Overlaps: pipe.pert
- Open questions: 2

- [ ] approve
- [ ] revise
- [ ] reject
- [ ] split
- [ ] merge with another class

## pipe.pert — Труба PE-RT

- Family: `pressure_pipes`
- Candidate rows: 15
- Candidate attributes: barrier_layer, coil_length_m, color, wall_thickness_mm
- Candidate ports: pipe_end, pipe_end
- Overlaps: pipe.multilayer
- Open questions: 6

- [ ] approve
- [ ] revise
- [ ] reject
- [ ] split
- [ ] merge with another class

## pipe.pex_a — Труба PE-Xa

- Family: `pressure_pipes`
- Candidate rows: 90
- Candidate attributes: barrier_layer, coil_length_m, color, wall_thickness_mm
- Candidate ports: pipe_end, pipe_end
- Overlaps: none proposed
- Open questions: 7

- [ ] approve
- [ ] revise
- [ ] reject
- [ ] split
- [ ] merge with another class

## pipe.ppr — Труба PP-R

- Family: `pressure_pipes`
- Candidate rows: 159
- Candidate attributes: body_material, color, length_m, pressure_class, sdr, wall_thickness_mm
- Candidate ports: pipe_end, pipe_end
- Overlaps: none proposed
- Open questions: 0

- [ ] approve
- [ ] revise
- [ ] reject
- [ ] split
- [ ] merge with another class

## pipe.sewer.external — Труба наружной канализации

- Family: `sewer_pipes`
- Candidate rows: 28
- Candidate attributes: color, length_mm, ring_stiffness
- Candidate ports: socket, spigot
- Overlaps: none proposed
- Open questions: 0

- [ ] approve
- [ ] revise
- [ ] reject
- [ ] split
- [ ] merge with another class

## pipe.sewer.internal — Труба внутренней канализации

- Family: `sewer_pipes`
- Candidate rows: 80
- Candidate attributes: body_material, color, length_mm
- Candidate ports: socket, spigot
- Overlaps: none proposed
- Open questions: 1

- [ ] approve
- [ ] revise
- [ ] reject
- [ ] split
- [ ] merge with another class

## pipe.sewer.low_noise — Малошумная канализационная труба

- Family: `sewer_pipes`
- Candidate rows: 28
- Candidate attributes: color, length_mm, sound_class
- Candidate ports: socket, spigot
- Overlaps: none proposed
- Open questions: 1

- [ ] approve
- [ ] revise
- [ ] reject
- [ ] split
- [ ] merge with another class

## sanitary.connector — Санитарный соединитель и сифон

- Family: `sanitary_drainage`
- Candidate rows: 14
- Candidate attributes: connector_kind, material, outlet_diameter_mm
- Candidate ports: fixture_port, sewer_port
- Overlaps: fitting.sewer.internal
- Open questions: 1

- [ ] approve
- [ ] revise
- [ ] reject
- [ ] split
- [ ] merge with another class

## sealant.plumbing — Герметизирующий материал для сантехники

- Family: `consumables`
- Candidate rows: 86
- Candidate attributes: sealant_kind, strength, viscosity, volume_ml
- Candidate ports: none proposed
- Overlaps: none proposed
- Open questions: 0

- [ ] approve
- [ ] revise
- [ ] reject
- [ ] split
- [ ] merge with another class

## support.pipe — Крепление и опора для труб

- Family: `mounting_accessories`
- Candidate rows: 105
- Candidate attributes: diameter_mm, material, support_kind
- Candidate ports: none proposed
- Overlaps: fitting.ppr, fitting.sewer.internal, fitting.sewer.low_noise
- Open questions: 17

- [ ] approve
- [ ] revise
- [ ] reject
- [ ] split
- [ ] merge with another class

## tool.mounting — Инструмент для монтажа труб

- Family: `tools`
- Candidate rows: 151
- Candidate attributes: drive_type, supported_diameters, tool_kind
- Candidate ports: none proposed
- Overlaps: none proposed
- Open questions: 0

- [ ] approve
- [ ] revise
- [ ] reject
- [ ] split
- [ ] merge with another class

## valve.ball — Кран шаровой

- Family: `valves`
- Candidate rows: 283
- Candidate attributes: body_material, coating, handle_type, pressure_class
- Candidate ports: thread_1, thread_2
- Overlaps: fitting.compression, fitting.ppr, valve.shutoff
- Open questions: 92

- [ ] approve
- [ ] revise
- [ ] reject
- [ ] split
- [ ] merge with another class

## valve.shutoff — Запорная и регулирующая арматура

- Family: `valves`
- Candidate rows: 368
- Candidate attributes: body_material, control_type, valve_kind
- Candidate ports: connection_1, connection_2
- Overlaps: fitting.brass.threaded, fitting.compression, fitting.ppr, manifold, valve.ball
- Open questions: 87

- [ ] approve
- [ ] revise
- [ ] reject
- [ ] split
- [ ] merge with another class
