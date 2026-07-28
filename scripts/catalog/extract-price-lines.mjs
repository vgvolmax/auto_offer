import { loadCatalogSources, loadJson, sha256File } from './lib/source-config.mjs';
import { readWorkbook } from './lib/workbook-reader.mjs';
import { extractConfiguredRecords } from './lib/inventory-report.mjs';
import { classifyRecord, detectDuplicateDiagnostics } from './lib/classification-rules.mjs';
import { writeCanonicalJsonl } from './lib/output.mjs';

const config = await loadCatalogSources();
const proposal = await loadJson('taxonomy/classification-rules.proposed.json');
const records = [];
for (const source of config.sources) {
  const workbook = await readWorkbook(source.file_path);
  const sha256 = await sha256File(source.file_path);
  for (const record of extractConfiguredRecords(workbook, source, sha256)) {
    if (record.row_status === 'product_candidate') Object.assign(record, classifyRecord(record, proposal.rules));
    records.push(record);
  }
}
detectDuplicateDiagnostics(records);
records.sort((a, b) => {
  const sourceOrder = config.sources.findIndex(source => source.source_id === a.source_file.source_id) - config.sources.findIndex(source => source.source_id === b.source_file.source_id);
  return sourceOrder || a.source.sheet.localeCompare(b.source.sheet, 'ru') || a.source.row - b.source.row;
});
await writeCanonicalJsonl('data/generated/catalog-source-inventory.jsonl', records);
console.log(`Extracted ${records.length} inventory records.`);
