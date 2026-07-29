import { canonicalStringify } from '../catalog/lib/canonical-json.mjs';

export function buildClassAnnotationPrompt({ kind, classId, rawText, taxonomy, classSchema }) {
  if (!['catalog_item','request_line'].includes(kind)) throw new Error(`Unsupported annotation kind: ${kind}`);
  if (!taxonomy.classes?.[classId]) throw new Error(`Unknown class_id: ${classId}`);
  return [
    '# Class-specific annotation prompt v1',
    '',
    `kind: ${kind}`,
    `taxonomy_version: ${taxonomy.taxonomy_version}`,
    `class_id: ${classId}`,
    '',
    'SOURCE TEXT',
    rawText,
    '',
    'RULES',
    '- Return JSON only.',
    '- Extract only explicit source facts; do not infer domain defaults.',
    '- Use annotation.unknown_fields for a required fact that is absent.',
    '- Use a blocking annotation.ambiguities entry when two or more values are plausible.',
    '- Add RFC 6901 evidence for every AI-derived value.',
    '- Do not return product_id, offer_id, match_level, similarity scores, or matching decisions.',
    '- For catalog items, do not copy or process GTIN or supplier_sku; identifiers are imported deterministically.',
    '',
    'CLASS SCHEMA',
    canonicalStringify(classSchema, 2),
    ''
  ].join('\n');
}
