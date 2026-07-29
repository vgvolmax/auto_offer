# Annotation kits

`catalog-annotation-kit.json` предназначен для разметки прайса, а
`request-annotation-kit.json` — для разметки заявки в обычном чате.

JSON-комплекты и manifest являются generated-файлами, их нельзя редактировать
вручную. Для обновления используйте `npm run generate:annotation-kits`.

Готовые самостоятельные промпты:

- [разметка прайса](catalog/CATALOG_ANNOTATION_PROMPT.md);
- [разметка заявки](request/REQUEST_ANNOTATION_PROMPT.md).

В новый чат прикладываются ровно три типа вложений: соответствующий MD-промпт,
соответствующий kit JSON и исходный прайс (один или несколько) либо заявка.
Пошаговые команды проверки приведены в
[инструкции оператора](../docs/CHAT_ANNOTATION_WORKFLOW.md).

MD-промпты — обычные поддерживаемые вручную документы, они не являются
generated-файлами. Taxonomy и schemas в них намеренно не дублируются.
