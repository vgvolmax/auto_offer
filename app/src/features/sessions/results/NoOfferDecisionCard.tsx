export function NoOfferDecisionCard(p: { lineId: string; selected: boolean; disabled: boolean; clearLabel?: string; onSelect: () => void; onClear: () => void }) {
  return <div className="no-offer-card">
    {p.selected ? <><strong>✓ Без предложения</strong>{" "}<button disabled={p.disabled} onClick={p.onClear}>{p.clearLabel ?? "Снять решение"}</button></> : <button disabled={p.disabled} onClick={p.onSelect}>Оставить без предложения</button>}
  </div>;
}
