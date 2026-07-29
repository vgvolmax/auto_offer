export function selectorValues(selector) {
  if (!selector) return [];
  const values = Object.hasOwn(selector, 'fixed') ? [selector.fixed] : selector.allowed ?? [];
  return [...new Set(values)].sort();
}

function mergeSelectors(selectors) {
  const present = selectors.filter(Boolean);
  if (!present.length) return null;
  if (present.length === selectors.length && present.every(selector => Object.hasOwn(selector, 'fixed')) && new Set(present.map(selector => selector.fixed)).size === 1) {
    return { fixed: present[0].fixed };
  }
  return { allowed: [...new Set(present.flatMap(selectorValues))].sort() };
}

export function buildRequestPortContracts(classDefinition) {
  const slots = classDefinition.ports.catalog_ordered_slots;
  return classDefinition.ports.request_allowed_roles.map(role => {
    const matching = slots.filter(slot => slot.role === role);
    if (!matching.length) throw new Error(`REQUEST_ROLE_WITHOUT_CATALOG_SLOT:${classDefinition.class_id}:${role}`);
    return {
      role,
      connection_kind_selector: mergeSelectors(matching.map(slot => slot.connection_kind)),
      system_selector: mergeSelectors(matching.map(slot => slot.system)),
      allowed_fields: [...new Set(matching.flatMap(slot => slot.allowed_fields))].sort()
    };
  });
}
