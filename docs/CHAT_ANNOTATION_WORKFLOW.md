# Разметка в обычном чате

## Разметка прайса

1. Откройте новый чат.
2. Прикрепите три типа вложений:
   - `CATALOG_ANNOTATION_PROMPT.md`;
   - `catalog-annotation-kit.json`;
   - исходный прайс или несколько прайсов.
3. Отправьте: `Выполни инструкцию из приложенного промпта и создай готовые JSON-файлы.`
4. Скачайте полученные JSON.
5. Проверьте каждый файл: `npm run validate:catalog-bundle -- <file>`.
6. После успешной проверки сохраните файл в `data/catalogs/`.

## Разметка заявки

### Шаг 1 — подготовка

1. Откройте новый чат и приложите `REQUEST_PREPARE_PROMPT.md`,
   `taxonomy-light.json` и исходную заявку. Full request kit в чат не
   прикладывайте.
2. Отправьте: `Выполни подготовку заявки по приложенному промпту и создай два готовых JSON-файла.`
3. Скачайте `request-source.json` и `request-routing.json`.
4. В dev workflow проверьте их:
   - `npm run validate:request-source -- request-source.json`;
   - `npm run validate:request-routing -- request-routing.json request-source.json taxonomy/taxonomy-light.json`.
5. Локально materialize canonical selected kit:
   `npm run build:request-selected-kit -- request-annotation-kit.json request-source.json request-routing.json taxonomy/taxonomy-light.json request-selected-kit.json`.
6. Проверьте generated artifact существующим validator:
   `npm run validate:request-selected-kit -- request-annotation-kit.json request-selected-kit.json request-source.json`.

Менеджер больше **не просит чат строить selected kit**.
`request-selected-kit.json` — generated application artifact: на текущем
ручном/dev этапе его детерминированно создаёт CLI, а в следующем UI PR это
будет автоматически делать Auto Offer.

Для табличного PDF перед STEP 2 выборочно сопоставьте 2–3 строки
`request-source.json` с исходной таблицей. Если source row содержала
model/article, manufacturer или note, а `raw_text` сохранил только
«Наименование», STEP 1 выполнен некорректно. Не продолжайте STEP 2 с
потерянным source context: повторите STEP 1.

Результат вида «39 source lines, 38 routed lines, 1 unsupported line» — успешный STEP 1: продолжайте STEP 2, не удаляя позицию. Непредставимую taxonomy строку нельзя «исправлять» выдуманным классом; она маршрутизируется в `unsupported_lines`.

### Шаг 2 — разметка

1. **Обязательно откройте новый чат.** Не продолжайте чат первого шага. Так
   исходный документ и taxonomy-light не останутся в контексте semantic annotation.
2. Приложите `REQUEST_ANNOTATION_PROMPT.md`, `request-source.json` и
   `request-selected-kit.json` — без исходной заявки и полного kit.
3. Отправьте: `Выполни разметку заявки по приложенному промпту и создай готовый request_bundle JSON.`
4. Скачайте final bundle и проверьте его полной production-командой:
   `npm run validate:request-bundle -- <file>`.
5. Только после успешной production validation загрузите bundle в Auto Offer.

При диагностике помните: `needs_review` означает реальную блокирующую
неопределённость, а не просто неполно заполненный schema object. Sparse-строка
с уверенным `class_id` может иметь статус `validated`.

## Исправление ошибок

При exit code 1 сохраните диагностический JSON. Для request bundle верните его
вместе с final bundle именно в чат STEP 2 (не возвращайтесь к PDF). Попросите
исправить **только** диагностированные ошибки без полной переразметки. Для
остальных bundle верните diagnostic в исходный чат вместе
с полученным bundle и попросите исправить **только** указанные ошибки, без
повторного толкования уже подтверждённых исходных данных. Скачайте исправленный
файл и повторно запустите соответствующий validator.

## Важно

- Catalog prompt нельзя использовать с request kit, а request prompt — с
  catalog kit. Прикладывать оба kit одновременно не нужно.
- Репозиторий и отдельные 82 schemas прикладывать к сообщению не нужно.
- Чат не выполняет matching или подбор товаров.
- Приложение работает только с готовыми bundle-файлами.
