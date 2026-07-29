function entries(value) {
  return Array.isArray(value)
    ? value.map(item => [item.source_id ?? item.class_id ?? item.code, item.count ?? item.source_row_count])
    : Object.entries(value ?? {});
}

function sortedEntries(value) {
  return entries(value).sort(([a], [b]) => String(a).localeCompare(String(b), 'en'));
}

export function renderCatalogInventoryReport(input) {
  const row = input.rowStatusCounts ?? {};
  const taxonomy = input.taxonomyStatusCounts ?? {};
  const sources = sortedEntries(input.sourceCounts);
  const classes = sortedEntries(input.classCounts);
  const diagnostics = sortedEntries(input.duplicateCounts);
  const lines = [
    '# Catalog source inventory', '',
    '**NOT APPROVED FOR MASS ANNOTATION**', '',
    `- Inventory file SHA-256: \`${input.inventoryFileSha256}\``,
    `- Proposal input SHA-256: \`${input.proposalInputSha256}\``,
    `- Physical non-empty rows across all sheets: ${input.physicalNonemptyRows}`,
    `- Non-empty rows on configured sheets: ${input.configuredNonemptyRows}`,
    `- Configured sheets: ${input.configuredSheetCount}`,
    `- Explicitly ignored sheets: ${input.ignoredSheetCount}`,
    `- Inventory records after configured headers: ${input.totalInventoryRecords}`,
    `- Product candidates: ${row.product_candidate ?? 0}`,
    `- Non-product rows: ${row.non_product ?? 0}`,
    `- Data errors: ${row.data_error ?? 0}`,
    `- Proposed mapped: ${taxonomy.proposed_mapped ?? 0}`,
    `- Ambiguous: ${taxonomy.ambiguous ?? 0}`,
    `- Unsupported: ${taxonomy.unsupported ?? 0}`, '',
    '## Sources', '', '| Source | Records | SHA-256 |', '|---|---:|---|',
    ...sources.map(([id, count]) => `| ${id} | ${count} | \`${input.sourceFileHashes?.[id] ?? ''}\` |`), '',
    `## Proposed classes (${classes.length})`, '', '| Class | Rows |', '|---|---:|',
    ...classes.map(([id, count]) => `| ${id} | ${count} |`), '',
    '## Duplicate and conflict diagnostics', '',
    ...(diagnostics.length ? diagnostics.map(([code, count]) => `- ${code}: ${count}`) : ['- None']), '',
    `## Unresolved cases (${input.unresolvedCaseCount})`, '',
    'Full examples and unresolved cases are available only in the private local review-pack.'
  ];
  return `${lines.join('\n')}\n`;
}

function list(values) {
  return [...(values ?? [])].sort((a, b) => String(a).localeCompare(String(b), 'en')).join(', ') || 'none proposed';
}

export function renderTaxonomyApprovalChecklist({classes}) {
  const values = Array.isArray(classes) ? classes : Object.values(classes ?? {});
  const lines = [
    '# Taxonomy approval checklist', '', '**NOT APPROVED FOR MASS ANNOTATION**', '',
    'Manual owner decision is required for every class.',
    'No option is preselected.',
    'Detailed evidence is available only in the private local review-pack.', ''
  ];
  for (const item of [...values].sort((a, b) => a.class_id.localeCompare(b.class_id, 'en'))) {
    lines.push(
      `## ${item.class_id} — ${item.name_ru}`, '',
      `- Family: \`${item.family_id}\``,
      `- Candidate rows: ${item.source_row_count}`,
      `- Candidate attributes: ${list(item.candidate_attributes)}`,
      `- Candidate ports: ${list(item.candidate_ports)}`,
      `- Overlaps: ${list(item.overlaps_with)}`,
      `- Open questions: ${(item.open_question_ids ?? []).length}`, '',
      '- [ ] approve', '- [ ] revise', '- [ ] reject', '- [ ] split', '- [ ] merge with another class', ''
    );
  }
  if (lines.at(-1) === '') lines.pop();
  return `${lines.join('\n')}\n`;
}
