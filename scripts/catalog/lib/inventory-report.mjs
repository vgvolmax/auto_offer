import path from 'node:path';
import { normalizeName } from './name-normalizer.mjs';
import { sha256Canonical } from './canonical-json.mjs';

function nonEmpty(sheet) {
  return sheet.nonempty_row_count > 0;
}

export function validateSourceCoverage(workbook, config) {
  const configured = new Set((config.sheets ?? []).map(sheet => sheet.name));
  const ignored = new Map((config.ignored_sheets ?? []).map(sheet => [sheet.name, sheet.reason]));
  for (const [name, reason] of ignored) if (!String(reason ?? '').trim()) throw new Error(`IGNORED_SHEET_REASON_REQUIRED:${name}`);
  for (const sheet of workbook.sheets.filter(nonEmpty)) {
    if (!configured.has(sheet.name) && !ignored.has(sheet.name)) throw new Error(`UNCONFIGURED_NON_EMPTY_SHEET:${sheet.name}`);
  }
  for (const name of configured) if (!workbook.sheets.some(sheet => sheet.name === name)) throw new Error(`CONFIGURED_SHEET_NOT_FOUND:${name}`);
  for (const name of ignored.keys()) if (!workbook.sheets.some(sheet => sheet.name === name)) throw new Error(`IGNORED_SHEET_NOT_FOUND:${name}`);
}

function text(row, column) {
  if (!column) return null;
  const value = row.cells[column]?.text;
  return value === undefined || value === null || String(value).trim() === '' ? null : String(value).trim();
}

function rowMatches(row, sheetConfig) {
  const sku = text(row, sheetConfig.columns.supplier_sku);
  const name = text(row, sheetConfig.columns.name);
  if (sheetConfig.row_predicate === 'sku_and_name') return /^\d+$/.test(sku ?? '') && Boolean(name) && name !== '#N/A';
  if (sheetConfig.row_predicate === 'name_only') return Boolean(name);
  throw new Error(`UNKNOWN_ROW_PREDICATE:${sheetConfig.row_predicate}`);
}

function isCarryForwardContext(value) {
  const textValue = String(value ?? '').trim();
  return /[A-Za-zА-Яа-яЁё]/u.test(textValue) && !/^(?:арт|артикул|код|штрих-?код|наименование|параметры|фото\*?)$/iu.test(textValue);
}

function rowDiagnostics(row) {
  const diagnostics = [];
  for (const cell of Object.values(row.cells)) {
    if (cell.formula !== null && !cell.formula_has_cached_value) diagnostics.push({code: 'FORMULA_RESULT_UNAVAILABLE', cell: cell.reference});
  }
  return diagnostics;
}

export function extractConfiguredRecords(workbook, sourceConfig, fileSha256) {
  validateSourceCoverage(workbook, sourceConfig);
  const records = [];
  for (const sheetConfig of sourceConfig.sheets) {
    const sheet = workbook.sheets.find(candidate => candidate.name === sheetConfig.name);
    const carriedContext = new Map();
    for (const row of sheet.rows) {
      if (row.number <= (sheetConfig.header_row ?? 0)) continue;
      const hasContent = Object.values(row.cells).some(cell => String(cell.text ?? '').trim() !== '');
      if (!hasContent) continue;
      const productRow = rowMatches(row, sheetConfig);
      if (!productRow) {
        for (const column of sheetConfig.carry_forward_context_columns ?? []) {
          const value = text(row, column);
          if (isCarryForwardContext(value) && value !== '#N/A') carriedContext.set(column, value);
        }
      }
      const name = text(row, sheetConfig.columns.name);
      const supplierSku = text(row, sheetConfig.columns.supplier_sku);
      const raw = {
        name,
        description: text(row, sheetConfig.columns.description),
        supplier_sku: supplierSku,
        gtin: text(row, sheetConfig.columns.gtin),
        unit: text(row, sheetConfig.columns.unit),
        category_context: [...new Set([
          ...(sheetConfig.context_columns ?? []).map(column => text(row, column)).filter(Boolean),
          ...(sheetConfig.carry_forward_context_columns ?? []).map(column => carriedContext.get(column)).filter(Boolean)
        ])]
      };
      const normalized = normalizeName(name ?? '');
      const sourceItemId = `${sourceConfig.source_id}:${sheet.name}:${row.number}`;
      const sourceFingerprint = `sha256:${sha256Canonical(raw)}`;
      const incompleteProduct = /^\d+$/.test(supplierSku ?? '') && !name;
      const rowStatus = productRow ? 'product_candidate' : incompleteProduct ? 'data_error' : 'non_product';
      const diagnostics = rowDiagnostics(row);
      if (incompleteProduct) diagnostics.push({code: 'PRODUCT_ROW_INCOMPLETE', field: 'name'});
      records.push({
        inventory_schema_version: '1.0.0',
        source_file: {
          source_id: sourceConfig.source_id,
          filename: path.basename(workbook.file_path),
          sha256: fileSha256.replace(/^sha256:/, '')
        },
        source_item_id: sourceItemId,
        source: {sheet: sheet.name, row: row.number, hidden: row.hidden},
        raw,
        normalized,
        row_status: rowStatus,
        taxonomy_status: productRow ? 'unsupported' : 'not_applicable',
        cluster_id: productRow ? `cluster:${sha256Canonical(normalized.name_skeleton).slice(0, 16)}` : null,
        proposed_class_ids: [],
        matched_rule_ids: [],
        duplicate_flags: [],
        diagnostics,
        source_fingerprint: sourceFingerprint
      });
    }
  }
  return records;
}
