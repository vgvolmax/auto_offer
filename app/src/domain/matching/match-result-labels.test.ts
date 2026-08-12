import { describe, expect, it } from "vitest";
import { getReasonCodeLabel, getResolutionLabel } from "./match-result-labels";

describe("match result presentation labels", () => {
  it("uses operator-readable labels without changing canonical keys", () => {
    expect(getResolutionLabel("request_unsupported")).toBe("Не поддерживается");
    expect(getResolutionLabel("no_match")).toBe("Совпадений не найдено");
    expect(getResolutionLabel("request_review_required")).toBe("Нужно проверить заявку");
    expect(getResolutionLabel("request_invalid")).toBe("Ошибка в данных заявки");
    expect(getResolutionLabel("excluded_by_policy")).toBe("Исключено настройками");
    expect(getReasonCodeLabel("REQUEST_UNSUPPORTED")).toBe("Нет подходящего класса в текущей taxonomy");
  });
});
