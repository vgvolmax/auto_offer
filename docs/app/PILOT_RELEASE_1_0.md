# Pilot release 1.0

| Компонент | Версия |
| --- | --- |
| Pilot release | `auto-offer-pilot-1.0.0` |
| Production taxonomy | `1.0.0` (текущий production contract) |
| Matching engine | `pilot-1.0.0` (`PILOT_MATCHING_ENGINE_VERSION`) |
| Policy registry | `pilot-1.0.0` (`pilotPolicyRegistry.policy_version`) |
| SelectionState | `1.1.0` |
| SessionConfirmation | `1.0.0` |
| AI feedback export | `1.1.0` |
| IndexedDB | `3` |

Matcher и taxonomy заморожены на первую серию разметки. Изменение любой версии матрицы требует отдельного PR, а изменение поведения matcher-а — нового release ID. Старые AI exports не переписываются.

Human final document не входит в Pilot 1.0. Pilot 1.0 предназначен для оценки качества подбора и сбора operator feedback и не является коммерческим production release.
