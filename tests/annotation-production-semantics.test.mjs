import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { loadAnnotationSchemas } from '../scripts/lib/annotation-schema-loader.mjs';
import { validateAnnotation } from '../scripts/lib/annotation-contract-validator.mjs';

const taxonomy = JSON.parse(await readFile('taxonomy/taxonomy.json', 'utf8'));
const registry = JSON.parse(await readFile('schemas/annotation/class-schema-registry.json', 'utf8'));
const { classSchemas } = await loadAnnotationSchemas();

const evidence = json_pointer => ({ json_pointer, source_text: 'synthetic evidence' });
function pipeItem(diameter2 = 20) {
  return {
    schema_version: '1.1.0', taxonomy_version: '1.0.0', source_item_id: 'synthetic-pipe', class_id: 'pipe.pert',
    identity: { brand: null, manufacturer: null, manufacturer_articles: [], models: [], series: null },
    attributes: { wall_thickness_mm: 2 },
    ports: [
      { role: 'pipe_end', connection_kind: 'plain_end', system: 'pe_rt', pipe_outer_diameter_mm: 20 },
      { role: 'pipe_end', connection_kind: 'plain_end', system: 'pe_rt', pipe_outer_diameter_mm: diameter2 }
    ],
    annotation: { status: 'validated', unknown_fields: [], issues: [], ambiguities: [], evidence: [
      evidence('/class_id'), evidence('/attributes/wall_thickness_mm'), evidence('/ports/0/pipe_outer_diameter_mm'), evidence('/ports/1/pipe_outer_diameter_mm')
    ] }
  };
}

function valveItem() {
  return {
    schema_version: '1.1.0', taxonomy_version: '1.0.0', source_item_id: 'synthetic-valve', class_id: 'valve.ball',
    identity: { brand: null, manufacturer: null, manufacturer_articles: [], models: [], series: null },
    attributes: { body_material: 'brass', handle_type: 'lever' },
    ports: [
      { role: 'inlet', connection_kind: 'female_thread', system: 'threaded_generic', thread_standard: 'bsp_g', thread_size: { numerator: 1, denominator: 2, unit: 'inch' } },
      { role: 'inlet', connection_kind: 'female_thread', system: 'threaded_generic', thread_standard: 'bsp_g', thread_size: { numerator: 1, denominator: 2, unit: 'inch' } }
    ],
    annotation: { status: 'validated', unknown_fields: [], issues: [], ambiguities: [], evidence: [
      evidence('/class_id'), evidence('/attributes/body_material'), evidence('/attributes/handle_type'),
      evidence('/ports/0/thread_standard'), evidence('/ports/0/thread_size'), evidence('/ports/1/thread_standard'), evidence('/ports/1/thread_size')
    ] }
  };
}

function requestLine(classId, port, pointerKind, pointer) {
  return {
    line_id: 'synthetic-line', raw_text: 'synthetic request line', class_id: classId,
    requested_identity: {}, constraints: { attributes: {}, ports: [port] }, quantity: { value: 1, unit: 'piece' },
    substitution_statement: { explicit: false, policy: 'unspecified', raw_text: null },
    annotation: { status: 'needs_review', unknown_fields: pointerKind === 'unknown' ? [pointer] : [], issues: [],
      ambiguities: pointerKind === 'ambiguity' ? [{ json_pointer: pointer, code: 'SYNTHETIC', source_text: 'synthetic', possible_values: ['a', 'b'] }] : [], evidence: [] }
  };
}

function validateRequestLine(line) {
  const data = { schema_version: '1.1.0', taxonomy_version: '1.0.0', request_id: 'synthetic', document: { source_file: 'synthetic', document_type: 'product_request' }, lines: [line] };
  return validateAnnotation({ kind: 'request_document', data, taxonomy, registry, schemas: classSchemas });
}

test('class-specific request schemas reject selectors outside their port contracts', () => {
  const invalid = [
    requestLine('valve.ball', { role: 'inlet', connection_kind: { operator: 'eq', value: 'sewer_socket' } }),
    requestLine('valve.ball', { role: 'inlet', connection_kind: { operator: 'in', values: ['female_thread', 'sewer_socket'] } }),
    requestLine('pipe.pert', { role: 'pipe_end', system: { operator: 'eq', value: 'sewer_internal' } }),
    requestLine('pipe.pert', { role: 'pipe_end', connection_kind: { operator: 'eq', value: 'compression' } }),
    requestLine('pipe.pert', { role: 'pipe_end', connection_kind: { operator: 'neq', value: 'plain_end' } })
  ];
  for (const line of invalid) {
    const validator = classSchemas[registry.classes[line.class_id].request_schema].validator;
    assert.equal(validator(line), false, JSON.stringify(line.constraints.ports[0]));
    assert.ok(validateRequestLine(line).issues.some(item => item.code === 'CLASS_SPECIFIC_VALIDATION_FAILED'));
  }
});

