# Windows portable launch

## Пользовательский контракт

1. Скачайте ZIP ветки/релиза и распакуйте его в любую доступную для записи папку (пробелы и кириллица поддерживаются).
2. Дважды щёлкните `start.bat`. Не устанавливайте Python или Node.js и не запускайте файл от администратора.
3. Дождитесь семи этапов: Portable Python, Portable Node.js, npm-зависимости, TypeScript, Сборка, Сервер, Браузер.
4. Останавливайте только через `stop.bat`.

Адрес неизменяем: `http://127.0.0.1:8765/#/`. Launcher никогда не использует `localhost`, `0.0.0.0` или запасной порт. Это сохраняет IndexedDB origin. IndexedDB также привязан к браузеру и профилю: данные, не видимые в другом браузере/профиле, не были удалены.

## Что хранится локально

`.runtime` содержит portable runtimes, подтверждённое состояние, server identity и ротируемый UTF-8 log; `node_modules` — зависимости; `dist/app` — атомарно опубликованную сборку. Эти каталоги не коммитятся. Успешный state записывается только после проверки соответствующего этапа. При изменении `app/**` выполняются typecheck/build; изменение manifest Node, `package.json` или lockfile также запускает `npm ci`.

Закреплены CPython 3.13.7 embeddable x64 и Node.js 22.19.0 LTS Windows x64. URL и SHA-256 находятся в `scripts/launcher/runtime-manifest.json`; их обновление требует отдельного PR.

## Сценарии L1–L7

* **L1:** чистая Windows — bootstrap скачивает и проверяет runtimes, затем dependencies/build/server/browser.
* **L2:** повторный запуск — подтверждённые stages пропускаются.
* **L3:** обновлённый ZIP — content fingerprint определяет необходимую переустановку/сборку.
* **L4:** offline repeat — готовое неизменённое приложение запускается без сети.
* **L5:** уже работает — health identity подтверждает сервер и launcher открывает тот же URL.
* **L6:** `stop.bat` выполняет локальный authenticated graceful shutdown; чужой PID не завершается.
* **L7:** ошибка — partial download/build не публикуется, сохранённые успешные stages переиспользуются.

## Диагностика и восстановление

`doctor` только диагностирует: `.runtime/python/python.exe scripts/launcher/launcher.py doctor`. Ошибка сообщает stage, сохранённое состояние, повторяемое действие, рекомендацию и путь `.runtime/logs/launcher.log`. Проверьте запись в папку, не менее 750 MB места, HTTPS-доступ к python.org/nodejs.org и свободный порт 8765. Corporate proxy или antivirus может блокировать загрузку/запуск unsigned portable binaries; настройку исключений выполняет пользовательская организация. Checksum mismatch нельзя обходить.

Manual clean-Windows acceptance pending: требуется проверить ZIP в `C:\Тест Auto Offer\auto_offer`, загрузку тестового bundle, stop, отключение сети и повторный запуск в том же браузере/профиле.
