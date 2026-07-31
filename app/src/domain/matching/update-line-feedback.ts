import type { AppRepositories } from "../../storage/repositories";
import { StaleSelectionStateError } from "../../storage/selection-states-repository";
import { normalizeLineFeedback, type LineFeedback } from "./line-feedback";
import { isMatchRunCurrent } from "./match-run-current";
import { equalOfferRefs, type OfferRef } from "./offer-ref";
import { SelectionError, type SelectionStateRecord } from "./selection-state";

type Obj = Record<string, unknown>;
const object = (x: unknown): x is Obj => typeof x === "object" && x !== null && !Array.isArray(x);
function ref(x: unknown): OfferRef | undefined {
  if (!object(x)) return;
  const fields = [x.catalog_record_id, x.catalog_id, x.source_sha256, x.source_item_id];
  return fields.every((v) => typeof v === "string") ? x as unknown as OfferRef : undefined;
}
async function context(input: { sessionId: string; matchRunId: string; lineId: string; expectedSelectionRevision: number; repositories: AppRepositories }) {
  const session = await input.repositories.sessions.get(input.sessionId);
  if (!session) throw new SelectionError("Сессия не найдена", "SESSION_NOT_FOUND");
  if (session.latestMatchRunId !== input.matchRunId) throw new SelectionError("Запуск заменён", "MATCH_RUN_REPLACED");
  const run = await input.repositories.matchRuns.get(input.matchRunId);
  if (!run) throw new SelectionError("Запуск не найден", "MATCH_RUN_NOT_FOUND");
  const catalogs = (await Promise.all(session.catalogRecordIds.map((id) => input.repositories.catalogs.get(id)))).filter(Boolean);
  if (!isMatchRunCurrent({ session, run, catalogs: catalogs as never[] })) throw new SelectionError("Результат устарел", "MATCH_RUN_STALE");
  const line = run.result.lines.find((x) => object(x) && x.line_id === input.lineId);
  if (!object(line)) throw new SelectionError("Строка не найдена", "LINE_NOT_FOUND");
  const state = await input.repositories.selectionStates.getOrCreateForRun(run);
  if (state.revision !== input.expectedSelectionRevision) throw new SelectionError("Обратная связь изменена в другой вкладке", "STALE_SELECTION_STATE");
  return { line, state };
}
function allowed(line: Obj, feedback: LineFeedback): boolean {
  if (!feedback.relatedOfferRef) return true;
  const inList = (name: string) => (Array.isArray(line[name]) ? line[name] : []).some((x) => object(x) && ref(x.offer_ref) && equalOfferRefs(ref(x.offer_ref)!, feedback.relatedOfferRef!));
  const candidate = inList("candidates"), excluded = inList("excluded_candidates");
  if (feedback.outcome === "correct_candidate_ranked_low") return candidate;
  if (feedback.outcome === "correct_candidate_excluded") return excluded;
  return ["suggested_candidate_incorrect", "other_outcome"].includes(feedback.outcome ?? "") && (candidate || excluded);
}
function persistenceError(error: unknown): never {
  if (error instanceof SelectionError) throw error;
  if (error instanceof StaleSelectionStateError) throw new SelectionError("Обратная связь изменена в другой вкладке", "STALE_SELECTION_STATE", { cause: error });
  throw new SelectionError("Не удалось сохранить обратную связь", "SELECTION_PERSIST_FAILED", { cause: error });
}
export async function saveFeedbackForLine(input: { sessionId: string; matchRunId: string; lineId: string; feedback: LineFeedback; expectedSelectionRevision: number; repositories: AppRepositories }): Promise<SelectionStateRecord> {
  const { line, state } = await context(input);
  let normalized = normalizeLineFeedback(input.feedback);
  if (normalized?.relatedOfferRef && !allowed(line, normalized)) {
    const previous = state.feedback[input.lineId];
    if (previous?.relatedOfferRef && equalOfferRefs(previous.relatedOfferRef, normalized.relatedOfferRef) && previous.outcome !== normalized.outcome)
      normalized = normalizeLineFeedback({ ...normalized, relatedOfferRef: undefined });
    else throw new SelectionError("Связанный товар недопустим для выбранной категории", "CANDIDATE_NOT_SELECTABLE");
  }
  try { return await input.repositories.selectionStates.saveFeedback({ sessionId: input.sessionId, matchRunId: input.matchRunId, lineId: input.lineId, expectedRevision: state.revision, feedback: normalized ?? null }); }
  catch (error) { return persistenceError(error); }
}
export async function clearFeedbackForLine(input: { sessionId: string; matchRunId: string; lineId: string; expectedSelectionRevision: number; repositories: AppRepositories }): Promise<SelectionStateRecord> {
  const { state } = await context(input);
  if (!state.feedback[input.lineId]) return state;
  try { return await input.repositories.selectionStates.saveFeedback({ sessionId: input.sessionId, matchRunId: input.matchRunId, lineId: input.lineId, expectedRevision: state.revision, feedback: null }); }
  catch (error) { return persistenceError(error); }
}
