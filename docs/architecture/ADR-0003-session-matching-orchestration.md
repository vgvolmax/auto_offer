# ADR-0003: orchestration подбора в сессии

## Статус

Принято для B4a.

## Решение

Сохраняемые `SessionMatchingSettings` принадлежат приложению и отличаются от контрактного `MatchingPolicy`: выбранные каталоги остаются единственным источником истины в `SessionRecord`, а адаптер собирает policy непосредственно перед вызовом matcher. Registry используется из pilot policy B3.

`MatchResult` хранится отдельно, в IndexedDB store `matchRuns`. Для сессии атомарно сохраняется только один последний успешный `MatchRunRecord`; транзакция одновременно проверяет `matchingRevision`, записывает run, обновляет ссылку сессии и удаляет предыдущий run. Изменение настроек не удаляет старый run: он становится stale.

Freshness определяется revision, request ID, embedded policy и catalog refs (`catalog_record_id`, `catalog_id`, `source_sha256`). Сводка UI является derived data и повторно не сохраняется.

Runtime matcher не знает о React, IndexedDB или сессиях. Просмотр кандидатов и отдельный `SelectionState` будут реализованы в B4b.
