/** Pure helpers for JSON-compatible contract values. */
export function stableJsonValue(value) {
  if (Array.isArray(value)) return value.map(stableJsonValue);
  if (value !== null && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stableJsonValue(value[key])]));
  return value;
}
export function jsonDeepEqual(left, right) {
  if (left === right) return true;
  if (left === null || right === null || typeof left !== typeof right) return false;
  if (Array.isArray(left) || Array.isArray(right)) return Array.isArray(left) && Array.isArray(right) && left.length === right.length && left.every((value, index) => jsonDeepEqual(value, right[index]));
  if (typeof left !== 'object') return false;
  const leftKeys = Object.keys(left).sort(), rightKeys = Object.keys(right).sort();
  return jsonDeepEqual(leftKeys, rightKeys) && leftKeys.every((key) => jsonDeepEqual(left[key], right[key]));
}
export function externalRefs(schema, baseId = schema.$id) {
  const refs = new Set();
  function visit(value) { if (!value || typeof value !== 'object') return; if (typeof value.$ref === 'string' && !value.$ref.startsWith('#')) refs.add(new URL(value.$ref, baseId).href.split('#')[0]); Object.values(value).forEach(visit); }
  visit(schema); return [...refs].sort();
}
