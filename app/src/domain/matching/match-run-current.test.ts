import {describe,expect,it} from 'vitest';
import catalogBundle from '../../../../tests/fixtures/matching/golden/shared/catalog-main.json';
import requestBundle from '../../../../tests/fixtures/matching/golden/D1-single-exact/request.json';
import {createCatalogRecord} from '../catalog';
import {createDraftSession} from '../session';
import {buildSessionMatchingPolicy} from './session-policy';
import {pilotPolicyRegistry} from './pilot-config';
import {isMatchRunCurrent} from './match-run-current';
import {buildSemanticSelectionPolicy} from './semantic-session-matching';

describe('match run catalog currentness',()=>{it.each([[undefined,0,true],[0,1,false],[1,1,true]] as const)('compares result revision %s with stored revision %s',(resultRevision,storedRevision,current)=>{const catalog={...createCatalogRecord(catalogBundle as any),recordId:'record-main',semanticRevision:storedRevision},session=createDraftSession(requestBundle as any,[catalog],'currentness'),ref:any={catalog_record_id:catalog.recordId,catalog_id:catalog.catalogId,source_sha256:catalog.sourceSha256};if(resultRevision!==undefined)ref.catalog_revision=resultRevision;const policy=buildSessionMatchingPolicy({sessionId:session.sessionId,catalogRecordIds:session.catalogRecordIds,settings:session.matchingSettings,policyRegistryVersion:pilotPolicyRegistry.policy_version}),run:any={sessionRevision:session.matchingRevision,result:{request_id:session.requestId,policy,catalog_refs:[ref]}};expect(isMatchRunCurrent({session,catalogs:[catalog],run})).toBe(current)})});

describe("semantic match run currentness", () => {
  function fixture() {
    const base = createCatalogRecord(catalogBundle as any);
    const catalogs = [
      { ...base, recordId: "catalog-A", catalogId: "catalog-a", sourceSha256: "sha-a", semanticRevision: 1 },
      { ...base, recordId: "catalog-B", catalogId: "catalog-b", sourceSha256: "sha-b", semanticRevision: 2 },
    ];
    const initial = createDraftSession(requestBundle as any, catalogs, "semantic-currentness");
    const session: any = {
      ...initial,
      matchingSettings: { ...initial.matchingSettings, catalogPriority: ["catalog-A", "catalog-B"] },
    };
    const selectionPolicy = buildSemanticSelectionPolicy(session.matchingSettings);
    const run: any = {
      id: "semantic-run", sessionId: session.sessionId, sessionRevision: session.matchingRevision,
      createdAt: "2026-01-01T00:00:00Z", runKind: "semantic", result: { package_fingerprint: "fp", lines: [] },
      semanticContext: {
        requestId: session.requestId,
        taxonomyVersion: session.requestBundle.taxonomy_version,
        packageFingerprint: "fp",
        selectionPolicy,
        catalogRefs: catalogs.map((catalog) => ({
          catalog_record_id: catalog.recordId, catalog_id: catalog.catalogId,
          source_sha256: catalog.sourceSha256, semantic_revision: catalog.semanticRevision,
        })),
      },
    };
    return { session, catalogs, run };
  }

  it("is current when all semantic inputs agree", () => {
    const input = fixture();
    expect(isMatchRunCurrent(input)).toBe(true);
  });

  it.each([
    ["settings", (x: any) => { x.session.matchingSettings = { ...x.session.matchingSettings, maxMatchLevel: "exact" }; }],
    ["taxonomy", (x: any) => { x.session.requestBundle = { ...x.session.requestBundle, taxonomy_version: "changed" }; }],
    ["catalog revision", (x: any) => { x.catalogs[0].semanticRevision++; }],
    ["catalog SHA", (x: any) => { x.catalogs[0].sourceSha256 = "changed"; }],
    ["missing catalog", (x: any) => { x.catalogs = x.catalogs.slice(0, 1); }],
    ["request ID", (x: any) => { x.session.requestId = "another-request"; }],
  ])("is stale after a %s change", (_name, change) => {
    const input = fixture();
    change(input);
    expect(isMatchRunCurrent(input)).toBe(false);
  });
});
