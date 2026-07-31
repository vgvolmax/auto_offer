import type { CatalogRecord } from "../catalog";
import type { SessionRecord } from "../session";
import type { MatchRunRecord } from "./match-run";
import {
  formatMatchTarget,
  formatMatchValue,
  getReasonCodeLabel,
} from "./match-result-labels";
import { equalOfferRefs, offerRefKey, type OfferRef } from "./offer-ref";
import { SelectionError, type SelectionStateRecord } from "./selection-state";
import type { LineDecision } from "./selection-state";
import type { LineFeedback } from "./line-feedback";
export type MatchLevel = "exact" | "equivalent" | "alternative";
export type CandidateAvailability = "eligible" | "manual_only";
export type MatchLineResolution =
  | "single_exact"
  | "multiple_exact"
  | "equivalent_only"
  | "alternative_only"
  | "excluded_by_policy"
  | "no_match"
  | "request_review_required"
  | "request_invalid";
export interface MatchCheckView {
  scope: string;
  target: string;
  operator?: string;
  expected?: string;
  actual?: string;
  outcome: string;
  effect: string;
  code: string;
  label: string;
}
export interface CandidateReviewView {
  key: string;
  offerRef: OfferRef;
  catalogLabel: string;
  sourceItemId: string;
  productLabel: string;
  classId?: string;
  brand?: string;
  matchLevel: MatchLevel;
  availability: CandidateAvailability;
  checks: MatchCheckView[];
  differences: MatchCheckView[];
  selected: boolean;
  suggested: boolean;
  selectable: boolean;
  resultPosition: number;
}
export interface ExcludedCandidateReviewView extends CandidateReviewView {
  exclusionCodes: string[];
}
export interface MatchLineReviewView {
  lineId: string;
  position: number;
  requestText: string;
  quantityLabel?: string;
  classId?: string;
  resolution: MatchLineResolution;
  candidates: CandidateReviewView[];
  excludedCandidates: ExcludedCandidateReviewView[];
  rejectionSummary: Array<{ code: string; label: string; count: number }>;
  decision?: LineDecision;
  decisionKind?: "selected_offer" | "no_offer";
  hasDecision: boolean;
  feedback?: LineFeedback;
  selectedOfferRef?: OfferRef;
  hasSelection: boolean;
  selectable: boolean;
  canSelectCandidate: boolean;
  canMarkNoOffer: boolean;
}
export interface MatchResultReviewDiagnostic {
  code:
    | "RESULT_LINE_INVALID"
    | "REQUEST_LINE_MISSING"
    | "CATALOG_RECORD_REFERENCE_MISSING"
    | "CATALOG_ITEM_REFERENCE_MISSING"
    | "SELECTION_CANDIDATE_MISSING";
  path: string;
  message: string;
}
export interface MatchResultReviewView {
  runId: string;
  current: boolean;
  lines: MatchLineReviewView[];
  selectedCount: number;
  selectableLineCount: number;
  unresolvedSelectableCount: number;
  lineCount: number;
  decidedCount: number;
  undecidedCount: number;
  noOfferCount: number;
  feedbackCount: number;
  diagnostics: MatchResultReviewDiagnostic[];
}
type Obj = Record<string, unknown>;
interface IndexedCatalogItem {
  source: Record<string, unknown>;
  catalogItem: Record<string, unknown>;
}
const object = (x: unknown): x is Obj =>
  typeof x === "object" && x !== null && !Array.isArray(x);
