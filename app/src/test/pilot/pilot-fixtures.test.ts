import { describe, expect, it } from "vitest";
import { runPilotMatcher } from "../../domain/matching";
import { PILOT_MATCHING_ENGINE_VERSION, pilotPolicyRegistry } from "../../domain/matching/pilot-config";
import { buildSessionMatchingPolicy, createDefaultSessionMatchingSettings } from "../../domain/matching/session-policy";
import { validateCatalogBundle } from "../../validation/validate-catalog-bundle";
import { validateRequestBundle } from "../../validation/validate-request-bundle";
import { createPilotWorkflowFixture } from "./pilot-fixtures";

describe("canonical Pilot 1.0 workflow fixture", () => {
  it("is valid, deterministic, immutable, and exposes priority-sensitive ranking", async () => {
    const fixture = createPilotWorkflowFixture();
    const before = structuredClone(fixture);
    expect(validateCatalogBundle(fixture.primaryCatalogBundle).valid).toBe(true);
    expect(validateCatalogBundle(fixture.secondaryCatalogBundle).valid).toBe(true);
    expect(validateRequestBundle(fixture.requestBundle).valid).toBe(true);
    const ids = ["pilot-primary-record", "pilot-secondary-record"];
    const execute = (priority: string[]) => runPilotMatcher({
      requestBundle: fixture.requestBundle,
      catalogs: [
        { catalogRecordId: ids[0], bundle: fixture.primaryCatalogBundle },
        { catalogRecordId: ids[1], bundle: fixture.secondaryCatalogBundle },
      ],
      policy: buildSessionMatchingPolicy({
        sessionId: "pilot-fixture",
        catalogRecordIds: ids,
        settings: { ...createDefaultSessionMatchingSettings(ids), maxMatchLevel: "exact", catalogPriority: priority },
        policyRegistryVersion: pilotPolicyRegistry.policy_version,
      }),
      registry: pilotPolicyRegistry,
      engineVersion: PILOT_MATCHING_ENGINE_VERSION,
    } as any);
    const primaryFirst = await execute(ids);
    const repeat = await execute(ids);
    const secondaryFirst = await execute([...ids].reverse());
    const ranked = (result: any) => result.lines.find((x: any) => x.line_id === fixture.expected.rankedLineId);
    expect(ranked(primaryFirst).candidates).toHaveLength(2);
    expect(ranked(primaryFirst).candidates[0].offer_ref.catalog_record_id).toBe(ids[0]);
    expect(ranked(secondaryFirst).candidates[0].offer_ref.catalog_record_id).toBe(ids[1]);
    expect((primaryFirst as any).lines.find((x: any) => x.line_id === fixture.expected.selectedLineId).candidates.length).toBeGreaterThan(0);
    expect((primaryFirst as any).lines.find((x: any) => x.line_id === fixture.expected.noOfferLineId).candidates).toHaveLength(0);
    expect(repeat).toEqual(primaryFirst);
    expect(fixture).toEqual(before);
  });
});
