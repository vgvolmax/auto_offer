import { describe, expect, it } from "vitest";
import { buildRequestLineDisplay } from "./request-line-display";

describe("buildRequestLineDisplay", () => {
  it("uses the product-defining segment and leaves the input untouched", () => {
    const rawText = "Наименование и техническая характеристика оборудования и материалов: Фитинг полипропиленовый - тройник 20 мм | Тип, марка: VTp.731.0.020 | Завод-изготовитель: Valtek | Примечание: или эквивалент";
    const input = { rawText };
    expect(buildRequestLineDisplay(input).primary).toBe("Фитинг полипропиленовый - тройник 20 мм");
    expect(input.rawText).toBe(rawText);
  });

  it("keeps a simple request", () => {
    expect(buildRequestLineDisplay({ rawText: "Кран шаровой DN25" })).toEqual({
      primary: "Кран шаровой DN25",
    });
  });
});
