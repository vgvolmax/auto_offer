const forbiddenDecisionFields = new Set([
  'confirmed', 'selected', 'selected_candidate', 'accepted', 'rejected_by_operator',
  'operator_comment', 'manual_override', 'match_score', 'similarity_score',
  'product_id', 'offer_id',
]);

export function validatePolicySemantics(policy, { catalogRecordIds = [] } = {}) {
  const errors = [];
  const brands = policy.brands;

  for (const brand of brands.include) {
    if (brands.exclude.includes(brand)) errors.push(`brand include/exclude conflict: ${brand}`);
  }
  for (const brand of brands.preferred) {
    if (brands.exclude.includes(brand)) errors.push(`preferred brand is excluded: ${brand}`);
  }
  for (const recordId of policy.catalog_priority) {
    if (!policy.catalog_record_ids.includes(recordId)) errors.push(`catalog_priority is outside selected catalogs: ${recordId}`);
  }
  for (const recordId of policy.catalog_record_ids) {
    if (catalogRecordIds.length && !catalogRecordIds.includes(recordId)) errors.push(`unknown catalog record: ${recordId}`);
  }
  return errors;
}

export function findForbiddenDecisionFields(value, path = '$', output = []) {
  if (!value || typeof value !== 'object') return output;

  for (const [key, child] of Object.entries(value)) {
    if (forbiddenDecisionFields.has(key)) output.push(`${path}.${key}`);
    findForbiddenDecisionFields(child, `${path}.${key}`, output);
  }
  return output;
}
