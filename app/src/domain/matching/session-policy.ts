import type { CatalogRecord } from "../catalog";
import type { MatcherInput } from "./index";

export interface SessionMatchingSettings {
  schemaVersion: "1.0.0";
  maxMatchLevel: "exact" | "equivalent" | "alternative";
  catalogNeedsReview: "exclude" | "manual_only";
  brands: {
    include: string[];
    exclude: string[];
    preferred: string[];
    unknown: "allow" | "exclude";
  };
  catalogPriority: string[];
}
export interface SessionMatchingSettingsIssue {
  code: string;
  path: string;
  message: string;
}
export type MatchingPolicy = MatcherInput["policy"];

export const createDefaultSessionMatchingSettings = (
  ids: readonly string[],
): SessionMatchingSettings => ({
  schemaVersion: "1.0.0",
  maxMatchLevel: "alternative",
  catalogNeedsReview: "exclude",
  brands: { include: [], exclude: [], preferred: [], unknown: "allow" },
  catalogPriority: [...ids],
});
export function normalizeSessionMatchingSettings(
  value: SessionMatchingSettings | undefined,
  ids: readonly string[],
): SessionMatchingSettings {
  if (!value) return createDefaultSessionMatchingSettings(ids);
  return {
    ...value,
    brands: {
      ...value.brands,
      include: [...value.brands.include],
      exclude: [...value.brands.exclude],
      preferred: [...value.brands.preferred],
    },
    catalogPriority: [...value.catalogPriority],
  };
}
export const equalSessionMatchingSettings = (
  a: SessionMatchingSettings,
  b: SessionMatchingSettings,
) => JSON.stringify(a) === JSON.stringify(b);
export function validateSessionMatchingSettings(
  settings: SessionMatchingSettings,
  catalogIds: readonly string[],
): SessionMatchingSettingsIssue[] {
  const issues: SessionMatchingSettingsIssue[] = [];
  const priority = new Set(settings.catalogPriority);
  if (priority.size !== settings.catalogPriority.length)
    issues.push({
      code: "DUPLICATE_CATALOG",
      path: "catalogPriority",
      message: "Приоритет содержит повторяющийся каталог",
    });
  for (const id of catalogIds)
    if (!priority.has(id))
      issues.push({
        code: "CATALOG_MISSING",
        path: "catalogPriority",
        message: `В приоритете отсутствует каталог ${id}`,
      });
  for (const id of priority)
    if (!catalogIds.includes(id))
      issues.push({
        code: "UNKNOWN_CATALOG",
        path: "catalogPriority",
        message: `Неизвестный каталог ${id}`,
      });
  const { include, exclude, preferred } = settings.brands;
  for (const [name, values] of Object.entries({
    include,
    exclude,
    preferred,
  })) {
    if (new Set(values).size !== values.length)
      issues.push({
        code: "DUPLICATE_BRAND",
        path: `brands.${name}`,
        message: "Список брендов содержит дубликаты",
      });
    if (values.some((value) => value.length === 0))
      issues.push({
        code: "EMPTY_BRAND",
        path: `brands.${name}`,
        message: "Brand ID не может быть пустым",
      });
  }
  for (const brand of include)
    if (exclude.includes(brand))
      issues.push({
        code: "BRAND_CONFLICT",
        path: "brands.include",
        message: `Бренд ${brand} одновременно разрешён и исключён`,
      });
  for (const brand of preferred) {
    if (exclude.includes(brand))
      issues.push({
        code: "PREFERRED_EXCLUDED",
        path: "brands.preferred",
        message: `Исключённый бренд ${brand} не может быть предпочтительным`,
      });
    if (include.length && !include.includes(brand))
      issues.push({
        code: "PREFERRED_NOT_INCLUDED",
        path: "brands.preferred",
        message: `Предпочтительный бренд ${brand} должен быть разрешён`,
      });
  }
  return issues;
}
export function buildSessionMatchingPolicy(input: {
  sessionId: string;
  catalogRecordIds: readonly string[];
  settings: SessionMatchingSettings;
  policyRegistryVersion: string;
}): MatchingPolicy {
  return {
    schema_version: "1.0.0",
    kind: "matching_policy",
    policy_id: `session:${input.sessionId}`,
    policy_registry_version: input.policyRegistryVersion,
    catalog_record_ids: [...input.catalogRecordIds],
    catalog_priority: [...input.settings.catalogPriority],
    brands: {
      include: [...input.settings.brands.include],
      exclude: [...input.settings.brands.exclude],
      preferred: [...input.settings.brands.preferred],
      unknown: input.settings.brands.unknown,
    },
    max_match_level: input.settings.maxMatchLevel,
    catalog_needs_review: input.settings.catalogNeedsReview,
  };
}
export function collectAvailableBrandIds(
  catalogs: readonly CatalogRecord[],
): string[] {
  const values = new Set<string>();
  for (const catalog of catalogs)
    for (const item of catalog.bundle.items) {
      const brand = (
        item.catalog_item as { identity?: { brand?: unknown } } | undefined
      )?.identity?.brand;
      if (typeof brand === "string" && brand.length) values.add(brand);
    }
  return [...values].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
}
