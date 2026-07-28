import { classifyGtin } from './catalog-identifiers.mjs';

const issue = (code, path, message, details) => ({ code, path, message, ...(details === undefined ? {} : { details }) });
const escapeToken = value => String(value).replaceAll('~', '~0').replaceAll('/', '~1');
const decodeToken = value => value.replaceAll('~1', '/').replaceAll('~0', '~');

export function getCanonicalValueIds(taxonomy, valueSetId) {
  const valueSet = taxonomy?.value_sets?.[valueSetId];
  if (!valueSet) return new Set();
  if (valueSet.values && typeof valueSet.values === 'object' && !Array.isArray(valueSet.values)) {
    return new Set(Object.keys(valueSet.values));
  }
  throw new Error(`Value set ${valueSetId} does not use the normative object-based format`);
}

function pointerAt(root, pointer) {
  if (!/^\/(?:[^~/]|~[01])*(?:\/(?:[^~/]|~[01])*)*$/.test(pointer)) return { exists: false, invalid: true };
  let value = root;
  for (const token of pointer.slice(1).split('/').map(decodeToken)) {
    if (value === null || typeof value !== 'object' || !(token in value)) return { exists: false };
    value = value[token];
  }
  return { exists: true, value };
}

function hasConfirmedValue(target) {
  return target.exists && target.value !== null;
}

function matches(pattern, pointer) {
  const a = pattern.split('/'); const b = pointer.split('/');
  return a.length === b.length && a.every((part, index) => part === '*' || part === b[index]);
}
function walk(value, path, callback) {
  callback(value, path);
  if (value && typeof value === 'object') for (const [key, child] of Object.entries(value)) walk(child, `${path}/${escapeToken(key)}`, callback);
}
function gcd(a, b) { while (b) [a, b] = [b, a % b]; return Math.abs(a); }
function constraintValues(value) {
  if (!value || typeof value !== 'object') return [value];
  if (['eq', 'neq'].includes(value.operator)) return [value.value];
  if (['in', 'contains_all', 'contains_any'].includes(value.operator)) return value.values ?? [];
  return [];
}
function resolveSchema(schemas, relativePath) {
  const entry = schemas?.[relativePath];
  if (typeof entry === 'function') return { validator: entry };
  return entry;
}

