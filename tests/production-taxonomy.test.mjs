import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import Ajv2020 from 'ajv/dist/2020.js';

const expectedClassIds = [
  'accessory.floor_heating','accessory.pipe.protection','accessory.sanitary.pipe_rosette','accessory.valve_box',
  'conduit.corrugated','consumable.plumbing','drain.floor','fire_collar.pipe','fitting.axial',
  'fitting.brass.threaded','fitting.compression.hdpe','fitting.compression.multilayer','fitting.ppr','fitting.radial',
  'fitting.sewer.external','fitting.sewer.internal','fitting.sewer.low_noise','fluid.heat_transfer','insulation.pipe',
  'manifold.accessory','manifold.distribution','manifold.group','pipe.hdpe','pipe.multilayer','pipe.pert','pipe.pex_a',
  'pipe.ppr','pipe.sewer.external','pipe.sewer.internal','pipe.sewer.low_noise','sanitary.connector','seal.sewer',
  'sealant.plumbing','support.pipe','tool.mounting','valve.ball','valve.check','valve.outdoor_tap',
  'valve.pressure_control','valve.radiator','valve.shutoff.generic'
].sort();

const json = async path => JSON.parse(await readFile(path, 'utf8'));

test('production taxonomy is the approved exact 41-class set', async () => {
  const taxonomy = await json('taxonomy/taxonomy.json');
  assert.equal(taxonomy.taxonomy_version, '1.0.0');
  assert.equal(taxonomy.status, 'production');
  assert.equal(taxonomy.mass_annotation_allowed, false);
  assert.equal(taxonomy.class_count, 41);
  assert.deepEqual(Object.keys(taxonomy.classes), expectedClassIds);
  assert.equal(Object.hasOwn(taxonomy.classes, 'accessory.floor_heating.panel'), false);
  assert.ok(taxonomy.value_sets.floor_heating_accessory_kinds.values.panel);
});

test('production taxonomy, approval manifest, and lineage validate structurally', async () => {
  const ajv = new Ajv2020({ allErrors: true, strict: false });
  const taxonomySchema = await json('schemas/taxonomy/taxonomy.schema.json');
  const manifestSchema = await json('schemas/taxonomy/production-approval-manifest.schema.json');
  const lineageSchema = await json('schemas/taxonomy/taxonomy-lineage.schema.json');
  const taxonomy = await json('taxonomy/taxonomy.json');
  const manifest = await json('taxonomy/production-approval-manifest.json');
  const lineage = await json('taxonomy/lineage.proposed-to-production.json');
  assert.equal(ajv.compile(taxonomySchema)(taxonomy), true);
  assert.equal(ajv.compile(manifestSchema)(manifest), true);
  assert.equal(ajv.compile(lineageSchema)(lineage), true);
});

test('approval manifest anchors the owner decision without private cases', async () => {
  const manifestText = await readFile('taxonomy/production-approval-manifest.json', 'utf8');
  const manifest = JSON.parse(manifestText);
  assert.equal(manifest.owner, 'vgvolmax');
  assert.equal(manifest.production_class_count, 41);
  assert.equal(manifest.proposal_sha256, 'a8b3091004bb80a88c4be61ef471e0a9e02db7f7ed8620c0a1298820ab0e1d32');
  assert.equal(manifest.source_inventory_sha256, 'dda007dba97121a73c793f0dab003242910e6454337be453a5aa2d7479f58fed');
  assert.equal(manifest.mass_annotation_allowed, false);
  for (const forbidden of ['case_id', 'raw_name', 'supplier_sku', 'gtin']) assert.equal(manifestText.includes(forbidden), false);
});

test('lineage records splits and the folded floor-heating panel resolution', async () => {
  const lineage = await json('taxonomy/lineage.proposed-to-production.json');
  assert.deepEqual(lineage.mappings['fitting.compression'], ['fitting.compression.hdpe', 'fitting.compression.multilayer']);
  assert.deepEqual(lineage.mappings.manifold, ['manifold.accessory', 'manifold.distribution', 'manifold.group']);
  assert.deepEqual(lineage.folded_resolutions, [{
    from: 'accessory.floor_heating.panel',
    to: 'accessory.floor_heating',
    discriminator: { path: '/attributes/accessory_kind', value: 'panel' }
  }]);
});

test('semantic production validator accepts the approved taxonomy', async () => {
  const { validateProductionTaxonomy } = await import('../scripts/taxonomy/validate-production-taxonomy.mjs');
  const result = await validateProductionTaxonomy();
  assert.deepEqual(result.errors, []);
  assert.equal(result.classCount, 41);
});

test('semantic production validator reports stable codes for invalid refs and mass annotation', async () => {
  const { validateProductionObjects } = await import('../scripts/taxonomy/validate-production-taxonomy.mjs');
  const taxonomy = await json('taxonomy/taxonomy.json');
  const manifest = await json('taxonomy/production-approval-manifest.json');
  const lineage = await json('taxonomy/lineage.proposed-to-production.json');
  const broken = structuredClone(taxonomy);
  broken.mass_annotation_allowed = true;
  broken.classes['accessory.floor_heating'].attributes.accessory_kind.value_set_ref = 'missing';
  const result = validateProductionObjects({ taxonomy: broken, manifest, lineage, skipSchemaValidation: true });
  assert.ok(result.errors.some(error => error.code === 'MASS_ANNOTATION_MUST_REMAIN_DISABLED'));
  assert.ok(result.errors.some(error => error.code === 'UNKNOWN_VALUE_SET_REF'));
});
