import { loadCatalogSources, sha256File } from './lib/source-config.mjs';
import { readWorkbook } from './lib/workbook-reader.mjs';
import { validateSourceCoverage } from './lib/inventory-report.mjs';
import { writeCanonicalGzip, writeCanonicalJson, writeText } from './lib/output.mjs';

function headerRows(sheet) {
  const headerWords = new Set(['арт', 'код', 'наименование', 'наименование товара', 'штрих-код', 'штрихкод']);
  return sheet.rows
    .map(row => ({
      row: row.number,
      values: Object.fromEntries(Object.entries(row.cells)
        .filter(([, cell]) => headerWords.has(cell.text.trim().toLowerCase()))
        .map(([column, cell]) => [column, cell.text]))
    }))
    .filter(row => Object.keys(row.values).length >= 2)
    .slice(0, 30);
}

function configuredSheet(sheet, source) {
  return source.sheets.find(candidate => candidate.name === sheet.name) ?? null;
}

function configuredHeader(sheet, source) {
  const config = configuredSheet(sheet, source);
  if (!config?.header_row) return null;
  const row = sheet.rows.find(candidate => candidate.number === config.header_row);
  if (!row) return {row: config.header_row, values: {}};
  return {
    row: config.header_row,
    values: Object.fromEntries(Object.entries(row.cells).map(([column, cell]) => [column, cell.text]))
  };
}

const config = await loadCatalogSources();
const sources = [];
for (const source of config.sources) {
  const sha256 = await sha256File(source.file_path);
  const workbook = await readWorkbook(source.file_path);
  validateSourceCoverage(workbook, source);
  const ignored = new Map((source.ignored_sheets ?? []).map(item => [item.name, item.reason]));
  sources.push({
    source_id: source.source_id,
    filename: source.filename,
    sha256,
    price_pool: source.price_pool,
    sheets: workbook.sheets.map(sheet => ({
      name: sheet.name,
      state: sheet.state,
      dimension: sheet.dimension,
      nonempty_row_count: sheet.nonempty_row_count,
      hidden_row_count: sheet.hidden_row_count,
      merged_range_count: sheet.merged_ranges?.length ?? sheet.merged_ranges,
      merged_ranges: sheet.merged_ranges,
      formula_count: sheet.formula_count,
      formula_without_cached_value_count: sheet.formula_without_cached_value_count,
      disposition: configuredSheet(sheet, source) ? 'configured' : 'ignored',
      ignored_reason: ignored.get(sheet.name) ?? null,
      configured_header: configuredHeader(sheet, source),
      configured_columns: configuredSheet(sheet, source)?.columns ?? null,
      row_predicate: configuredSheet(sheet, source)?.row_predicate ?? null,
      context_columns: configuredSheet(sheet, source)?.context_columns ?? [],
      carry_forward_context_columns: configuredSheet(sheet, source)?.carry_forward_context_columns ?? [],
      candidate_header_rows: headerRows(sheet),
      warnings: configuredSheet(sheet, source) && !configuredHeader(sheet, source)
        ? [{code: 'CONFIGURED_HEADER_ROW_NOT_FOUND'}]
        : []
    }))
  });
}
const report = {inspection_schema_version: '1.0.0', sources};
const inspectionPayload = 'reports/generated/catalog-source-inspection.full.json.gz';
const inspectionHashes = await writeCanonicalGzip(inspectionPayload, report);
await writeCanonicalJson('reports/catalog-source-inspection.json', {
  inspection_schema_version: '1.0.0',
  source_count: sources.length,
  configured_sheet_count: sources.flatMap(source => source.sheets).filter(sheet => sheet.disposition === 'configured').length,
  ignored_sheet_count: sources.flatMap(source => source.sheets).filter(sheet => sheet.disposition === 'ignored').length,
  source_file_hashes: Object.fromEntries(sources.map(source => [source.source_id, source.sha256])),
  payload_file: inspectionPayload,
  payload_sha256: inspectionHashes.compressed_sha256,
  payload_uncompressed_sha256: inspectionHashes.uncompressed_sha256
});
const lines = ['# Catalog source inspection', '', 'NOT APPROVED FOR MASS ANNOTATION', ''];
for (const source of sources) {
  lines.push(`## ${source.source_id}`, '', `- File: \`${source.filename}\``, `- SHA-256: \`${source.sha256}\``, `- Price pool: \`${source.price_pool}\``, '');
  lines.push('| Sheet | State | Rows | Formulas | Missing cached formulas | Disposition |', '|---|---:|---:|---:|---:|---|');
  for (const sheet of source.sheets) lines.push(`| ${sheet.name.replaceAll('|', '\\|')} | ${sheet.state} | ${sheet.nonempty_row_count} | ${sheet.formula_count} | ${sheet.formula_without_cached_value_count} | ${sheet.disposition}${sheet.ignored_reason ? ` — ${sheet.ignored_reason}` : ''} |`);
  lines.push('');
  for (const sheet of source.sheets.filter(item => item.disposition === 'configured')) {
    lines.push(`### ${sheet.name}`, '', `- Header row: ${sheet.configured_header?.row ?? 'missing'}`, `- Columns: \`${JSON.stringify(sheet.configured_columns)}\``, `- Row predicate: \`${sheet.row_predicate}\``, `- Context columns: ${sheet.context_columns.join(', ') || 'none'}`, `- Carry-forward context columns: ${sheet.carry_forward_context_columns.join(', ') || 'none'}`, '');
  }
}
await writeText('reports/catalog-source-inspection.md', lines.join('\n'));
console.log(`Inspected ${sources.length} workbooks.`);
