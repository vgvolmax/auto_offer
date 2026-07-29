import { buildRequestPortContracts } from './request-port-contracts.mjs';
import { requestAttributeSchema, requestPortFieldSchemas, requestSelectorConstraint } from './schema-utils.mjs';

function requestPortSchema(contract) {
  const properties = { role: { const: contract.role }, connection_kind: requestSelectorConstraint(contract.connection_kind_selector) };
  if (contract.system_selector) properties.system = requestSelectorConstraint(contract.system_selector);
  for (const field of contract.allowed_fields) properties[field] = requestPortFieldSchemas[field];
  return { type: 'object', additionalProperties: false, required: ['role'], properties };
}

export function buildRequestSchema(classDefinition) {
  const attributes = Object.fromEntries(Object.entries(classDefinition.attributes).map(([key, definition]) => [key, requestAttributeSchema(definition)]));
  const portSchemas = buildRequestPortContracts(classDefinition).map(requestPortSchema);
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
