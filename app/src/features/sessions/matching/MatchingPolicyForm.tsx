import type { CatalogRecord } from "../../../domain/catalog";
import {
  collectAvailableBrandIds,
  type SessionMatchingSettings,
  type SessionMatchingSettingsIssue,
} from "../../../domain/matching/session-policy";
import { CatalogPriorityEditor } from "./CatalogPriorityEditor";
import { BrandPolicyEditor } from "./BrandPolicyEditor";
export function MatchingPolicyForm({
  settings,
  catalogs,
  state,
  issues,
  onChange,
  onSave,
  locked,
  externalBusy,
}: {
  settings: SessionMatchingSettings;
  catalogs: CatalogRecord[];
  state: string;
  issues: SessionMatchingSettingsIssue[];
  onChange: (s: SessionMatchingSettings) => void;
  onSave: () => void;
  locked: boolean;
  externalBusy: boolean;
}) {
  const busy =
    externalBusy ||
    ["saving", "running", "confirming", "reopening"].includes(state);
  const interactionDisabled = locked || busy;
  const dirty = state === "ready-dirty";
  const clean =
    state === "ready-clean" ||
    state === "success-current" ||
    state === "success-stale";
  return (
    <section className="card">
      <h2>Правила предложения</h2>
      <p>Эти правила ограничивают, какие товары ИИ может предложить.</p>
      {locked && (
        <p className="warning-text">
          Результат подтверждён. Верните его к редактированию, чтобы изменить
          правила или подготовить новый подбор для ИИ.
        </p>
      )}
      <fieldset disabled={interactionDisabled}>
        <legend>Какие замены разрешены</legend>
        {[
          ["exact", "Только точное соответствие"],
          ["equivalent", "Точное или эквивалент"],
          ["alternative", "Можно предлагать альтернативы"],
        ].map(([value, label]) => (
          <label key={value} className="inline-check">
            <input
              type="radio"
              name="level"
              checked={settings.maxMatchLevel === value}
              onChange={() =>
                onChange({
                  ...settings,
                  maxMatchLevel:
                    value as SessionMatchingSettings["maxMatchLevel"],
                })
              }
            />
            {label}
          </label>
        ))}
        <p className="hint">
          ИИ сможет выбирать только варианты в пределах разрешённого уровня.
        </p>
      </fieldset>
      <CatalogPriorityEditor
        locked={interactionDisabled}
        ids={settings.catalogPriority}
        catalogs={catalogs}
        onChange={(catalogPriority) =>
          onChange({ ...settings, catalogPriority })
        }
      />
      <BrandPolicyEditor
        locked={interactionDisabled}
        brands={settings.brands}
        available={collectAvailableBrandIds(catalogs)}
        onChange={(brands) => onChange({ ...settings, brands })}
      />
      {issues.map((x) => (
        <p className="error-text" key={`${x.code}-${x.path}`}>
          {x.message}
        </p>
      ))}
      <div className="actions">
        <button
          className="button button--secondary"
          disabled={interactionDisabled || !dirty || issues.length > 0}
          onClick={onSave}
        >
          {state === "saving" ? "Сохранение…" : "Сохранить настройки"}
        </button>
        {busy && (
          <span role="status">
            {externalBusy ? "Обновляем данные…" : "Подождите…"}
          </span>
        )}
        {clean && <span>Сохранено</span>}
      </div>
    </section>
  );
}
