import { describe, expect, it } from 'vitest';
import { runPilotMatcher, type MatcherInput } from './index';
import requestBundle from '../../../../tests/fixtures/matching/golden/D1-single-exact/request.json';
import catalogBundle from '../../../../tests/fixtures/matching/golden/shared/catalog-main.json';
import policy from '../../../../tests/fixtures/matching/golden/D1-single-exact/policy.json';
import registry from '../../../../matching/policies/pilot-v1.json';
import {createCatalogRecord} from '../catalog';
import {applyCatalogReviewEdits} from '../catalog-review-edit';

describe('browser-first matching adapter', () => {
  it('runs an exact match and computes a Web Crypto SHA-256 fingerprint', async () => {
    const input = {
      requestBundle,
      catalogs: [{ catalogRecordId: 'record-main', bundle: catalogBundle }],
      policy,
      registry,
      engineVersion: 'pilot-1.0.0',
    } as unknown as MatcherInput;

    const result = await runPilotMatcher(input);

    expect(result.kind).toBe('match_result');
    expect(result.lines[0]).toMatchObject({ resolution: 'single_exact' });
    expect(result.input_fingerprint).toBe('eb141e2cd2fed1996be6afccbceda9f4cf684a58c67b6ec72bd376f63ec854a1');
    expect(result.input_fingerprint).toMatch(/^[0-9a-f]{64}$/);
  });
  it('includes the catalog semantic revision in refs and input identity',async()=>{const base={requestBundle,catalogs:[{catalogRecordId:'record-main',catalogRevision:0,bundle:catalogBundle}],policy,registry,engineVersion:'pilot-1.0.0'} as unknown as MatcherInput,a=await runPilotMatcher(base),b=await runPilotMatcher({...base,catalogs:[{...(base.catalogs[0]),catalogRevision:1}]} as MatcherInput);expect(a.catalog_refs[0].catalog_revision).toBe(0);expect(b.catalog_refs[0].catalog_revision).toBe(1);expect(a.input_fingerprint).not.toBe(b.input_fingerprint)});
  it('makes a reviewed item eligible after the final production-valid edit',async()=>{const reviewBundle=structuredClone(catalogBundle) as any,item=reviewBundle.items[0].catalog_item;item.annotation.status='needs_review';item.annotation.unknown_fields=['/attributes/handle_type'];item.annotation.evidence=item.annotation.evidence.filter((entry:any)=>entry.json_pointer!=='/attributes/handle_type');delete item.attributes.handle_type;const before:any=await runPilotMatcher({requestBundle,catalogs:[{catalogRecordId:'record-main',catalogRevision:0,bundle:reviewBundle}],policy,registry,engineVersion:'pilot-1.0.0'} as unknown as MatcherInput);expect(before.lines[0].candidates).toHaveLength(0);expect(before.lines[0].excluded_candidates[0].exclusion_codes).toContain('CATALOG_ITEM_NEEDS_REVIEW');const record={...createCatalogRecord(reviewBundle),recordId:'record-main'},edited=applyCatalogReviewEdits({record,sourceItemId:item.source_item_id,edits:[{jsonPointer:'/attributes/handle_type',value:'lever'}],now:'2026-08-10T12:00:00.000Z'});expect(edited.ok).toBe(true);if(!edited.ok)return;expect(edited.record.bundle.items[0].catalog_item!.annotation?.status).toBe('validated');const after:any=await runPilotMatcher({requestBundle,catalogs:[{catalogRecordId:'record-main',catalogRevision:edited.record.semanticRevision,bundle:edited.record.bundle}],policy,registry,engineVersion:'pilot-1.0.0'} as unknown as MatcherInput);expect(after.lines[0].candidates).toHaveLength(1)});
});
