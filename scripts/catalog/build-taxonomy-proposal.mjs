import { readFile } from 'node:fs/promises';
import { gunzipSync } from 'node:zlib';
import { loadJson } from './lib/source-config.mjs';
import { sha256Canonical, sha256Text } from './lib/canonical-json.mjs';
import { writeCanonicalGzip, writeCanonicalJson, writeText } from './lib/output.mjs';
import { renderCatalogInventoryReport, renderTaxonomyApprovalChecklist } from './lib/public-taxonomy-reports.mjs';

const inventoryPath = 'data/generated/catalog-source-inventory.jsonl';
const inventoryText = await readFile(inventoryPath, 'utf8');
const inventoryFileSha256 = sha256Text(inventoryText);
const records = inventoryText.trim() ? inventoryText.trimEnd().split('\n').map(line => JSON.parse(line)) : [];
const rulesProposal = await loadJson('taxonomy/classification-rules.proposed.json');
const sourceConfig = await loadJson('config/catalog-sources.json');
const inspectionIndex = await loadJson('reports/catalog-source-inspection.json');
const inspection = JSON.parse(gunzipSync(await readFile(inspectionIndex.payload_file)).toString('utf8'));

function sortedUnique(values) {
  return [...new Set(values.filter(value => value !== undefined && value !== null))].sort((a, b) => String(a).localeCompare(String(b), 'ru'));
}

function counter(values) {
  const result = {};
  for (const value of values) result[value] = (result[value] ?? 0) + 1;
  return Object.fromEntries(Object.entries(result).sort(([a], [b]) => a.localeCompare(b, 'ru')));
}

function examples(items, limit = 10) {
  return items
    .filter(item => item.raw?.name)
    .sort((a, b) => a.source_item_id.localeCompare(b.source_item_id, 'ru'))
    .slice(0, limit)
    .map(item => ({source_item_id: item.source_item_id, raw_name: item.raw.name}));
}

const productRecords = records.filter(record => record.row_status === 'product_candidate');
const clusterGroups = new Map();
for (const record of productRecords) {
  const bucket = clusterGroups.get(record.cluster_id) ?? [];
  bucket.push(record);
  clusterGroups.set(record.cluster_id, bucket);
}

const classMap = {};
for (const [clusterId, clusterRecords] of [...clusterGroups.entries()].sort(([a], [b]) => a.localeCompare(b))) {
  const classIds = sortedUnique(clusterRecords.flatMap(record => record.proposed_class_ids));
  const ruleIds = sortedUnique(clusterRecords.flatMap(record => record.matched_rule_ids));
  const status = classIds.length === 0 ? 'unsupported' : classIds.length === 1 && clusterRecords.every(record => record.taxonomy_status !== 'ambiguous') ? 'proposed_mapped' : 'ambiguous';
  classMap[clusterId] = {
    status,
    source_row_count: clusterRecords.length,
    proposed_class_ids: classIds,
    classification_rule_ids: ruleIds,
    source_ids: sortedUnique(clusterRecords.map(record => record.source_file.source_id))
  };
}

const unresolvedCases = [];
for (const [clusterId, entry] of Object.entries(classMap)) {
  if (entry.status === 'proposed_mapped') continue;
  const caseId = `case:${sha256Canonical({type: entry.status, cluster_id: clusterId}).slice(0, 16)}`;
  unresolvedCases.push({
    case_id: caseId,
    type: entry.status === 'ambiguous' ? 'ambiguous_pattern' : 'unsupported_family',
    question_ru: entry.status === 'ambiguous'
      ? `Какой класс следует утвердить для кластера ${clusterId}?`
      : `Какой новый или существующий класс покрывает кластер ${clusterId}?`,
    cluster_ids: [clusterId],
    source_references: examples(clusterGroups.get(clusterId) ?? [], 5).map(item => item.source_item_id),
    raw_examples: examples(clusterGroups.get(clusterId) ?? [], 5).map(item => item.raw_name),
    candidate_options: entry.proposed_class_ids,
    recommended_option: entry.proposed_class_ids.length === 1 ? entry.proposed_class_ids[0] : null,
    rationale: entry.status === 'ambiguous'
      ? `Совпали правила нескольких классов: ${entry.classification_rule_ids.join(', ')}`
      : 'Ни одно утвержденное proposed rule не совпало с кластером.',
    owner_decision: null
  });
}

