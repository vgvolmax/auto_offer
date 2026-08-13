import { describe, expect, it } from "vitest";
import { summarizeSemanticMatchResult } from "./match-run";

describe("semantic match run summary", () => {
  it("counts every semantic status without legacy inference", () => {
    const lines = [
      { decision: "offer", match_level: "exact" },
      { decision: "offer", match_level: "equivalent" },
      { decision: "offer", match_level: "equivalent" },
      { decision: "offer", match_level: "alternative" },
      ...Array.from({ length: 3 }, () => ({ decision: "no_offer" })),
      { decision: "reroute_required" },
      ...Array.from({ length: 2 }, () => ({ decision: "request_review_required" })),
      { decision: "request_invalid" },
      ...Array.from({ length: 4 }, () => ({ decision: "request_unsupported" })),
    ].map((line, index) => ({ line_id: `line-${index}`, ...line }));

    const summary = summarizeSemanticMatchResult({ lines } as never);
    expect(summary).toEqual({
      totalLines: 15,
      exactOfferCount: 1,
      equivalentOfferCount: 2,
      alternativeOfferCount: 1,
      noOfferRecommendedCount: 3,
      rerouteRequiredCount: 1,
      requestReviewRequiredCount: 2,
      requestInvalidCount: 1,
      requestUnsupportedCount: 4,
    });
    expect(summary.totalLines).toBe(
      Object.values(summary).slice(1).reduce((sum, count) => sum + count, 0),
    );
  });
});