const text = (x: unknown) => (typeof x === "string" ? x : undefined);
const array = (x: unknown): unknown[] => (Array.isArray(x) ? x : []);
function offer(x: unknown): OfferRef | undefined {
  if (!object(x)) return;
  const values = [
    x.catalog_record_id,
    x.catalog_id,
    x.source_sha256,
    x.source_item_id,
  ];
  if (values.every((v) => typeof v === "string"))
    return x as unknown as OfferRef;
}
export function getCatalogItemBrand(catalogItem: unknown): string | undefined {
  if (!object(catalogItem) || !object(catalogItem.identity)) return undefined;
  const brand = text(catalogItem.identity.brand);
  return brand?.trim() ? brand : undefined;
}
export function getCatalogItemDisplayLabel(input: {
  source: unknown;
  catalogItem: unknown;
  fallbackSourceItemId: string;
}): string {
  if (object(input.source)) {
    const rawName = text(input.source.raw_name)?.trim();
    if (rawName) return rawName;
  }
  if (!object(input.catalogItem)) return input.fallbackSourceItemId;
  for (const key of ["raw_text", "name", "product_name", "title"]) {
    const value = text(input.catalogItem[key])?.trim();
    if (value) return value;
  }
  const sourceItemId =
    text(input.catalogItem.source_item_id)?.trim() ||
    input.fallbackSourceItemId;
  const brand = getCatalogItemBrand(input.catalogItem);
  return brand ? `${brand} ${sourceItemId}` : sourceItemId;
}
function check(raw: unknown): MatchCheckView | undefined {
  if (!object(raw)) return;
  const code = text(raw.code) ?? "UNKNOWN";
  return {
    scope: text(raw.scope) ?? "",
    target: formatMatchTarget(raw.target),
    operator: text(raw.operator),
    expected: formatMatchValue(raw.expected),
    actual: formatMatchValue(raw.actual),
    outcome: text(raw.outcome) ?? "",
    effect: text(raw.effect) ?? "",
    code,
    label: getReasonCodeLabel(code),
  };
}

