# Шаг 1 — подготовка заявки

Используй только приложенные `request-annotation-kit.json` и исходную заявку
(PDF, DOCX, XLSX, текст или иной доступный формат). Не обращайся к GitHub,
web, catalog data или внешним источникам. Kit — единственный источник
допустимых `class_id` и contracts.

Создай два скачиваемых UTF-8 JSON-файла: `request-source.json` и
`request-selected-kit.json`. Их точные обязательные top-level structures
заданы ниже; другие файлы или schemas не нужны.

### Форма `request-source.json`

```json
{
  "kind": "request_source",
  "source_file": "<имя исходного файла>",
  "line_count": 1,
  "lines": [
    {
      "line_id": "1",
      "raw_text": "<исходный текст товарной позиции>",
      "quantity_raw": null,
      "source_position": {
        "page": 1
      }
    }
  ]
}
```

Обязательны ровно четыре top-level поля: `kind`, `source_file`,
`line_count`, `lines`; никаких других top-level fields. В каждой
строке обязательны `line_id`, `raw_text`, `quantity_raw`;
`source_position` optional. `quantity_raw` имеет тип string или `null`.
Всегда `line_count === lines.length`.

### Форма `request-selected-kit.json`

```json
{
  "kind": "request_selected_annotation_kit",
  "source_kit_version": "<fullKit.kit_version>",
  "taxonomy_version": "<fullKit.taxonomy_version>",
  "annotation_schema_version": "<fullKit.annotation_schema_version>",
  "bundle_schema_version": "<fullKit.bundle_schema_version>",
  "root_schema_id": "<fullKit.root_schema_id>",
  "selected_class_ids": [],
  "line_candidates": [],
  "unsupported_lines": [],
  "taxonomy": {},
  "class_schema_ids": {},
  "schemas_by_id": {}
}
```

Эти 12 top-level полей обязательны, другие top-level fields
запрещены. `source_kit_version` копируется из `fullKit.kit_version`;
`taxonomy_version`, `annotation_schema_version`, `bundle_schema_version` и
`root_schema_id` копируются из одноимённых полей full kit.
`taxonomy.class_count` равен количеству selected classes, а
`taxonomy.classes` содержит только selected classes.
`class_schema_ids` содержит только selected classes. Schemas копируются
из full kit без semantic изменений; dispatcher изменяется только
фильтрацией `oneOf`.

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

Для каждой source line создай ровно один routing entry: либо `line_candidates` с тем же `line_id` и 1–3 уникальными production class ids, либо `unsupported_lines` с `line_id` и `reason_code` (`NO_TAXONOMY_CLASS`, `AMBIGUOUS_CLASS`, `UNCLASSIFIABLE_SOURCE`). Эти массивы образуют XOR-покрытие всех source lines в исходном порядке внутри каждой проекции. Уверенный выбор означает
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

Если одна или несколько строк не представимы taxonomy, сохрани их в source и `unsupported_lines`, честно укажи reason code, продолжи routing остальных строк и обязательно выдай оба файла. Не подставляй ближайший класс. Пустые `selected_class_ids`, `line_candidates` и `class_schema_ids` допустимы для полностью unsupported заявки; dispatcher всё равно сохраняет production unsupported ref. Остановить весь шаг можно лишь когда документ в целом нельзя надёжно прочитать или выделить его товарные позиции. На этом шаге запрещены semantic annotation,
canonicalization, matching, подбор товара и создание `request_bundle`.
