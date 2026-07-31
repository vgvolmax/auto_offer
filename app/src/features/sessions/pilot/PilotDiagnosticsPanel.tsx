import type { PilotRuntimeInfo } from "../../../domain/pilot/pilot-runtime";

const value = (input: string | number | undefined) => input ?? "—";
export function PilotDiagnosticsPanel({ info }: { info: PilotRuntimeInfo }) {
  return (
    <details className="pilot-diagnostics">
      <summary>Диагностика пилота</summary>
      {!info.taxonomy.consistent && <p role="alert">Версии таксономии заявки и каталогов не совпадают.</p>}
      <dl>
        <dt>Release ID</dt><dd><code>{info.pilotReleaseId}</code></dd>
        <dt>Статус сессии</dt><dd>{info.session.status}</dd>
        <dt>Taxonomy заявки</dt><dd>{info.taxonomy.requestVersion}</dd>
        {info.taxonomy.catalogVersions.map((catalog) => (
          <div key={catalog.recordId}>
            <dt>Taxonomy каталога {catalog.catalogId}</dt><dd>{catalog.taxonomyVersion} (<code>{catalog.recordId}</code>)</dd>
          </div>
        ))}
        <dt>Matcher engine</dt><dd>{info.matcher.engineVersion}</dd>
        <dt>Policy registry</dt><dd>{info.matcher.policyVersion}</dd>
        <dt>SelectionState schema</dt><dd>{info.contracts.selectionStateSchemaVersion}</dd>
        <dt>Confirmation schema</dt><dd>{info.contracts.sessionConfirmationSchemaVersion}</dd>
        <dt>AI feedback schema</dt><dd>{info.contracts.aiFeedbackExportSchemaVersion}</dd>
        <dt>IndexedDB</dt><dd>{info.storage.databaseName}, версия {info.storage.databaseVersion}</dd>
        <dt>Session ID</dt><dd><code>{info.session.sessionId}</code></dd>
        <dt>Match run ID</dt><dd><code>{value(info.session.latestMatchRunId ?? undefined)}</code></dd>
        <dt>Matching revision</dt><dd>{info.session.matchingRevision}</dd>
        <dt>SelectionState revision</dt><dd>{value(info.session.selectionStateRevision)}</dd>
        <dt>Input fingerprint</dt><dd><code>{value(info.session.inputFingerprint)}</code></dd>
        <dt>Run актуален</dt><dd>{info.session.current ? "Да" : "Нет"}</dd>
      </dl>
    </details>
  );
}
