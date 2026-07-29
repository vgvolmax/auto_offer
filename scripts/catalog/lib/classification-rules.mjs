import { normalizeName } from './name-normalizer.mjs';

function normalizedSet(values = []) {
  return new Set(values.map(value => normalizeName(value).name));
}

function matchRule(record, rule) {
  const tokens = new Set(record.normalized.tokens);
  const normalizedName = record.normalized.name;
  const context = normalizedSet(record.raw.category_context ?? []);
  if ((rule.all_tokens ?? []).some(token => !tokens.has(normalizeName(token).name))) return false;
  if ((rule.any_tokens ?? []).length && !(rule.any_tokens ?? []).some(token => tokens.has(normalizeName(token).name))) return false;
  if ((rule.excluded_tokens ?? []).some(token => tokens.has(normalizeName(token).name))) return false;
  if (rule.exact_normalized_phrase && normalizedName !== normalizeName(rule.exact_normalized_phrase).name) return false;
  if (rule.regex && !new RegExp(rule.regex, 'iu').test(normalizedName)) return false;
  if ((rule.exact_context ?? []).length && !(rule.exact_context ?? []).some(value => context.has(normalizeName(value).name))) return false;
  if ((rule.source_ids ?? []).length && !rule.source_ids.includes(record.source_file?.source_id)) return false;
  if ((rule.sheet_names ?? []).length && !rule.sheet_names.includes(record.source?.sheet)) return false;
  return true;
}

export function classifyRecord(record, rules) {
  const matches = [...rules].sort((a, b) => (a.priority ?? 0) - (b.priority ?? 0) || a.rule_id.localeCompare(b.rule_id))
    .filter(rule => matchRule(record, rule));
  const classes = [...new Set(matches.map(rule => rule.class_id))].sort();
  return {
    taxonomy_status: classes.length === 0 ? 'unsupported' : classes.length === 1 ? 'proposed_mapped' : 'ambiguous',
    proposed_class_ids: classes,
    matched_rule_ids: matches.map(rule => rule.rule_id)
  };
}

function addFlag(records, code) {
  for (const record of records) if (!record.duplicate_flags.includes(code)) record.duplicate_flags.push(code);
}

function groups(records, keyFn) {
  const map = new Map();
  for (const record of records) {
    const key = keyFn(record);
    if (!key) continue;
    const bucket = map.get(key) ?? [];
    bucket.push(record);
    map.set(key, bucket);
  }
  return [...map.values()].filter(bucket => bucket.length > 1);
}

export function detectDuplicateDiagnostics(records) {
  const eligibleRecords = records.filter(record => record.row_status === undefined || record.row_status === 'product_candidate');
  for (const bucket of groups(eligibleRecords, record => record.source_fingerprint)) {
    const sourceCount = new Set(bucket.map(item => item.source_file.source_id)).size;
    addFlag(bucket, sourceCount > 1 ? 'CROSS_SOURCE_DUPLICATE' : 'EXACT_SOURCE_DUPLICATE');
  }
  for (const bucket of groups(eligibleRecords, record => record.raw.supplier_sku)) {
    const names = new Set(bucket.map(item => item.normalized.name));
    const sources = new Set(bucket.map(item => item.source_file.source_id));
    if (names.size > 1) addFlag(bucket, 'SUPPLIER_SKU_CONFLICT');
    else if (sources.size > 1) addFlag(bucket, 'CROSS_SOURCE_DUPLICATE');
  }
  for (const bucket of groups(eligibleRecords, record => record.raw.gtin)) {
    const names = new Set(bucket.map(item => item.normalized.name));
    const sources = new Set(bucket.map(item => item.source_file.source_id));
    if (names.size > 1) addFlag(bucket, 'GTIN_CONFLICT');
    else if (sources.size > 1) addFlag(bucket, 'CROSS_SOURCE_DUPLICATE');
  }
  for (const bucket of groups(eligibleRecords, record => record.normalized.name)) {
    const identifiers = new Set(bucket.map(item => `${item.raw.supplier_sku ?? ''}|${item.raw.gtin ?? ''}`));
    if (identifiers.size > 1) addFlag(bucket, 'POSSIBLE_NAME_DUPLICATE');
  }
  for (const record of records) record.duplicate_flags.sort();
  return records;
}