export function buildMatchResultReviewView(input: {
  session: SessionRecord;
  catalogs: readonly CatalogRecord[];
  run: MatchRunRecord;
  selectionState: SelectionStateRecord;
  current: boolean;
}): MatchResultReviewView {
  const { run, selectionState } = input;
  if (
    selectionState.matchRunId !== run.id ||
    selectionState.sessionId !== run.sessionId ||
    selectionState.inputFingerprint !== run.result.input_fingerprint
  )
    throw new SelectionError(
      "SelectionState не соответствует запуску",
      "SELECTION_STATE_RUN_MISMATCH",
    );
  const diagnostics: MatchResultReviewDiagnostic[] = [];
  const requests = new Map(
    input.session.requestBundle.request_document.lines.map((x) => [
      x.line_id,
      x,
    ]),
  );
  const catalogs = new Map(input.catalogs.map((c) => [c.recordId, c]));
  const items = new Map<string, IndexedCatalogItem>();
  for (const catalog of input.catalogs)
    for (const raw of catalog.bundle.items) {
      const rawValue: unknown = raw;
      if (!object(rawValue) || !object(rawValue.catalog_item)) continue;
      const id = text(rawValue.catalog_item.source_item_id);
      if (id)
        items.set(
          offerRefKey({
            catalog_record_id: catalog.recordId,
            catalog_id: catalog.catalogId,
            source_sha256: catalog.sourceSha256,
            source_item_id: id,
          }),
          {
            source: object(rawValue.source) ? rawValue.source : {},
            catalogItem: rawValue.catalog_item,
          },
        );
    }
  const lines: MatchLineReviewView[] = [];
  array(run.result.lines).forEach((raw, index) => {
    if (!object(raw) || !text(raw.line_id)) {
      diagnostics.push({
        code: "RESULT_LINE_INVALID",
        path: `lines[${index}]`,
        message: "Повреждённая строка результата",
      });
      return;
    }
    const lineId = text(raw.line_id)!;
    const request = requests.get(lineId);
    if (!request)
      diagnostics.push({
        code: "REQUEST_LINE_MISSING",
        path: `lines[${index}]`,
        message: `Строка ${lineId} отсутствует в заявке`,
      });
    const decision = selectionState.decisions[lineId];
    let brokenSelection = false;
    const mapCandidate = (
      value: unknown,
      excluded: boolean,
    ): CandidateReviewView | ExcludedCandidateReviewView | undefined => {
      if (!object(value)) return;
      const ref = offer(value.offer_ref);
      if (!ref) return;
      const catalog = catalogs.get(ref.catalog_record_id);
      const found = items.get(offerRefKey(ref));
      if (!catalog)
        diagnostics.push({
          code: "CATALOG_RECORD_REFERENCE_MISSING",
          path: `${lineId}.${ref.source_item_id}`,
          message: "Версия каталога не найдена",
        });
      else if (!found)
        diagnostics.push({
          code: "CATALOG_ITEM_REFERENCE_MISSING",
          path: `${lineId}.${ref.source_item_id}`,
          message: "Товар каталога не найден",
        });
      const selected = Boolean(
        decision?.kind === "selected_offer" && equalOfferRefs(decision.offerRef, ref),
      );
      const base: CandidateReviewView = {
        key: offerRefKey(ref),
        offerRef: ref,
        catalogLabel: catalog?.sourceFileName ?? ref.catalog_id,
        sourceItemId: ref.source_item_id,
        productLabel: found
          ? getCatalogItemDisplayLabel({
              source: found.source,
              catalogItem: found.catalogItem,
              fallbackSourceItemId: ref.source_item_id,
            })
          : "Товар не найден в сохранённой версии каталога",
        classId: found && text(found.catalogItem.class_id),
        brand: found && getCatalogItemBrand(found.catalogItem),
        matchLevel: (text(value.match_level) ?? "alternative") as MatchLevel,
        availability: (text(value.availability) ??
          "eligible") as CandidateAvailability,
        checks: array(value.checks)
          .map(check)
          .filter((x): x is MatchCheckView => Boolean(x)),
        differences: array(value.differences)
          .map(check)
          .filter((x): x is MatchCheckView => Boolean(x)),
        selected,
        suggested: false,
        selectable: input.current && !excluded && Boolean(found),
        resultPosition: 0,
      };
      return excluded
        ? {
            ...base,
            selectable: false,
            exclusionCodes: array(value.exclusion_codes).map(String),
          }
        : base;
    };
    const candidates = array(raw.candidates)
      .map((x, position) => { const candidate = mapCandidate(x, false); if (candidate) candidate.resultPosition = position + 1; return candidate; })
      .filter((x): x is CandidateReviewView => Boolean(x));
    const excluded = array(raw.excluded_candidates)
      .map((x, position) => { const candidate = mapCandidate(x, true); if (candidate) candidate.resultPosition = position + 1; return candidate; })
      .filter((x): x is ExcludedCandidateReviewView => Boolean(x));
    if (decision?.kind === "selected_offer" && !candidates.some((c) => c.selected)) {
      brokenSelection = true;
      diagnostics.push({
        code: "SELECTION_CANDIDATE_MISSING",
        path: `decisions.${lineId}`,
        message: "Выбранное предложение отсутствует в запуске",
      });
    }
    const resolution = (text(raw.resolution) ??
      "request_invalid") as MatchLineResolution;
    if (resolution === "single_exact") {
      const suggested = candidates.find(
        (c) => c.selectable && c.matchLevel === "exact",
      );
      if (suggested) suggested.suggested = true;
    }
    const quantity = request?.quantity;
    const quantityLabel = quantity
      ? `${quantity.value} ${quantity.unit}`
      : undefined;
    lines.push({
      lineId,
      position: index + 1,
      requestText: request?.raw_text ?? "Техническая ошибка строки",
      quantityLabel,
      classId: request?.class_id,
      resolution,
      candidates,
      excludedCandidates: excluded,
      rejectionSummary: array(raw.rejection_summary)
        .filter(object)
        .map((r) => ({
          code: text(r.code) ?? "UNKNOWN",
          label: getReasonCodeLabel(text(r.code) ?? "UNKNOWN"),
          count: typeof r.count === "number" ? r.count : 0,
        })),
      decision,
      decisionKind: decision?.kind,
      hasDecision: Boolean(decision),
      feedback: selectionState.feedback?.[lineId],
      selectedOfferRef: decision?.kind === "selected_offer" ? decision.offerRef : undefined,
      hasSelection: decision?.kind === "selected_offer",
      selectable: !brokenSelection && candidates.some((c) => c.selectable),
      canSelectCandidate: !brokenSelection && candidates.some((c) => c.selectable),
      canMarkNoOffer: input.current,
    });
  });
  return {
    runId: run.id,
    current: input.current,
    lines,
    selectedCount: lines.filter((x) => x.decisionKind === "selected_offer").length,
    selectableLineCount: lines.filter((x) => x.candidates.length > 0).length,
    unresolvedSelectableCount: lines.filter(
      (x) => x.selectable && !x.hasDecision,
    ).length,
    lineCount: lines.length,
    decidedCount: lines.filter((x) => x.hasDecision).length,
    undecidedCount: lines.filter((x) => !x.hasDecision).length,
    noOfferCount: lines.filter((x) => x.decisionKind === "no_offer").length,
    feedbackCount: lines.filter((x) => x.feedback).length,
    diagnostics,
  };
}
