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
| F1 | planned | — | — | — | 23 |
| F2 | planned | — | — | — | 23 |
| F3 | planned | — | — | — | 23 |
| F4 | planned | — | — | — | 23 |
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
| Final review | Planned |
| Export | Planned |

The full end-to-end workflow remains unverified until B5.
