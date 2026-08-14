import { describe, expect, it } from "vitest";
import { matchesResultFilter } from "./useMatchResultReview";

const line = (input: Record<string, unknown> = {}) => ({
  lineId: "line", requestText: "request", candidates: [], hasDecision: false,
  resolution: "no_match", effectiveOutcome: { kind: "unresolved" }, ...input,
}) as never;

describe("matchesResultFilter", () => {
  it("filters semantic rows by their effective outcome, including AI and unsupported baselines", () => {
    const offer = line({ effectiveOutcome: { kind: "selected_offer", source: "ai" } });
    const aiNoOffer = line({ effectiveOutcome: { kind: "no_offer", source: "ai" } });
    const unsupported = line({ resolution: "request_unsupported", effectiveOutcome: { kind: "no_offer", source: "unsupported" } });
    const unresolved = line({ effectiveOutcome: { kind: "unresolved" } });
    const operatorNoOffer = line({ hasDecision: true, decisionKind: "no_offer", effectiveOutcome: { kind: "no_offer", source: "operator" } });
    expect([offer, aiNoOffer, unsupported, unresolved, operatorNoOffer].filter((x) => matchesResultFilter(x, "selected", "semantic"))).toEqual([offer]);
    expect([offer, aiNoOffer, unsupported, unresolved, operatorNoOffer].filter((x) => matchesResultFilter(x, "no_offer", "semantic"))).toEqual([aiNoOffer, unsupported, operatorNoOffer]);
    expect([offer, aiNoOffer, unsupported, unresolved, operatorNoOffer].filter((x) => matchesResultFilter(x, "undecided", "semantic"))).toEqual([unresolved]);
  });

  it("keeps Pilot filters dependent on explicit operator decisions", () => {
    const candidateOnly = line({ candidates: [{}], effectiveOutcome: undefined });
    expect(matchesResultFilter(candidateOnly, "selected", "pilot")).toBe(false);
    expect(matchesResultFilter(candidateOnly, "no_offer", "pilot")).toBe(false);
    expect(matchesResultFilter(candidateOnly, "undecided", "pilot")).toBe(true);
    expect(matchesResultFilter(line({ hasDecision: true, decisionKind: "selected_offer" }), "selected", "pilot")).toBe(true);
  });
});
