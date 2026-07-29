import { readFile, writeFile, mkdir, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { canonicalJson } from './lib/schema-utils.mjs';

const readJson = async filename => JSON.parse(await readFile(filename, 'utf8'));
const clone = value => structuredClone(value);
const firstValue = (taxonomy, setId) => Object.keys(taxonomy.value_sets[setId].values).sort()[0];

function sampleAttribute(definition, taxonomy, variant = 0) {
  switch (definition.type) {
    case 'enum': {
      const values = Object.keys(taxonomy.value_sets[definition.value_set_ref].values).sort();
      return values[Math.min(variant, values.length - 1)];
    }
    case 'string': return variant ? 'synthetic-b' : 'synthetic-a';
    case 'number': return definition.minimum !== undefined ? definition.minimum + 1 : definition.exclusive_minimum !== undefined ? definition.exclusive_minimum + 1 : variant ? 25 : 20;
    case 'integer': return Math.ceil(definition.minimum !== undefined ? definition.minimum : definition.exclusive_minimum !== undefined ? definition.exclusive_minimum + 1 : variant ? 2 : 1);
    case 'boolean': return variant === 0;
    case 'rational_inch': return { numerator: variant ? 3 : 1, denominator: variant ? 4 : 2, unit: 'inch' };
    case 'number_set': return variant ? [25,32] : [16,20];
    case 'string_set': {
      const values = definition.value_set_ref ? Object.keys(taxonomy.value_sets[definition.value_set_ref].values).sort() : ['alpha','beta'];
      return values.slice(0, Math.min(2, values.length));
    }
    case 'dimensions': return variant ? { width_mm: 200 } : { length_mm: 100 };
    default: throw new Error(`Unsupported fixture attribute type ${definition.type}`);
  }
}

function sampleConstraint(definition, taxonomy) {
  const value = sampleAttribute(definition, taxonomy);
  if (definition.type === 'string_set' || definition.type === 'number_set') return { operator: 'contains_all', values: value };
  if (definition.type === 'dimensions') return { length_mm: { operator: 'eq', value: value.length_mm ?? 100 } };
  return { operator: 'eq', value };
}

function samplePort(slot, taxonomy, index) {
  const connection = slot.connection_kind.fixed ?? [...slot.connection_kind.allowed].sort()[0];
  const port = { role: slot.role, connection_kind: connection };
  if (slot.system) port.system = slot.system.fixed ?? [...slot.system.allowed].sort()[0];
  for (const field of slot.required_for_validated) {
    if (field === 'connection_kind' || field === 'system') continue;
    if (field === 'thread_standard') port[field] = firstValue(taxonomy, 'thread_standards');
    else if (field === 'thread_size') port[field] = { numerator: 1, denominator: 2, unit: 'inch' };
    else port[field] = 20 + index;
  }
  return port;
}

const evidence = json_pointer => ({ json_pointer, source_text: 'synthetic evidence' });

function catalogFixture(classDefinition, taxonomy, variant = 0) {
  const attributes = {};
  for (const [key, definition] of Object.entries(classDefinition.attributes)) if (definition.required_for_validated) attributes[key] = sampleAttribute(definition, taxonomy, variant);
  const slots = classDefinition.ports.catalog_ordered_slots;
  const requiredCount = slots.findLastIndex(slot => slot.required) + 1;
  const ports = slots.slice(0, requiredCount).map((slot,index)=>samplePort(slot,taxonomy,index));
  for (const role of classDefinition.ports.repeatable_roles) {
    const indexes = ports.map((port, index) => port.role === role ? index : -1).filter(index => index >= 0);
    for (const index of indexes.slice(1)) {
      const first = ports[indexes[0]];
      for (const key of Object.keys(ports[index])) if (key !== 'role') ports[index][key] = structuredClone(first[key]);
    }
  }
  const evidences = [evidence('/class_id')];
  for (const key of Object.keys(attributes)) evidences.push(evidence(`/attributes/${key}`));
  for (const [index, port] of ports.entries()) {
    const slot = slots[index];
    for (const key of Object.keys(port)) {
      if (key === 'role') continue;
      if (key === 'connection_kind' && slot.connection_kind.fixed) continue;
      if (key === 'system' && slot.system?.fixed) continue;
      evidences.push(evidence(`/ports/${index}/${key}`));
    }
  }
  return {
    kind:'catalog_item',
    data:{
      schema_version:'1.1.0',taxonomy_version:'1.0.0',source_item_id:`synthetic-${classDefinition.class_id}-${variant+1}`,class_id:classDefinition.class_id,
      identity:{brand:null,manufacturer:null,manufacturer_articles:[],models:[],series:null},attributes,ports,
      annotation:{status:'validated',unknown_fields:[],issues:[],ambiguities:[],evidence:evidences}
    }
  };
}

function requestFixture(classDefinition, taxonomy) {
  const required = Object.entries(classDefinition.attributes).find(([,definition])=>definition.required_for_validated) ?? Object.entries(classDefinition.attributes)[0];
  const attributes = required ? { [required[0]]: sampleConstraint(required[1],taxonomy) } : {};
  const evidences=[evidence('/class_id')];
  if (required) evidences.push(evidence(`/constraints/attributes/${required[0]}`));
  return {kind:'request_line',data:{line_id:`request-${classDefinition.class_id}`,raw_text:`Синтетическая заявка: ${classDefinition.name_ru}`,class_id:classDefinition.class_id,requested_identity:{},constraints:{attributes,ports:[]},substitution_statement:{policy:'unspecified',explicit:false,raw_text:null},annotation:{status:'validated',unknown_fields:[],issues:[],ambiguities:[],evidence:evidences}}};
}

function ambiguityValues(definition, taxonomy) {
  if (definition.type === 'enum') {
    const values=Object.keys(taxonomy.value_sets[definition.value_set_ref].values).sort();
    return values.length >= 2 ? values.slice(0,2) : [values[0],`${values[0]}_alternative`];
  }
  if (definition.type === 'boolean') return [true,false];
  if (definition.type === 'rational_inch') return [{numerator:1,denominator:2,unit:'inch'},{numerator:3,denominator:4,unit:'inch'}];
  if (definition.type === 'number_set') return [[16,20],[25,32]];
  if (definition.type === 'string_set') return [['ppr'],['hdpe']];
  if (definition.type === 'dimensions') return [{length_mm:100},{length_mm:200}];
  if (definition.type === 'string') return ['synthetic-a','synthetic-b'];
  return [20,25];
}

function reviewFixtures(classDefinition, taxonomy, catalog) {
  const target = Object.entries(classDefinition.attributes).find(([,definition])=>definition.matching_critical) ?? Object.entries(classDefinition.attributes).find(([,definition])=>definition.required_for_validated);
  if (!target) throw new Error(`${classDefinition.class_id} has no attribute suitable for review fixtures`);
  const [key,definition]=target; const pointer=`/attributes/${key}`;
  const unknown=clone(catalog); delete unknown.data.attributes[key]; unknown.data.annotation.status='needs_review'; unknown.data.annotation.unknown_fields=[pointer]; unknown.data.annotation.evidence=unknown.data.annotation.evidence.filter(item=>item.json_pointer!==pointer);
  const ambiguity=clone(catalog); delete ambiguity.data.attributes[key]; ambiguity.data.annotation.status='needs_review'; ambiguity.data.annotation.evidence=ambiguity.data.annotation.evidence.filter(item=>item.json_pointer!==pointer); ambiguity.data.annotation.ambiguities=[{json_pointer:pointer,code:'AMBIGUOUS_SYNTHETIC_VALUE',source_text:'synthetic ambiguous source',possible_values:ambiguityValues(definition,taxonomy),blocking:true}];
  return {unknown,ambiguity};
}

function invalidFixtures(classDefinition, catalog) {
  const requiredKey=Object.entries(classDefinition.attributes).find(([,definition])=>definition.required_for_validated)?.[0] ?? Object.keys(classDefinition.attributes)[0];
  const additional=clone(catalog); additional.data.attributes.unexpected_attribute='forbidden';
  const role=clone(catalog); if (role.data.ports.length) role.data.ports[0].role='unknown_role'; else role.data.ports.push({role:'unknown_role',connection_kind:'plain_end'});
  const type=clone(catalog); type.data.attributes[requiredKey]={invalid:true};
  return {additional_attribute:additional,invalid_port_role:role,invalid_type:type};
}

export async function generateClassFixtures({root='.'}={}) {
  const taxonomy=await readJson(path.join(root,'taxonomy/taxonomy.json'));
  const output=path.join(root,'tests/fixtures/annotation/classes');
  await rm(output,{recursive:true,force:true}); await mkdir(output,{recursive:true});
  for (const classId of Object.keys(taxonomy.classes)) {
    const definition=taxonomy.classes[classId];
    const catalog=catalogFixture(definition,taxonomy,0); const catalog2=catalogFixture(definition,taxonomy,1); const request=requestFixture(definition,taxonomy);
    const review=reviewFixtures(definition,taxonomy,catalog);
    const fixture={class_id:classId,valid:[catalog,request,catalog2],needs_review:review,invalid:invalidFixtures(definition,catalog),golden:{kind:'catalog_item',input_text_ru:`Синтетический пример: ${definition.name_ru}`,expected_output:catalog.data}};
    await writeFile(path.join(output,`${classId}.json`),canonicalJson(fixture));
  }
  return {classCount:Object.keys(taxonomy.classes).length};
}
const invoked=process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url);
if(invoked){const result=await generateClassFixtures();console.log(`Generated fixtures for ${result.classCount} classes.`)}
