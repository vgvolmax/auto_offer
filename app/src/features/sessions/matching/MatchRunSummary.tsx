import type { MatchRunRecord } from "../../../domain/matching/match-run";
import { summarizeMatchResult } from "../../../domain/matching/match-run";
export function MatchRunSummaryView({
  run,
  current,
}: {
  run: MatchRunRecord;
  current: boolean;
}) {
  const s = summarizeMatchResult(run.result);
  return (
    <section className="card" aria-label="Сводка подбора">
      <div className="row">
        <h2>Сводка запуска</h2>
        <strong className={current ? "current-run" : "stale-run"}>
          {current ? "Актуальный" : "Настройки изменены — результат устарел"}
        </strong>
      </div>
      <p>
        {new Date(run.createdAt).toLocaleString("ru")} · fingerprint:{" "}
        <code title={run.result.input_fingerprint}>
          {run.result.input_fingerprint.slice(0, 12)}…
        </code>
      </p>
      <dl className="summary-grid">
        <dt>Строк всего</dt>
        <dd>{s.totalLines}</dd>
        <dt>Точные одиночные</dt>
        <dd>{s.singleExact}</dd>
        <dt>Несколько точных</dt>
        <dd>{s.multipleExact}</dd>
        <dt>Только эквивалентные</dt>
        <dd>{s.equivalentOnly}</dd>
        <dt>Только альтернативные</dt>
        <dd>{s.alternativeOnly}</dd>
        <dt>Исключённые правилами</dt>
        <dd>{s.excludedByPolicy}</dd>
        <dt>Без совпадений</dt>
        <dd>{s.noMatch}</dd>
        <dt>Требуют проверки</dt>
        <dd>{s.requestReviewRequired}</dd>
      </dl>
      <p className="notice">
        Просмотр предложений и ручной выбор будут доступны на следующем этапе.
      </p>
    </section>
  );
}
