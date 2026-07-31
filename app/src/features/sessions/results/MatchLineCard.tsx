import { getResolutionLabel } from "../../../domain/matching/match-result-labels";
import type { MatchLineReviewView } from "../../../domain/matching/match-result-review";
import { CandidateCard } from "./CandidateCard";
import { ExcludedCandidates } from "./ExcludedCandidates";
import type { LineFeedback } from "../../../domain/matching/line-feedback";
import { NoOfferDecisionCard } from "./NoOfferDecisionCard";
import { LineFeedbackEditor } from "./LineFeedbackEditor";
export function MatchLineCard(p: {
  line: MatchLineReviewView;
  expanded: boolean;
  disabled: boolean;
  saving: boolean;
  onToggle: () => void;
  onSelect: (key: number) => void;
  onClear: () => void;
  onNoOffer: () => void;
  onSaveFeedback: (feedback: LineFeedback) => Promise<void>;
  onClearFeedback: () => Promise<void>;
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
        {line.decisionKind === "selected_offer" ? `Выбран: ${line.selectedOfferRef?.source_item_id}` : line.decisionKind === "no_offer" ? "Без предложения" : "Решение не принято"}
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
          <NoOfferDecisionCard lineId={line.lineId} selected={line.decisionKind === "no_offer"} disabled={p.disabled || !line.canMarkNoOffer} onSelect={p.onNoOffer} onClear={p.onClear} />
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
          <LineFeedbackEditor line={line} disabled={p.disabled} initiallyOpen={line.decisionKind === "no_offer"} onSave={p.onSaveFeedback} onClear={p.onClearFeedback} />
        </div>
      )}
    </article>
  );
}
