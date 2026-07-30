# ADR-0001: границы домена matching

**Статус:** accepted · **Режим:** design-first · **Контракт:** pilot-1.0.0

## Решение

Пилот использует четыре раздельные проекции, а не универсальный `Product`.

* **TechnicalProduct** — `class_id`, технические `attributes`, `ports` и annotation status. В нём никогда нет цены, остатка, supplier SKU, GTIN, `catalog_id`, пользовательского решения или результата.
* **ProductIdentity** — `brand`, `manufacturer`, `manufacturer_articles`, `models`, `series`. Это не предложение; в пилоте у него нет `product_id`. Технически одинаковые товары разных изготовителей автоматически не сливаются.
* **CatalogOffer** — коммерческая строка конкретного прайса: catalog record ID, `catalog_id`, source SHA-256, `source_item_id`, `raw_name`, supplier SKU, GTIN, цена, валюта, остаток, единица и `raw_fields`. Собственной технической классификации у него нет. Стабильная ссылка — тройка `catalog_record_id + source_item_id + source_sha256`; `offer_id` запрещён.
* **RequestRequirement** — проекция строки заявки: `line_id`, `raw_text`, `class_id`, `requested_identity`, `constraints`, `substitution_statement`, quantity и annotation status.

Композиция строго направлена: catalog bundle → TechnicalProduct + ProductIdentity + CatalogOffer; request bundle → RequestRequirement; эти проекции вместе с MatchingPolicy → неизменяемый MatchResult.

## Вычисление и решение оператора

MatchResult — воспроизводимый снимок вычисления. `confirmed`, `selected`, `selected_candidate`, `accepted`, `rejected_by_operator`, `operator_comment`, `manual_override`, score-поля, `product_id` и `offer_id` запрещены. Будущие подтверждение и ручной выбор принадлежат отдельному `SelectionState`, который не является частью этого PR. Изменение правил создаёт новый MatchResult с новым fingerprint, а не мутирует старый.

## Последствия

Коммерческие строки разных прайсов остаются разными предложениями; цена и остаток не загрязняют техническую модель. Matcher и UI намеренно не реализованы: ADR утверждает границы для следующего PR.
