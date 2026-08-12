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

1. Откройте новый чат и приложите `REQUEST_PREPARE_PROMPT.md`, полный
   `request-annotation-kit.json` и исходную заявку.
2. Отправьте: `Выполни подготовку заявки по приложенному промпту и создай два готовых JSON-файла.`
3. Скачайте `request-source.json` и `request-selected-kit.json`.
4. В dev workflow проверьте их:
   - `npm run validate:request-source -- request-source.json`;
   - `npm run validate:request-selected-kit -- request-annotation-kit.json request-selected-kit.json request-source.json`.

Результат вида «39 source lines, 38 routed lines, 1 unsupported line» — успешный STEP 1: продолжайте STEP 2, не удаляя позицию. Непредставимую taxonomy строку нельзя «исправлять» выдуманным классом; она маршрутизируется в `unsupported_lines`.

### Шаг 2 — разметка

1. **Обязательно откройте новый чат.** Не продолжайте чат первого шага. Так
   исходный документ и полный kit не останутся в контексте semantic annotation.
2. Приложите `REQUEST_ANNOTATION_PROMPT.md`, `request-source.json` и
   `request-selected-kit.json` — без исходной заявки и полного kit.
3. Отправьте: `Выполни разметку заявки по приложенному промпту и создай готовый request_bundle JSON.`
4. Скачайте final bundle и проверьте его полной production-командой:
   `npm run validate:request-bundle -- <file>`.
5. Только после успешной production validation загрузите bundle в Auto Offer.

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
