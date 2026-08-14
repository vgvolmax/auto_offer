import type { CatalogRecord } from "../../../domain/catalog";
import type { MatchRunRecord } from "../../../domain/matching/match-run";
import type { SessionRecord } from "../../../domain/session";
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
import { PilotDiagnosticsPanel } from "../pilot/PilotDiagnosticsPanel";
import { buildPilotRuntimeInfo } from "../../../domain/pilot/pilot-runtime";
import { buildProposalTableView } from "../../../domain/presentation/proposal-table-view";
import { ProposalTable } from "./ProposalTable";
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
  reviewRefreshing: boolean;
  onReviewRefreshingChange: (value: boolean) => void;
}) {
  const transitionBusy =
    input.confirming || input.reopening || input.reviewRefreshing;
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
  const bulkSaving = busy && review.state.kind === "saving" && review.state.savingLineId === "__bulk_no_offer__";
  const proposal = buildProposalTableView({ review: review.view, runKind: input.run.runKind });
  const visibleProposal = buildProposalTableView({ review: { ...review.view, lines: review.lines }, runKind: input.run.runKind });
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
    input.onReviewRefreshingChange(true);
    try {
      const [snapshotOk, selectionOk] = await Promise.all([
        input.onRefreshSessionSnapshot(),
        review.reloadSelectionState(),
      ]);
      setReviewError(
        snapshotOk && selectionOk
          ? "Решения изменились в другой вкладке. Данные обновлены — проверьте результат ещё раз."
          : "Решения изменились в другой вкладке, но обновить данные не удалось. Перезагрузите страницу.",
      );
    } finally {
      input.onReviewRefreshingChange(false);
    }
    return false;
  };
  return (
    <section className="card">
      <h2>Заявка</h2>
      <p>
        {proposal.summary.total} позиций · {proposal.summary.withOffer} с предложением ·{" "}
        {proposal.summary.noOffer} без предложения · {proposal.summary.attention} требуют внимания ·{" "}
        {input.run.runKind === "pilot" ? `Не подтверждено: ${proposal.summary.unconfirmed}` : `Готово: ${review.view.effectiveReadyCount ?? 0}`}
      </p>
      {input.run.runKind === "pilot" && review.bulkEligibleCount > 0 && (
        <button disabled={writeLocked || busy || !input.current} onClick={() => void review.markAllWithoutOptions()}>
          {bulkSaving ? `Сохраняем ${review.bulkEligibleCount} строк…` : `Оставить без предложения ${review.bulkEligibleCount} строк без вариантов`}
        </button>
      )}
      {input.locked ? (
        <p className="warning-text">
          Это зафиксированный результат. Решения и обратная связь доступны
          только для просмотра.
        </p>
      ) : (
        !input.current && (
          <p className="warning-text">
            Результат построен по другим настройкам. Решения сохранены, но
            редактирование недоступно. Верните настройки или подготовьте новый
            подбор для ИИ.
          </p>
        )
      )}
      {review.state.kind === "error" && (
        <p role="alert">{review.state.message}</p>
      )}
      <details className="service-details">
        <summary>Служебная информация и экспорт</summary>
        {input.run.runKind === "pilot" && (
          <PilotDiagnosticsPanel
            info={buildPilotRuntimeInfo({
              session: input.session,
              catalogs: input.catalogs,
              run: input.run,
              selectionState:
                "selectionState" in review.state
                  ? review.state.selectionState
                  : undefined,
              current: input.current,
            })}
          />
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
            (input.run.runKind === "semantic" ? (review.view.effectiveUnresolvedCount ?? 0) : review.view.undecidedCount) > 0 ||
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
        ) : (input.run.runKind === "semantic" ? (review.view.effectiveUnresolvedCount ?? 0) : review.view.undecidedCount) > 0 ? (
          <p>
            Требуют внимания: {input.run.runKind === "semantic" ? review.view.effectiveUnresolvedCount : review.view.undecidedCount} строк.
          </p>
        ) : null}
        {exportStatus.kind === "success" && (
          <p role="status">JSON-файл подготовлен</p>
        )}
        {exportStatus.kind === "error" && (
          <p role="alert">{exportStatus.message}</p>
        )}
        </section>
      </details>
      <MatchResultsToolbar
        query={review.query}
        filter={review.filter}
        onQuery={review.setQuery}
        onFilter={review.setFilter}
      />
      <ProposalTable
        rows={visibleProposal.rows}
        expanded={review.expanded}
        feedbackExpanded={review.feedbackExpanded}
        disabled={!input.current || writeLocked || busy}
        savingLineId={busy && review.state.kind === "saving" ? review.state.savingLineId : undefined}
        onToggle={review.toggle}
        onSelect={(lineId, index) => {
          const line = review.view?.lines.find((item) => item.lineId === lineId);
          if (line?.candidates[index]) void review.selectOffer(lineId, line.candidates[index].offerRef);
        }}
        onNoOffer={review.markNoOffer}
        onFeedbackOpenChange={review.setFeedbackExpanded}
        onClear={(lineId) => void review.clearDecision(lineId)}
        onSaveFeedback={review.saveFeedback}
        onClearFeedback={review.clearFeedback}
      />
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
            input.reviewRefreshing
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
