import type { SessionMatchingSettings } from "../../../domain/matching/session-policy";
export function BrandPolicyEditor({
  brands,
  available,
  onChange,
  locked,
}: {
  brands: SessionMatchingSettings["brands"];
  available: string[];
  onChange: (v: SessionMatchingSettings["brands"]) => void;
  locked: boolean;
}) {
  const all = [
    ...new Set([
      ...available,
      ...brands.include,
      ...brands.exclude,
      ...brands.preferred,
    ]),
  ].sort();
  const toggle = (
    brand: string,
    key: "include" | "exclude" | "preferred",
    checked: boolean,
  ) => {
    let next = {
      ...brands,
      include: [...brands.include],
      exclude: [...brands.exclude],
      preferred: [...brands.preferred],
    };
    next[key] = checked
      ? [...next[key], brand]
      : next[key].filter((x) => x !== brand);
    if (key === "exclude" && checked) {
      next.include = next.include.filter((x) => x !== brand);
      next.preferred = next.preferred.filter((x) => x !== brand);
    }
    if (key === "include" && checked)
      next.exclude = next.exclude.filter((x) => x !== brand);
    onChange(next);
  };
  const move = (i: number, d: number) => {
    const preferred = [...brands.preferred],
      [v] = preferred.splice(i, 1);
    preferred.splice(i + d, 0, v);
    onChange({ ...brands, preferred });
  };
  return (
    <fieldset disabled={locked}>
      <legend>Правила брендов</legend>
      {all.length === 0 && <p>В каталогах нет известных брендов.</p>}
      {all.map((brand) => {
        const missing = !available.includes(brand),
          excluded = brands.exclude.includes(brand),
          includeLimited = brands.include.length > 0;
        return (
          <div className="brand-row" key={brand}>
            <span>
              {brand} {missing && <small>Нет в текущих каталогах</small>}
            </span>
            <label>
              <input
                type="checkbox"
                checked={brands.include.includes(brand)}
                onChange={(e) => toggle(brand, "include", e.target.checked)}
              />{" "}
              Допустимый
            </label>
            <label>
              <input
                type="checkbox"
                checked={excluded}
                onChange={(e) => toggle(brand, "exclude", e.target.checked)}
              />{" "}
              Исключённый
            </label>
            <label>
              <input
                type="checkbox"
                disabled={
                  excluded ||
                  (includeLimited && !brands.include.includes(brand))
                }
                checked={brands.preferred.includes(brand)}
                onChange={(e) => toggle(brand, "preferred", e.target.checked)}
              />{" "}
              Предпочтительный
            </label>
            {brands.preferred.includes(brand) && (
              <span>
                <button
                  type="button"
                  disabled={!brands.preferred.indexOf(brand)}
                  onClick={() => move(brands.preferred.indexOf(brand), -1)}
                >
                  Выше
                </button>
                <button
                  type="button"
                  disabled={
                    brands.preferred.indexOf(brand) ===
                    brands.preferred.length - 1
                  }
                  onClick={() => move(brands.preferred.indexOf(brand), 1)}
                >
                  Ниже
                </button>
              </span>
            )}
          </div>
        );
      })}
      <label>
        Неизвестный бренд
        <select
          value={brands.unknown}
          onChange={(e) =>
            onChange({
              ...brands,
              unknown: e.target.value as "allow" | "exclude",
            })
          }
        >
          <option value="allow">Разрешать</option>
          <option value="exclude">Исключать</option>
        </select>
      </label>
    </fieldset>
  );
}
