import {describe,expect,it} from 'vitest';
import catalogBundle from '../../../../tests/fixtures/matching/golden/shared/catalog-main.json';
import requestBundle from '../../../../tests/fixtures/matching/golden/D1-single-exact/request.json';
import {createCatalogRecord} from '../catalog';
import {createDraftSession} from '../session';
import {buildSessionMatchingPolicy} from './session-policy';
import {pilotPolicyRegistry} from './pilot-config';
import {isMatchRunCurrent} from './match-run-current';

describe('match run catalog currentness',()=>{it.each([[undefined,0,true],[0,1,false],[1,1,true]] as const)('compares result revision %s with stored revision %s',(resultRevision,storedRevision,current)=>{const catalog={...createCatalogRecord(catalogBundle as any),recordId:'record-main',semanticRevision:storedRevision},session=createDraftSession(requestBundle as any,[catalog],'currentness'),ref:any={catalog_record_id:catalog.recordId,catalog_id:catalog.catalogId,source_sha256:catalog.sourceSha256};if(resultRevision!==undefined)ref.catalog_revision=resultRevision;const policy=buildSessionMatchingPolicy({sessionId:session.sessionId,catalogRecordIds:session.catalogRecordIds,settings:session.matchingSettings,policyRegistryVersion:pilotPolicyRegistry.policy_version}),run:any={sessionRevision:session.matchingRevision,result:{request_id:session.requestId,policy,catalog_refs:[ref]}};expect(isMatchRunCurrent({session,catalogs:[catalog],run})).toBe(current)})});
