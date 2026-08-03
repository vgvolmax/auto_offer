# Матрица сценариев

Матрица обновляется в каждом изменении приложения. `verified` означает полноценный автоматический userflow test; `implemented` — реализованный сценарий без такого доказательства; `partial` — реализованную часть сценария.

| Scenario | Status | UI | Domain | Tests | PR |
|---|---|---|---|---|---|
| A1 | implemented | Реализован | Реализован | `A1` / component or repository | 23 |
| A2 | implemented | Реализован | Реализован | `A2` / component or repository | 23 |
| A3 | implemented | Реализован | Реализован | `A3` / component or repository | 23 |
| A4 | implemented | Реализован | Реализован | `A4` / component or repository | 23 |
| A5 | implemented | Реализован | Реализован | `A5` / component or repository | 23 |
| A6 | planned | — | — | — | 23 |
| A7 | implemented | Реализован | Реализован | `A7` / component or repository | 23 |
| A8 | implemented | Реализован | Реализован | `A8` / component or repository | 23 |
| B1 | implemented | Реализован | Реализован | `B1` / component or repository | 23 |
| B2 | implemented | Реализован | Реализован | `B2` / component or repository | 23 |
| B3 | implemented | Реализован | Реализован | `B3` / component or repository | 23 |
| B4 | planned | — | — | — | 23 |
| B5 | partial | — | Contract defined | `B5-request-review` | B2 |
| C1 | partial | — | Contract defined | contract validation | B2 |
| C2 | partial | — | Contract defined | contract validation | B2 |
| C3 | partial | — | Contract defined | contract validation | B2 |
| C4 | partial | — | Contract defined | contract validation | B2 |
| C5 | partial | — | Contract defined | contract validation | B2 |
| C6 | partial | — | Contract defined | contract validation | B2 |
| C7 | partial | — | Contract defined | contract validation | B2 |
| C8 | partial | — | Contract defined | contract validation | B2 |
| C9 | partial | — | Contract defined | contract validation | B2 |
| C10 | partial | — | Contract defined | `C10-review-excluded`, `C10-review-manual` | B2 |
| C11 | planned | — | — | — | 23 |
| C12 | partial | — | Contract defined | contract validation | B2 |
| C13 | planned | — | — | — | 23 |
| D1 | partial | — | Contract defined | `D1-single-exact` | B2 |
| D2 | partial | — | Contract defined | `D2-multiple-exact`, `determinism-catalog-order` | B2 |
| D3 | partial | — | Contract defined | `D3-brand-equivalent`, `D3-pressure-equivalent` | B2 |
| D4 | partial | — | Contract defined | `D4-handle-alternative` | B2 |
| D5 | partial | — | Contract defined | `D5-thread-no-match`, `D5-missing-value`, `identity-neq-hard` | B2 |
| D6 | partial | — | Contract defined | `D6-brand-excluded`, `D6-brand-not-included` | B2 |
| D7 | planned | — | Pilot: stock informational; no split allocation | — | B2 |
| D8 | planned | — | Pilot: source unit informational; no package conversion | — | B2 |
| D9 | partial | — | Contract defined | `D9-two-offers` | B2 |
| D10 | partial | — | Contract defined | `D10-policy-fingerprint` | B2 |
| E1 | partial | — | Contract defined | contract validation | B2 |
| E2 | planned | — | — | — | 23 |
| E3 | partial | — | Contract defined | contract validation | B2 |
| E4 | partial | — | Contract defined | contract validation | B2 |
| E5 | planned | — | — | — | 23 |
| E6 | planned | — | — | — | 23 |
| E7 | planned | — | — | — | 23 |
| E8 | planned | — | — | — | 23 |
| E9 | planned | — | — | — | 23 |
| E10 | planned | — | — | — | 23 |
| F1 | verified | B5b | automated | completed-review validator and UI flow | 23 |
| F2 | verified | B5b | automated | integrity validation | 23 |
| F3 | verified | B5b | automated | atomic confirmation | 23 |
| F4 | verified | B5b | automated | lossless reopen | 23 |
| G1 | planned | — | — | — | 23 |
| G2 | planned | — | — | — | 23 |
| G3 | planned | — | — | — | 23 |
| G4 | planned | — | — | — | 23 |
| G5 | partial | Открытие черновика | Постоянный draft | repository / H1 | 23 |
| H1 | implemented | Реализован | Реализован | `H1` / component or repository | 23 |
| H2 | implemented | Реализован | Реализован | `H2` / component or repository | 23 |
| H3 | implemented | Реализован | Реализован | `H3` / component or repository | 23 |
| H4 | planned | — | — | — | 23 |
| H5 | planned | — | — | — | 23 |
| H6 | planned | — | — | — | 23 |
| H7 | planned | — | — | — | 23 |
| H8 | planned | — | — | — | 23 |

