import { getResolutionLabel } from "../../../domain/matching/match-result-labels";
import type { MatchLineReviewView } from "../../../domain/matching/match-result-review";
import { CandidateCard } from "./CandidateCard";
import { ExcludedCandidates } from "./ExcludedCandidates";
export function MatchLineCard(p: {
  line: MatchLineReviewView;
  expanded: boolean;
  disabled: boolean;
  saving: boolean;
  onToggle: () => void;
  onSelect: (key: number) => void;
  onClear: () => void;
}) {
  const { line } = p,
    id = `result-line-${line.lineId}`;
  return (
    <article className="card match-line">
      <button
        aria-expanded={p.expanded}
        aria-controls={id}
        onClick={p.onToggle}
      >
        <strong>
          {line.position}. {line.lineId}
        </strong>{" "}
        — {line.requestText}
      </button>
      <p>
        {line.quantityLabel ?? "Количество не указано"}
        {line.classId && ` · ${line.classId}`} ·{" "}
        {getResolutionLabel(line.resolution)} · Предложений:{" "}
        {line.candidates.length} ·{" "}
        {line.selectedOfferRef?.source_item_id ?? "Не выбрано"}
      </p>
      {p.expanded && (
        <div id={id}>
          {p.saving && <p role="status">Сохраняем…</p>}
          {line.resolution === "request_review_required" && (
            <p>Сначала требуется проверить данные строки заявки.</p>
          )}
          {line.resolution === "request_invalid" && (
            <p>Строка заявки не прошла проверку.</p>
          )}
          {line.candidates.map((x, i) => (
            <CandidateCard
              key={x.key}
              candidate={x}
              lineId={line.lineId}
              disabled={p.disabled}
              onSelect={() => p.onSelect(i)}
              onClear={p.onClear}
            />
          ))}
          {!line.candidates.length && line.rejectionSummary.length > 0 && (
            <section>
              <h4>Почему предложения не подошли</h4>
              <ul>
                {line.rejectionSummary.map((x) => (
                  <li key={x.code}>
                    {x.label} — {x.count}
                  </li>
                ))}
              </ul>
            </section>
          )}
          <ExcludedCandidates items={line.excludedCandidates} />
        </div>
      )}
    </article>
  );
}
