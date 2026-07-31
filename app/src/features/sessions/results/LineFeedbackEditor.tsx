import { useEffect, useState } from "react";
import { feedbackCauseHints, feedbackCauseLabels, feedbackOutcomeLabels, normalizeLineFeedback, type FeedbackCause, type FeedbackOutcome, type LineFeedback } from "../../../domain/matching/line-feedback";
import type { MatchLineReviewView } from "../../../domain/matching/match-result-review";
import { RelatedOfferPicker } from "./RelatedOfferPicker";
const causes = Object.keys(feedbackCauseLabels) as FeedbackCause[];
export function LineFeedbackEditor(p: { line: MatchLineReviewView; disabled: boolean; initiallyOpen?: boolean; onSave: (feedback: LineFeedback) => Promise<void>; onClear: () => Promise<void> }) {
  const [open,setOpen] = useState(Boolean(p.initiallyOpen || p.line.feedback)), [draft,setDraft] = useState<LineFeedback>(p.line.feedback ?? {}), [saved,setSaved] = useState(false);
  useEffect(() => setDraft(p.line.feedback ?? {}), [p.line.feedback]);
  const outcomes = (Object.keys(feedbackOutcomeLabels) as FeedbackOutcome[]).filter((x) => x === "correct_result" || x === "no_correct_candidate" || x === "other_outcome" || (x === "suggested_candidate_incorrect" && p.line.candidates.some((c) => c.suggested)) || (x === "correct_candidate_ranked_low" && p.line.candidates.length) || (x === "correct_candidate_excluded" && p.line.excludedCandidates.length));
  const picker = draft.outcome && ["correct_candidate_ranked_low","correct_candidate_excluded","suggested_candidate_incorrect","other_outcome"].includes(draft.outcome);
  return <section className="line-feedback"><button type="button" aria-expanded={open} onClick={() => setOpen((x) => !x)}>Обратная связь для улучшения системы · необязательно</button>{open && <div>
    <label>Что не так с результатом?<select value={draft.outcome ?? ""} onChange={(e) => { const outcome = e.target.value as FeedbackOutcome || undefined; setDraft((d) => normalizeLineFeedback({ ...d, outcome }) ?? {}); }}><option value="">Не указано</option>{outcomes.map((x) => <option key={x} value={x}>{feedbackOutcomeLabels[x]}</option>)}</select></label>
    {draft.outcome !== "correct_result" && <label>С чем это может быть связано?<select value={draft.suspectedCause ?? ""} onChange={(e) => setDraft((d) => ({ ...d, suspectedCause: e.target.value as FeedbackCause || undefined }))}><option value="">Не указано</option>{causes.map((x) => <option key={x} value={x}>{feedbackCauseLabels[x]}</option>)}</select>{draft.suspectedCause && feedbackCauseHints[draft.suspectedCause] && <small>{feedbackCauseHints[draft.suspectedCause]}</small>}</label>}
    <label>Комментарий оператора<textarea value={draft.comment ?? ""} onChange={(e) => setDraft((d) => ({ ...d, comment: e.target.value }))} placeholder="Например: какой товар ожидался, какой параметр определён неверно или почему предложенная замена не подходит." /></label>
    {picker && draft.outcome && <><p>Какой товар вы считаете правильным?</p><RelatedOfferPicker outcome={draft.outcome} candidates={p.line.candidates} excluded={p.line.excludedCandidates} value={draft.relatedOfferRef} onChange={(relatedOfferRef) => setDraft((d) => ({ ...d, relatedOfferRef }))} /></>}
    <button disabled={p.disabled} onClick={async () => { await p.onSave(draft); setSaved(true); }}>Сохранить обратную связь</button>{" "}<button disabled={p.disabled || !p.line.feedback} onClick={async () => { await p.onClear(); setDraft({}); setSaved(true); }}>Удалить обратную связь</button>{saved && <p role="status">Обратная связь сохранена</p>}
  </div>}</section>;
}
