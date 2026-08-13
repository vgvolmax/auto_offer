import type { MatchRunRecord } from "../../../domain/matching/match-run";
import {
  matchRunFingerprint,
  summarizeMatchResult,
  summarizeSemanticMatchResult,
} from "../../../domain/matching/match-run";

function PilotMetrics({ run }: { run: Extract<MatchRunRecord, { runKind: "pilot" }> }) {
  const summary = summarizeMatchResult(run.result);
  return <>
    <dt>Строк всего</dt><dd>{summary.totalLines}</dd>
    <dt>Точные одиночные</dt><dd>{summary.singleExact}</dd>
    <dt>Несколько точных</dt><dd>{summary.multipleExact}</dd>
    <dt>Только эквивалентные</dt><dd>{summary.equivalentOnly}</dd>
    <dt>Только альтернативные</dt><dd>{summary.alternativeOnly}</dd>
    <dt>Исключённые правилами</dt><dd>{summary.excludedByPolicy}</dd>
    <dt>Без совпадений</dt><dd>{summary.noMatch}</dd>
    <dt>Требуют проверки</dt><dd>{summary.requestReviewRequired}</dd>
  </>;
}

function SemanticMetrics({ run }: { run: Extract<MatchRunRecord, { runKind: "semantic" }> }) {
  const summary = summarizeSemanticMatchResult(run.result);
  return <>
    <dt>Строк всего</dt><dd>{summary.totalLines}</dd>
    <dt>Точных предложений</dt><dd>{summary.exactOfferCount}</dd>
    <dt>Эквивалентных предложений</dt><dd>{summary.equivalentOfferCount}</dd>
    <dt>Альтернативных предложений</dt><dd>{summary.alternativeOfferCount}</dd>
    <dt>Рекомендуется без предложения</dt><dd>{summary.noOfferRecommendedCount}</dd>
    <dt>Требуется повторная маршрутизация</dt><dd>{summary.rerouteRequiredCount}</dd>
    <dt>Требуют проверки заявки</dt><dd>{summary.requestReviewRequiredCount}</dd>
    <dt>Ошибки в заявке</dt><dd>{summary.requestInvalidCount}</dd>
    <dt>Не поддерживаются</dt><dd>{summary.requestUnsupportedCount}</dd>
  </>;
}

export function MatchRunSummaryView({ run, current }: { run: MatchRunRecord; current: boolean }) {
  const fingerprint = matchRunFingerprint(run);
  return (
    <section className="card" aria-label="Сводка подбора">
      <div className="row">
        <h2>Сводка запуска</h2>
        <strong className={current ? "current-run" : "stale-run"}>
          {current ? "Актуальный" : "Настройки изменены — результат устарел"}
        </strong>
      </div>
      <p>{new Date(run.createdAt).toLocaleString("ru")} · fingerprint:{" "}
        <code title={fingerprint}>{fingerprint.slice(0, 12)}…</code>
      </p>
      <dl className="summary-grid">
        {run.runKind === "semantic" ? <SemanticMetrics run={run} /> : <PilotMetrics run={run} />}
      </dl>
      <p className="notice">Источник: {run.runKind === "semantic" ? "Подбор ИИ" : "Локальный подбор (legacy)"}.</p>
    </section>
  );
}
