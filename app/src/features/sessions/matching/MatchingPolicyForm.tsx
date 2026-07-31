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
  onRun,
  locked,
}: {
  settings: SessionMatchingSettings;
  catalogs: CatalogRecord[];
  state: string;
  issues: SessionMatchingSettingsIssue[];
  onChange: (s: SessionMatchingSettings) => void;
  onSave: () => void;
  onRun: () => void;
  locked: boolean;
}) {
  const busy = state === "saving" || state === "running";
  const dirty = state === "ready-dirty";
  const clean =
    state === "ready-clean" ||
    state === "success-current" ||
    state === "success-stale";
  return (
    <section className="card">
      <h2>Настройка правил подбора</h2>
      {locked && <p className="warning-text">Результат подтверждён. Верните его к редактированию, чтобы изменить правила или запустить подбор заново.</p>}
      <fieldset disabled={locked}>
        <legend>Максимальный уровень подбора</legend>
        {[
          ["exact", "Только точные"],
          ["equivalent", "Точные и эквивалентные"],
          ["alternative", "Все варианты, включая альтернативные"],
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
          Уровень ограничивает выдачу matcher, но не подтверждает предложение
          автоматически.
        </p>
      </fieldset>
      <fieldset disabled={locked}>
        <legend>Товары needs_review</legend>
        <label className="inline-check">
          <input
            type="radio"
            name="review"
            checked={settings.catalogNeedsReview === "exclude"}
            onChange={() =>
              onChange({ ...settings, catalogNeedsReview: "exclude" })
            }
          />
          Исключать
        </label>
        <label className="inline-check">
          <input
            type="radio"
            name="review"
            checked={settings.catalogNeedsReview === "manual_only"}
            onChange={() =>
              onChange({ ...settings, catalogNeedsReview: "manual_only" })
            }
          />
          Показывать только для ручной проверки
        </label>
      </fieldset>
      <CatalogPriorityEditor
        locked={locked}
        ids={settings.catalogPriority}
        catalogs={catalogs}
        onChange={(catalogPriority) =>
          onChange({ ...settings, catalogPriority })
        }
      />
      <BrandPolicyEditor
        locked={locked}
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
          disabled={locked || !dirty || issues.length > 0 || busy}
          onClick={onSave}
        >
          {state === "saving" ? "Сохранение…" : "Сохранить настройки"}
        </button>
        <button
          className="button"
          disabled={locked || busy || issues.length > 0}
          onClick={onRun}
        >
          {state === "running" ? "Выполняется подбор…" : "Запустить подбор"}
        </button>
        {busy && <span role="status">Подождите…</span>}
        {clean && <span>Сохранено</span>}
      </div>
    </section>
  );
}
