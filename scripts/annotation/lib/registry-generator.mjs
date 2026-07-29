import { buildRequestPortContracts } from './request-port-contracts.mjs';

const identityPaths = ['/identity/brand','/identity/manufacturer','/identity/series','/identity/manufacturer_articles/*','/identity/models/*'];
const requestedIdentityPaths = ['/requested_identity/brand','/requested_identity/manufacturer','/requested_identity/manufacturer_article','/requested_identity/model','/requested_identity/gtin','/requested_identity/supplier_sku'];
const technicalFields = ['nominal_diameter_dn','pipe_outer_diameter_mm','pipe_wall_thickness_mm','thread_standard','thread_size'];

export function buildRegistry(taxonomy) {
  const classes = {};
  for (const classId of Object.keys(taxonomy.classes)) {
    const definition = taxonomy.classes[classId];
    const requestPorts = buildRequestPortContracts(definition);
    const requestFields = [...new Set(requestPorts.flatMap(contract => contract.allowed_fields))].sort();
    const requestHasSystem = requestPorts.some(contract => contract.system_selector);
    const canonical = {};
    const allowed = ['/class_id', ...identityPaths, ...requestedIdentityPaths, '/quantity', '/substitution_statement'];
    const requestPortPatterns = requestPorts.length ? ['/constraints/ports/*/connection_kind', ...(requestHasSystem ? ['/constraints/ports/*/system'] : []), ...requestFields.map(field => `/constraints/ports/*/${field}`)] : [];
    const requiredPatterns = ['/class_id', ...identityPaths, '/attributes/*', '/ports/*/connection_kind','/ports/*/system',...technicalFields.map(field=>`/ports/*/${field}`),'/requested_identity/*','/constraints/attributes/*',...requestPortPatterns,'/quantity','/substitution_statement'];
    const fixed = [];
    for (const [attributeId, attribute] of Object.entries(definition.attributes)) {
      allowed.push(`/attributes/${attributeId}`, `/constraints/attributes/${attributeId}`);
      if (attribute.value_set_ref) {
        canonical[`/attributes/${attributeId}`] = attribute.value_set_ref;
        canonical[`/constraints/attributes/${attributeId}`] = attribute.value_set_ref;
      }
    }
    for (const [index, slot] of definition.ports.catalog_ordered_slots.entries()) {
      const fields = ['connection_kind', ...(slot.system ? ['system'] : []), ...slot.allowed_fields];
      for (const field of fields) allowed.push(`/ports/${index}/${field}`);
      if (slot.connection_kind.fixed) fixed.push(`/ports/${index}/connection_kind`);
      if (slot.system?.fixed) fixed.push(`/ports/${index}/system`);
      canonical[`/ports/${index}/connection_kind`] = 'connection_kinds';
      if (slot.system) canonical[`/ports/${index}/system`] = 'pipe_systems';
      if (slot.allowed_fields.includes('thread_standard')) canonical[`/ports/${index}/thread_standard`] = 'thread_standards';
    }
    if (requestPorts.length) {
      allowed.push('/constraints/ports/*/connection_kind', ...(requestHasSystem ? ['/constraints/ports/*/system'] : []), ...requestFields.map(field => `/constraints/ports/*/${field}`));
      canonical['/constraints/ports/*/connection_kind'] = 'connection_kinds';
      if (requestHasSystem) canonical['/constraints/ports/*/system'] = 'pipe_systems';
      if (requestFields.includes('thread_standard')) canonical['/constraints/ports/*/thread_standard'] = 'thread_standards';
    }
    classes[classId] = {
      catalog_schema: `class-specific/${classId}.catalog.schema.json`,
      request_schema: `class-specific/${classId}.request.schema.json`,
      canonical_value_paths: Object.fromEntries(Object.entries(canonical).sort(([a],[b])=>a.localeCompare(b))),
      allowed_annotation_paths: [...new Set(allowed)].sort(),
      evidence_policy: { required_patterns: [...new Set(requiredPatterns)].sort(), fixed_by_class_patterns: fixed.sort() },
      critical_catalog_paths: [
        ...Object.entries(definition.attributes).filter(([, attribute]) => attribute.required_for_validated).map(([attributeId]) => `/attributes/${attributeId}`),
        ...definition.ports.catalog_ordered_slots.flatMap((slot, index) => slot.required ? slot.required_for_validated.map(field => `/ports/${index}/${field}`) : [])
      ].sort(),
      repeatable_port_roles: [...definition.ports.repeatable_roles].sort()
    };
  }
  return { schema_version: '1.1.0', taxonomy_version: taxonomy.taxonomy_version, classes };
}
