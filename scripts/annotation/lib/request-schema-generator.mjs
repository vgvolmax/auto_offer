import { requestAttributeSchema, requestPortFieldSchemas } from './schema-utils.mjs';

function roles(classDefinition) {
  const grouped = new Map();
  for (const slot of classDefinition.ports.catalog_ordered_slots) {
    const item = grouped.get(slot.role) ?? { fields: new Set(), hasSystem: false };
    for (const field of slot.allowed_fields) item.fields.add(field);
    item.hasSystem ||= Boolean(slot.system);
    grouped.set(slot.role, item);
  }
  for (const role of classDefinition.ports.request_allowed_roles) if (!grouped.has(role)) grouped.set(role, { fields: new Set(), hasSystem: false });
  return grouped;
}

function requestPortSchema(role, info) {
  const properties = { role: { const: role }, connection_kind: { $ref: '../common.schema.json#/$defs/enumConstraint' } };
  if (info.hasSystem) properties.system = { $ref: '../common.schema.json#/$defs/enumConstraint' };
  for (const field of info.fields) properties[field] = requestPortFieldSchemas[field];
  return { type: 'object', additionalProperties: false, required: ['role'], properties };
}

export function buildRequestSchema(classDefinition) {
  const attributes = Object.fromEntries(Object.entries(classDefinition.attributes).map(([key, definition]) => [key, requestAttributeSchema(definition)]));
  const portSchemas = [...roles(classDefinition)].map(([role, info]) => requestPortSchema(role, info));
  return {
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    $id: `https://example.local/schemas/annotation/class-specific/${classDefinition.class_id}.request.schema.json`,
    title: `Request line annotation: ${classDefinition.name_ru}`,
    allOf: [
      { $ref: '../request-line-annotation.base.schema.json' },
      { type: 'object', properties: {
        class_id: { const: classDefinition.class_id },
        constraints: { type: 'object', properties: {
          attributes: { type: 'object', additionalProperties: false, properties: attributes },
          ports: { type: 'array', maxItems: classDefinition.ports.catalog_ordered_slots.length, items: portSchemas.length ? { oneOf: portSchemas } : false }
        } }
      } }
    ]
  };
}
