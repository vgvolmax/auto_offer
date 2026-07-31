import { useEffect, useRef, useState } from "react";
import { feedbackCauseHints, feedbackCauseLabels, feedbackOutcomeLabels, normalizeLineFeedback, type FeedbackCause, type FeedbackOutcome, type LineFeedback } from "../../../domain/matching/line-feedback";
import type { MatchLineReviewView } from "../../../domain/matching/match-result-review";
import { RelatedOfferPicker } from "./RelatedOfferPicker";
const causes = Object.keys(feedbackCauseLabels) as FeedbackCause[];
type FeedbackSaveStatus = "idle" | "saved" | "deleted";
type PendingFeedbackOperation =
  | { kind: "save"; expectedFeedbackKey: string }
  | { kind: "clear" };

function feedbackKey(feedback?: LineFeedback): string {
  const normalized = normalizeLineFeedback(feedback ?? {});
  return JSON.stringify(normalized ? {
    outcome: normalized.outcome,
    suspectedCause: normalized.suspectedCause,
    comment: normalized.comment,
    relatedOfferRef: normalized.relatedOfferRef ? {
      catalog_record_id: normalized.relatedOfferRef.catalog_record_id,
      catalog_id: normalized.relatedOfferRef.catalog_id,
      source_sha256: normalized.relatedOfferRef.source_sha256,
      source_item_id: normalized.relatedOfferRef.source_item_id,
    } : undefined,
  } : {});
}
export function LineFeedbackEditor(p: { line: MatchLineReviewView; disabled: boolean; open: boolean; onOpenChange: (open: boolean) => void; onSave: (feedback: LineFeedback) => Promise<boolean>; onClear: () => Promise<boolean> }) {
  const [draft,setDraft] = useState<LineFeedback>(p.line.feedback ?? {}), [status,setStatus] = useState<FeedbackSaveStatus>("idle");
  const pendingOperation = useRef<PendingFeedbackOperation | undefined>(undefined);
  const previousLineId = useRef(p.line.lineId);
  useEffect(() => {
    const changedLine = previousLineId.current !== p.line.lineId;
    previousLineId.current = p.line.lineId;
    setDraft(p.line.feedback ?? {});
    if (changedLine) {
      pendingOperation.current = undefined;
      setStatus("idle");
      return;
    }
    const pending = pendingOperation.current;
    if (pending?.kind === "save" && pending.expectedFeedbackKey === feedbackKey(p.line.feedback)) {
      pendingOperation.current = undefined;
      setStatus("saved");
    } else if (pending?.kind === "clear" && feedbackKey(p.line.feedback) === feedbackKey()) {
      pendingOperation.current = undefined;
      setStatus("deleted");
    } else {
      pendingOperation.current = undefined;
      setStatus("idle");
    }
  }, [p.line.lineId, p.line.feedback]);
  const change = (update: (draft: LineFeedback) => LineFeedback) => { setDraft(update); pendingOperation.current = undefined; setStatus("idle"); };
  const outcomes = (Object.keys(feedbackOutcomeLabels) as FeedbackOutcome[]).filter((x) => x === "correct_result" || x === "no_correct_candidate" || x === "other_outcome" || (x === "suggested_candidate_incorrect" && p.line.candidates.some((c) => c.suggested)) || (x === "correct_candidate_ranked_low" && p.line.candidates.length) || (x === "correct_candidate_excluded" && p.line.excludedCandidates.length));
  const picker = draft.outcome && ["correct_candidate_ranked_low","correct_candidate_excluded","suggested_candidate_incorrect","other_outcome"].includes(draft.outcome);
  return <section className="line-feedback"><button type="button" aria-expanded={p.open} onClick={() => p.onOpenChange(!p.open)}>Обратная связь для улучшения системы · необязательно</button>{p.open && <fieldset disabled={p.disabled}>
    <label>Что не так с результатом?<select value={draft.outcome ?? ""} onChange={(e) => { const outcome = e.target.value as FeedbackOutcome || undefined; change((d) => normalizeLineFeedback({ ...d, outcome }) ?? {}); }}><option value="">Не указано</option>{outcomes.map((x) => <option key={x} value={x}>{feedbackOutcomeLabels[x]}</option>)}</select></label>
    {draft.outcome !== "correct_result" && <label>С чем это может быть связано?<select value={draft.suspectedCause ?? ""} onChange={(e) => change((d) => ({ ...d, suspectedCause: e.target.value as FeedbackCause || undefined }))}><option value="">Не указано</option>{causes.map((x) => <option key={x} value={x}>{feedbackCauseLabels[x]}</option>)}</select>{draft.suspectedCause && feedbackCauseHints[draft.suspectedCause] && <small>{feedbackCauseHints[draft.suspectedCause]}</small>}</label>}
    <label>Комментарий оператора<textarea value={draft.comment ?? ""} onChange={(e) => change((d) => ({ ...d, comment: e.target.value }))} placeholder="Например: какой товар ожидался, какой параметр определён неверно или почему предложенная замена не подходит." /></label>
    {picker && draft.outcome && <><p>Какой товар вы считаете правильным?</p><RelatedOfferPicker disabled={p.disabled} outcome={draft.outcome} candidates={p.line.candidates} excluded={p.line.excludedCandidates} value={draft.relatedOfferRef} onChange={(relatedOfferRef) => change((d) => ({ ...d, relatedOfferRef }))} /></>}
    <button type="button" onClick={async () => { const normalized = normalizeLineFeedback(draft); pendingOperation.current = { kind: "save", expectedFeedbackKey: feedbackKey(normalized) }; setStatus("idle"); if (await p.onSave(draft)) setStatus("saved"); else { pendingOperation.current = undefined; setStatus("idle"); } }}>Сохранить обратную связь</button>{" "}<button type="button" disabled={!p.line.feedback} onClick={async () => { pendingOperation.current = { kind: "clear" }; setStatus("idle"); if (await p.onClear()) { setDraft({}); setStatus("deleted"); } else { pendingOperation.current = undefined; setStatus("idle"); } }}>Удалить обратную связь</button>{status !== "idle" && <p role="status">{status === "saved" ? "Обратная связь сохранена" : "Обратная связь удалена"}</p>}
  </fieldset>}</section>;
}
