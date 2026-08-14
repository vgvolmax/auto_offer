import { getReasonCodeLabel, getResolutionLabel } from "../../../domain/matching/match-result-labels";
import type { MatchLineReviewView } from "../../../domain/matching/match-result-review";
import { CandidateCard } from "./CandidateCard";
import { ExcludedCandidates } from "./ExcludedCandidates";
import type { LineFeedback } from "../../../domain/matching/line-feedback";
import { NoOfferDecisionCard } from "./NoOfferDecisionCard";
import { LineFeedbackEditor } from "./LineFeedbackEditor";
export function MatchLineCard(p: {
  line: MatchLineReviewView;
  expanded: boolean;
  feedbackOpen: boolean;
  disabled: boolean;
  saving: boolean;
  onToggle: () => void;
  onSelect: (key: number) => void;
  onClear: () => void;
  onNoOffer: () => Promise<boolean>;
  onFeedbackOpenChange: (open: boolean) => void;
  onSaveFeedback: (feedback: LineFeedback) => Promise<boolean>;
  onClearFeedback: () => Promise<boolean>;
}) {
  const { line } = p,
    id = `result-line-${line.lineId}`;
  return (
    <article className="card match-line">
      <button
        aria-label={`${line.lineId}: ${line.requestText}`}
        aria-expanded={p.expanded}
        aria-controls={id}
        onClick={p.onToggle}
      >
        <strong>
          {line.position}. {line.requestText}
        </strong>
      </button>
      <p>
        {line.quantityLabel ?? "Количество не указано"}
        {" · "}{getResolutionLabel(line.resolution)} · Предложений:{" "}
        {line.candidates.length} ·{" "}
        {line.decisionKind === "selected_offer" ? `✓ Выбран: ${line.selectedOfferRef?.source_item_id}` : line.decisionKind === "no_offer" ? "✓ Без предложения" : "Без решения"}
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
          {line.resolution === "request_unsupported" && <p>Строка заявки не поддерживается.</p>}
          {line.semanticRecommendation === "reroute_required" && (
            <section><h4>Требуется повторная маршрутизация заявки</h4>
              {line.semanticReasonCode && <p>Причина: {getReasonCodeLabel(line.semanticReasonCode)}</p>}
              {line.semanticRationaleRu && <p>{line.semanticRationaleRu}</p>}
            </section>
          )}
          {line.semanticRecommendation === "no_offer" && (
            <section><h4>Подбор через внешний чат рекомендует: без предложения</h4>
              {line.semanticReasonCode && <p>Причина: {getReasonCodeLabel(line.semanticReasonCode)}</p>}
              {line.semanticRationaleRu && <p>{line.semanticRationaleRu}</p>}
            </section>
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
          {line.canMarkNoOffer && <NoOfferDecisionCard lineId={line.lineId} selected={line.decisionKind === "no_offer"} disabled={p.disabled} clearLabel={line.runKind === "semantic" ? "Вернуть результат ИИ" : undefined} onSelect={p.onNoOffer} onClear={p.onClear} />}
          {!line.candidates.length && line.rejectionSummary.length > 0 && (
            <section>
              <h4>Почему ничего не найдено</h4>
              <ul>
                {line.rejectionSummary.map((x) => (
                  <li key={x.code}>
                    {x.label}{x.code === "REQUEST_UNSUPPORTED" ? "" : ` — ${x.count}`}
                  </li>
                ))}
              </ul>
            </section>
          )}
          <ExcludedCandidates items={line.excludedCandidates} />
          <LineFeedbackEditor line={line} disabled={p.disabled} open={p.feedbackOpen} onOpenChange={p.onFeedbackOpenChange} onSave={p.onSaveFeedback} onClear={p.onClearFeedback} />
        </div>
      )}
    </article>
  );
}
