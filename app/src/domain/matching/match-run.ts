import type { MatchResult } from "./index";
export interface MatchRunRecord {
  id: string;
  sessionId: string;
  sessionRevision: number;
  createdAt: string;
  result: MatchResult;
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
