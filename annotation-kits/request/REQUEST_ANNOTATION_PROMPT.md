# Шаг 2 — semantic annotation заявки

Выполни инструкцию в **новом чате**, используя только приложенные
`request-source.json` и `request-selected-kit.json`. Не используй исходный
PDF, full request kit, GitHub, web, catalog data или внешние источники.

Создай скачиваемый UTF-8 файл `request.<request_id>.json`: обычный production
`request_bundle`, валидный по `root_schema_id` и embedded `schemas_by_id`
selected kit. Это промежуточный kit, а не новый production contract.
Production root: `https://example.local/schemas/bundles/request-bundle.schema.json`.

Сохрани все строки, их порядок и `line_id`. `raw_text` — единственный источник
semantic product facts, `quantity_raw` — единственный источник quantity, а
`source_position` — только source location. Не бери факты из памяти, catalog,
web, названия schema или предположений о типовом товаре. Для routed-строки разрешены исключительно class ids из соответствующей `line_candidates` записи. При одном кандидате используй
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

## Статусы и sparse-заявки

Ключевой принцип: **SPARSE REQUEST IS VALID**. Заявка не обязана заполнять все
optional поля schema. Ставь `annotation.status = "validated"`, если `class_id`
определён достаточно уверенно, каждый записанный в output semantic fact
подтверждён source, нет blocking ambiguity и production contract violation, а
фактически написанное заказчиком можно честно представить. Отсутствие
необязательных характеристик этому не мешает.

**Optional missing != unknown.** Если optional property отсутствует в source,
не добавляй её в `unknown_fields` только потому, что она существует в schema.
`unknown_fields` не является checklist всех schema properties, которые не
удалось заполнить: он предназначен только для реально значимого unresolved
source fact, когда существующая production semantics требует указать его как
неизвестный. Поле, вообще не упомянутое source, просто отсутствует. Отсутствие
optional field само по себе не означает `needs_review`.

Используй `needs_review` только при реальной блокирующей неопределённости,
мешающей безопасно представить semantic facts: например, при двух
противоречивых значениях materially important field или когда смысл явно
указанного размера существенно неоднозначен. Ambiguity с `blocking: false`
сама по себе не заставляет ставить `needs_review`; строка может оставаться
`validated`, если неоднозначный факт не записан как constraint, а остальные
факты надёжны. При `blocking: true` строка не может быть `validated`. Если
нельзя честно выбрать production class, используй существующий unsupported
flow с `AMBIGUOUS_CLASS`, а не произвольный `class_id` и `needs_review`.

Не выдумывай отсутствующие характеристики ради `validated`. Например, для
`fitting.ppr` из «Фитинг полипропиленовый - тройник 20 мм» можно записать
подтверждённые материал, construction и диаметры портов, но нельзя выводить
типичный `connection_kind = socket_fusion`. Production schema разрешает sparse
ports: у port обязателен `role`, а `connection_kind` optional, поэтому его
отсутствие не блокирует строку. Аналогично отсутствие `body_material` или
`handle_type` у «Кран шаровый муфтовый, полнопроходной DN25» и отсутствие
`diameter_mm` у «Монтажная направляющая SL-E1 (1м)» не являются причиной
`needs_review`, если source их не задаёт и иной blocking ambiguity нет.

Семантика `invalid` не меняется: используй его при реальном production-contract
conflict или непредставимом сочетании фактов (например, source явно задаёт
трёхходовую геометрию, которую выбранная class schema не может представить).
Не скрывай такой конфликт через `validated`. Unsupported semantics также не
меняется: отсутствие подходящего taxonomy class означает `NO_TAXONOMY_CLASS`,
а невозможность честно выбрать класс — `AMBIGUOUS_CLASS`.

До выдачи программно проверь обычный production bundle. Если routing не покрывает source line ровно один раз, candidate отсутствует в selected
kit, kit неполон или полный bundle построить нельзя — остановись, назови
конкретную проблему и `line_id`, не создавая правдоподобный частичный файл.

После файла сообщи только line count и количества `validated`, `needs_review`, `invalid` и `unsupported`. Финальной инстанцией истины остаётся внешний запуск
`npm run validate:request-bundle -- <file>`.

## Explicit fact preservation audit

**EXPLICIT SOURCE FACT MUST NOT DISAPPEAR.** Перед финальной выдачей каждой строки проведи semantic fact audit: каждый materially relevant технический факт, явно присутствующий в `raw_text`, должен либо попасть в соответствующее semantic field (`requested_identity`, attributes, constraints или ports), либо быть отражён через `unknown_fields`, `ambiguities` или `issues`, если его нормализация действительно неоднозначна. Запрещено потерять явный факт и оставить строку `validated`; это правило не разрешает выдумывать отсутствующие характеристики.

Regression case: `Труба PPR PN20 DN32x5.4` обязана сохранить pressure class PN20, wall thickness 5.4 и явно указанный DN/OD 32 как semantic value либо ambiguity. Результат с PN20 и 5.4, но без 32, не может быть `validated`.

Минимальная canonical construction guidance: female-thread closure → `cap`; male-thread closure → `plug`; PPR + threaded mixed fitting → `adapter`. Для неоднозначного названия source всегда важнее догадки; не создавай общий словарь сантехнических эвристик.
