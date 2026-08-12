const REQUIRED_CLASS_FIELDS = [
  'class_id',
  'family_id',
  'name_ru',
  'definition_ru',
  'include_rules_ru',
  'exclude_rules_ru',
];

function assertString(value, path) {
  if (typeof value !== 'string' || value.length === 0) throw new Error(`${path} must be a non-empty string`);
}

export function buildTaxonomyLight(taxonomy) {
  if (!taxonomy || typeof taxonomy !== 'object' || Array.isArray(taxonomy)) throw new Error('taxonomy must be an object');
  for (const field of ['taxonomy_schema_version', 'taxonomy_version']) assertString(taxonomy[field], `taxonomy.${field}`);
  if (taxonomy.status !== 'production') throw new Error('taxonomy.status must be production');
  if (!taxonomy.classes || typeof taxonomy.classes !== 'object' || Array.isArray(taxonomy.classes)) throw new Error('taxonomy.classes must be an object');
  const entries = Object.entries(taxonomy.classes);
  if (taxonomy.class_count !== entries.length) throw new Error('taxonomy.class_count must equal the number of classes');

  const classes = entries.map(([key, definition]) => {
    if (!definition || typeof definition !== 'object' || Array.isArray(definition)) throw new Error(`taxonomy.classes.${key} must be an object`);
    if (definition.class_id !== key) throw new Error(`taxonomy.classes.${key}.class_id must equal its map key`);
    for (const field of REQUIRED_CLASS_FIELDS.slice(0, 4)) assertString(definition[field], `taxonomy.classes.${key}.${field}`);
    for (const field of REQUIRED_CLASS_FIELDS.slice(4)) {
      if (!Array.isArray(definition[field]) || definition[field].some((value) => typeof value !== 'string')) throw new Error(`taxonomy.classes.${key}.${field} must be an array of strings`);
    }
    return Object.fromEntries(REQUIRED_CLASS_FIELDS.map((field) => [field, structuredClone(definition[field])]));
  }).sort((left, right) => left.class_id.localeCompare(right.class_id));

  if (new Set(classes.map(({ class_id }) => class_id)).size !== classes.length) throw new Error('taxonomy class_id values must be unique');
  return {
    kind: 'taxonomy_light',
    schema_version: '1.0.0',
    taxonomy_schema_version: taxonomy.taxonomy_schema_version,
    taxonomy_version: taxonomy.taxonomy_version,
    status: 'production',
    class_count: classes.length,
    classes,
  };
}
