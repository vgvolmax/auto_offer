# Шаг 2 — semantic annotation заявки

Выполни инструкцию в **новом чате**, используя только приложенные
`request-source.json` и `request-selected-kit.json`. Не используй исходный
PDF, full request kit, GitHub, web, catalog data или внешние источники.

Создай скачиваемый UTF-8 файл `request.<request_id>.json`: обычный production
`request_bundle`, валидный по `root_schema_id` и embedded `schemas_by_id`
selected kit. Это промежуточный kit, а не новый production contract.
Production root: `https://example.local/schemas/bundles/request-bundle.schema.json`.

Сохрани все строки, их порядок и `line_id`; источником фактов служит только
`request-source.lines[].raw_text`. Для routed-строки разрешены исключительно class ids из соответствующей `line_candidates` записи. При одном кандидате используй
его, если он соответствует строке; при нескольких выбери только среди них по
`raw_text`. Не ищи иной класс.

Для каждой записи `unsupported_lines` создай production unsupported request line: сохрани `line_id`, `raw_text`, доступную `source_position` и честно canonicalized `quantity`; annotation содержит только `status: "unsupported"` и переданный `reason_code`. Не добавляй `class_id`, `requested_identity`, `constraints` или `substitution_statement`. Если Top-2/Top-3 после полной проверки нельзя честно разрешить, также допустим unsupported с `AMBIGUOUS_CLASS`; при недостаточном source — `UNCLASSIFIABLE_SOURCE`. Не подменяй это `needs_review` с произвольным классом.

Canonicalize quantity на этом шаге по production rules. Формируй
`requested_identity`, sparse constraints, attributes и ports только из явно
указанных данных. Evidence может цитировать только request source. Оформляй
unknown, ambiguity и `substitution_statement` по неизменным production rules;
не придумывай отсутствующие характеристики. При отсутствии явно написанного
разрешения/запрета замены используй ровно
`{"policy":"unspecified","explicit":false,"raw_text":null}`. Не выполняй
matching или подбор, не создавай `product_id` или `offer_id`.

До выдачи программно проверь обычный production bundle. Если routing не покрывает source line ровно один раз, candidate отсутствует в selected
kit, kit неполон или полный bundle построить нельзя — остановись, назови
конкретную проблему и `line_id`, не создавая правдоподобный частичный файл.

После файла сообщи только line count и количества `validated`, `needs_review`, `invalid` и `unsupported`. Финальной инстанцией истины остаётся внешний запуск
`npm run validate:request-bundle -- <file>`.
