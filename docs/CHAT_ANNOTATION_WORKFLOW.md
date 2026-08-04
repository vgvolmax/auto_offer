# Разметка в обычном чате

## Разметка прайса

1. Откройте новый чат.
2. Прикрепите три типа вложений:
   - `CATALOG_ANNOTATION_PROMPT.md`;
   - `catalog-validation-kit.mjs`;
   - исходный прайс или несколько прайсов.
3. Отправьте: `Выполни инструкцию из приложенного промпта и создай готовые JSON-файлы.`
4. Чат использует читаемые экспорты `annotationKit` и
   `classSchemaRegistry` из MJS, а затем запускает полный
   `validateCatalogBundle`.
5. Скачайте только файлы, для которых подтверждено `valid: true`.
6. Для независимой повторной проверки запустите:

   ```bash
   node catalog-validation-kit.mjs <file>
   ```

7. После успешной проверки загрузите JSON в приложение или сохраните в
   `data/catalogs/`.

`validated`, `needs_review` и `invalid` — статусы отдельных товарных записей.
Сам bundle при этом обязан быть технически валидным: полный валидатор должен
вернуть `valid: true` и пустой `errors`.

## Получение актуального `catalog-validation-kit.mjs`

В репозитории готовый файл находится здесь:

```text
annotation-kits/catalog-validation-kit.mjs
```

После изменения taxonomy, schemas, registry или semantic rules пересоберите
его одной командой:

```bash
npm run generate:catalog-validation-kit
```

Одновременно можно пересобрать офлайн-сборщик:

```bash
npm run generate:catalog-validation-kit-builder
```

Готовый HTML находится здесь:

```text
tools/catalog-validation-kit-builder.html
```

Он открывается двойным кликом и не отправляет файлы в сеть. Перетащите в него
актуальные исходники:

- `catalog-annotation-kit.json`;
- `class-schema-registry.json`;
- `bundle-validator.mjs`;
- `annotation-contract-validator.mjs`;
- `catalog-identifiers.mjs`;
- `request-port-contracts.mjs`.

HTML сам определяет роли по содержимому, проверяет комплект, выполняет smoke
validation и скачивает новый `catalog-validation-kit.mjs`. Промпт в эту сборку
не входит и прикладывается к чату отдельно.

Проверка, что закоммиченные MJS и HTML соответствуют текущим исходникам:

```bash
npm run check:catalog-validation-kit
```

## Разметка заявки

1. Откройте новый чат.
2. Прикрепите три вложения:
   - `REQUEST_ANNOTATION_PROMPT.md`;
   - `request-annotation-kit.json`;
   - заявку.
3. Отправьте: `Выполни инструкцию из приложенного промпта и создай готовые JSON-файлы.`
4. Скачайте JSON.
5. Проверьте файл: `npm run validate:request-bundle -- <file>`.
6. Загрузите валидный файл в приложение.

## Исправление ошибок

При exit code 1 сохраните диагностический JSON. Верните его в тот же чат вместе
с полученным bundle и попросите исправить **только** указанные ошибки по
`code`, `path` и `message`, без повторного толкования уже подтверждённых
исходных данных. Скачайте исправленный файл и повторно запустите соответствующий
validator.

Ошибки чтения или JSON дают exit code 2 и требуют исправления файла либо пути,
а не смысловой переразметки.

## Важно

- Catalog prompt нельзя использовать с request kit, а request prompt — с
  catalog validation kit. Прикладывать оба комплекта одновременно не нужно.
- Репозиторий и отдельные schemas прикладывать к сообщению не нужно.
- Чат не выполняет matching или подбор товаров.
- Приложение работает только с готовыми bundle-файлами.
- Для catalog workflow одной проверки по `root_schema_id` недостаточно:
  обязательны semantic rules из автономного MJS.