function addIdentifierCases(code, field, type = 'identifier_conflict') {
  const groups = new Map();
  for (const record of productRecords.filter(item => item.duplicate_flags.includes(code))) {
    const value = record.raw[field];
    if (!value) continue;
    const bucket = groups.get(value) ?? [];
    bucket.push(record);
    groups.set(value, bucket);
  }
  for (const [value, group] of [...groups.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    const names = sortedUnique(group.map(item => item.raw.name));
    if (names.length < 2) continue;
    unresolvedCases.push({
      case_id: `case:${sha256Canonical({type, code, field, value}).slice(0, 16)}`,
      type,
      question_ru: `Как обработать конфликт ${field} ${value}, связанный с разными наименованиями?`,
      cluster_ids: sortedUnique(group.map(item => item.cluster_id)),
      source_references: sortedUnique(group.map(item => item.source_item_id)).slice(0, 10),
      raw_examples: names.slice(0, 10),
      candidate_options: ['keep_separate_and_disable_exact_identifier', 'confirm_same_product', 'correct_source_data'],
      recommended_option: 'keep_separate_and_disable_exact_identifier',
      rationale: `${code}: один идентификатор встречается у разных нормализованных наименований. Автоматическое объединение запрещено.`,
      owner_decision: null
    });
  }
}
addIdentifierCases('SUPPLIER_SKU_CONFLICT', 'supplier_sku');
addIdentifierCases('GTIN_CONFLICT', 'gtin');

unresolvedCases.sort((a, b) => a.case_id.localeCompare(b.case_id));
const unresolvedIdsByClass = new Map();
for (const item of unresolvedCases) {
  for (const clusterId of item.cluster_ids) {
    for (const classId of classMap[clusterId]?.proposed_class_ids ?? []) {
      const values = unresolvedIdsByClass.get(classId) ?? [];
      values.push(item.case_id);
      unresolvedIdsByClass.set(classId, values);
    }
  }
}

const classes = {};
for (const [classId, definition] of Object.entries(rulesProposal.classes).sort(([a], [b]) => a.localeCompare(b))) {
  const related = productRecords.filter(record => record.proposed_class_ids.includes(classId));
  if (related.length === 0) continue;
  const clusterIds = sortedUnique(related.map(record => record.cluster_id));
  const overlaps = sortedUnique(related.flatMap(record => record.proposed_class_ids).filter(value => value !== classId));
  classes[classId] = {
    class_id: classId,
    name_ru: definition.name_ru,
    family_id: definition.family_id,
    review_status: 'needs_owner_approval',
    source_row_count: related.length,
    cluster_ids: clusterIds.slice(0, 20),
    source_examples: examples(related),
    distinguishing_patterns: rulesProposal.rules.filter(rule => rule.class_id === classId).map(rule => rule.rule_id).sort(),
    candidate_attributes: [...(definition.candidate_attributes ?? [])].sort(),
    candidate_ports: [...(definition.candidate_ports ?? [])].sort(),
    candidate_value_set_refs: [...(definition.candidate_value_set_refs ?? [])].sort(),
    overlaps_with: overlaps,
    open_question_ids: sortedUnique(unresolvedIdsByClass.get(classId) ?? [])
  };
}

const fileHashes = Object.fromEntries(sourceConfig.sources.map(source => {
  const record = records.find(item => item.source_file.source_id === source.source_id);
  return [source.source_id, record?.source_file.sha256 ?? null];
}));
const sourceInventorySha256 = sha256Canonical({
  inventory_sha256: inventoryFileSha256,
  file_hashes: fileHashes,
  source_config: sourceConfig,
  classification_rules: rulesProposal
});

const taxonomyProposal = {
  proposal_schema_version: '1.0.0',
  proposal_version: '0.1.0',
  status: 'proposed',
  mass_annotation_allowed: false,
  source_inventory_sha256: sourceInventorySha256,
  source_file_hashes: fileHashes,
  classes,
  candidate_value_sets: {},
  open_questions: unresolvedCases.map(item => item.case_id)
};

const classMapProposal = {
  proposal_schema_version: '1.0.0',
  proposal_version: '0.1.0',
  source_inventory_sha256: sourceInventorySha256,
  cluster_count: Object.keys(classMap).length,
  clusters: classMap
};

const unresolvedProposal = {
  proposal_schema_version: '1.0.0',
  proposal_version: '0.1.0',
  source_inventory_sha256: sourceInventorySha256,
  case_count: unresolvedCases.length,
  cases: unresolvedCases
};

const rowStatuses = counter(records.map(record => record.row_status));
const taxonomyStatuses = counter(records.map(record => record.taxonomy_status));
const sourceCounts = counter(records.map(record => record.source_file.source_id));
const duplicateCounts = counter(records.flatMap(record => record.duplicate_flags));
const physicalNonemptyRowsAllSheets = inspection.sources.flatMap(source => source.sheets).reduce((sum, sheet) => sum + sheet.nonempty_row_count, 0);
const configuredNonemptyRows = inspection.sources.flatMap(source => source.sheets).filter(sheet => sheet.disposition === 'configured').reduce((sum, sheet) => sum + sheet.nonempty_row_count, 0);
const configuredSheetCount = inspection.sources.flatMap(source => source.sheets).filter(sheet => sheet.disposition === 'configured').length;
const ignoredSheetCount = inspection.sources.flatMap(source => source.sheets).filter(sheet => sheet.disposition === 'ignored').length;
const classCounts = Object.fromEntries(Object.entries(classes).map(([classId, value]) => [classId, value.source_row_count]));
const report = {
  report_schema_version: '1.0.0',
  status: 'proposed',
  mass_annotation_allowed: false,
  source_inventory_sha256: sourceInventorySha256,
  inventory_file_sha256: inventoryFileSha256,
  physical_nonempty_rows_all_sheets: physicalNonemptyRowsAllSheets,
  configured_nonempty_rows: configuredNonemptyRows,
  configured_sheet_count: configuredSheetCount,
  ignored_sheet_count: ignoredSheetCount,
  total_inventory_records: records.length,
  row_status_counts: rowStatuses,
  taxonomy_status_counts: taxonomyStatuses,
  source_counts: sourceCounts,
  duplicate_flag_counts: duplicateCounts,
  proposed_class_counts: classCounts,
  unresolved_case_count: unresolvedCases.length
};

const taxonomyPayload = 'taxonomy/generated/taxonomy.proposed.full.json.gz';
const classMapPayload = 'taxonomy/generated/class-map.proposed.full.json.gz';
const unresolvedPayload = 'taxonomy/generated/unresolved-cases.full.json.gz';
const taxonomyHashes = await writeCanonicalGzip(taxonomyPayload, taxonomyProposal);
const classMapHashes = await writeCanonicalGzip(classMapPayload, classMapProposal);
const unresolvedHashes = await writeCanonicalGzip(unresolvedPayload, unresolvedProposal);
await writeCanonicalJson('taxonomy/taxonomy.proposed.json', {
  proposal_schema_version: '1.0.0',
  proposal_version: '0.1.0',
  status: 'proposed',
  mass_annotation_allowed: false,
  source_inventory_sha256: sourceInventorySha256,
  source_file_hashes: fileHashes,
  class_count: Object.keys(classes).length,
  open_question_count: unresolvedCases.length,
  private_payload: {committed: false, artifact_kind: 'taxonomy_proposal_full', sha256: taxonomyHashes.compressed_sha256, uncompressed_sha256: taxonomyHashes.uncompressed_sha256, regeneration_command: 'npm run catalog:inventory'}
});
await writeCanonicalJson('taxonomy/class-map.proposed.json', {
  proposal_schema_version: '1.0.0',
  proposal_version: '0.1.0',
  source_inventory_sha256: sourceInventorySha256,
  cluster_count: Object.keys(classMap).length,
  private_payload: {committed: false, artifact_kind: 'class_map_full', sha256: classMapHashes.compressed_sha256, uncompressed_sha256: classMapHashes.uncompressed_sha256, regeneration_command: 'npm run catalog:inventory'}
});
await writeCanonicalJson('taxonomy/unresolved-cases.json', {
  proposal_schema_version: '1.0.0',
  proposal_version: '0.1.0',
  source_inventory_sha256: sourceInventorySha256,
  case_count: unresolvedCases.length,
  private_payload: {committed: false, artifact_kind: 'unresolved_cases_full', sha256: unresolvedHashes.compressed_sha256, uncompressed_sha256: unresolvedHashes.uncompressed_sha256, regeneration_command: 'npm run catalog:inventory'}
});
await writeCanonicalJson('reports/catalog-source-inventory.json', report);
await writeCanonicalJson('reports/catalog-source-inventory-manifest.json', {
  manifest_schema_version: '1.0.0',
  committed: false,
  contains_prices: false,
  generated_file: inventoryPath,
  inventory_sha256: inventoryFileSha256,
  proposal_input_sha256: sourceInventorySha256,
  regeneration_command: 'npm run catalog:inventory',
  reason_not_committed: 'Private source workbooks, full row-level inventory, and full audit payloads are generated locally and excluded from Git. Committed summaries, hashes, rules, schemas, and review reports anchor the result.',
  physical_nonempty_rows_all_sheets: physicalNonemptyRowsAllSheets,
  configured_nonempty_rows: configuredNonemptyRows,
  configured_sheet_count: configuredSheetCount,
  ignored_sheet_count: ignoredSheetCount,
  total_inventory_records: records.length,
  row_status_counts: rowStatuses,
  taxonomy_status_counts: taxonomyStatuses,
  source_files: sourceConfig.sources.map(source => ({
    source_id: source.source_id,
    filename: source.filename,
    sha256: fileHashes[source.source_id]
  }))
});

/* Public Markdown intentionally receives aggregate data only. */
const md = renderCatalogInventoryReport({
  inventoryFileSha256, proposalInputSha256: sourceInventorySha256,
  physicalNonemptyRows: physicalNonemptyRowsAllSheets, configuredNonemptyRows,
  configuredSheetCount, ignoredSheetCount, totalInventoryRecords: records.length,
  rowStatusCounts: rowStatuses, taxonomyStatusCounts: taxonomyStatuses,
  sourceCounts, sourceFileHashes: fileHashes, classCounts,
  duplicateCounts, unresolvedCaseCount: unresolvedCases.length
});
await writeText('reports/catalog-source-inventory.md', md);

const checklist = renderTaxonomyApprovalChecklist({classes});
await writeText('reports/taxonomy-approval-checklist.md', checklist);
console.log(`Built proposed taxonomy with ${Object.keys(classes).length} classes and ${unresolvedCases.length} unresolved cases.`);
