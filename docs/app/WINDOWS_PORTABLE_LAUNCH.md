# Windows portable launch

Статус архитектуры: **READY**. Статус ручной приёмки: **Manual clean-Windows acceptance pending**.

## Контракт поставки

CI на Node.js **22.19.0** проверяет приложение, собирает `dist/app`, создаёт manifest,
ZIP и тестирует именно повторно распакованный архив. Пользовательский пакет содержит
только `start.bat`, `stop.bat`, `release-manifest.json`, готовый `dist/app` и
`scripts/launcher/{bootstrap.ps1,launcher.py,runtime-manifest.json,auto_offer_launcher/**}`.
В нём нет Node/npm, исходников TypeScript, `.runtime`, Python или пользовательских данных.

Первый `start.bat` под OS-backed mutex загружает официальный embeddable Python
**3.13.7 x64** с
`https://www.python.org/ftp/python/3.13.7/python-3.13.7-embed-amd64.zip` и проверяет
SHA-256 `f6cca216a359be84797cabb54149ce5e062afb16cc7567eb7fc51cacb2d86b65`.
Runtime атомарно публикуется в `.runtime/python`; системные Python, pip, PATH,
пакеты и права администратора не используются.

## Целостность и lifecycle

`release-manifest.json` строго фиксирует schema/app/launcher versions, source commit,
build timestamp, origin и сортированный список `path`, `size`, `sha256` всех файлов
кроме manifest. Неизвестные поля, unsafe/duplicate paths, пропуски и несовпадения
блокируют сервер. Сервер standard-library `ThreadingHTTPServer` слушает только
`127.0.0.1:8765`, публикует health identity/fingerprint и использует authenticated
loopback shutdown. `stop.bat` не завершает процесс по одному PID.

Логи находятся в `.runtime/logs/launcher.log` и `server.log`, ротируются и не должны
содержать shutdown token. Повреждённый release следует скачать и полностью
распаковать заново; исправный Python runtime сохраняется.

## IndexedDB и ручная приёмка

IndexedDB принадлежит origin `http://127.0.0.1:8765`, браузеру и профилю. Новый
release на том же origin и удаление `.runtime` данные не удаляют. Другой профиль
показывает другое хранилище; очистка site data может удалить данные.

Ручной clean-Windows flow (ZIP в `C:\Тест Auto Offer\auto_offer`, первый online
start, импорт тестового bundle, draft, stop, offline start и проверка данных в том
же профиле) ещё не выполнен и не заявляется как verified.
