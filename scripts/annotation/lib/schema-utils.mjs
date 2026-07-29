export const commonRef = name => ({ $ref: `../common.schema.json#/$defs/${name}` });

export function selectorSchema(selector) {
  if (!selector) return undefined;
  if (Object.hasOwn(selector, 'fixed')) return { const: selector.fixed };
  return { enum: [...selector.allowed] };
}

export function catalogAttributeSchema(definition, taxonomy) {
  const numeric = { type: definition.type === 'integer' ? 'integer' : 'number' };
  if (definition.minimum !== undefined) numeric.minimum = definition.minimum;
  if (definition.exclusive_minimum !== undefined) numeric.exclusiveMinimum = definition.exclusive_minimum;
  if (definition.maximum !== undefined) numeric.maximum = definition.maximum;
  switch (definition.type) {
    case 'enum': return { enum: Object.keys(taxonomy.value_sets[definition.value_set_ref].values) };
    case 'string': return { type: 'string', minLength: 1 };
    case 'number': case 'integer': return numeric;
    case 'boolean': return { type: 'boolean' };
    case 'rational_inch': return commonRef('rationalInch');
    case 'number_set': return { type: 'array', minItems: 1, uniqueItems: true, items: { type: 'number' } };
    case 'string_set': return { type: 'array', minItems: 1, uniqueItems: true, items: definition.value_set_ref ? { enum: Object.keys(taxonomy.value_sets[definition.value_set_ref].values) } : { type: 'string', minLength: 1 } };
    case 'dimensions': return { type: 'object', additionalProperties: false, minProperties: 1, properties: Object.fromEntries(['length_mm','width_mm','height_mm'].map(key => [key,{ type:'number', exclusiveMinimum:0 }])) };
    default: throw new Error(`Unsupported attribute type: ${definition.type}`);
  }
}

export function requestAttributeSchema(definition) {
  switch (definition.type) {
    case 'enum': return commonRef('enumConstraint');
    case 'string': return commonRef('stringConstraint');
    case 'number': case 'integer': return commonRef('numberConstraint');
    case 'boolean': return commonRef('booleanConstraint');
    case 'rational_inch': return commonRef('rationalConstraint');
    case 'string_set': return commonRef('setConstraint');
    case 'number_set': return commonRef('numberSetConstraint');
    case 'dimensions': return { type: 'object', additionalProperties: false, minProperties: 1, properties: Object.fromEntries(['length_mm','width_mm','height_mm'].map(key => [key,commonRef('numberConstraint')])) };
    default: throw new Error(`Unsupported attribute type: ${definition.type}`);
  }
}

export const catalogPortFieldSchemas = {
  nominal_diameter_dn: { type: 'number', exclusiveMinimum: 0 },
  pipe_outer_diameter_mm: { type: 'number', exclusiveMinimum: 0 },
  pipe_wall_thickness_mm: { type: 'number', exclusiveMinimum: 0 },
  thread_standard: { type: 'string', minLength: 1 },
  thread_size: commonRef('rationalInch')
};

export const requestPortFieldSchemas = {
  nominal_diameter_dn: commonRef('numberConstraint'),
  pipe_outer_diameter_mm: commonRef('numberConstraint'),
  pipe_wall_thickness_mm: commonRef('numberConstraint'),
  thread_standard: commonRef('enumConstraint'),
  thread_size: commonRef('rationalConstraint')
};

export const canonicalJson = value => `${JSON.stringify(canonicalize(value), null, 2)}\n`;
function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map(key => [key, canonicalize(value[key])]));
  return value;
}
