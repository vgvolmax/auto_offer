import type { CatalogRecord } from "../../../domain/catalog";
import type { MatchRunRecord } from "../../../domain/matching/match-run";
import type { SessionRecord } from "../../../domain/session";
import { MatchLineCard } from "./MatchLineCard";
import { MatchResultsToolbar } from "./MatchResultsToolbar";
import { useMatchResultReview } from "./useMatchResultReview";
import { buildAiFeedbackExport } from "../../../domain/export/ai-feedback-export";
import { createAiFeedbackFilename, downloadAiFeedback } from "./download-ai-feedback";
import { useState } from "react";
export function MatchResultsPanel(input: {
  session: SessionRecord;
  catalogs: readonly CatalogRecord[];
  run: MatchRunRecord;
  current: boolean;
}) {
  const review = useMatchResultReview(input);
  const [exported, setExported] = useState(false);
  if (review.state.kind === "loading")
    return (
      <section className="card">
        <h2>Результаты подбора</h2>
        <p role="status">Загружаем решения…</p>
      </section>
    );
  if (!review.view)
    return (
      <section className="card">
        <h2>Результаты подбора</h2>
        <p role="alert">
          {review.state.kind === "error" && review.state.message}
        </p>
      </section>
    );
  const busy = review.state.kind === "saving";
  return (
    <section className="card">
      <h2>Результаты подбора</h2>
      <p>
        Обработано {review.view.decidedCount} из {review.view.lineCount} · выбрано товаров {review.view.selectedCount} · без предложения {review.view.noOfferCount} · осталось {review.view.undecidedCount}
      </p>
      {!input.current && (
        <p className="warning-text">
          Результат построен по другим настройкам. Решения сохранены, но
          редактирование недоступно. Верните настройки или запустите подбор
          заново.
        </p>
      )}
      {review.state.kind === "error" && (
        <p role="alert">{review.state.message}</p>
      )}
      <section className="ai-export"><h3>Экспорт для улучшения системы</h3><p>JSON содержит исходную заявку, результат подбора, решения оператора и необязательную обратную связь.</p>
        <button disabled={!input.current || review.view.undecidedCount > 0 || busy || review.state.kind === "error"} onClick={() => {
          const selectionState = "selectionState" in review.state ? review.state.selectionState : undefined;
          if (!selectionState) return;
          const now = new Date().toISOString();
          downloadAiFeedback(buildAiFeedbackExport({ ...input, selectionState, exportedAt: now }), createAiFeedbackFilename(input.session.name, input.session.sessionId, now)); setExported(true);
        }}>Скачать JSON для анализа ИИ</button>
        {!input.current ? <p>Экспорт доступен только для текущего результата подбора.</p> : review.view.undecidedCount > 0 ? <p>Для экспорта примите решение ещё по {review.view.undecidedCount} строкам.</p> : null}{exported && <p role="status">JSON-файл подготовлен</p>}
      </section>
      <MatchResultsToolbar
        query={review.query}
        filter={review.filter}
        onQuery={review.setQuery}
        onFilter={review.setFilter}
      />
      {review.lines.map((line) => (
        <MatchLineCard
          key={line.lineId}
          line={line}
          expanded={review.expanded.has(line.lineId)}
          disabled={!input.current || busy}
          saving={
            busy &&
            review.state.kind === "saving" &&
            review.state.savingLineId === line.lineId
          }
          onToggle={() => review.toggle(line.lineId)}
          onSelect={(i) =>
            void review.selectOffer(line.lineId, line.candidates[i].offerRef)
          }
          onNoOffer={() => void review.markNoOffer(line.lineId)}
          onClear={() => void review.clearDecision(line.lineId)}
          onSaveFeedback={(feedback) => review.saveFeedback(line.lineId, feedback)}
          onClearFeedback={() => review.clearFeedback(line.lineId)}
        />
      ))}
      {review.hasMore && (
        <button onClick={review.showMore}>Показать ещё</button>
      )}
    </section>
  );
}
