# Проведение Pilot 1.0

## Что подготовить

* validated CatalogBundle для каждого используемого каталога;
* validated RequestBundle;
* понятное имя тестовой сессии;
* папку, куда будут сохранены результаты.

## Рекомендуемое имя сессии

`YYYY-MM-DD — поставщик — заявка — тест N`

## Порядок работы

1. Загрузить catalog bundles.
2. Создать session.
3. Проверить выбранные каталоги.
4. Настроить priority и brand policy.
5. Запустить matcher.
6. Принять решение по каждой строке.
7. Добавить feedback только там, где он полезен.
8. Подтвердить результат.
9. Скачать AI JSON.
10. Сохранить использованные catalog/request bundles рядом с export.

## Что сохранять после каждого теста

Сохраните исходный RequestBundle, все использованные CatalogBundle, финальный AI JSON и краткое описание цели теста. Скриншот нужен только при проблеме интерфейса.

## Как исправлять решение

1. Вернуть session к редактированию.
2. Исправить decisions или feedback.
3. Подтвердить повторно.
4. Скачать новый AI JSON.
5. Не выдавать старый export за финальную версию.

## Что считать завершённым тестом

Нет pending lines, session подтверждена, AI JSON скачан, bundles и export сохранены вместе, а версия пилота зафиксирована в diagnostics.

## Что делать при ошибке

Запишите текст ошибки, название session, pilot release ID, session ID, match run ID, fingerprint и шаг, на котором возникла ошибка.
# Полный автоматический gate

Запустите `npm run test:pilot`. Canonical bundles и влияние `catalogPriority` проверяет `src/test/pilot/pilot-fixtures.test.ts`; workflow confirm/export/reload/reopen — `src/features/pilot/PilotWorkflow.test.tsx`; recovery, conflict и stale run — `src/features/sessions/SessionPage.pilot.test.tsx`; snapshot — `src/storage/catalog-snapshot.pilot.test.ts`; 500 строк и pagination — `src/features/pilot/PilotVolume.test.tsx`.
