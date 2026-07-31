const reasons: Record<string, string> = {
  CLASS_MATCH: "Класс совпадает", ATTRIBUTE_MATCH: "Характеристика совпадает",
  ATTRIBUTE_MISMATCH: "Характеристика отличается", CATALOG_ITEM_NEEDS_REVIEW: "Товар каталога требует проверки",
  BRAND_EXCLUDED: "Бренд исключён", BRAND_NOT_INCLUDED: "Бренд не включён",
  MATCH_LEVEL_EXCEEDS_POLICY: "Уровень совпадения запрещён правилами",
};
const resolutions: Record<string, string> = { single_exact: "Точное совпадение", multiple_exact: "Несколько точных",
  equivalent_only: "Только эквиваленты", alternative_only: "Только альтернативы", excluded_by_policy: "Исключены правилами",
  no_match: "Без совпадений", request_review_required: "Проверка заявки", request_invalid: "Ошибка заявки" };
export function formatMatchValue(value: unknown): string | undefined {
  if (value === undefined) return undefined;
  if (value === null) return "Не указано";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return JSON.stringify(value);
}
export const formatMatchTarget = (value: unknown) => formatMatchValue(value) ?? "";
export const getReasonCodeLabel = (code: string) => reasons[code] ?? `Неизвестная причина: ${code}`;
export const getResolutionLabel = (code: string) => resolutions[code] ?? code;
export const getMatchLevelLabel = (level: string) => ({ exact: "Точное", equivalent: "Эквивалент", alternative: "Альтернатива" }[level] ?? level);
