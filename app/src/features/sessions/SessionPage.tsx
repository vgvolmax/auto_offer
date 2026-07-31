import { Link, useParams } from "react-router-dom";
import { PageHeader } from "../../components/PageHeader";
import { StatusBadge } from "../../components/StatusBadge";
import { MatchingPolicyForm } from "./matching/MatchingPolicyForm";
import { MatchRunSummaryView } from "./matching/MatchRunSummary";
import { useSessionMatching } from "./matching/useSessionMatching";
import { MatchResultsPanel } from "./results/MatchResultsPanel";
export function SessionPage() {
  const { id } = useParams(),
    matching = useSessionMatching(id);
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
            {session.lineCount} (needs_review: {session.needsReviewCount})
          </dd>
          <dt>Каталоги</dt>
          <dd>
            {catalogs.map((c) => (
              <div key={c.recordId}>
                <strong>{c.catalogId}</strong> — {c.sourceFileName},{" "}
                {c.itemCount} позиций (validated: {c.validatedCount},
                needs_review: {c.needsReviewCount})
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
      />
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
