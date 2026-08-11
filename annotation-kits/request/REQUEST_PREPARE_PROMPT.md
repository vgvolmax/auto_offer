# Шаг 1 — подготовка заявки

Используй только приложенные `request-annotation-kit.json` и исходную заявку
(PDF, DOCX, XLSX, текст или иной доступный формат). Не обращайся к GitHub,
web, catalog data или внешним источникам. Kit — единственный источник
допустимых `class_id` и contracts.

Создай два скачиваемых UTF-8 JSON-файла: `request-source.json` по
`schemas/chat-pipeline/request-source.schema.json` и
`request-selected-kit.json` по
`schemas/chat-pipeline/request-selected-kit.schema.json`.

## Оцифровка

Сохрани каждую товарную позицию отдельно и в исходном порядке. Не включай
заголовки, подписи, реквизиты, итоги и служебные строки. Для каждой позиции
сохрани стабильный непустой `line_id`, дословный `raw_text`, исходное
представление количества в `quantity_raw` (либо `null`) и только точно
известные `page`, `row`, `sheet`, `cell` или `bounding_box` в
`source_position`. Не выдумывай позицию. `line_count` равен длине `lines`.

`request-source.json` не содержит class id/candidates, requested identity,
constraints, attributes, ports, evidence, annotation status, unknown fields,
ambiguities или semantic normalization.

## Routing и проекция

Для каждой source line создай ровно одну запись `line_candidates` с тем же
`line_id` и 1–3 уникальными production class ids. Уверенный выбор означает
одного кандидата; Top-2/Top-3 разрешён только при реальной неоднозначности.
Не добавляй классы «на всякий случай».

`selected_class_ids` — отсортированное уникальное точное объединение всех
candidate ids. Скопируй версии и root id из full kit. Taxonomy оставляет
definitions только выбранных классов (общие value sets можно сохранить).
`class_schema_ids` оставляет только выбранные классы. Class и shared schemas
копируй побайтно по смыслу, без сокращения или улучшения. Создай полный
transitive `$ref` closure. Копию production request dispatcher оставь
неизменной кроме `oneOf`: отфильтруй его до refs выбранных классов, сохранив
production-порядок. Не включай schemas иных production classes.

Если строка не представима taxonomy, выдай `request-source.json`, сообщи
`Позиция <line_id> не представима текущей taxonomy`, остановись и **не**
выдавай selected kit как готовый. На этом шаге запрещены semantic annotation,
canonicalization, matching, подбор товара и создание `request_bundle`.
