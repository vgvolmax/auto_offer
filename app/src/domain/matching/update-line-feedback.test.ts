import { describe, expect, it } from "vitest";
import { normalizeLineFeedback } from "./line-feedback";
describe("line feedback normalization", () => {
  it("trims comments, removes empty feedback and incompatible fields without mutation", () => {
    const relatedOfferRef = { catalog_record_id: "r", catalog_id: "c", source_sha256: "s", source_item_id: "i" };
    const input = { outcome: "correct_result" as const, suspectedCause: "unknown_cause" as const, comment: "  полезно  ", relatedOfferRef };
    const snapshot = structuredClone(input);
    expect(normalizeLineFeedback(input)).toEqual({ outcome: "correct_result", comment: "полезно" });
    expect(normalizeLineFeedback({ comment: "   " })).toBeUndefined();
    expect(input).toEqual(snapshot);
  });
});