export function validateAnnotation({ kind, data, taxonomy = {}, registry = { classes: {} }, schemas }) {
  const issues = []; const add = (...args) => issues.push(issue(...args));
  if (!['document_segmentation', 'catalog_item', 'request_document'].includes(kind)) add('UNKNOWN_ANNOTATION_KIND', '', `Unsupported kind ${kind}`);
  const items = kind === 'catalog_item' ? [data] : kind === 'request_document' ? (data.lines ?? []) : [];

  for (const [index, item] of items.entries()) {
    const prefix = kind === 'catalog_item' ? '' : `/lines/${index}`;
    const registration = registry.classes?.[item.class_id];
    if (!registration) { add('UNKNOWN_CLASS_ID', `${prefix}/class_id`, 'Class ID is not registered', { value: item.class_id }); continue; }
    const schemaKey = kind === 'catalog_item' ? 'catalog_schema' : 'request_schema';
    const schemaPath = registration[schemaKey]; const schema = resolveSchema(schemas, schemaPath);
    if (!schemaPath || (schemas && !schema)) add('CLASS_SCHEMA_MISSING', `${prefix}/class_id`, 'Registered class-specific schema is unavailable', { schema: schemaPath });
    else if (schemas && !schema.validator) add('CLASS_SCHEMA_NOT_COMPILED', `${prefix}/class_id`, 'Class-specific schema was not compiled', { schema: schemaPath });
    else if (schemas) {
      if (schema.classId !== undefined && schema.classId !== item.class_id) add('CLASS_SCHEMA_MISMATCH', `${prefix}/class_id`, 'Schema class_id const differs from registry', { schema: schemaPath });
      if (!schema.validator(item)) add('CLASS_SPECIFIC_VALIDATION_FAILED', prefix || '/', 'Annotation failed its class-specific schema', { schema: schemaPath, errors: schema.validator.errors });
    }

    const annotation = item.annotation ?? {};
    const hasBlockingAmbiguity = annotation.ambiguities?.some(x => x.blocking !== false);
    if (annotation.status === 'validated' && annotation.issues?.length) add('VALIDATED_WITH_ISSUES', `${prefix}/annotation/issues`, 'validated annotation cannot contain issues');
    if (annotation.status === 'needs_review' && !annotation.unknown_fields?.length && !annotation.issues?.length && !hasBlockingAmbiguity) add('REVIEW_REASON_REQUIRED', `${prefix}/annotation/status`, 'needs_review requires an unknown field, issue, or blocking ambiguity');
    if (annotation.status === 'validated' && hasBlockingAmbiguity) add('BLOCKING_AMBIGUITY', `${prefix}/annotation/ambiguities`, 'validated annotation cannot contain a blocking ambiguity');
    if (annotation.status === 'invalid' && !annotation.issues?.length) add('ISSUE_REQUIRED', `${prefix}/annotation/issues`, 'invalid annotation requires an issue');

    const allowed = registration.allowed_annotation_paths ?? [];
    for (const pointer of annotation.unknown_fields ?? []) {
      const target = pointerAt(item, pointer);
      if (target.invalid) add('INVALID_JSON_POINTER', `${prefix}/annotation/unknown_fields`, 'Unknown field pointer is not RFC 6901');
      else if (!allowed.some(pattern => matches(pattern, pointer))) add('UNKNOWN_PATH_NOT_ALLOWED', `${prefix}${pointer}`, 'Unknown pointer is not allowed for this class');
      if (hasConfirmedValue(target)) add('UNKNOWN_POINTS_TO_VALUE', `${prefix}${pointer}`, 'Unknown pointer already has a value');
    }
    for (const ambiguity of annotation.ambiguities ?? []) {
      const pointer = ambiguity.json_pointer;
      if (pointerAt(item, pointer).invalid) add('INVALID_JSON_POINTER', `${prefix}/annotation/ambiguities`, 'Ambiguity pointer is not RFC 6901');
      else if (!allowed.some(pattern => matches(pattern, pointer))) add('AMBIGUITY_PATH_NOT_ALLOWED', `${prefix}${pointer}`, 'Ambiguity pointer is not allowed for this class');
      const values = ambiguity.possible_values;
      if (values && new Set(values.map(JSON.stringify)).size < 2) add('AMBIGUITY_VALUES_REQUIRED', `${prefix}${pointer}`, 'Ambiguity requires at least two unique possible values');
      const target = pointerAt(item, pointer);
      if (hasConfirmedValue(target) && !annotation.issues?.some(x => x.json_pointer === pointer)) add('AMBIGUITY_POINTS_TO_CONFIRMED_VALUE', `${prefix}${pointer}`, 'Ambiguity points to a confirmed value');
    }
    for (const evidence of annotation.evidence ?? []) {
      const target = pointerAt(item, evidence.json_pointer);
      if (!target.exists) add('EVIDENCE_POINTER_NOT_FOUND', `${prefix}${evidence.json_pointer}`, 'Evidence pointer does not exist');
      else if (target.value === null) add('EVIDENCE_POINTS_TO_EMPTY_VALUE', `${prefix}${evidence.json_pointer}`, 'Evidence cannot point to a null value');
    }

    const evidencePointers = new Set((annotation.evidence ?? []).map(x => x.json_pointer));
    const policy = registration.evidence_policy ?? {};
    walk(item, '', (value, pointer) => {
      if (!pointer || value === undefined || value === null) return;
      if (!(policy.required_patterns ?? []).some(pattern => matches(pattern, pointer))) return;
      if (pointer === '/substitution_statement' && value.explicit === false && value.policy === 'unspecified' && value.raw_text === null) return;
      if ((policy.fixed_by_class_patterns ?? []).some(pattern => matches(pattern, pointer))) return;
      if ((policy.deterministic_import_patterns ?? []).some(pattern => matches(pattern, pointer))) return;
      if (!evidencePointers.has(pointer)) add('MISSING_EVIDENCE', `${prefix}${pointer}`, 'AI-derived value requires evidence');
    });

    const ports = item.ports ?? item.constraints?.ports ?? []; const roles = new Set();
    for (const port of ports) { if (roles.has(port.role)) add('DUPLICATE_PORT_ROLE', `${prefix}${item.ports ? '/ports' : '/constraints/ports'}`, 'Port roles must be unique', { role: port.role }); roles.add(port.role); }
    for (const [pattern, valueSetId] of Object.entries(registration.canonical_value_paths ?? {})) {
      walk(item, '', (value, pointer) => {
        if (!matches(pattern, pointer)) return;
        for (const canonical of constraintValues(value)) if (typeof canonical === 'string' && !getCanonicalValueIds(taxonomy, valueSetId).has(canonical)) add('UNKNOWN_CANONICAL_VALUE', `${prefix}${pointer}`, 'Value is absent from taxonomy value set', { value_set_id: valueSetId, value: canonical });
      });
    }
    if (kind === 'catalog_item') {
      for (const pointer of registration.critical_catalog_paths ?? []) if (!pointerAt(item, pointer).exists) {
        const explained = (annotation.unknown_fields ?? []).includes(pointer) || (annotation.ambiguities ?? []).some(x => x.json_pointer === pointer) || annotation.issues?.some(x => x.json_pointer === pointer);
        if (annotation.status === 'validated' || !explained) add('MISSING_CRITICAL_FIELD', pointer, 'Catalog annotation lacks an unexplained critical field');
      }
    } else {
      const requestedIdentity = item.requested_identity ?? {};
      if (Object.hasOwn(requestedIdentity, 'gtin')) {
        const requestedValues = constraintValues(requestedIdentity.gtin);
        if (requestedValues.some(value => classifyGtin(value) !== 'valid') && annotation.status !== 'needs_review') add('INVALID_REQUEST_GTIN_REQUIRES_REVIEW', `${prefix}/requested_identity/gtin`, 'An invalid explicitly printed GTIN requires needs_review');
      }
      const unit = item.quantity?.unit;
      if (unit && !getCanonicalValueIds(taxonomy, 'quantity_units').has(unit)) add('UNKNOWN_QUANTITY_UNIT', `${prefix}/quantity/unit`, 'Quantity unit is absent from taxonomy');
    }
  }

  walk(data, '', (value, path) => {
    if (value?.operator === 'between' && typeof value.min === 'number' && typeof value.max === 'number' && value.min > value.max) add('INVALID_RANGE', path, 'between.min must not exceed between.max');
    if (['in', 'contains_all', 'contains_any'].includes(value?.operator) && Array.isArray(value.values) && new Set(value.values.map(JSON.stringify)).size !== value.values.length) add('DUPLICATE_CONSTRAINT_VALUE', `${path}/values`, 'Constraint values contain duplicates');
    if (value?.unit === 'inch' && Number.isInteger(value.numerator) && Number.isInteger(value.denominator) && value.denominator > 0 && gcd(value.numerator, value.denominator) !== 1) add('NON_REDUCED_RATIONAL', path, 'Rational inch must be reduced');
  });
  if (kind === 'document_segmentation') {
    const segments = data.segments ?? []; const map = new Map(segments.map(x => [x.segment_id, x]));
    for (const [index, segment] of segments.entries()) {
      for (const id of [segment.parent_segment_id, ...(segment.context_segment_ids ?? [])].filter(Boolean)) if (!map.has(id)) add('UNKNOWN_SEGMENT_REFERENCE', `/segments/${index}`, 'Referenced segment does not exist', { value: id });
      const seen = new Set([segment.segment_id]); let current = segment;
      while (current?.parent_segment_id) { if (seen.has(current.parent_segment_id)) { add('PARENT_CYCLE', `/segments/${index}/parent_segment_id`, 'Parent chain contains a cycle'); break; } seen.add(current.parent_segment_id); current = map.get(current.parent_segment_id); }
    }
  }
  return { valid: issues.length === 0, issues };
}
