# Нормативные схемы AI-разметки

**Статус:** архитектурный контракт v1  
**Связанный документ:** `ARCHITECTURE_SPEC_LOCAL_PRODUCT_MATCHER.md`

## 1. Назначение

Этот документ фиксирует форматы, которые внешний ИИ-разметчик имеет право возвращать. ИИ не выполняет сопоставление с каталогом и не возвращает `product_id`, `offer_id`, `match_level`, similarity score или рекомендации.

Нормативными являются JSON Schema в `schemas/annotation/`. Примеры в архитектурном ТЗ поясняют контракты, но не заменяют схемы.

## 2. Два прохода разметки заявки

### Проход A: сегментация документа

Вход: документ или его распознанное содержимое.  
Выход: `document-segmentation.schema.json`.

ИИ определяет `document_type`, выделяет сегменты и помечает каждый как `product_line`, `customer_details`, `heading`, `note`, `table_header` или `other`. Для товарной строки MAY вернуть до пяти кандидатов `class_id` с confidence.

Этот проход не извлекает полную техническую спецификацию.

### Проход B: class-specific разметка

Для каждого сегмента `product_line` оркестратор выбирает один `class_id` либо отправляет строку на проверку. ИИ получает:

- raw text;
- taxonomy version;
- выбранный `class_id`;
- class-specific schema;
- canonical value sets;
- правила unknown, ambiguity и evidence.

Выход каждой строки обязан проходить базовую и class-specific JSON Schema.

## 3. Разметка каталога

Базовый контракт: `catalog-item-annotation.base.schema.json`.

Class-specific контракт задает:

- точный `class_id` через `const`;
- разрешенные и обязательные attributes;
- число, роли и типы ports;
- canonical enum values;
- типы размеров и единиц.

ИИ возвращает только identity и техническую аннотацию. Цена, прайс-пул, availability, решение о слиянии строк и `product_id` формируются детерминированным catalog-builder.

## 4. Разметка заявки

Базовые контракты:

- `request-document.base.schema.json`;
- `request-line-annotation.base.schema.json`.

В `constraints` присутствуют только явно заданные заказчиком ограничения. Отсутствие поля означает «ограничение не задано», а не `unknown` и не wildcard-значение.

ИИ извлекает оператор только из текста: `eq`, `neq`, `in`, `gte`, `lte`, `between`, `contains_all`, `contains_any`.

## 5. Нормативная семантика неизвестных значений

Используются следующие правила:

1. Неизвестное значение не записывается выдуманным canonical value.
2. Неизвестный ожидаемый path добавляется в `annotation.unknown_fields`.
3. Если есть две или более правдоподобные интерпретации, создается `annotation.ambiguities[]`, а status становится `needs_review`.
4. JSON `null` используется только в полях, где schema явно допускает `null`, прежде всего в необязательной identity.
5. В `constraints` запрещены `null`-ограничения. Неизвлеченное ограничение отсутствует.
6. Значение со status `needs_review` не участвует в автоматическом matching.

## 6. Статусы разметки

Для каталога и заявки используется единый набор:

- `validated` — схема и семантические проверки пройдены, automatic matching разрешен;
- `needs_review` — JSON загружается для диагностики, matching блокируется для элемента;
- `invalid` — JSON не может быть принят production pipeline.

`annotation.issues[]` всегда содержит блокирующие проблемы, а
`annotation.warnings[]` — только неблокирующие предупреждения. Поле `blocking` у issue
не существует. Поэтому `validated` требует пустого `issues[]` и отсутствия blocking
ambiguities; `needs_review` требует unknown field, issue или blocking ambiguity; а
`invalid` требует хотя бы один issue.

`deprecated` является статусом сущности каталога, но не статусом AI-аннотации.

## 7. Evidence

Каждое присутствующее AI-derived значение MUST иметь evidence с:

- `json_pointer` по RFC 6901;
- точным `source_text`;
- source coordinates, если они доступны;
- `raw_value`, когда normalization меняет представление.

Evidence является трассировкой и не участвует в matching.

## 8. Class-specific schemas

Базовые схемы намеренно не разрешают считать произвольный объект attributes достаточной разметкой. Для каждого активного product class MUST существовать две сгенерированные схемы:

```text
schemas/annotation/class-specific/<class_id>.catalog.schema.json
schemas/annotation/class-specific/<class_id>.request.schema.json
```

Первая проверяет каталог, вторая — ограничения заявки. Источником генерации служит `taxonomy.json`; ручное расхождение taxonomy и class-specific schema запрещено.

В репозитории зафиксирован первый эталонный класс:

```text
fitting.adapter.ppr.male_thread
```

Он служит шаблоном генератора, но не означает, что остальные классы могут использовать его поля.

## 9. Дополнительные семантические проверки

JSON Schema дополняется детерминированным validator:

