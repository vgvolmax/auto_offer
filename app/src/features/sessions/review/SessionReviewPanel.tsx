import { useState } from "react";
import type { MatchRunRecord } from "../../../domain/matching/match-run";
import type { SessionRecord } from "../../../domain/session";

export function SessionReviewPanel(input: {
  session: SessionRecord;
  run: MatchRunRecord;
  current: boolean;
  summary: {
    lineCount: number;
    decidedCount: number;
    selectedCount: number;
    noOfferCount: number;
    feedbackCount: number;
    undecidedCount: number;
  };
  selectionStateRevision: number;
  busy?: "confirming" | "reopening" | "refreshing" | "saving";
  error?: string;
  onConfirm: (input: {
    matchRunId: string;
    expectedSelectionRevision: number;
  }) => Promise<boolean>;
  onReopen: () => Promise<boolean>;
}) {
  const [action, setAction] = useState<"confirm" | "reopen">();
  const busy = Boolean(input.busy);
  const refreshText =
    input.busy === "refreshing" ? <p role="status">Обновляем данные…</p> : null;
  if (input.session.status === "confirmed")
    return (
      <section className="session-review card">
        <h2>Результат подтверждён</h2>
        {refreshText}
        <p>
          Дата подтверждения:{" "}
          {new Date(input.session.confirmation.confirmedAt).toLocaleString(
            "ru-RU",
          )}
        </p>
        <p>Обработано строк: {input.session.confirmation.lineCount}</p>
        <p>Выбрано товаров: {input.session.confirmation.selectedOfferCount}</p>
        <p>Без предложения: {input.session.confirmation.noOfferCount}</p>
        <p>С обратной связью: {input.session.confirmation.feedbackCount}</p>
        {input.error && <p role="alert">{input.error}</p>}
        {action === "reopen" ? (
          <div>
            <p className="warning-text">
              После возврата решения и обратная связь сохранятся, но результат
              перестанет считаться подтверждённым.
            </p>
            <button disabled={busy} onClick={() => setAction(undefined)}>
              Отмена
            </button>
            <button
              disabled={busy}
              onClick={() =>
                void input.onReopen().then((ok) => ok && setAction(undefined))
              }
            >
              {input.busy === "reopening"
                ? "Возвращаем к редактированию…"
                : "Вернуть к редактированию"}
            </button>
          </div>
        ) : (
          <button disabled={busy} onClick={() => setAction("reopen")}>
            Вернуть к редактированию
          </button>
        )}
      </section>
    );
  const complete = input.summary.undecidedCount === 0;
  return (
    <section className="session-review card">
      <h2>Завершение проверки</h2>
      {refreshText}
      <p
        aria-label={`Обработано ${input.summary.decidedCount} из ${input.summary.lineCount}`}
      >
        Обработано{" "}
        <strong>
          {input.summary.decidedCount} из {input.summary.lineCount}
        </strong>
      </p>
      <p>Выбрано товаров: {input.summary.selectedCount}</p>
      <p>Без предложения: {input.summary.noOfferCount}</p>
      <p>С обратной связью: {input.summary.feedbackCount}</p>
      {!complete && (
        <p>
          Для подтверждения примите решение ещё по{" "}
          {input.summary.undecidedCount} строкам.
        </p>
      )}
      {!input.current && (
        <p className="warning-text">
          Результат нельзя подтвердить, потому что настройки или каталоги
          изменились. Подготовьте новый подбор для ИИ.
        </p>
      )}
      {input.error && <p role="alert">{input.error}</p>}
      {action === "confirm" ? (
        <div>
          <h3>{input.session.name}</h3>
          <p>Файл заявки: {input.session.requestFileName}</p>
          <p>
            Дата подбора:{" "}
            {new Date(input.run.createdAt).toLocaleString("ru-RU")}
          </p>
          <p className="warning-text">
            После подтверждения настройки, решения и обратная связь будут
            доступны только для просмотра. Результат можно будет вернуть к
            редактированию.
          </p>
          <button disabled={busy} onClick={() => setAction(undefined)}>
            Отмена
          </button>
          <button
            disabled={busy}
            onClick={() =>
              void input
                .onConfirm({
                  matchRunId: input.run.id,
                  expectedSelectionRevision: input.selectionStateRevision,
                })
                .then((ok) => ok && setAction(undefined))
            }
          >
            {input.busy === "confirming"
              ? "Подтверждаем результат…"
              : "Подтвердить результат"}
          </button>
        </div>
      ) : (
        <button
          disabled={!complete || !input.current || busy}
          onClick={() => setAction("confirm")}
        >
          Проверить и подтвердить
        </button>
      )}
    </section>
  );
}
