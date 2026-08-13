import type { LineFeedback } from "../../../domain/matching/line-feedback";
import type { ProposalRowView } from "../../../domain/presentation/proposal-table-view";
import { ProposalRowDetails } from "./ProposalRowDetails";

const offerFallback: Record<string, string> = { operator_no_offer: "Нет предложения", recommended_no_offer: "Нет предложения", reroute: "Требуется уточнение", request_review: "Требуется проверить заявку", request_invalid: "Ошибка в строке заявки", request_unsupported: "Не поддерживается", undecided: "Решение не принято" };

export function ProposalTableRow(p: { row: ProposalRowView; expanded: boolean; feedbackOpen: boolean; disabled: boolean; saving: boolean; onToggle: () => void; onSelect: (index: number) => void; onClear: () => void; onNoOffer: () => Promise<boolean>; onFeedbackOpenChange: (open: boolean) => void; onSaveFeedback: (feedback: LineFeedback) => Promise<boolean>; onClearFeedback: () => Promise<boolean> }) {
  const id = `proposal-details-${p.row.lineId}`;
  const recommendation = p.row.offer.kind === "recommended_offer" || p.row.offer.kind === "recommended_no_offer";
  return <>
    <tr data-proposal-row><td>{p.row.position}</td><td><strong>{p.row.request.primary}</strong>{p.row.request.secondary && <small>{p.row.request.secondary}</small>}</td><td>{p.row.request.quantity ?? "—"}</td><td><strong>{p.row.offer.productLabel ?? offerFallback[p.row.offer.kind]}</strong>{p.row.offer.brand && <small>{p.row.offer.brand}</small>}<div className="proposal-offer-badges">{recommendation && <span className="proposal-badge info">Рекомендация ИИ</span>}{p.row.offer.kind === "selected_offer" && <span className="proposal-badge success">Выбрано</span>}{p.row.offer.availability === "manual_only" && <span className="proposal-badge warning">Товар требует проверки</span>}</div></td><td><span className={`proposal-badge ${p.row.statusTone}`}>{p.row.statusLabel}</span><button className="proposal-details-toggle" aria-label={`${p.row.lineId}: ${p.row.request.primary}`} aria-expanded={p.expanded} aria-controls={id} onClick={p.onToggle}>{p.expanded ? "Скрыть" : "Подробнее"}</button></td></tr>
    {p.expanded && <tr className="proposal-detail-row"><td colSpan={5}><div id={id}><ProposalRowDetails {...p} /></div></td></tr>}
  </>;
}
