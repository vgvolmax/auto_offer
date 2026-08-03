# B6 pilot readiness

## План проверки

1. Зафиксировать authoritative версии contracts, хранилища, matcher и policy.
2. Показывать runtime-снимок сессии в сворачиваемой read-only diagnostics.
3. Проверять полный UI workflow, восстановление draft/confirmed и конфликт revision.
4. Проверять неизменяемые catalog snapshots и профиль 500 строк / 2 каталога / 2 000 товаров.
5. Запускать B6-проверки одной командой `npm run test:pilot` и фиксировать процедуру оператора.

Защищённые matcher, policy, taxonomy и golden contracts не изменяются. G1 human final document остаётся planned.
# B6.1 completion evidence

Pilot readiness больше не определяется только diagnostics tests. Команда `npm run test:pilot` запускает фиксированный список проверок canonical fixture, полного review lifecycle, восстановления draft и conflict revision, stale settings/new run, immutable catalog snapshot и deterministic 500-line export с pagination smoke. Статус `verified` применяется только к сценариям, покрытым этими автоматическими tests.
