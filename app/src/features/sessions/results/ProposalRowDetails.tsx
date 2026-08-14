import { getMatchLevelLabel, getReasonCodeLabel } from "../../../domain/matching/match-result-labels";
import type { LineFeedback } from "../../../domain/matching/line-feedback";
import type { ProposalRowView } from "../../../domain/presentation/proposal-table-view";
import { CandidateCard } from "./CandidateCard";
import { ExcludedCandidates } from "./ExcludedCandidates";
import { LineFeedbackEditor } from "./LineFeedbackEditor";
import { NoOfferDecisionCard } from "./NoOfferDecisionCard";

export function ProposalRowDetails(p: {
  row: ProposalRowView; disabled: boolean; saving: boolean; feedbackOpen: boolean;
  onSelect: (index: number) => void; onClear: () => void; onNoOffer: () => Promise<boolean>;
  onFeedbackOpenChange: (open: boolean) => void;
  onSaveFeedback: (feedback: LineFeedback) => Promise<boolean>; onClearFeedback: () => Promise<boolean>;
}) {
  const { row, row: { source: line } } = p;
  return <div className="proposal-details">
    {p.saving && <p role="status">Сохраняем…</p>}
    <section><h4>Исходный запрос</h4><p>{row.request.raw}</p><p>Количество: {row.request.quantity ?? "—"}</p></section>
    {row.offer.kind === "recommended_no_offer" && <section><h4>ИИ рекомендует оставить без предложения</h4>{row.offer.reasonLabel && <p>Причина: {row.offer.reasonLabel}</p>}{row.offer.rationale && <p>{row.offer.rationale}</p>}</section>}
    {row.offer.kind === "reroute" && <section><h4>Требуется уточнить классификацию строки</h4>{row.offer.reasonLabel && <p>Причина: {row.offer.reasonLabel}</p>}{row.offer.rationale && <p>{row.offer.rationale}</p>}</section>}
    {row.offer.kind === "request_review" && <p>Сначала требуется проверить данные строки заявки.</p>}
    {row.offer.kind === "request_invalid" && <p>Строка заявки не прошла проверку.</p>}
    {row.offer.kind === "request_unsupported" && <p>Для этого типа товара нет поддерживаемого класса.</p>}
    {row.offer.candidate && <section className="proposal-product-details"><h4>Предлагаемый товар</h4><p>{row.offer.productLabel}</p>{row.offer.brand && <p>Бренд: {row.offer.brand}</p>}<p>Каталог: {row.offer.catalogLabel}</p><p>Соответствие: {getMatchLevelLabel(row.offer.matchLevel!)}</p>{row.offer.rationale && <><h5>Почему предложено</h5><p>{row.offer.rationale}</p></>}{row.offer.differences?.length ? <><h5>Отличия</h5><ul>{row.offer.differences.map((value) => <li key={value}>{value}</li>)}</ul></> : null}</section>}
    {line.candidates.map((candidate, index) => <CandidateCard key={candidate.key} candidate={candidate} lineId={line.lineId} disabled={p.disabled} onSelect={() => p.onSelect(index)} onClear={p.onClear} />)}
    {line.canMarkNoOffer && <NoOfferDecisionCard lineId={line.lineId} selected={line.decisionKind === "no_offer"} disabled={p.disabled} onSelect={p.onNoOffer} onClear={p.onClear} />}
    {!line.candidates.length && line.rejectionSummary.length > 0 && <section><h4>Почему ничего не найдено</h4><ul>{line.rejectionSummary.map((item) => <li key={item.code}>{getReasonCodeLabel(item.code)}{item.code === "REQUEST_UNSUPPORTED" ? "" : ` — ${item.count}`}</li>)}</ul></section>}
    <ExcludedCandidates items={line.excludedCandidates} />
    <LineFeedbackEditor line={line} disabled={p.disabled} open={p.feedbackOpen} onOpenChange={p.onFeedbackOpenChange} onSave={p.onSaveFeedback} onClear={p.onClearFeedback} />
  </div>;
}
