export function normalizeCanonicalJson(value) {
  if (Array.isArray(value)) {
    return value.map(normalizeCanonicalJson);
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, normalizeCanonicalJson(value[key])]),
    );
  }

  if (typeof value === 'number' && !Number.isFinite(value)) {
    throw new TypeError('Canonical JSON only supports finite numbers');
  }

  return value;
}

export function canonicalJson(value) {
  return JSON.stringify(normalizeCanonicalJson(value));
}
