import type { AppRepositories } from "../../storage/repositories";
import { StaleSelectionStateError } from "../../storage/selection-states-repository";
import { isMatchRunCurrent } from "./match-run-current";
import { equalOfferRefs, offerRefKey, type OfferRef } from "./offer-ref";
import { SelectionError, type SelectionStateRecord } from "./selection-state";
type Obj = Record<string, unknown>;
const object = (x: unknown): x is Obj =>
  typeof x === "object" && x !== null && !Array.isArray(x);
function ref(x: unknown): OfferRef | undefined {
  if (!object(x)) return;
  const v = [
    x.catalog_record_id,
    x.catalog_id,
    x.source_sha256,
    x.source_item_id,
  ];
  return v.every((y) => typeof y === "string")
    ? (x as unknown as OfferRef)
    : undefined;
}
async function context(input: {
  sessionId: string;
  matchRunId: string;
  lineId: string;
  repositories: AppRepositories;
}) {
  const session = await input.repositories.sessions.get(input.sessionId);
  if (!session)
    throw new SelectionError("Сессия не найдена", "SESSION_NOT_FOUND");
  if (session.latestMatchRunId !== input.matchRunId)
    throw new SelectionError("Запуск заменён", "MATCH_RUN_REPLACED");
  const run = await input.repositories.matchRuns.get(input.matchRunId);
  if (!run) throw new SelectionError("Запуск не найден", "MATCH_RUN_NOT_FOUND");
  const catalogs = (
    await Promise.all(
      session.catalogRecordIds.map((x) => input.repositories.catalogs.get(x)),
    )
  ).filter((x) => Boolean(x));
  if (!isMatchRunCurrent({ session, catalogs: catalogs as never[], run }))
    throw new SelectionError("Результат устарел", "MATCH_RUN_STALE");
  const line = run.result.lines.find(
    (x) => object(x) && x.line_id === input.lineId,
  );
  if (!line || !object(line))
    throw new SelectionError("Строка не найдена", "LINE_NOT_FOUND");
  return { session, run, catalogs, line };
}
function mapPersistenceError(error: unknown): never {
  if (error instanceof SelectionError) throw error;
  if (error instanceof StaleSelectionStateError)
    throw new SelectionError(
      "Решение изменилось в другой вкладке",
      "STALE_SELECTION_STATE",
      { cause: error },
    );
  throw new SelectionError(
    "Не удалось сохранить решение",
    "SELECTION_PERSIST_FAILED",
    { cause: error },
  );
}
export async function selectOfferForLine(input: {
  sessionId: string;
  matchRunId: string;
  lineId: string;
  offerRef: OfferRef;
  expectedSelectionRevision: number;
  repositories: AppRepositories;
}): Promise<SelectionStateRecord> {
  const ctx = await context(input);
  const state = await input.repositories.selectionStates.getOrCreateForRun(
    ctx.run,
  );
  const existing = state.decisions[input.lineId];
  if (existing?.kind === "selected_offer" && equalOfferRefs(existing.offerRef, input.offerRef))
    return state;
  const candidate = (
    Array.isArray(ctx.line.candidates) ? ctx.line.candidates : []
  ).find(
    (x) =>
      object(x) &&
      ref(x.offer_ref) &&
      equalOfferRefs(ref(x.offer_ref)!, input.offerRef),
  );
  if (!object(candidate))
    throw new SelectionError("Предложение не найдено", "CANDIDATE_NOT_FOUND");
  const catalog = ctx.catalogs.find(
    (x) =>
      x!.recordId === input.offerRef.catalog_record_id &&
      x!.catalogId === input.offerRef.catalog_id &&
      x!.sourceSha256 === input.offerRef.source_sha256,
  );
  const found = catalog?.bundle.items.some((raw) => {
    const value: unknown = raw;
    const item =
      object(value) && object(value.catalog_item) ? value.catalog_item : value;
    return (
      object(item) && item.source_item_id === input.offerRef.source_item_id
    );
  });
  if (
    !found ||
    !(
      candidate.availability === "eligible" ||
      candidate.availability === "manual_only"
    )
  )
    throw new SelectionError(
      "Предложение недоступно для выбора",
      "CANDIDATE_NOT_SELECTABLE",
    );
  try {
    return await input.repositories.selectionStates.saveDecision({
      sessionId: input.sessionId,
      matchRunId: input.matchRunId,
      lineId: input.lineId,
      expectedRevision: input.expectedSelectionRevision,
      decision: {
        kind: "selected_offer",
        offerRef: input.offerRef,
        confirmedAt: new Date().toISOString(),
      },
    });
  } catch (e) {
    return mapPersistenceError(e);
  }
}
export async function markNoOfferForLine(input: {
  sessionId: string; matchRunId: string; lineId: string; expectedSelectionRevision: number; repositories: AppRepositories;
}): Promise<SelectionStateRecord> {
  const ctx = await context(input);
  const state = await input.repositories.selectionStates.getOrCreateForRun(ctx.run);
  if (state.decisions[input.lineId]?.kind === "no_offer") return state;
  try { return await input.repositories.selectionStates.saveDecision({
    sessionId: input.sessionId, matchRunId: input.matchRunId, lineId: input.lineId,
    expectedRevision: input.expectedSelectionRevision,
    decision: { kind: "no_offer", confirmedAt: new Date().toISOString() },
  }); } catch (e) { return mapPersistenceError(e); }
}
export async function markNoOfferForLines(input: {
  sessionId: string; matchRunId: string; lineIds: string[]; expectedSelectionRevision: number; repositories: AppRepositories;
}): Promise<SelectionStateRecord> {
  if (!input.lineIds.length)
    throw new SelectionError("Не выбраны строки", "LINE_NOT_FOUND");
  if (new Set(input.lineIds).size !== input.lineIds.length)
    throw new SelectionError("Строки не должны повторяться", "DUPLICATE_LINE_IDS");
  await context({ ...input, lineId: input.lineIds[0] });
  try {
    return await input.repositories.selectionStates.saveNoOfferDecisions({
      sessionId: input.sessionId,
      matchRunId: input.matchRunId,
      lineIds: input.lineIds,
      expectedRevision: input.expectedSelectionRevision,
    });
  } catch (e) {
    return mapPersistenceError(e);
  }
}
export async function clearDecisionForLine(input: {
  sessionId: string;
  matchRunId: string;
  lineId: string;
  expectedSelectionRevision: number;
  repositories: AppRepositories;
}): Promise<SelectionStateRecord> {
  const ctx = await context(input);
  const state = await input.repositories.selectionStates.getOrCreateForRun(ctx.run);
  if (!state.decisions[input.lineId]) return state;
  try {
    return await input.repositories.selectionStates.saveDecision({
      sessionId: input.sessionId,
      matchRunId: input.matchRunId,
      lineId: input.lineId,
      expectedRevision: input.expectedSelectionRevision,
      decision: null,
    });
  } catch (e) {
    return mapPersistenceError(e);
  }
}
