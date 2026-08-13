# SEMANTIC MATCHING — новый изолированный чат

Начни новый чат. Используй **ТОЛЬКО** два приложенных JSON-файла: `request_bundle.json` и `semantic-matching-catalog.json`. Никаких других файлов, web, GitHub, внешних каталогов или памяти о товарах. Результат — только один JSON object для `semantic-match-result.json`, без Markdown fences, комментариев или текста до/после JSON.

## Неприкосновенные данные

Не создавай товары, SKU или идентификаторы. Каждый `offer_ref` (`catalog_record_id` + `source_item_id`) буквально скопируй из matching catalog. Не возвращай цену, название, SKU, catalog SHA, нормализованные атрибуты, model/provider metadata, `confidence`, score или candidate list. Не исправляй входные JSON.

Скопируй `taxonomy_version`, `request_id`, `package_fingerprint`; используй `kind: "semantic_match_result"` и `schema_version: "1.0.0"`.

## Каждая строка

Покрой **every line** ровно один раз и в **exact order** `request_document.lines`. `needs_review` → `request_review_required`; `invalid` → `request_invalid`; `unsupported` → `request_unsupported`.

Для `validated` используй только items **того же class_id**. Проверь explicit identity, attributes, ports, constraints и substitution meaning. Верни один лучший `offer`, либо `no_offer`, либо `reroute_required`, не candidate list. Не считай отсутствующее значение совпадением; не додумывай diameter/thread/material/manufacturer/brand; не игнорируй explicit mismatch, не подменяй product type и не считай текстовую похожесть достаточной. Недостаток evidence может дать `CATALOG_DATA_INSUFFICIENT`, но не invented item.

## Match levels

`exact`: все product-defining требования совпадают без meaningful difference. `equivalent`: отличие сохраняет техническую эквивалентность и разрешено substitution policy. `alternative`: допустимая замена с meaningful difference. Не превышай `selection_policy.max_match_level` (`exact` < `equivalent` < `alternative`). Tie break: preferred brand, `catalog_priority`, source order. Не оптимизируй цену без explicit price condition.

## NO OFFER / REROUTE REQUIRED

**NO OFFER**: class/pool правильны, товара нет. Используй `NO_ELIGIBLE_OFFER`, `NO_TECHNICAL_MATCH`, `POLICY_EXCLUDED` или `CATALOG_DATA_INSUFFICIENT`.

**REROUTE REQUIRED**: понятной строке назначен явно неправильный class/slice. Только тогда `reroute_required` + `ROUTING_INSUFFICIENT`; не используй reroute лишь из-за отсутствия товара.

## Output

Один strict JSON object, every line, exact order, без aliases/additional fields. Offer: `line_id`, `decision`, `offer_ref`, `match_level`, `rationale_ru`, `differences_ru`. No-offer/reroute: contract reason и `rationale_ru`. Никаких markdown fences.
