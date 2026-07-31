import { useMemo, useRef, useState } from "react";
import type { FeedbackOutcome } from "../../../domain/matching/line-feedback";
import type { CandidateReviewView, ExcludedCandidateReviewView } from "../../../domain/matching/match-result-review";
import type { OfferRef } from "../../../domain/matching/offer-ref";
import { equalOfferRefs } from "../../../domain/matching/offer-ref";
export function RelatedOfferPicker(p: { outcome: FeedbackOutcome; candidates: CandidateReviewView[]; excluded: ExcludedCandidateReviewView[]; value?: OfferRef; onChange: (value?: OfferRef) => void }) {
  const [open, setOpen] = useState(false), [query, setQuery] = useState(""), button = useRef<HTMLButtonElement>(null);
  const showCandidates = p.outcome !== "correct_candidate_excluded", showExcluded = p.outcome !== "correct_candidate_ranked_low";
  const items = useMemo(() => [...(showCandidates ? p.candidates.map((x) => ({ ...x, list: "candidate" })) : []), ...(showExcluded ? p.excluded.map((x) => ({ ...x, list: "excluded" })) : [])].filter((x) => [x.productLabel,x.brand,x.sourceItemId,x.catalogLabel,x.offerRef.catalog_id].join(" ").toLowerCase().includes(query.trim().toLowerCase())), [p.candidates,p.excluded,query,showCandidates,showExcluded]);
  const selected = [...p.candidates, ...p.excluded].find((x) => p.value && equalOfferRefs(x.offerRef,p.value));
  const close = () => { setOpen(false); queueMicrotask(() => button.current?.focus()); };
  return <div className="related-offer-picker">
    {selected && <p><strong>{selected.productLabel}</strong> · {selected.brand ?? "Бренд не указан"} · {selected.sourceItemId} · {selected.catalogLabel} · {p.excluded.includes(selected as ExcludedCandidateReviewView) ? "исключённый" : "candidate"} <button onClick={() => setOpen(true)}>Заменить</button> <button onClick={() => p.onChange()}>Убрать</button></p>}
    {!selected && <button ref={button} type="button" aria-expanded={open} onClick={() => setOpen(true)}>Указать правильный товар</button>}
    {open && <div className="related-offer-panel"><label>Поиск товара<input value={query} onChange={(e) => setQuery(e.target.value)} autoFocus /></label><div className="related-offer-list">
      {items.map((x) => <button type="button" key={x.key} onClick={() => { p.onChange(x.offerRef); close(); }}><strong>{x.productLabel}</strong><br />{x.brand ?? "Без бренда"} · {x.sourceItemId} · {x.catalogLabel} · {x.list === "candidate" ? `позиция ${x.resultPosition}` : `исключён: ${"exclusionCodes" in x ? Array.isArray(x.exclusionCodes) ? x.exclusionCodes.join(", ") : "правилами" : "правилами"}`} · {x.matchLevel}{x.suggested ? " · Рекомендуется" : ""}</button>)}
      {!items.length && <p>Товары не найдены</p>}</div><button type="button" onClick={close}>Закрыть</button></div>}
  </div>;
}
