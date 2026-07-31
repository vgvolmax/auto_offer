import type { CatalogRecord } from "../../../domain/catalog";
export function CatalogPriorityEditor({
  ids,
  catalogs,
  onChange,
}: {
  ids: string[];
  catalogs: CatalogRecord[];
  onChange: (ids: string[]) => void;
}) {
  const move = (i: number, d: number) => {
    const next = [...ids],
      [item] = next.splice(i, 1);
    next.splice(i + d, 0, item);
    onChange(next);
  };
  return (
    <fieldset>
      <legend>Приоритет каталогов</legend>
      {ids.map((id, i) => (
        <div className="policy-row" key={id}>
          <span>
            {catalogs.find((c) => c.recordId === id)?.catalogId ?? id}
          </span>
          <button
            type="button"
            disabled={!i}
            aria-label={`Поднять каталог ${id} выше`}
            onClick={() => move(i, -1)}
          >
            Выше
          </button>
          <button
            type="button"
            disabled={i === ids.length - 1}
            aria-label={`Опустить каталог ${id} ниже`}
            onClick={() => move(i, 1)}
          >
            Ниже
          </button>
        </div>
      ))}
    </fieldset>
  );
}
