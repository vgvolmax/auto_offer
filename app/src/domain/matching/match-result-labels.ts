const reasons: Record<string, string> = {
  CLASS_MATCH: "Класс товара совпадает",
  CLASS_MISMATCH: "Класс товара не совпадает",
  IDENTITY_MATCH: "Идентификатор товара совпадает",
  IDENTITY_DIFFERENCE: "Идентификатор товара отличается",
  IDENTITY_EXCLUDED: "Товар исключён по идентичности",
  ATTRIBUTE_MATCH: "Характеристика совпадает",
  ATTRIBUTE_DIFFERENCE: "Характеристика отличается",
  ATTRIBUTE_CONSTRAINT_FAILED: "Ограничение характеристики не выполнено",
  PORT_MATCH: "Подключение совпадает",
  PORT_ROLE_MISSING: "Не найдено подключение требуемой роли",
  PORT_CONSTRAINT_FAILED: "Ограничение подключения не выполнено",
  CATALOG_VALUE_MISSING: "В каталоге отсутствует требуемое значение",
  CATALOG_ITEM_INVALID: "Товар каталога не прошёл проверку",
  CATALOG_ITEM_NEEDS_REVIEW: "Товар каталога требует ручной проверки",
  REQUEST_UNSUPPORTED: "Нет подходящего класса в текущей taxonomy",
  REQUEST_REVIEW_REQUIRED: "Строка заявки требует ручной проверки",
  BRAND_NOT_INCLUDED: "Бренд не входит в разрешённые",
  BRAND_EXCLUDED: "Бренд исключён правилами",
  BRAND_UNKNOWN_EXCLUDED: "Товар без определённого бренда исключён",
  CATALOG_NOT_SELECTED: "Каталог не выбран для подбора",
  MATCH_LEVEL_NOT_ALLOWED: "Уровень совпадения запрещён правилами",
  EQUIVALENT_RULE_APPLIED: "Применено правило эквивалентной замены",
  ALTERNATIVE_RULE_APPLIED: "Применено правило альтернативной замены",
};
const resolutions: Record<string, string> = {
  single_exact: "Точное совпадение",
  multiple_exact: "Несколько точных",
  equivalent_only: "Только эквиваленты",
  alternative_only: "Только альтернативы",
  excluded_by_policy: "Исключено настройками",
  no_match: "Совпадений не найдено",
  request_unsupported: "Не поддерживается",
  request_review_required: "Нужно проверить заявку",
  request_invalid: "Ошибка в данных заявки",
};
export function formatMatchValue(value: unknown): string | undefined {
  if (value === undefined) return undefined;
  if (value === null) return "Не указано";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean")
    return String(value);
  return JSON.stringify(value);
}
export const formatMatchTarget = (value: unknown) =>
  formatMatchValue(value) ?? "";
export const getReasonCodeLabel = (code: string) =>
  reasons[code] ?? `Неизвестная причина: ${code}`;
export const getResolutionLabel = (code: string) => resolutions[code] ?? code;
export const getMatchLevelLabel = (level: string) =>
  ({ exact: "Точное", equivalent: "Эквивалент", alternative: "Альтернатива" })[
    level
  ] ?? level;
