# Шаг 1 — извлечение source и routing заявки

Используй только:

- приложенный `taxonomy-light.json`;
- исходную заявку.

Не используй `request-annotation-kit.json`, full taxonomy, GitHub, web, catalog data или внешние источники. Создай ровно два скачиваемых UTF-8 JSON-файла: `request-source.json` и `request-routing.json`. **Не создавай `request-selected-kit.json`** и никакие другие файлы.

## Точная форма `request-source.json`

```json
{
  "kind": "request_source",
  "source_file": "request.pdf",
  "line_count": 1,
  "lines": [
    {
      "line_id": "1",
      "raw_text": "Наименование: ... | Модель: ... | Производитель: ... | Примечание: ...",
      "quantity_raw": "20 шт",
      "source_position": { "page": 1, "row": 2 }
    }
  ]
}
```

Обязательны ровно четыре top-level поля: `kind`, `source_file`, `line_count`, `lines`; других top-level fields нет. В каждой строке обязательны `line_id`, `raw_text`, `quantity_raw`; `source_position` optional. `quantity_raw` — string или `null`. Всегда `line_count === lines.length`.

## Оцифровка без потерь

Сохрани каждую товарную позицию отдельно, в исходном порядке и со стабильным уникальным `line_id`. Не включай заголовки, подписи, реквизиты, итоги и служебные строки. Для каждой позиции сохрани дословный `raw_text`, исходное представление количества в `quantity_raw` и только точно известные `page`, `row`, `sheet`, `cell` или `bounding_box` в `source_position`. Не выдумывай позицию.

Для таблицы товарная позиция — **вся логическая строка таблицы**, а не только колонка «Наименование». Сохрани в одном `raw_text` все непустые product-defining cells: «Наименование», «Тип/марка», «Модель», model/article, «Артикул», «Код изделия», «Производитель», «Изготовитель», manufacturer, «Бренд», «Стандарт», «ГОСТ», «ТУ», исполнение, материал, размер, характеристики, описание, «Примечание», note, дополнительные требования и другие соседние product-defining cells. Перечень не является whitelist.

Используй lossless serialization: сохраняй значения дословно, доступные исходные названия колонок и их порядок, соединяя пары стабильным разделителем ` | `. Запрещены semantic rewrite, сокращение, исправление обозначений, нормализация моделей или артикулов. Нельзя создавать `raw_text` только из значения «Наименование», если в той же строке есть другие product-defining values.

Сохраняй substitution wording («или эквивалент», «или аналог», «замена допускается/не допускается», «строго указанная марка») дословно, без интерпретации. Количество остаётся отдельно в `quantity_raw`; не переноси его в semantic interpretation. Если число и единица в разных ячейках, объедини их без conversion (`"20 шт"`).

Повторяющиеся или параллельные страницы/секции читай независимо. Даже если две таблицы почти одинаковы, каждую конкретную source row прочитай заново. Запрещено копировать или переносить semantic values из похожей строки предыдущей страницы/секции. Различия конкретных строк должны сохраниться дословно. Если source действительно содержит две одинаковые товарные строки, не дедуплицируй их: сохрани обе отдельными source lines.

`request-source.json` не содержит class candidates, requested identity, constraints, attributes, ports, evidence, annotation status, unknown fields, ambiguities или semantic normalization.

## Точная форма `request-routing.json`

```json
{
  "kind": "request_routing",
  "schema_version": "1.0.0",
  "taxonomy_version": "1.0.0",
  "source_file": "request.pdf",
  "line_count": 3,
  "routes": [
    { "line_id": "1", "decision": "candidates", "class_ids": ["fitting.ppr"] },
    { "line_id": "2", "decision": "candidates", "class_ids": ["valve.ball", "valve.shutoff.generic"] },
    { "line_id": "3", "decision": "unsupported", "reason_code": "NO_TAXONOMY_CLASS" }
  ]
}
```

Для каждой `request-source` line существует ровно один route entry, а порядок `routes` точно совпадает с source lines. `source_file` и `line_count` совпадают с source; `taxonomy_version` совпадает с `taxonomy-light.json`.

Candidate field называется **ровно `class_ids`**. Aliases `candidate_class_ids`, `candidate_ids`, `classes`, `class_candidates` запрещены и downstream validator их не исправляет. Для уверенной классификации используй `{ "decision": "candidates", "class_ids": ["..."] }`, обычно с одним id. Top-2/Top-3 допустимы только при реальной неоднозначности production classes; не добавляй классы «на всякий случай».

Возвращай только `class_id`, буквально присутствующие в `taxonomy-light.json`. Не придумывай новый class, alias, parent class, family вместо class или похожий id. `family_id`, `name_ru`, `definition_ru`, `include_rules_ru`, `exclude_rules_ru` служат только для semantic routing. Общего лимита числа taxonomy classes нет; лимит 1–3 относится лишь к одной source line. Не возвращай confidence.

Для unsupported разрешены только:

- `NO_TAXONOMY_CLASS` — среди production classes действительно нет класса для этого типа товара; отсутствие optional attribute класса не является этой причиной;
- `AMBIGUOUS_CLASS` — товар понятен, но source недостаточно, чтобы честно выбрать между несколькими class semantics;
- `UNCLASSIFIABLE_SOURCE` — сама строка настолько неполна, повреждена или непонятна, что тип товара определить нельзя.

Routing выбирает класс, а не выполняет полную semantic annotation. `request-routing` НЕ содержит `raw_text`, quantity, `requested_identity`, attributes, ports, constraints, evidence, `unknown_fields`, ambiguities, annotation status, substitution policy, catalog item, product, offer или matching result. Это только source line → class routing.

## Обязательная финальная самопроверка

Перед созданием JSON проверь:

1. `line_count === lines.length`;
2. все `line_id` уникальны;
3. товарные строки идут в source order;
4. для таблиц `raw_text` содержит всю logical product row;
5. model/article/manufacturer/note не потеряны;
6. quantity не перенесено в semantic interpretation;
7. repeated/parallel sections прочитаны независимо, без copy-forward из похожей строки другой страницы;
8. `routes` покрывают source lines ровно один раз и в том же порядке;
9. каждый candidate использует exact `class_ids` и только ids из `taxonomy-light.json`.
