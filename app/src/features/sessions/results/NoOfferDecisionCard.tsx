export function NoOfferDecisionCard(p: { lineId: string; selected: boolean; disabled: boolean; onSelect: () => void; onClear: () => void }) {
  return <article className="candidate-card no-offer-card">
    <h4>Оставить строку без предложения</h4>
    <p>Используйте это решение, когда по строке не нужно предлагать ни один из найденных товаров.</p>
    <label><input type="radio" name={`selection-${p.lineId}`} checked={p.selected} disabled={p.disabled} readOnly /> {p.selected ? "Решение: без предложения" : "Без предложения не выбрано"}</label>{" "}
    {p.selected ? <button disabled={p.disabled} onClick={p.onClear}>Снять решение</button> : <button disabled={p.disabled} onClick={p.onSelect}>Оставить без предложения</button>}
  </article>;
}
