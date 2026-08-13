export interface RequestLineDisplayInput {
  rawText: string;
  identityName?: string;
  brand?: string;
  model?: string;
}

export interface RequestLineDisplay {
  primary: string;
  secondary?: string;
}

const KNOWN_PREFIX =
  /^Наименование и техническая характеристика оборудования и материалов:\s*/i;

/** Deterministic display cleanup only; the complete source remains untouched. */
export function buildRequestLineDisplay(
  input: RequestLineDisplayInput,
): RequestLineDisplay {
  const raw = input.rawText.trim();
  const leading = raw.replace(KNOWN_PREFIX, "").split(" | ", 1)[0]?.trim();
  const primary = input.identityName?.trim() || leading || raw || "Без наименования";
  const secondary = [input.brand?.trim(), input.model?.trim()]
    .filter((value): value is string => Boolean(value))
    .join(" · ");
  return { primary, ...(secondary ? { secondary } : {}) };
}
