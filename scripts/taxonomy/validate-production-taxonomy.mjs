import Ajv2020 from 'ajv/dist/2020.js';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const EXPECTED_PRODUCTION_CLASS_IDS = [
  'accessory.floor_heating','accessory.pipe.protection','accessory.sanitary.pipe_rosette','accessory.valve_box',
  'conduit.corrugated','consumable.plumbing','drain.floor','fire_collar.pipe','fitting.axial',
  'fitting.brass.threaded','fitting.compression.hdpe','fitting.compression.multilayer','fitting.ppr','fitting.radial',
  'fitting.sewer.external','fitting.sewer.internal','fitting.sewer.low_noise','fluid.heat_transfer','insulation.pipe',
  'manifold.accessory','manifold.distribution','manifold.group','pipe.hdpe','pipe.multilayer','pipe.pert','pipe.pex_a',
  'pipe.ppr','pipe.sewer.external','pipe.sewer.internal','pipe.sewer.low_noise','sanitary.connector','seal.sewer',
  'sealant.plumbing','support.pipe','tool.mounting','valve.ball','valve.check','valve.outdoor_tap',
  'valve.pressure_control','valve.radiator','valve.shutoff.generic'
].sort();

const APPROVAL = {
  proposal_sha256: 'a8b3091004bb80a88c4be61ef471e0a9e02db7f7ed8620c0a1298820ab0e1d32',
  source_inventory_sha256: 'dda007dba97121a73c793f0dab003242910e6454337be453a5aa2d7479f58fed'
};

const error = (code, path, message, details) => ({ code, path, message, ...(details === undefined ? {} : { details }) });
const sorted = values => [...values].sort();
const selectorValues = selector => selector?.fixed === undefined ? (selector?.allowed ?? []) : [selector.fixed];
const isPrivateKey = key => /^(?:source_item_id|raw_name|supplier_sku|gtin|case_id)$/i.test(key);

function walk(value, pointer, visit) {
  visit(value, pointer);
  if (!value || typeof value !== 'object') return;
  for (const [key, child] of Object.entries(value)) walk(child, `${pointer}/${key.replaceAll('~','~0').replaceAll('/','~1')}`, visit);
}

