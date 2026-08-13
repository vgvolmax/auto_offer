import { matchRunFingerprint } from "../matching/match-run";
import type { CatalogRecord } from "../catalog";
import { getAllowedRelatedOfferSource } from "../matching/line-feedback-validation";
import { isMatchRunCurrent } from "../matching/match-run-current";
import type { MatchRunRecord } from "../matching/match-run";
import { equalOfferRefs, type OfferRef } from "../matching/offer-ref";
import type { SelectionStateRecord } from "../matching/selection-state";
import type { SessionRecord } from "../session";

export type CompletedReviewMode = "current_draft" | "confirmed_snapshot";
export interface CompletedReviewSummary { matchRunId: string; inputFingerprint: string; matchingRevision: number; selectionStateRevision: number; lineCount: number; selectedOfferCount: number; noOfferCount: number; feedbackCount: number }
export type CompletedReviewErrorCode = "REVIEW_NOT_CURRENT" | "REVIEW_STATE_MISMATCH" | "REVIEW_INCOMPLETE" | "REVIEW_RESULT_INCONSISTENT" | "REVIEW_CONFIRMATION_MISMATCH";
export class CompletedReviewError extends Error {
  constructor(message: string, public readonly code: CompletedReviewErrorCode, public readonly lineIds: string[] = []) { super(message); this.name = "CompletedReviewError"; }
}
type Obj = Record<string, unknown>;
const object = (value: unknown): value is Obj => typeof value === "object" && value !== null && !Array.isArray(value);
const offerRef = (value: unknown): OfferRef | undefined => {
  if (!object(value)) return;
  const fields = [value.catalog_record_id, value.catalog_id, value.source_sha256, value.source_item_id];
  return fields.every((field) => typeof field === "string") ? value as unknown as OfferRef : undefined;
};
const fail = (message: string, code: CompletedReviewErrorCode, lineIds: string[] = []): never => { throw new CompletedReviewError(message, code, lineIds); };

export function validateCompletedReview(input: { session: SessionRecord; catalogs: readonly CatalogRecord[]; run: MatchRunRecord; selectionState: SelectionStateRecord; mode: CompletedReviewMode }): CompletedReviewSummary {
  const { session, run, selectionState } = input;
  if (input.mode === "current_draft") {
    if (session.status !== "draft" || session.latestMatchRunId !== run.id || !isMatchRunCurrent({ session, catalogs: input.catalogs, run })) fail("Результат подбора устарел", "REVIEW_NOT_CURRENT");
  } else if (session.status !== "confirmed") fail("Сессия не подтверждена", "REVIEW_CONFIRMATION_MISMATCH");
  if (run.sessionId !== session.sessionId || selectionState.sessionId !== session.sessionId || selectionState.matchRunId !== run.id || selectionState.inputFingerprint !== matchRunFingerprint(run) || run.result.request_id !== session.requestId)
    fail("Состояние проверки не соответствует запуску", "REVIEW_STATE_MISMATCH");
  const requestLines = session.requestBundle.request_document.lines;
  const requestIds = requestLines.map((line) => line.line_id);
  if (new Set(requestIds).size !== requestIds.length) fail("Заявка содержит повторяющиеся строки", "REVIEW_RESULT_INCONSISTENT", requestIds.filter((id, index) => requestIds.indexOf(id) !== index));
  const rawLines = run.result.lines as unknown[];
  const resultLines = rawLines.filter((line): line is Obj => object(line) && typeof line.line_id === "string");
  const resultIds = resultLines.map((line) => line.line_id as string);
  const requestSet = new Set(requestIds);
  if (resultLines.length !== rawLines.length || new Set(resultIds).size !== resultIds.length || resultIds.length !== requestIds.length || resultIds.some((id) => !requestSet.has(id)) || requestIds.some((id) => !resultIds.includes(id)))
    fail("Строки результата не соответствуют заявке", "REVIEW_RESULT_INCONSISTENT", requestIds.filter((id) => !resultIds.includes(id)));
  if ([...Object.keys(selectionState.decisions), ...Object.keys(selectionState.feedback)].some((id) => !requestSet.has(id))) fail("Проверка содержит неизвестные строки", "REVIEW_RESULT_INCONSISTENT");
  const missing = requestIds.filter((id) => !selectionState.decisions[id]);
  if (missing.length) fail("Не по всем строкам принято решение", "REVIEW_INCOMPLETE", missing);
  const byId = new Map(resultLines.map((line) => [line.line_id as string, line]));
  for (const lineId of requestIds) {
    const line = byId.get(lineId)!;
    const candidates = Array.isArray(line.candidates) ? line.candidates : [];
    const excludedCandidates = Array.isArray(line.excluded_candidates) ? line.excluded_candidates : [];
    const decision = selectionState.decisions[lineId];
    if (!decision || (decision.kind !== "selected_offer" && decision.kind !== "no_offer")) fail("Решение повреждено", "REVIEW_RESULT_INCONSISTENT", [lineId]);
    if (decision.kind === "selected_offer" && (!offerRef(decision.offerRef) || !candidates.some((candidate) => object(candidate) && offerRef(candidate.offer_ref) && equalOfferRefs(offerRef(candidate.offer_ref)!, decision.offerRef)))) fail("Выбранный товар не принадлежит строке", "REVIEW_RESULT_INCONSISTENT", [lineId]);
    const feedback = selectionState.feedback[lineId];
    if (feedback?.relatedOfferRef && !getAllowedRelatedOfferSource({ outcome: feedback.outcome, relatedOfferRef: feedback.relatedOfferRef, candidates, excludedCandidates })) fail("Связанный товар не принадлежит строке", "REVIEW_RESULT_INCONSISTENT", [lineId]);
  }
  const decisions = requestIds.map((id) => selectionState.decisions[id]);
  const summary: CompletedReviewSummary = { matchRunId: run.id, inputFingerprint: matchRunFingerprint(run), matchingRevision: session.matchingRevision, selectionStateRevision: selectionState.revision, lineCount: requestIds.length, selectedOfferCount: decisions.filter((decision) => decision.kind === "selected_offer").length, noOfferCount: decisions.filter((decision) => decision.kind === "no_offer").length, feedbackCount: requestIds.filter((id) => selectionState.feedback[id]).length };
  if (input.mode === "confirmed_snapshot") {
    const confirmation = session.status === "confirmed" ? session.confirmation : undefined;
    if (!confirmation || confirmation.matchRunId !== summary.matchRunId || confirmation.inputFingerprint !== summary.inputFingerprint || confirmation.matchingRevision !== summary.matchingRevision || confirmation.selectionStateRevision !== summary.selectionStateRevision || confirmation.lineCount !== summary.lineCount || confirmation.selectedOfferCount !== summary.selectedOfferCount || confirmation.noOfferCount !== summary.noOfferCount || confirmation.feedbackCount !== summary.feedbackCount)
      fail("Подтверждение не соответствует результату", "REVIEW_CONFIRMATION_MISMATCH");
  }
  return summary;
}
