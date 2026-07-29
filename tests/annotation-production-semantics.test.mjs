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
