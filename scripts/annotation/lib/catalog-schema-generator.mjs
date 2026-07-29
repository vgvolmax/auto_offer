import { catalogAttributeSchema, catalogPortFieldSchemas, selectorSchema } from './schema-utils.mjs';

function portSchema(slot) {
  const properties = {
    role: { const: slot.role },
    connection_kind: selectorSchema(slot.connection_kind)
  };
  if (slot.system) properties.system = selectorSchema(slot.system);
  for (const field of slot.allowed_fields) properties[field] = catalogPortFieldSchemas[field];
  return { type: 'object', additionalProperties: false, required: ['role'], properties };
}

export function buildCatalogSchema(classDefinition, taxonomy) {
  const slots = classDefinition.ports.catalog_ordered_slots;
  const attributes = Object.fromEntries(Object.entries(classDefinition.attributes).map(([key, definition]) => [key, catalogAttributeSchema(definition, taxonomy)]));
  const requiredAttributes = Object.entries(classDefinition.attributes).filter(([, definition]) => definition.required_for_validated).map(([key]) => key);
  const requiredSlotCount = slots.findLastIndex(slot => slot.required) + 1;
  const classLayer = {
    type: 'object',
    properties: {
      class_id: { const: classDefinition.class_id },
      attributes: { type: 'object', additionalProperties: false, properties: attributes },
      ports: slots.length ? { type: 'array', minItems: 0, maxItems: slots.length, prefixItems: slots.map(portSchema), items: false } : { type: 'array', maxItems: 0, items: false }
    },
    if: { properties: { annotation: { properties: { status: { const: 'validated' } }, required: ['status'] } }, required: ['annotation'] },
    then: { properties: {
      attributes: { required: requiredAttributes },
      ports: slots.length ? { minItems: requiredSlotCount, prefixItems: slots.map(slot => ({ required: [...new Set(['role', ...slot.required_for_validated])] })) } : { maxItems: 0 }
    } }
  };
  return {
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    $id: `https://example.local/schemas/annotation/class-specific/${classDefinition.class_id}.catalog.schema.json`,
    title: `Catalog annotation: ${classDefinition.name_ru}`,
    allOf: [{ $ref: '../catalog-item-annotation.base.schema.json' }, classLayer]
  };
}