export function validateProductionObjects({ taxonomy, manifest, lineage, schemaValidators = {}, skipSchemaValidation = false }) {
  const errors = [];
  const add = (...args) => errors.push(error(...args));

  if (!skipSchemaValidation) {
    for (const [name, data] of Object.entries({ taxonomy, manifest, lineage })) {
      const validator = schemaValidators[name];
      if (validator && !validator(data)) add('PRODUCTION_TAXONOMY_SCHEMA_INVALID', `/${name}`, `${name} failed JSON Schema`, validator.errors);
    }
  }

  const classIds = Object.keys(taxonomy?.classes ?? {});
  if (taxonomy?.class_count !== classIds.length || classIds.length !== 41) add('PRODUCTION_CLASS_COUNT_MISMATCH', '/class_count', 'Production taxonomy must contain exactly 41 classes', { declared: taxonomy?.class_count, actual: classIds.length });
  if (JSON.stringify(sorted(classIds)) !== JSON.stringify(EXPECTED_PRODUCTION_CLASS_IDS)) add('PRODUCTION_CLASS_SET_MISMATCH', '/classes', 'Production class set differs from approved set');
  if (taxonomy?.mass_annotation_allowed !== false || manifest?.mass_annotation_allowed !== false) add('MASS_ANNOTATION_MUST_REMAIN_DISABLED', '/mass_annotation_allowed', 'Mass annotation remains disabled');
  if (manifest?.proposal_sha256 !== APPROVAL.proposal_sha256 || lineage?.proposal_sha256 !== APPROVAL.proposal_sha256 || manifest?.source_inventory_sha256 !== APPROVAL.source_inventory_sha256) add('APPROVAL_HASH_MISMATCH', '/approval', 'Approval hashes do not match the owner-approved snapshot');
  if (Object.hasOwn(taxonomy?.classes ?? {}, 'accessory.floor_heating.panel')) add('PRODUCTION_CLASS_SET_MISMATCH', '/classes/accessory.floor_heating.panel', 'Floor-heating panel is an accessory_kind, not a class');
  if (!taxonomy?.value_sets?.floor_heating_accessory_kinds?.values?.panel) add('UNKNOWN_CANONICAL_VALUE', '/value_sets/floor_heating_accessory_kinds/values/panel', 'panel accessory kind is required');

  const valueSets = taxonomy?.value_sets ?? {};
  const connectionIds = new Set(Object.keys(valueSets.connection_kinds?.values ?? {}));
  const systemIds = new Set(Object.keys(valueSets.pipe_systems?.values ?? {}));
  for (const [mapKey, definition] of Object.entries(taxonomy?.classes ?? {})) {
    const base = `/classes/${mapKey}`;
    if (definition.class_id !== mapKey) add('PRODUCTION_CLASS_SET_MISMATCH', `${base}/class_id`, 'Class map key must equal class_id');
    if (!(definition.matching_critical_paths?.length > 0)) add('PRODUCTION_CLASS_SET_MISMATCH', `${base}/matching_critical_paths`, 'Every class needs at least one matching-critical path');
    for (const [attributeId, attribute] of Object.entries(definition.attributes ?? {})) {
      if (attribute.type === 'enum' || (attribute.type === 'string_set' && attribute.value_set_ref)) {
        if (!valueSets[attribute.value_set_ref]) add('UNKNOWN_VALUE_SET_REF', `${base}/attributes/${attributeId}/value_set_ref`, 'Attribute references an unknown value set', { value_set_ref: attribute.value_set_ref });
      }
      if (attribute.required_for_validated !== true && definition.matching_critical_paths.includes(`/attributes/${attributeId}`) && attribute.matching_critical !== true) add('PRODUCTION_CLASS_SET_MISMATCH', `${base}/attributes/${attributeId}`, 'Critical path must be marked matching_critical');
    }
    const slots = definition.ports?.catalog_ordered_slots ?? [];
    const seen = new Set(); const repeats = new Set(definition.ports?.repeatable_roles ?? []);
    for (const [index, slot] of slots.entries()) {
      if (seen.has(slot.role) && !repeats.has(slot.role)) add('INVALID_REPEATABLE_ROLE', `${base}/ports/catalog_ordered_slots/${index}/role`, 'Repeated role must be declared repeatable', { role: slot.role });
      seen.add(slot.role);
      for (const value of selectorValues(slot.connection_kind)) if (!connectionIds.has(value)) add('UNKNOWN_CANONICAL_VALUE', `${base}/ports/catalog_ordered_slots/${index}/connection_kind`, 'Unknown connection kind', { value });
      for (const value of selectorValues(slot.system)) if (!systemIds.has(value)) add('UNKNOWN_CANONICAL_VALUE', `${base}/ports/catalog_ordered_slots/${index}/system`, 'Unknown pipe system', { value });
      for (const required of slot.required_for_validated ?? []) {
        if (!['connection_kind','system',...(slot.allowed_fields ?? [])].includes(required)) add('INVALID_PORT_DEFINITION', `${base}/ports/catalog_ordered_slots/${index}/required_for_validated`, 'Required port field is not allowed', { required });
      }
    }
    for (const role of repeats) if (!slots.some(slot => slot.role === role)) add('INVALID_REPEATABLE_ROLE', `${base}/ports/repeatable_roles`, 'Repeatable role is not a catalog slot', { role });
  }

  for (const [sourceId, targets] of Object.entries(lineage?.mappings ?? {})) for (const target of targets) if (!taxonomy?.classes?.[target]) add('LINEAGE_TARGET_NOT_FOUND', `/mappings/${sourceId}`, 'Lineage target is absent from production taxonomy', { target });
  for (const target of lineage?.case_created_classes ?? []) if (!taxonomy?.classes?.[target]) add('LINEAGE_TARGET_NOT_FOUND', '/case_created_classes', 'Case-created class is absent from production taxonomy', { target });
  for (const item of lineage?.folded_resolutions ?? []) if (!taxonomy?.classes?.[item.to]) add('LINEAGE_TARGET_NOT_FOUND', '/folded_resolutions', 'Folded resolution target is absent', { target: item.to });

  walk(taxonomy, '', (value, pointer) => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return;
    for (const key of Object.keys(value)) if (isPrivateKey(key)) add('PRIVATE_FIELD_IN_PRODUCTION_TAXONOMY', `${pointer}/${key}`, 'Private row-level field is forbidden in production taxonomy');
  });

  return { errors, classCount: classIds.length };
}

const readJson = async filename => JSON.parse(await readFile(filename, 'utf8'));

export async function validateProductionTaxonomy({ root = '.' } = {}) {
  const files = {
    taxonomy: path.join(root, 'taxonomy/taxonomy.json'),
    manifest: path.join(root, 'taxonomy/production-approval-manifest.json'),
    lineage: path.join(root, 'taxonomy/lineage.proposed-to-production.json')
  };
  const schemas = {
    taxonomy: path.join(root, 'schemas/taxonomy/taxonomy.schema.json'),
    manifest: path.join(root, 'schemas/taxonomy/production-approval-manifest.schema.json'),
    lineage: path.join(root, 'schemas/taxonomy/taxonomy-lineage.schema.json')
  };
  const [taxonomy, manifest, lineage] = await Promise.all(Object.values(files).map(readJson));
  const ajv = new Ajv2020({ allErrors: true, strict: false });
  const schemaValidators = {};
  for (const [name, filename] of Object.entries(schemas)) schemaValidators[name] = ajv.compile(await readJson(filename));
  return validateProductionObjects({ taxonomy, manifest, lineage, schemaValidators });
}

const invoked = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invoked) {
  const result = await validateProductionTaxonomy();
  if (result.errors.length) {
    for (const item of result.errors) console.error(`${item.code} ${item.path}: ${item.message}`);
    process.exitCode = 1;
  } else console.log(`Production taxonomy is valid: ${result.classCount} classes; mass annotation disabled.`);
}
