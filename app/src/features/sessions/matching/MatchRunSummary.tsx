import type { MatchRunRecord } from "../../../domain/matching/match-run";
import { matchRunFingerprint, summarizeMatchResult } from "../../../domain/matching/match-run";
export function MatchRunSummaryView({
  run,
  current,
}: {
  run: MatchRunRecord;
  current: boolean;
}) {
  const s = run.runKind === "pilot" ? summarizeMatchResult(run.result) : {totalLines:run.result.lines.length,singleExact:run.result.lines.filter(x=>x.decision==="offer"&&x.match_level==="exact").length,multipleExact:0,equivalentOnly:run.result.lines.filter(x=>x.decision==="offer"&&x.match_level==="equivalent").length,alternativeOnly:run.result.lines.filter(x=>x.decision==="offer"&&x.match_level==="alternative").length,excludedByPolicy:0,noMatch:run.result.lines.filter(x=>x.decision==="no_offer").length,requestReviewRequired:run.result.lines.filter(x=>x.decision==="request_review_required").length};
  const fingerprint=matchRunFingerprint(run);
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
        <code title={fingerprint}>
          {fingerprint.slice(0, 12)}…
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
        Источник: {run.runKind === "semantic" ? "внешний чат" : "Pilot matcher"}.
      </p>
    </section>
  );
}
