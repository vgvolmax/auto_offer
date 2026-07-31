import type { CatalogRecord } from "../../../domain/catalog";
import type { MatchRunRecord } from "../../../domain/matching/match-run";
import type { SessionRecord } from "../../../domain/session";
import { MatchLineCard } from "./MatchLineCard";
import { MatchResultsToolbar } from "./MatchResultsToolbar";
import { useMatchResultReview } from "./useMatchResultReview";
import { buildAiFeedbackExport } from "../../../domain/export/ai-feedback-export";
import {
  createAiFeedbackFilename,
  downloadAiFeedback,
} from "./download-ai-feedback";
import { useEffect, useState } from "react";
import { SessionReviewPanel } from "../review/SessionReviewPanel";
import type { ConfirmReviewResult } from "../matching/useSessionMatching";
type ExportStatus =
  | { kind: "idle" }
  | { kind: "success" }
  | { kind: "error"; message: string };
export function MatchResultsPanel(input: {
  session: SessionRecord;
  catalogs: readonly CatalogRecord[];
  run: MatchRunRecord;
  current: boolean;
  locked: boolean;
  confirming: boolean;
  reopening: boolean;
  error?: string;
  onConfirm: (input: {
    matchRunId: string;
    expectedSelectionRevision: number;
  }) => Promise<ConfirmReviewResult>;
  onReopen: () => Promise<boolean>;
  onRefreshSessionSnapshot: () => Promise<boolean>;
}) {
  const [refreshingAfterConflict, setRefreshingAfterConflict] = useState(false);
  const transitionBusy =
    input.confirming || input.reopening || refreshingAfterConflict;
  const writeLocked = input.locked || transitionBusy;
  const review = useMatchResultReview({ ...input, writeLocked });
  const [exportStatus, setExportStatus] = useState<ExportStatus>({
    kind: "idle",
  });
  const [reviewError, setReviewError] = useState<string>();
  const selectionRevision =
    "selectionState" in review.state
      ? review.state.selectionState?.revision
      : undefined;
  useEffect(
    () => setExportStatus({ kind: "idle" }),
    [selectionRevision, input.run.id, input.current],
  );
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
  const confirm = async (request: {
    matchRunId: string;
    expectedSelectionRevision: number;
  }) => {
    const result = await input.onConfirm(request);
    if (result.ok) {
      setReviewError(undefined);
      return true;
    }
    if (result.code !== "SELECTION_REVISION_CHANGED") {
      setReviewError(result.message);
      return false;
    }
    setRefreshingAfterConflict(true);
    const [snapshotOk, selectionOk] = await Promise.all([
      input.onRefreshSessionSnapshot(),
      review.reloadSelectionState(),
    ]);
    setRefreshingAfterConflict(false);
    setReviewError(
      snapshotOk && selectionOk
        ? "Решения изменились в другой вкладке. Данные обновлены — проверьте результат ещё раз."
        : "Решения изменились в другой вкладке, но обновить данные не удалось. Перезагрузите страницу.",
    );
    return false;
  };
  return (
    <section className="card">
      <h2>Результаты подбора</h2>
      <p>
        Обработано {review.view.decidedCount} из {review.view.lineCount} ·
        выбрано товаров {review.view.selectedCount} · без предложения{" "}
        {review.view.noOfferCount} · осталось {review.view.undecidedCount}
      </p>
      {input.locked ? (
        <p className="warning-text">
          Это зафиксированный результат. Решения и обратная связь доступны
          только для просмотра.
        </p>
      ) : (
        !input.current && (
          <p className="warning-text">
            Результат построен по другим настройкам. Решения сохранены, но
            редактирование недоступно. Верните настройки или запустите подбор
            заново.
          </p>
        )
      )}
      {review.state.kind === "error" && (
        <p role="alert">{review.state.message}</p>
      )}
      <section className="ai-export">
        <h3>Экспорт для улучшения системы</h3>
        <p>
          JSON содержит исходную заявку, результат подбора, решения оператора и
          необязательную обратную связь.
        </p>
        <button
          disabled={
            (input.session.status === "draft" && !input.current) ||
            review.view.undecidedCount > 0 ||
            busy ||
            transitionBusy ||
            review.state.kind === "error"
          }
          onClick={() => {
            setExportStatus({ kind: "idle" });
            const selectionState =
              "selectionState" in review.state
                ? review.state.selectionState
                : undefined;
            if (!selectionState) return;
            try {
              const now = new Date().toISOString();
              const data = buildAiFeedbackExport({
                ...input,
                selectionState,
                exportedAt: now,
              });
              downloadAiFeedback(
                data,
                createAiFeedbackFilename(
                  input.session.name,
                  input.session.sessionId,
                  now,
                ),
              );
              setExportStatus({ kind: "success" });
            } catch {
              setExportStatus({
                kind: "error",
                message:
                  "Не удалось подготовить JSON-файл. Проверьте решения по строкам и повторите попытку.",
              });
            }
          }}
        >
          Скачать JSON для анализа ИИ
        </button>
        {input.session.status === "draft" && !input.current ? (
          <p>Экспорт доступен только для текущего результата подбора.</p>
        ) : review.view.undecidedCount > 0 ? (
          <p>
            Для экспорта примите решение ещё по {review.view.undecidedCount}{" "}
            строкам.
          </p>
        ) : null}
        {exportStatus.kind === "success" && (
          <p role="status">JSON-файл подготовлен</p>
        )}
        {exportStatus.kind === "error" && (
          <p role="alert">{exportStatus.message}</p>
        )}
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
          feedbackOpen={review.feedbackExpanded.has(line.lineId)}
          disabled={!input.current || writeLocked || busy}
          saving={
            busy &&
            review.state.kind === "saving" &&
            review.state.savingLineId === line.lineId
          }
          onToggle={() => review.toggle(line.lineId)}
          onSelect={(i) =>
            void review.selectOffer(line.lineId, line.candidates[i].offerRef)
          }
          onNoOffer={() => review.markNoOffer(line.lineId)}
          onFeedbackOpenChange={(open) =>
            review.setFeedbackExpanded(line.lineId, open)
          }
          onClear={() => void review.clearDecision(line.lineId)}
          onSaveFeedback={(feedback) =>
            review.saveFeedback(line.lineId, feedback)
          }
          onClearFeedback={() => review.clearFeedback(line.lineId)}
        />
      ))}
      {review.hasMore && (
        <button onClick={review.showMore}>Показать ещё</button>
      )}
      {selectionRevision !== undefined && (
        <SessionReviewPanel
          session={input.session}
          run={input.run}
          current={input.current}
          summary={review.view}
          selectionStateRevision={selectionRevision}
          busy={
            refreshingAfterConflict
              ? "refreshing"
              : busy
                ? "saving"
                : input.confirming
                  ? "confirming"
                  : input.reopening
                    ? "reopening"
                    : undefined
          }
          error={reviewError ?? input.error}
          onConfirm={confirm}
          onReopen={input.onReopen}
        />
      )}
    </section>
  );
}
