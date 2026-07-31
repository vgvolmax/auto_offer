import { useEffect, useMemo, useRef, useState } from "react";
import type { FeedbackOutcome } from "../../../domain/matching/line-feedback";
import { getMatchLevelLabel, getReasonCodeLabel } from "../../../domain/matching/match-result-labels";
import type { CandidateReviewView, ExcludedCandidateReviewView } from "../../../domain/matching/match-result-review";
import { equalOfferRefs, type OfferRef } from "../../../domain/matching/offer-ref";
type Source = "candidate" | "excluded";
export function RelatedOfferPicker(p: { disabled: boolean; outcome: FeedbackOutcome; candidates: CandidateReviewView[]; excluded: ExcludedCandidateReviewView[]; value?: OfferRef; onChange: (value?: OfferRef) => void }) {
  const [open, setOpen] = useState(false), [query, setQuery] = useState(""), [source,setSource] = useState<Source>(p.candidates.length ? "candidate" : "excluded"), opener = useRef<HTMLButtonElement>(null);
  const both = ["suggested_candidate_incorrect","other_outcome"].includes(p.outcome);
  const fixedSource: Source = p.outcome === "correct_candidate_excluded" ? "excluded" : "candidate";
  const activeSource = both ? source : fixedSource;
  const items = useMemo(() => (activeSource === "candidate" ? p.candidates : p.excluded).filter((x) => [x.productLabel,x.brand,x.sourceItemId,x.catalogLabel,x.offerRef.catalog_id].join(" ").toLowerCase().includes(query.trim().toLowerCase())), [p.candidates,p.excluded,query,activeSource]);
  const selected = [...p.candidates, ...p.excluded].find((x) => p.value && equalOfferRefs(x.offerRef,p.value));
  const close = () => { setOpen(false); queueMicrotask(() => opener.current?.focus()); };
  useEffect(() => { if (p.disabled && open) close(); }, [p.disabled]);
  const openPicker = (event: React.MouseEvent<HTMLButtonElement>) => { opener.current = event.currentTarget; setSource(p.candidates.length ? "candidate" : "excluded"); setOpen(true); };
  return <div className="related-offer-picker">
    {selected && <p><strong>{selected.productLabel}</strong> · {selected.brand ?? "Бренд не указан"} · {selected.sourceItemId} · {selected.catalogLabel} · {p.excluded.includes(selected as ExcludedCandidateReviewView) ? "Исключённый товар" : "Кандидат"} <button disabled={p.disabled} type="button" onClick={openPicker}>Заменить</button> <button disabled={p.disabled} type="button" onClick={() => p.onChange()}>Убрать</button></p>}
    {!selected && <button disabled={p.disabled} type="button" aria-expanded={open} onClick={openPicker}>Указать правильный товар</button>}
    {open && <div className="related-offer-panel">{both && <div role="group" aria-label="Источник товара"><button type="button" aria-pressed={source === "candidate"} disabled={!p.candidates.length} onClick={() => setSource("candidate")}>Кандидаты</button><button type="button" aria-pressed={source === "excluded"} disabled={!p.excluded.length} onClick={() => setSource("excluded")}>Исключённые</button></div>}<label>Поиск товара<input value={query} onChange={(e) => setQuery(e.target.value)} autoFocus /></label><div className="related-offer-list">
      {items.map((x) => <button type="button" key={x.key} onClick={() => { p.onChange(x.offerRef); close(); }}><strong>{x.productLabel}</strong><br />{x.brand ?? "Без бренда"} · {x.sourceItemId} · {x.catalogLabel} · {activeSource === "candidate" ? `Кандидат · позиция ${x.resultPosition}` : `Исключённый товар · ${"exclusionCodes" in x && Array.isArray(x.exclusionCodes) ? x.exclusionCodes.map(getReasonCodeLabel).join(", ") : "Исключён правилами"}`} · {getMatchLevelLabel(x.matchLevel)}{x.suggested ? " · Рекомендуется" : ""}</button>)}
      {!items.length && <p>Товары не найдены</p>}</div><button type="button" onClick={close}>Закрыть</button></div>}
  </div>;
}