| B4a policy configuration | implemented |
| B4a matcher launch from session | implemented |
| B4a MatchResult persistence | implemented |
| B4a run summary | implemented |
| B4b candidate review | planned |
| B4b manual selection | planned |
| Export | planned |
# B4b status

| Capability | Status |
| --- | --- |
| Result line review | Implemented |
| Candidate details | Implemented |
| Checks and differences | Implemented |
| Excluded candidate review | Implemented |
| Manual candidate selection | Implemented |
| Selection persistence | Implemented |
| Final review | Verified (B5b) |
| AI feedback export | Verified; human export planned |

The full end-to-end workflow remains unverified until B5.
# B5a scenarios

| Сценарий | B5a |
| --- | --- |
| Выбор candidate / `no_offer` / отсутствие решения | Реализовано |
| Необязательные outcome/cause, comment и related OfferRef | Реализовано независимо от decision |
| Восстановление решений и feedback из IndexedDB | Реализовано |
| AI JSON после обработки всех строк текущего run | Реализовано |

# B5b final review

F1–F4 verified: end-to-end review workflow завершён. B5a AI feedback export verified в составе полного flow и поддерживает draft/confirmed snapshots. AI JSON не является основным человеческим итоговым документом; human export (G1–G4) остаётся отдельным будущим PR. Полная pilot readiness всё ещё требует B6.
| Финальное подтверждение | Verified: B5b |
| Human export | Planned: future PR |

## B6 pilot gate

F1–F4 остаются verified. Gate проверяет full workflow, reload/recovery, concurrent revision refresh, multi-catalog priority, confirmed AI feedback export и volume smoke. G1 human final document остаётся planned; Pilot 1.0 не считается коммерческим production release.
# Pilot readiness automation

Статус `verified` для Pilot 1.0 означает прохождение автоматического сценария, а не только наличие production-кода. Полный жизненный цикл review подтверждает `PilotWorkflow.test.tsx`; восстановление draft, конфликт revision и stale settings — `SessionPage.pilot.test.tsx`; неизменяемость ссылки на каталог — `catalog-snapshot.pilot.test.ts`; профиль 500 строк и ограниченный рендеринг — `PilotVolume.test.tsx`.

## Windows launcher scenarios

| ID | Scenario | Automated coverage | Status |
|---|---|---|---|
| L1 | First clean-Windows launch | Windows E2E workflow | implemented, manual pending |
| L2 | Unchanged repeat | fingerprint/unit + E2E repeat | implemented, manual pending |
| L3 | Updated ZIP | dependency/build fingerprints | implemented, manual pending |
| L4 | Offline repeat | Windows E2E second start | implemented, manual pending |
| L5 | Already running | health identity unit/integration | implemented, manual pending |
| L6 | Graceful stop | authenticated shutdown integration | implemented, manual pending |
| L7 | Failure/recovery | retry/checksum/atomic publication tests | implemented, manual pending |
