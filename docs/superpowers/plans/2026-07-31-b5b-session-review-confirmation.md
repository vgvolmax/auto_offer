# B5b session review confirmation — implementation plan

1. Добавить discriminated session status и валидируемый confirmation snapshot без миграции IndexedDB v3.
2. Вынести completeness/integrity в чистый `validateCompletedReview` для draft и confirmed snapshot.
3. Реализовать atomic confirm/reopen repository transactions и application facade.
4. Заблокировать writes confirmed-сессии в matching и selection/match-run repositories.
5. Обновить AI feedback JSON до 1.1.0 и переиспользовать общий validator.
6. Добавить inline final-review UI, read-only confirmed state, reopen и badges списка.
7. Покрыть domain, repository, export и UI flows тестами и выполнить полную проверку репозитория.

## Post-review hardening

- Matching settings сохраняются через atomic CAS внутри одной readwrite-транзакции IndexedDB; stale draft больше не может затереть confirmed session.
- При конфликте SelectionState интерфейс перечитывает SessionRecord, latest MatchRunRecord и SelectionStateRecord.
- Сообщение «данные обновлены» показывается только после успешного завершения обеих операций refresh.
- Добавлены repository CAS и full-flow проверки confirm/reopen, write-lock и confirmed export.
