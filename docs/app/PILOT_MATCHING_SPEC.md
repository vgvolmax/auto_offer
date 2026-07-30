# Pilot Matching Specification 1.0

Нормативные слова «должен», «запрещён» и «только» обязательны. Версии engine/registry: `pilot-1.0.0`.

## Входы и проекции

Входы — один production request bundle, выбранные production catalog bundles, session matching policy и `matching/policies/pilot-v1.json`. Проекции и их границы определены ADR-0001. Выход — только `match_result`; SelectionState находится вне вычисления.

## Алгоритм строки

1. Проверить annotation status заявки: любой статус кроме `validated` даёт `request_review_required` и `REQUEST_REVIEW_REQUIRED` без автоматических кандидатов.
2. Выбрать позиции с тем же `class_id`.
3. Отклонить `invalid`; `needs_review` обработать политикой каталога.
4. Проверить technical constraints.
5. Проверить `requested_identity`.
6. Зафиксировать technical match level.
7. Применить catalog scope и brand include/exclude/unknown.
8. Применить effective maximum level.
9. Сортировать кандидатов.
10. Сформировать resolution, checks, differences и rejection summary.

Фильтры сессии не меняют уже вычисленный match level. Технически подходящие, но исключённые позиции сохраняются в `excluded_candidates`.

## Constraints

Для string/enum: `eq` означает равенство, `neq` — различие, `in` — членство в списке. Для number: `eq`, `neq`, `gte`, `lte` сравнивают числа без строкового преобразования. Rational inch сравнивается математически (`a/b` через числитель и знаменатель), не по JSON или display text. `neq` никогда не ослабляется.

Запрошенное, но отсутствующее catalog value даёт `CATALOG_VALUE_MISSING`; hard constraint отклоняет. Незапрошенное отсутствие игнорируется. Ports соединяются по `role`, не индексу: для каждого request port ищется та же role и проверяются его поля. Отсутствующая role даёт `PORT_ROLE_MISSING`; inlet/outlet не переставляются.

## Уровни

* **exact**: class совпал, все technical и обязательные identity constraints выполнены, annotation допустим, relaxation не применялся. Незапрошенные различия уровень не снижают.
* **equivalent**: hard compatibility сохранена, а отличие разрешено явным equivalent rule либо положительная identity отличается при разрешённой замене; alternative differences отсутствуют.
* **alternative**: все compatibility-critical constraints выполнены, каждое отличие названо и разрешено явным alternative rule, effective policy разрешает alternatives. Отсутствие exact само по себе alternative не создаёт.
* **rejected**: class mismatch, hard failure/missing value, несовместимый port, invalid annotation или запрещённая замена. `no_match` — resolution строки, не candidate level.

Для `valve.ball`: большее `pressure_class` по порядку pn6, pn10, pn12_5, pn16, pn20, pn25, pn40 является equivalent только при разрешённом equivalent; меньшее отклоняется. Явные различия `handle_type` и `coating` — alternative только при разрешённых alternatives. Структурные hard targets перечислены в registry. Для остальных классов допустимы exact и identity-equivalent; technical mismatch отклоняется, alternative не синтезируется.

## Effective substitution policy

Явное line policy имеет приоритет: `exact_only` → exact; `equivalent_allowed` → exact/equivalent; `alternative_allowed` → все уровни. При `unspecified` применяется session `max_match_level`. Сессия не ослабляет явное ограничение (line exact_only + session alternative = exact_only).

## Session filters и review

Пустой brand include разрешает всё кроме exclude; непустой — только перечисленное. Exclude всегда hard; пересечение include/exclude запрещено. Preferred задаёт лишь порядок и не возвращает исключённый бренд; unknown обрабатывается `allow|exclude`. Кандидат допускается только из `catalog_record_ids`; priority — подмножество/перестановка выбранных record IDs, неизвестные IDs ошибочны.

Catalog `needs_review` по умолчанию исключён. При `manual_only` он возвращается отдельно с availability `manual_only`, не входит в normal eligible и не становится единственным automatic exact. `invalid` всегда rejected.

## Детерминизм, ordering и resolution

Порядок: (1) exact/equivalent/alternative; (2) индекс preferred brand; (3) catalog priority; (4) `catalog_id`; (5) `source_item_id`. Цена, остаток и порядок загрузки bundle не участвуют. Одинаковая техника из двух прайсов — два CatalogOffer.

Resolution закрыт: `single_exact`, `multiple_exact`, `equivalent_only`, `alternative_only`, `excluded_by_policy`, `no_match`, `request_review_required`, `request_invalid`. Checks структурированы scope/target/operator/expected/actual/outcome/effect/code; свободный текст не является единственным объяснением. Закрытый набор codes задан `$defs.reasonCode` match-result schema.

## Fingerprint

Сформировать объект с ключами `request_bundle`, отсортированными canonical-JSON `catalog_refs`, `matching_policy`, `policy_registry_version`, `engine_version`; рекурсивно отсортировать object keys, сохранить порядок остальных массивов, сериализовать JSON без среды-зависимых данных и вычислить SHA-256 lowercase hex. Время, UI state, operator comments и file load order не включаются. Нормативный environment-neutral helper — `scripts/matching/lib/canonical-json.mjs`.

## Ограничения пилота

Нет matcher, AI/hidden score, UI, автоматического выбора, экспорта, price ranking, allocation, package conversion, brand aliases, backend или candidate index. Цена, stock и исходная unit информационны. Policy registry data-driven и versioned; неизвестные поля/версии fail closed.

### Воспроизводимость matching input

`matchingInputFingerprint` — асинхронная browser-compatible операция на Web Crypto
`globalThis.crypto.subtle`. Она канонизирует ключи объектов, нормализует порядок
`catalog_refs` и возвращает lowercase SHA-256 без Node polyfills.

Golden scenario связывает каждый catalog bundle с локальным `catalog_record_id`
через `catalog_inputs`. Ссылка на предложение считается допустимой только по полному
составному ключу `catalog_record_id + catalog_id + source_sha256 + source_item_id`.
`input_fingerprint` в expected result является пересчитываемым контрактным значением,
а не иллюстративным примером; обычная validation сверяет committed значение.
