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

`deprecated` является статусом сущности каталога, но не статусом AI-аннотации.

## 7. Evidence

Каждое технически значимое извлеченное значение SHOULD иметь evidence с:

- `json_path`;
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

- каждый evidence `json_path` существует в аннотации;
- каждый unknown path допустим для класса и отсутствует среди известных значений;
- ambiguity path допустим для класса;
- `validated` запрещен при непустом списке blocking ambiguities;
- supplier SKU, GTIN и manufacturer article не выводятся из технических параметров;
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
