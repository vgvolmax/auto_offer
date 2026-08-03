# Windows portable launch

Статус архитектуры после технической проверки: **REFACTOR-IN-PR**. Статус ручной
приёмки: **Manual clean-Windows acceptance pending**.

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
Runtime публикуется в `.runtime/python` через проверенный staging-каталог;
системные Python, pip, PATH, пакеты и права администратора не используются.
`install-receipt.json` schema v2 фиксирует точный сортированный набор каждого
regular file (нормализованный path, size и SHA-256), pinned Python/archive и launcher
version. Повторное использование разрешено только при полном совпадении receipt,
фактического набора файлов, их хешей и запускаемой версии Python.

Mutex удерживается до подтверждённого health нового сервера (либо подтверждения
уже работающего экземпляра). Поэтому конкурентные первые запуски последовательно
перепроверяют runtime и listener, а аварийное завершение не оставляет постоянный lock.
Сетевые попытки ограничены тремя и повторяются только для временных transport/HTTP
ошибок; checksum, policy redirect и unsafe ZIP завершают установку сразу.

## Целостность и lifecycle

`release-manifest.json` строго фиксирует schema/app/launcher versions, source commit,
build timestamp, origin и сортированный список `path`, `size`, `sha256` всех файлов
кроме manifest. Неизвестные поля, unsafe/duplicate paths, пропуски и несовпадения
блокируют сервер. Сервер standard-library `ThreadingHTTPServer` слушает только
`127.0.0.1:8765`, публикует health identity/fingerprint и использует authenticated
loopback shutdown. После успешного bind сервер сам создаёт instance ID и shutdown
token, записывает собственный ненулевой PID и атомарно публикует `server.json`.
Token существует только в этом локальном state, не передаётся через argv и
сравнивается constant-time. Сервер удаляет state только если файл всё ещё относится
к его instance. `stop.bat` сверяет health со state и не завершает процесс по одному PID.
Закрытый port со state считается stale; foreign или временно не отвечающий listener
не останавливается и не перезаписывается.

Публикация runtime сохраняет sibling-каталог `.runtime/python.previous` до
успешного запуска launcher. Если процесс прерван после переименования, следующий
`start.bat` под mutex восстанавливает проверенный previous runtime до сетевой
загрузки. Повреждённый, неполный или содержащий лишний файл runtime не считается
готовым и заменяется только после полной проверки нового staging-каталога.

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

GitHub Actions `Windows portable release` выполняет автоматическую ZIP-проверку на
Windows 2022, включая Unicode/space path, два конкурентных BAT-запуска, health/root,
все referenced assets, согласованность PID/instance state, единственный server
process, отсутствие token в argv/logs и временных install-файлов, stop и
offline-ready restart без переустановки runtime. Эта CI-проверка не заменяет указанную выше ручную
приёмку на чистой пользовательской Windows.