- каждый evidence `json_pointer` существует в аннотации;
- каждый unknown path допустим для класса и отсутствует среди известных значений;
- ambiguity path допустим для класса;
- `validated` запрещен при непустом списке blocking ambiguities;
- supplier SKU и manufacturer article не выводятся из технических параметров; catalog GTIN вообще не входит в AI-аннотацию;
- denominator рационального размера резьбы больше нуля;
- дробь резьбы приводится к несократимому виду catalog-builder/normalizer;
- роли ports уникальны, если class schema не объявляет повторяемую роль;
- fixed values класса совпадают с результатом.

## 10. Критерий фиксации схемы класса

Класс считается готовым к массовой AI-разметке только при наличии:

1. taxonomy definition;
2. catalog class-specific schema;
3. request class-specific schema;
4. минимум трех valid fixtures;
5. fixtures для unknown и ambiguity;
6. invalid fixtures для лишних полей, неверных port roles и неверных типов;
7. golden prompt/output tests.

## Annotation contract 1.1.0 (normative)

### Validity and matching sufficiency

**Annotation validity** means that the annotation faithfully reflects the source document. **Matching sufficiency** means that the extracted characteristics are sufficient for deterministic matching. These are independent: a request such as `Муфта PPR 32×1"` MAY be `validated` while omitting an unmentioned `thread_standard`; a future matcher MAY report `insufficient_data`. The AI MUST NOT infer `G` or any other domain default. An ambiguous stated value requires `needs_review`, a blocking ambiguity, and blocks automatic processing.

Annotation status is exactly `validated`, `needs_review`, or `invalid`; `deprecated` is a product lifecycle status only. All diagnostic field references use RFC 6901 JSON Pointer (for example `/constraints/ports/0/pipe_outer_diameter_mm`). Stable issue `code` values, not localized messages, are the programmatic interface.

### Typed constraint algebra

Constraint shape is selected by its operator: `eq`/`neq` use `value`; `in` uses a non-empty unique `values` array; numeric `gte`/`lte` use `value`; inclusive `between` uses `min` and `max`; and set operators `contains_all`/`contains_any` use `values`. Enum and identifier constraints allow `eq`, `neq`, `in`; numbers additionally allow `gte`, `lte`, `between`; rational inches allow `eq`, `neq`, `in`. The semantic validator enforces `min <= max` and reduced rational inches.

`requested_identity` is sparse and contains only explicitly requested `brand`, `manufacturer`, `manufacturer_article`, `model`, `gtin`, or `supplier_sku` constraints. `{}` means no identity was requested. The former required-null identity representation is incompatible with 1.1.0.

### Dispatch, partial annotations, and provenance

Production validation MUST enter through the generated registry dispatcher; base schemas are building blocks only. Every class has catalog and request schemas with a matching `class_id` constant. Catalog critical fields are required conditionally for `validated`; `needs_review` may be partial when every gap is diagnosed, and `invalid` requires an issue.

Evidence MUST exist for every present AI-derived value; fixed-by-class and deterministic imported values are exempt. An implicit substitution statement (`explicit: false`, `policy: unspecified`, `raw_text: null`) has no source evidence and requires none; an explicit non-`unspecified` policy with its source `raw_text` requires evidence. Canonical brand/manufacturer IDs are taxonomy values, while original spelling belongs in evidence. Identifier normalization is deterministic and configured by `normalizer_id`, never invented by AI. Structured GTIN and supplier SKU columns are imported directly by the catalog builder; GTIN shape and checksum are validated.

## Barcode and GTIN scope

The application does not decode barcode images and does not use a camera, scanner,
OCR, ZXing, or any other graphical barcode-recognition library.

Catalog GTIN values and supplier SKUs are imported deterministically from configured
spreadsheet columns into `structured_identifiers`; they are not fields of an AI catalog
annotation and AI MUST NOT copy, normalize, repair, or assess them. Spreadsheet cells
MUST be read as text without floating-point conversion, so leading zeroes are retained.
A request GTIN may be extracted only when all digits are explicitly present in textual
document content. AI MUST NOT reconstruct damaged digits. An invalid printed request
GTIN requires `needs_review`; GTIN is optional and its absence does not affect validity.

GTIN is an optional exact-identity identifier. It is not a technical attribute and does
not participate in `technical_key`, class selection, equivalent, or alternative matching.
An invalid or conflicting catalog GTIN produces an identifier-scoped data-quality warning
and is excluded only from the exact GTIN index; the product, offer, other identity indexes,
and validated technical annotation remain eligible. A valid unique GTIN yields `exact`,
while multiple products yield `catalog_data_conflict` rather than an automatic choice.

Quantity is optional for technical matching. If present, its unit is a canonical taxonomy value (`piece`, `meter`, `set`, `package`, or `coil`); source spellings belong in evidence. Segmentation parent and context references allow inherited heading/table facts, whose evidence points to the originating segment.

### Migration 1.0.0 → 1.1.0

Migrate dotted paths to RFC 6901 pointers, string warnings to coded issue objects, `in.value` to `in.values`, range values to `min`/`max`, and required-null request identity to a sparse object. Update status to the three-value annotation vocabulary, make quantity optional, enforce substitution consistency, and validate via the generated class dispatcher plus semantic validator. This is an intentionally incompatible request-identity migration.
