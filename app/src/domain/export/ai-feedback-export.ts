import type { CatalogRecord } from "../catalog";
import type { MatchRunRecord } from "../matching/match-run";
import { offerRefKey, type OfferRef } from "../matching/offer-ref";
import type { LineFeedback } from "../matching/line-feedback";
import type { LineDecision, SelectionStateRecord } from "../matching/selection-state";
import type { RequestBundle, SessionRecord } from "../session";
import type { SessionMatchingSettings } from "../matching/session-policy";

export type AiFeedbackExportErrorCode = "AI_EXPORT_NOT_CURRENT" | "AI_EXPORT_STATE_MISMATCH" | "AI_EXPORT_INCOMPLETE" | "AI_EXPORT_RESULT_INCONSISTENT";
export class AiFeedbackExportError extends Error {
  constructor(message: string, public readonly code: AiFeedbackExportErrorCode, public readonly missingLineIds: string[] = []) { super(message); this.name = "AiFeedbackExportError"; }
}
export interface ReferencedCatalogItem { offer_ref: OfferRef; catalog: { record_id: string; catalog_id: string; source_sha256: string; source_file_name: string } | null; source: unknown | null; catalog_item: unknown | null; missing: boolean }
export interface AiFeedbackSession { session_id: string; name: string; comment: string; request_id: string; request_file_name: string; matching_revision: number; matching_settings: SessionMatchingSettings; catalog_refs: SessionRecord["catalogRefs"]; created_at: string; updated_at: string }
export interface AiFeedbackMatchRun { id: string; session_revision: number; created_at: string; input_fingerprint: string; result: MatchRunRecord["result"] }
export interface AiFeedbackOperatorReview { selection_state_schema_version: "1.1.0"; selection_state_revision: number; decided_count: number; selected_offer_count: number; no_offer_count: number; feedback_count: number; lines: Array<{ line_id: string; decision: LineDecision; feedback?: LineFeedback }> }
export interface AiFeedbackExportV1 { schema_version: "1.0.0"; export_type: "auto_offer_ai_feedback"; exported_at: string; session: AiFeedbackSession; request_bundle: RequestBundle; match_run: AiFeedbackMatchRun; operator_review: AiFeedbackOperatorReview; referenced_catalog_items: ReferencedCatalogItem[] }
type Obj = Record<string, unknown>;
const object = (x: unknown): x is Obj => typeof x === "object" && x !== null && !Array.isArray(x);
function ref(x: unknown): OfferRef | undefined { if (!object(x)) return; const f = [x.catalog_record_id,x.catalog_id,x.source_sha256,x.source_item_id]; return f.every((v) => typeof v === "string") ? x as unknown as OfferRef : undefined; }

export function buildAiFeedbackExport(input: { session: SessionRecord; catalogs: readonly CatalogRecord[]; run: MatchRunRecord; selectionState: SelectionStateRecord; current: boolean; exportedAt?: string }): AiFeedbackExportV1 {
  const { session, run, selectionState } = input;
  if (!input.current) throw new AiFeedbackExportError("Экспорт доступен только для текущего запуска", "AI_EXPORT_NOT_CURRENT");
  if (run.sessionId !== session.sessionId || session.latestMatchRunId !== run.id || run.sessionRevision !== session.matchingRevision || selectionState.sessionId !== session.sessionId || selectionState.matchRunId !== run.id || selectionState.inputFingerprint !== run.result.input_fingerprint)
    throw new AiFeedbackExportError("Состояние не соответствует запуску", "AI_EXPORT_STATE_MISMATCH");
  const requestLines = session.requestBundle.request_document.lines;
  const ids = new Set(requestLines.map((line) => line.line_id));
  if (Object.keys(selectionState.decisions).some((id) => !ids.has(id)) || Object.keys(selectionState.feedback).some((id) => !ids.has(id)))
    throw new AiFeedbackExportError("Состояние содержит неизвестные строки", "AI_EXPORT_RESULT_INCONSISTENT");
  const resultIds = new Set((run.result.lines as unknown[]).filter(object).map((line) => String(line.line_id)));
  if (requestLines.some((line) => !resultIds.has(line.line_id))) throw new AiFeedbackExportError("Результат не содержит строку заявки", "AI_EXPORT_RESULT_INCONSISTENT");
  const missing = requestLines.filter((line) => !selectionState.decisions[line.line_id]).map((line) => line.line_id);
  if (missing.length) throw new AiFeedbackExportError("Не по всем строкам принято решение", "AI_EXPORT_INCOMPLETE", missing);
  const lines = requestLines.map(({ line_id }) => ({ line_id, decision: selectionState.decisions[line_id]!, ...(selectionState.feedback[line_id] && { feedback: selectionState.feedback[line_id] }) }));
  const refs = new Map<string, OfferRef>();
  for (const raw of run.result.lines as unknown[]) if (object(raw)) for (const list of [raw.candidates, raw.excluded_candidates]) for (const value of Array.isArray(list) ? list : []) { const offer = object(value) && ref(value.offer_ref); if (offer) refs.set(offerRefKey(offer), offer); }
  for (const decision of Object.values(selectionState.decisions)) if (decision.kind === "selected_offer") refs.set(offerRefKey(decision.offerRef), decision.offerRef);
  for (const feedback of Object.values(selectionState.feedback)) if (feedback.relatedOfferRef) refs.set(offerRefKey(feedback.relatedOfferRef), feedback.relatedOfferRef);
  const referenced_catalog_items = [...refs].sort(([a],[b]) => a.localeCompare(b)).map(([, offer]): ReferencedCatalogItem => {
    const catalog = input.catalogs.find((c) => c.recordId === offer.catalog_record_id && c.catalogId === offer.catalog_id && c.sourceSha256 === offer.source_sha256);
    const raw = catalog?.bundle.items.find((item) => object(item) && object(item.catalog_item) && (item.catalog_item as Obj).source_item_id === offer.source_item_id) as Obj | undefined;
    return { offer_ref: offer, catalog: catalog ? { record_id: catalog.recordId, catalog_id: catalog.catalogId, source_sha256: catalog.sourceSha256, source_file_name: catalog.sourceFileName } : null, source: raw?.source ?? null, catalog_item: raw?.catalog_item ?? null, missing: !catalog || !raw };
  });
  return {
    schema_version: "1.0.0", export_type: "auto_offer_ai_feedback", exported_at: input.exportedAt ?? new Date().toISOString(),
    session: { session_id: session.sessionId, name: session.name, comment: session.comment, request_id: session.requestId, request_file_name: session.requestFileName, matching_revision: session.matchingRevision, matching_settings: session.matchingSettings, catalog_refs: session.catalogRefs, created_at: session.createdAt, updated_at: session.updatedAt },
    request_bundle: session.requestBundle,
    match_run: { id: run.id, session_revision: run.sessionRevision, created_at: run.createdAt, input_fingerprint: run.result.input_fingerprint, result: run.result },
    operator_review: { selection_state_schema_version: "1.1.0", selection_state_revision: selectionState.revision, decided_count: lines.length, selected_offer_count: lines.filter((x) => x.decision.kind === "selected_offer").length, no_offer_count: lines.filter((x) => x.decision.kind === "no_offer").length, feedback_count: lines.filter((x) => x.feedback).length, lines },
    referenced_catalog_items,
  };
}
