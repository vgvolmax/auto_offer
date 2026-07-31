import type { ResultFilter } from "./useMatchResultReview";
const options: Record<ResultFilter, string> = {
  all: "Все",
  undecided: "Без решения",
  selected: "С выбранным товаром",
  no_offer: "Без предложения",
  with_feedback: "С обратной связью",
  no_match: "Без совпадений",
  review_required: "Требуют проверки заявки",
  excluded_by_policy: "Исключены правилами",
};
export function MatchResultsToolbar(p: {
  query: string;
  filter: ResultFilter;
  onQuery: (x: string) => void;
  onFilter: (x: ResultFilter) => void;
}) {
  return (
    <div className="results-toolbar">
      <label>
        Поиск по строкам заявки
        <input value={p.query} onChange={(e) => p.onQuery(e.target.value)} />
      </label>
      <label>
        Фильтр
        <select
          value={p.filter}
          onChange={(e) => p.onFilter(e.target.value as ResultFilter)}
        >
          {Object.entries(options).map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}
