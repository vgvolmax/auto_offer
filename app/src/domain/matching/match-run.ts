import type { MatchResult } from "./index";
import type { SemanticMatchResult, SemanticSelectionPolicy } from "./semantic-types";

interface MatchRunRecordBase {
  id: string;
  sessionId: string;
  sessionRevision: number;
  createdAt: string;
}

export interface PilotMatchRunRecord extends MatchRunRecordBase {
  runKind: "pilot";
  result: MatchResult;
}

export interface SemanticMatchRunRecord extends MatchRunRecordBase {
  runKind: "semantic";
  result: SemanticMatchResult;
  semanticContext: {
    taxonomyVersion: string;
    requestId: string;
    packageFingerprint: string;
    selectionPolicy: SemanticSelectionPolicy;
    catalogRefs: Array<{
      catalog_record_id: string;
      catalog_id: string;
      source_sha256: string;
      semantic_revision: number;
    }>;
  };
}

export type MatchRunRecord = PilotMatchRunRecord | SemanticMatchRunRecord;
export type StoredMatchRunRecord = MatchRunRecord | Omit<PilotMatchRunRecord, "runKind">;

export function normalizeMatchRunRecord(record: StoredMatchRunRecord): MatchRunRecord {
  if ("runKind" in record) return record;
  const normalized = { ...record } as MatchRunRecord;
  Object.defineProperty(normalized, "runKind", { value: "pilot", enumerable: false });
  return normalized;
}

export function matchRunFingerprint(run: MatchRunRecord): string {
  return run.runKind === "semantic"
    ? run.result.package_fingerprint
    : run.result.input_fingerprint;
}

export interface MatchRunSummary {
  totalLines: number;
  singleExact: number;
  multipleExact: number;
  equivalentOnly: number;
  alternativeOnly: number;
  excludedByPolicy: number;
  noMatch: number;
  requestReviewRequired: number;
}

export interface SemanticMatchRunSummary {
  totalLines: number;
  exactOfferCount: number;
  equivalentOfferCount: number;
  alternativeOfferCount: number;
  noOfferRecommendedCount: number;
  rerouteRequiredCount: number;
  requestReviewRequiredCount: number;
  requestInvalidCount: number;
  requestUnsupportedCount: number;
}

const keys: Record<string, keyof Omit<MatchRunSummary, "totalLines">> = {
  single_exact: "singleExact",
  multiple_exact: "multipleExact",
  equivalent_only: "equivalentOnly",
  alternative_only: "alternativeOnly",
  excluded_by_policy: "excludedByPolicy",
  no_match: "noMatch",
  request_review_required: "requestReviewRequired",
};

export function summarizeMatchResult(result: MatchResult): MatchRunSummary {
  const summary: MatchRunSummary = {
    totalLines: result.lines.length,
    singleExact: 0,
    multipleExact: 0,
    equivalentOnly: 0,
    alternativeOnly: 0,
    excludedByPolicy: 0,
    noMatch: 0,
    requestReviewRequired: 0,
  };
  for (const line of result.lines) {
    if (typeof line === "object" && line && "resolution" in line) {
      const key = keys[String(line.resolution)];
      if (key) summary[key]++;
    }
  }
  return summary;
}

export function summarizeSemanticMatchResult(
  result: SemanticMatchResult,
): SemanticMatchRunSummary {
  const summary: SemanticMatchRunSummary = {
    totalLines: result.lines.length,
    exactOfferCount: 0,
    equivalentOfferCount: 0,
    alternativeOfferCount: 0,
    noOfferRecommendedCount: 0,
    rerouteRequiredCount: 0,
    requestReviewRequiredCount: 0,
    requestInvalidCount: 0,
    requestUnsupportedCount: 0,
  };
  for (const line of result.lines) {
    if (line.decision === "offer") {
      if (line.match_level === "exact") summary.exactOfferCount++;
      if (line.match_level === "equivalent") summary.equivalentOfferCount++;
      if (line.match_level === "alternative") summary.alternativeOfferCount++;
    } else if (line.decision === "no_offer") summary.noOfferRecommendedCount++;
    else if (line.decision === "reroute_required") summary.rerouteRequiredCount++;
    else if (line.decision === "request_review_required") summary.requestReviewRequiredCount++;
    else if (line.decision === "request_invalid") summary.requestInvalidCount++;
    else if (line.decision === "request_unsupported") summary.requestUnsupportedCount++;
  }
  return summary;
}
