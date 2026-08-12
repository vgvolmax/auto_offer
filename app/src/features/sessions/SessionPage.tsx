import { Link, useParams } from "react-router-dom";
import { PageHeader } from "../../components/PageHeader";
import { StatusBadge } from "../../components/StatusBadge";
import { MatchingPolicyForm } from "./matching/MatchingPolicyForm";
import { MatchRunSummaryView } from "./matching/MatchRunSummary";
import { useSessionMatching } from "./matching/useSessionMatching";
import { MatchResultsPanel } from "./results/MatchResultsPanel";
import { useEffect, useState } from "react";
export function SessionPage() {
  const { id } = useParams(),
    matching = useSessionMatching(id);
  const [reviewRefreshing, setReviewRefreshing] = useState(false);
  useEffect(() => setReviewRefreshing(false), [id]);
  if (matching.state.kind === "loading")
    return <p role="status">Открываем черновик…</p>;
  if (!matching.state.session)
    return (
      <p>
        Черновик не найден. <Link to="/sessions">К списку</Link>
      </p>
    );
  const { session, catalogs, settings, run, current } = matching.state;
  return (
    <>
      <PageHeader
        title={session.name}
        action={
          <StatusBadge>
            {session.status === "confirmed" ? "Подтверждено" : "Черновик"}
          </StatusBadge>
        }
      />
      <section className="card">
        <h2>Источники сессии</h2>
        <dl className="details">
          <dt>Файл заявки</dt>
          <dd>{session.requestFileName}</dd>
          <dt>Строк</dt>
          <dd>
            {session.lineCount} строк · требуют проверки: {session.needsReviewCount} · не поддерживаются: {session.unsupportedCount}
          </dd>
          <dt>Каталоги</dt>
          <dd>
            {catalogs.map((c) => (
              <div key={c.recordId}>
                <strong>{c.catalogId}</strong> — {c.sourceFileName},{" "}
                {c.itemCount} позиций (проверено: {c.validatedCount},
                требуют проверки: {c.needsReviewCount})
              </div>
            ))}
          </dd>
        </dl>
      </section>
      <MatchingPolicyForm
        settings={settings}
        catalogs={catalogs}
        state={matching.state.kind}
        issues={matching.issues}
        onChange={matching.change}
        onSave={matching.save}
        onRun={matching.run}
        locked={session.status === "confirmed"}
        externalBusy={reviewRefreshing}
      />
      {run && !current && <p className="warning-text" role="status">{session.status === "confirmed" ? "Каталог изменился после подтверждения результата. Чтобы пересчитать подбор, верните результат к редактированию." : "Каталог или настройки изменились после последнего подбора. Результат устарел."}</p>}
      {run && <MatchRunSummaryView run={run} current={current} />}{" "}
      {run && (
        <MatchResultsPanel
          session={session}
          catalogs={catalogs}
          run={run}
          current={current}
          locked={session.status === "confirmed"}
          confirming={matching.state.kind === "confirming"}
          reopening={matching.state.kind === "reopening"}
          error={
            matching.state.kind === "error" ? matching.state.message : undefined
          }
          onConfirm={matching.confirmReview}
          onReopen={matching.reopenReview}
          onRefreshSessionSnapshot={matching.refreshSessionSnapshot}
          reviewRefreshing={reviewRefreshing}
          onReviewRefreshingChange={setReviewRefreshing}
        />
      )}
      {matching.state.kind === "error" && (
        <p className="error-text" role="alert">
          {matching.state.message}
        </p>
      )}
      <Link to="/sessions">Вернуться к списку</Link>
    </>
  );
}