test('class-specific request schemas accept selectors declared by their port contracts', () => {
  const valid = [
    requestLine('valve.ball', { role: 'inlet', connection_kind: { operator: 'eq', value: 'female_thread' }, system: { operator: 'eq', value: 'threaded_generic' } }),
    requestLine('pipe.pert', { role: 'pipe_end', connection_kind: { operator: 'eq', value: 'plain_end' }, system: { operator: 'eq', value: 'pe_rt' }, pipe_outer_diameter_mm: { operator: 'eq', value: 20 } })
  ];
  for (const line of valid) {
    const validator = classSchemas[registry.classes[line.class_id].request_schema].validator;
    assert.equal(validator(line), true, JSON.stringify(validator.errors, null, 2));
  }
});

test('request pointer validation is class- and role-aware', () => {
  for (const kind of ['unknown', 'ambiguity']) {
    const code = kind === 'unknown' ? 'UNKNOWN_PATH_NOT_ALLOWED' : 'AMBIGUITY_PATH_NOT_ALLOWED';
    const rejected = validateRequestLine(requestLine('pipe.pert', { role: 'pipe_end' }, kind, '/constraints/ports/0/thread_size'));
    assert.ok(rejected.issues.some(item => item.code === code));
  }
  const allowed = validateRequestLine(requestLine('pipe.pert', { role: 'pipe_end' }, 'unknown', '/constraints/ports/0/pipe_outer_diameter_mm'));
  assert.equal(allowed.issues.some(item => item.code === 'UNKNOWN_PATH_NOT_ALLOWED'), false);
  const fixture = validateRequestLine(requestLine('sanitary.connector', { role: 'fixture_port' }, 'unknown', '/constraints/ports/0/system'));
  assert.ok(fixture.issues.some(item => item.code === 'UNKNOWN_PATH_NOT_ALLOWED'));
  const sewer = validateRequestLine(requestLine('sanitary.connector', { role: 'sewer_port' }, 'unknown', '/constraints/ports/0/system'));
  assert.equal(sewer.issues.some(item => item.code === 'UNKNOWN_PATH_NOT_ALLOWED'), false);
});

test('repeatable pipe_end roles are accepted for pressure pipes', () => {
  const result = validateAnnotation({ kind: 'catalog_item', data: pipeItem(), taxonomy, registry, schemas: classSchemas });
  assert.equal(result.valid, true, JSON.stringify(result.issues, null, 2));
  assert.equal(result.issues.some(issue => issue.code === 'DUPLICATE_PORT_ROLE'), false);
});

test('mismatched repeatable pipe ends are rejected', () => {
  const result = validateAnnotation({ kind: 'catalog_item', data: pipeItem(25), taxonomy, registry, schemas: classSchemas });
  assert.ok(result.issues.some(issue => issue.code === 'PIPE_END_MISMATCH'));
});

test('duplicate non-repeatable valve role remains rejected', () => {
  const result = validateAnnotation({ kind: 'catalog_item', data: valveItem(), taxonomy, registry, schemas: classSchemas });
  assert.ok(result.issues.some(issue => issue.code === 'DUPLICATE_PORT_ROLE'));
});

test('operator confirmation is distinct provenance and satisfies evidence policy', async () => {
  const fixture=JSON.parse(await readFile('tests/fixtures/annotation/classes/fitting.radial.json','utf8')).golden.expected_output;
  fixture.annotation.evidence=fixture.annotation.evidence.filter(x=>x.json_pointer!=='/attributes/profile');
  fixture.annotation.operator_confirmations=[{json_pointer:'/attributes/profile',value:'b',confirmed_at:'2026-08-10T11:30:00.000Z'}];
  const result=validateAnnotation({kind:'catalog_item',data:fixture,taxonomy,registry,schemas:classSchemas});
  assert.equal(result.valid,true,JSON.stringify(result.issues));
  assert.equal(result.issues.some(x=>x.code==='MISSING_EVIDENCE'&&x.path==='/attributes/profile'),false);
});

test('stale and duplicate operator confirmations are rejected', async () => {
  const fixture=JSON.parse(await readFile('tests/fixtures/annotation/classes/fitting.radial.json','utf8')).golden.expected_output;
  fixture.annotation.operator_confirmations=[{json_pointer:'/attributes/profile',value:'th',confirmed_at:'2026-08-10T11:30:00.000Z'},{json_pointer:'/attributes/profile',value:'b',confirmed_at:'2026-08-10T11:31:00.000Z'}];
  const codes=new Set(validateAnnotation({kind:'catalog_item',data:fixture,taxonomy,registry,schemas:classSchemas}).issues.map(x=>x.code));
  assert.ok(codes.has('OPERATOR_CONFIRMATION_VALUE_MISMATCH'));assert.ok(codes.has('DUPLICATE_OPERATOR_CONFIRMATION'));
});
