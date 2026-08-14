# SEMANTIC MATCHING — новый изолированный чат

Начни новый чат. Используй **ТОЛЬКО** два приложенных JSON-файла: `request_bundle.json` и `semantic-matching-catalog.json`. Никаких других файлов, web, GitHub, внешних каталогов или памяти о товарах. Результат — только один JSON object для `semantic-match-result.json`, без Markdown fences, комментариев или текста до/после JSON.

## Неприкосновенные данные

Не создавай товары, SKU или идентификаторы. Каждый `offer_ref` (`catalog_record_id` + `source_item_id`) буквально скопируй из matching catalog. Не возвращай цену, название, SKU, catalog SHA, нормализованные атрибуты, model/provider metadata, `confidence`, score или candidate list. Не исправляй входные JSON.

Скопируй `taxonomy_version`, `request_id`, `package_fingerprint`; используй `kind: "semantic_match_result"` и `schema_version: "1.0.0"`.

## Каждая строка

Покрой **every line** ровно один раз и в **exact order** `request_document.lines`. `validated` и `needs_review` участвуют в matching и для них допустимы `offer`, `no_offer` или `reroute_required`; `invalid` → `request_invalid`; `unsupported` → `request_unsupported`. `request_review_required` остаётся только legacy-формой и не используется новым flow для `needs_review`.

## needs_review participates in matching

`needs_review` — это качество/неполнота annotation, а не exclusion. Рассматривай товары и строки со статусами `validated` и `needs_review` наравне. Для них используй только items **того же class_id**. Проверь explicit identity, attributes, ports, constraints и substitution meaning. Верни один лучший `offer`, либо `no_offer`, либо `reroute_required`, не candidate list. Допустимым evidence при matching являются `source.raw_name`, `source.raw_fields`, `identity`, `attributes`, `ports` и `annotation_review`. `source.raw_name/raw_fields are valid evidence`: если normalized field отсутствует, но значение явно написано в source, используй его. Например, «Муфта комбинированная PPR наружная резьба 20x1/2» явно подтверждает PPR 20 и male thread 1/2 даже при потерянном normalized port. Но отсутствие значения одновременно в semantic fields и source запрещено трактовать как совпадение.

Не считай отсутствующее значение совпадением; не додумывай diameter/thread/material/manufacturer/brand; не игнорируй explicit mismatch, не подменяй product type и не считай текстовую похожесть достаточной. Недостаток evidence может дать `CATALOG_DATA_INSUFFICIENT`, но не invented item.

## Match levels

**match_level != annotation quality**: `match_level` характеризует соответствие товара заявке, а не качество annotation. Не понижай уровень автоматически по правилу `needs_review => alternative`. Товар `needs_review` может быть `exact`, если source или semantic fields однозначно подтверждают все требования конкретной заявки; неполнота по иному признаку остаётся отдельным предупреждением качества данных.

`exact`: все product-defining требования совпадают без meaningful difference. `equivalent`: отличие сохраняет техническую эквивалентность и разрешено substitution policy. `alternative`: допустимая замена с meaningful difference. Не превышай `selection_policy.max_match_level` (`exact` < `equivalent` < `alternative`). Tie break: preferred brand, `catalog_priority`, source order. Не оптимизируй цену без explicit price condition.

## NO OFFER / REROUTE REQUIRED

**NO OFFER**: class/pool правильны, товара нет. Используй `NO_ELIGIBLE_OFFER`, `NO_TECHNICAL_MATCH`, `POLICY_EXCLUDED` или `CATALOG_DATA_INSUFFICIENT`.

**REROUTE REQUIRED**: понятной строке назначен явно неправильный class/slice. Только тогда `reroute_required` + `ROUTING_INSUFFICIENT`; не используй reroute лишь из-за отсутствия товара.

## Output

Верни один strict JSON object следующей top-level формы:

```json
{
  "kind": "semantic_match_result",
  "schema_version": "1.0.0",
  "taxonomy_version": "<copy exactly>",
  "request_id": "<copy exactly>",
  "package_fingerprint": "<copy exactly>",
  "lines": []
}
```

Единственное поле массива результатов называется `lines`. Не используй `results`, `items`, `matches`, `decisions` или другие aliases. Покрой every line в exact order. Никаких additional fields.

Допустимы ровно четыре формы строки.

**Offer** — никаких полей, кроме показанных:

```json
{
  "line_id": "32",
  "decision": "offer",
  "offer_ref": {
    "catalog_record_id": "catalog-1",
    "source_item_id": "item-1"
  },
  "match_level": "exact",
  "rationale_ru": "Технические характеристики совпадают.",
  "differences_ru": []
}
```

**No offer**:

```json
{
  "line_id": "33",
  "decision": "no_offer",
  "reason_code": "NO_TECHNICAL_MATCH",
  "rationale_ru": "Подходящего товара нет."
}
```

**Reroute**:

```json
{
  "line_id": "34",
  "decision": "reroute_required",
  "reason_code": "ROUTING_INSUFFICIENT",
  "rationale_ru": "Строка направлена в неверный класс."
}
```

**Passthrough**:

```json
{
  "line_id": "35",
  "decision": "request_unsupported"
}
```

В passthrough значение `decision` — одно из `request_review_required`, `request_invalid`, `request_unsupported`. Passthrough содержит **только** `line_id` и `decision`: запрещены `rationale_ru`, `reason_code`, `differences_ru`, `offer_ref`, `match_level` и любые другие поля.

## Canonical output example

Следующий цельный пример имеет production-valid форму. В реальном результате буквально скопируй метаданные и идентификаторы из входных файлов и верни JSON без Markdown fences.

```json
{
  "kind": "semantic_match_result",
  "schema_version": "1.0.0",
  "taxonomy_version": "1.0.0",
  "request_id": "request-example",
  "package_fingerprint": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  "lines": [
    {
      "line_id": "32",
      "decision": "offer",
      "offer_ref": {
        "catalog_record_id": "catalog-1",
        "source_item_id": "item-1"
      },
      "match_level": "exact",
      "rationale_ru": "Технические характеристики совпадают.",
      "differences_ru": []
    },
    {
      "line_id": "33",
      "decision": "no_offer",
      "reason_code": "NO_TECHNICAL_MATCH",
      "rationale_ru": "Подходящего товара нет."
    },
    {
      "line_id": "34",
      "decision": "reroute_required",
      "reason_code": "ROUTING_INSUFFICIENT",
      "rationale_ru": "Строка направлена в неверный класс."
    },
    {
      "line_id": "35",
      "decision": "request_unsupported"
    }
  ]
}
```
