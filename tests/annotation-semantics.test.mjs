import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { getCanonicalValueIds, validateAnnotation } from '../scripts/lib/annotation-contract-validator.mjs';
import { loadAnnotationSchemas } from '../scripts/lib/annotation-schema-loader.mjs';

const taxonomy = JSON.parse(await readFile('taxonomy/taxonomy.json', 'utf8'));
const registry = JSON.parse(await readFile('schemas/annotation/class-schema-registry.json', 'utf8'));
const fixture = JSON.parse(await readFile('tests/fixtures/annotation/classes/fitting.ppr.json', 'utf8'));
const { classSchemas } = await loadAnnotationSchemas();
const catalogTemplate = fixture.valid.find(item => item.kind === 'catalog_item').data;
const requestTemplate = fixture.valid.find(item => item.kind === 'request_line').data;

const evidence = json_pointer => ({ json_pointer, source_text: 'synthetic source' });
const requestDocument = line => ({ schema_version:'1.1.0', taxonomy_version:'1.0.0', request_id:'request', document:{source_file:'request.txt',document_type:'product_request'}, lines:[line] });
const validateCatalog = data => validateAnnotation({ kind:'catalog_item', data, taxonomy, registry, schemas:classSchemas });
const validateRequest = line => validateAnnotation({ kind:'request_document', data:requestDocument(line), taxonomy, registry, schemas:classSchemas });

function completeCatalog() {
  const data = structuredClone(catalogTemplate);
  data.identity = { brand:'synthetic_brand', manufacturer:'synthetic_manufacturer', manufacturer_articles:['A-1'], models:['M-1'], series:'Series A' };
  data.annotation.evidence.push(evidence('/identity/brand'), evidence('/identity/manufacturer'), evidence('/identity/manufacturer_articles/0'), evidence('/identity/models/0'), evidence('/identity/series'));
  return data;
}

function sparseRequest() { return structuredClone(requestTemplate); }

test('taxonomy accepts only normative object-based value sets', () => {
  assert.ok(getCanonicalValueIds(taxonomy, 'materials').has('brass'));
  assert.throws(() => getCanonicalValueIds({ value_sets: { materials: ['brass'] } }, 'materials'), /normative object-based format/);
});

test('implicit unspecified substitution policy does not require fabricated evidence', () => {
  const result = validateRequest(sparseRequest());
  assert.equal(result.valid, true, JSON.stringify(result.issues));
  assert.equal(result.issues.some(issue => issue.code === 'MISSING_EVIDENCE'), false);
});

test('request port role does not require separate evidence', () => {
  const line = sparseRequest();
  line.constraints.ports = [{ role:'end_1', pipe_outer_diameter_mm:{operator:'between',min:25,max:40} }];
  line.annotation.evidence.push(evidence('/constraints/ports/0/pipe_outer_diameter_mm'));
  const result = validateRequest(line);
  assert.equal(result.valid, true, JSON.stringify(result.issues));
  assert.equal(result.issues.some(issue => issue.code === 'MISSING_EVIDENCE' && issue.path.endsWith('/role')), false);
});

test('request port technical field still requires evidence', () => {
  const line = sparseRequest();
  line.constraints.ports = [{ role:'end_1', pipe_outer_diameter_mm:{operator:'between',min:25,max:40} }];
  const result = validateRequest(line);
  assert.ok(result.issues.some(issue => issue.code === 'MISSING_EVIDENCE' && issue.path === '/lines/0/constraints/ports/0/pipe_outer_diameter_mm'));
});

test('warnings are nonblocking while issues are blocking', () => {
  const line = sparseRequest();
  line.annotation.warnings = [{code:'CHECK_SOURCE'}];
  assert.equal(validateRequest(line).valid, true);
  line.annotation.issues.push({code:'BAD_VALUE'});
  assert.ok(validateRequest(line).issues.some(issue => issue.code === 'VALIDATED_WITH_ISSUES'));
});

test('a present catalog series requires evidence', () => {
  const data = completeCatalog();
  data.annotation.evidence = data.annotation.evidence.filter(item => item.json_pointer !== '/identity/series');
  assert.ok(validateCatalog(data).issues.some(issue => issue.code === 'MISSING_EVIDENCE' && issue.path === '/identity/series'));
});

for (const pointer of ['/identity/brand','/identity/manufacturer','/identity/series']) {
  test(`nullable catalog identity ${pointer} can be marked unknown`, () => {
    const data=completeCatalog(); const field=pointer.split('/').at(-1); data.identity[field]=null; data.annotation.status='needs_review'; data.annotation.unknown_fields=[pointer]; data.annotation.evidence=data.annotation.evidence.filter(item=>item.json_pointer!==pointer);
    const result=validateCatalog(data);
    assert.equal(result.issues.some(issue=>['UNKNOWN_PATH_NOT_ALLOWED','UNKNOWN_POINTS_TO_VALUE'].includes(issue.code)),false);
  });
}

