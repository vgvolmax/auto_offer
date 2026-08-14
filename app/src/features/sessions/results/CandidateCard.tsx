import { getMatchLevelLabel } from "../../../domain/matching/match-result-labels";
import type { CandidateReviewView } from "../../../domain/matching/match-result-review";
import { CandidateChecks } from "./CandidateChecks";
export function CandidateCard({
  candidate,
  lineId,
  disabled,
  onSelect,
  onClear,
  baselineReady = false,
  operatorOverride = false,
}: {
  candidate: CandidateReviewView;
  lineId: string;
  disabled: boolean;
  onSelect: () => void;
  onClear: () => void;
  baselineReady?: boolean;
  operatorOverride?: boolean;
}) {
  return (
    <article className="candidate-card">
      <h4>{candidate.productLabel}</h4>
      <p>
        {candidate.sourceItemId} · {candidate.offerRef.catalog_id}
        {candidate.brand && ` · ${candidate.brand}`}
      </p>
      <p>
        {getMatchLevelLabel(candidate.matchLevel)} · {candidate.availability}
        {candidate.suggested && <strong> · Рекомендуется</strong>}
        {candidate.selected && <strong> · Выбрано</strong>}
      </p>
      {candidate.availability === "manual_only" && (
        <p>Каталог требует ручной проверки</p>
      )}
      {candidate.semanticRationaleRu && (
        <section><h5>Почему предложено</h5><p>{candidate.semanticRationaleRu}</p></section>
      )}
      {candidate.semanticDifferencesRu && candidate.semanticDifferencesRu.length > 0 && (
        <section><h5>Отличия</h5><ul>{candidate.semanticDifferencesRu.map((value) => <li key={value}>{value}</li>)}</ul></section>
      )}
      {!baselineReady && <><label>
        <input
          type="radio"
          name={`selection-${lineId}`}
          checked={candidate.selected}
          disabled={disabled || !candidate.selectable}
          readOnly
        />{" "}
        {candidate.selected ? "Выбрано" : "Не выбрано"}
      </label>{" "}
      {candidate.selected ? (
        <button disabled={disabled} onClick={onClear}>
          {operatorOverride ? "Вернуть результат ИИ" : "Снять выбор"}
        </button>
      ) : (
        <button disabled={disabled || !candidate.selectable} onClick={onSelect}>
          {candidate.availability === "manual_only" ? "Подтвердить товар" : "Выбрать"}
        </button>
      )}</>}
      <CandidateChecks
        checks={candidate.checks}
        differences={candidate.differences}
      />
    </article>
  );
}