test('nullable catalog series can be marked ambiguous', () => {
  const data=completeCatalog(); data.identity.series=null; data.annotation.status='needs_review'; data.annotation.evidence=data.annotation.evidence.filter(item=>item.json_pointer!=='/identity/series'); data.annotation.ambiguities=[{json_pointer:'/identity/series',code:'AMBIGUOUS_SERIES',source_text:'Series A / B',possible_values:['Series A','Series B']}];
  const result=validateCatalog(data);
  assert.equal(result.issues.some(issue=>['AMBIGUITY_PATH_NOT_ALLOWED','AMBIGUITY_POINTS_TO_CONFIRMED_VALUE'].includes(issue.code)),false);
});

test('confirmed catalog value cannot be marked unknown or ambiguous', () => {
  const unknown=completeCatalog(); unknown.annotation.status='needs_review'; unknown.annotation.unknown_fields=['/identity/series'];
  assert.ok(validateCatalog(unknown).issues.some(issue=>issue.code==='UNKNOWN_POINTS_TO_VALUE'));
  const ambiguous=completeCatalog(); ambiguous.annotation.status='needs_review'; ambiguous.annotation.ambiguities=[{json_pointer:'/identity/series',code:'AMBIGUOUS_SERIES',source_text:'A/B',possible_values:['A','B']}];
  assert.ok(validateCatalog(ambiguous).issues.some(issue=>issue.code==='AMBIGUITY_POINTS_TO_CONFIRMED_VALUE'));
});

test('evidence cannot point to a null catalog value', () => {
  const data=completeCatalog(); data.identity.series=null;
  assert.ok(validateCatalog(data).issues.some(issue=>issue.code==='EVIDENCE_POINTS_TO_EMPTY_VALUE'));
});

function validateRequestGtin(gtin, status='validated') {
  const line=sparseRequest();
  if (gtin !== undefined) { line.requested_identity.gtin=gtin; line.annotation.evidence.push(evidence('/requested_identity/gtin')); }
  line.annotation.status=status;
  if (status==='needs_review') line.annotation.issues.push({code:'INVALID_REQUEST_GTIN',json_pointer:'/requested_identity/gtin'});
  return validateRequest(line);
}

test('absent request GTIN is not treated as invalid', () => {
  const result=validateRequestGtin(undefined); assert.equal(result.valid,true); assert.equal(result.issues.some(issue=>issue.code==='INVALID_REQUEST_GTIN_REQUIRES_REVIEW'),false);
});

test('valid explicit request GTIN constraints are accepted', () => {
  for (const gtin of [{operator:'eq',value:'4006381333931'},{operator:'in',values:['4006381333931','036000291452']}]) assert.equal(validateRequestGtin(gtin).valid,true);
});

test('invalid explicit request GTIN requires review', () => {
  for (const gtin of [{operator:'eq',value:'4006381333932'},{operator:'in',values:['4006381333931','4006381333932']}]) assert.ok(validateRequestGtin(gtin).issues.some(issue=>issue.code==='INVALID_REQUEST_GTIN_REQUIRES_REVIEW'));
});

test('invalid request GTIN already marked for review does not add duplicate semantic issue', () => {
  const result=validateRequestGtin({operator:'eq',value:'4006381333932'},'needs_review'); assert.equal(result.valid,true); assert.equal(result.issues.some(issue=>issue.code==='INVALID_REQUEST_GTIN_REQUIRES_REVIEW'),false);
});

test('semantic validator rejects invalid ranges and unreduced thread fractions', () => {
  const line=sparseRequest(); line.constraints.ports=[{role:'end_1',pipe_outer_diameter_mm:{operator:'between',min:40,max:20}}]; line.annotation.evidence.push(evidence('/constraints/ports/0/pipe_outer_diameter_mm'));
  assert.ok(validateRequest(line).issues.some(issue=>issue.code==='INVALID_RANGE'));
  const catalog=completeCatalog(); catalog.ports[0].thread_size={numerator:2,denominator:4,unit:'inch'}; catalog.annotation.evidence.push(evidence('/ports/0/thread_size'));
  assert.ok(validateCatalog(catalog).issues.some(issue=>issue.code==='NON_REDUCED_RATIONAL'));
});

test('missing registered class schema is reported', () => {
  const local=structuredClone(registry); delete local.classes['fitting.ppr'].request_schema;
  const result=validateAnnotation({kind:'request_document',data:requestDocument(sparseRequest()),taxonomy,registry:local,schemas:classSchemas});
  assert.ok(result.issues.some(issue=>issue.code==='CLASS_SCHEMA_MISSING'));
});
