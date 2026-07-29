import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';

export const PRIVATE_INVENTORY_ERROR = 'PRIVATE_INVENTORY_NOT_FOUND:\nrun npm run catalog:inventory with the configured source workbooks first';
const stable = value => JSON.stringify(value, Object.keys(value ?? {}).sort());
export const canonical = value => JSON.stringify(sortDeep(value), null, 2) + '\n';
function sortDeep(value) { if (Array.isArray(value)) return value.map(sortDeep); if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map(k => [k, sortDeep(value[k])])); return value; }
export const sha256 = value => createHash('sha256').update(value).digest('hex');
const uniq = xs => [...new Set((xs ?? []).filter(x => x != null))].sort();

export async function readInventory(path) {
  let text;
  try { text = await readFile(path, 'utf8'); } catch (error) { if (error.code === 'ENOENT') throw new Error(PRIVATE_INVENTORY_ERROR); throw error; }
  return { text, records: text.trim() ? text.trimEnd().split('\n').map(line => JSON.parse(line)) : [] };
}
function example(r) {
  return {
    source_item_id: String(r.source_item_id),
    source_id: String(r.source_id ?? r.source_file?.source_id ?? ''),
    sheet: String(r.sheet ?? r.source?.sheet ?? r.source_location?.sheet ?? ''),
    row: Number(r.row ?? r.source?.row ?? r.source_location?.row ?? 0),
    raw_name: String(r.raw_name ?? r.raw?.name ?? ''),
    normalized_name: String(r.normalized_name ?? r.normalized?.name ?? ''),
    category_context: uniq(r.category_context ?? r.raw?.category_context ?? []),
    cluster_id: String(r.cluster_id ?? ''),
    proposed_class_ids: uniq(r.proposed_class_ids),
    matched_rule_ids: uniq(r.matched_rule_ids),
    diagnostic_codes: uniq(r.diagnostic_codes ?? r.duplicate_flags ?? [])
  };
}
function ordering(config) {
  const sources = new Map((config.sources ?? []).map((x, i) => [x.source_id, i]));
  const sheets = new Map();
  for (const source of config.sources ?? []) for (const [i, sheet] of (source.sheets ?? []).entries()) sheets.set(`${source.source_id}\0${sheet.name ?? sheet.sheet}`, i);
  return (a, b) => (sources.get(a.source_id) ?? 1e9) - (sources.get(b.source_id) ?? 1e9) || (sheets.get(`${a.source_id}\0${a.sheet}`) ?? 1e9) - (sheets.get(`${b.source_id}\0${b.sheet}`) ?? 1e9) || a.row - b.row || a.source_item_id.localeCompare(b.source_item_id);
}
export function buildReviewPack({inventoryText, records, taxonomy, classMap, unresolvedIndex, rules, sourceConfig = {sources: []}}) {
  const proposalSha = sha256(canonical(taxonomy));
  const all = records.map(example).sort(ordering(sourceConfig));
  const definitions = rules.classes ?? {};
  const counts = taxonomy.proposed_class_counts ?? {};
  const classes = Object.entries(definitions).sort(([a],[b]) => a.localeCompare(b)).map(([classId, def]) => {
    const related = all.filter(x => x.proposed_class_ids.includes(classId));
    const used = new Set();
    const take = (items, limit) => items.filter(x => !used.has(x.source_item_id)).filter(x => (used.add(x.source_item_id), true)).slice(0, limit);
    const clusterSizes = new Map(); for (const x of related) clusterSizes.set(x.cluster_id, (clusterSizes.get(x.cluster_id) ?? 0) + 1);
    const representativePool = [...related].sort((a,b) => (clusterSizes.get(b.cluster_id)-clusterSizes.get(a.cluster_id)) || ordering(sourceConfig)(a,b));
    const representatives = []; const seenClusters = new Set();
    for (const x of representativePool) if (!seenClusters.has(x.cluster_id)) { seenClusters.add(x.cluster_id); representatives.push(x); }
    const boundary = related.filter(x => x.proposed_class_ids.length > 1 || x.matched_rule_ids.length > 1);
    const ambiguous = related.filter(x => x.diagnostic_codes.length || x.proposed_class_ids.length !== 1);
    return {class_id:classId,name_ru:def.name_ru,family_id:def.family_id,source_row_count:related.length || counts[classId] || 0,candidate_attributes:uniq(def.candidate_attributes),candidate_ports:uniq(def.candidate_ports),overlaps_with:uniq(related.flatMap(x=>x.proposed_class_ids).filter(x=>x!==classId)),matched_rule_ids:uniq(related.flatMap(x=>x.matched_rule_ids)),source_distribution:Object.fromEntries(uniq(related.map(x=>x.source_id)).map(id=>[id,related.filter(x=>x.source_id===id).length])),representative_examples:take(representatives,10),boundary_examples:take(boundary,10),ambiguous_examples:take(ambiguous,10),identifier_conflict_count:related.filter(x=>x.diagnostic_codes.some(c=>/CONFLICT/.test(c))).length,open_question_ids:uniq(related.flatMap(x=>x.unresolved_case_ids ?? []))};
  });
  let cases = unresolvedIndex.cases ?? [];
  if (!cases.length) {
    const groups = new Map();
    for (const r of records.filter(x => ['ambiguous','unsupported'].includes(x.taxonomy_status))) { const a=groups.get(r.cluster_id)??[]; a.push(r); groups.set(r.cluster_id,a); }
    cases = [...groups].map(([cluster_id, rows]) => ({case_id:`case:${sha256(stable({type:rows[0].taxonomy_status,cluster_id})).slice(0,16)}`,type:rows[0].taxonomy_status,question_ru:`Как обработать кластер ${cluster_id}?`,candidate_options:uniq(rows.flatMap(x=>x.proposed_class_ids)),examples:rows}));
    for (const [code, field] of [['SUPPLIER_SKU_CONFLICT','supplier_sku'], ['GTIN_CONFLICT','gtin']]) {
      const conflicts = new Map();
      for (const row of records.filter(x => (x.duplicate_flags ?? []).includes(code))) {
        for (const value of [row.raw?.[field]].flat().filter(Boolean)) {
          const bucket = conflicts.get(String(value)) ?? [];
          bucket.push(row); conflicts.set(String(value), bucket);
        }
      }
      for (const [value, rows] of [...conflicts].sort(([a],[b]) => a.localeCompare(b))) {
        if (uniq(rows.map(x => x.normalized?.name ?? x.normalized_name)).length < 2) continue;
        cases.push({case_id:`case:${sha256(stable({type:'identifier_conflict',code,field,value})).slice(0,16)}`,type:'identifier_conflict',question_ru:`Как обработать конфликт ${field}?`,candidate_options:['keep_separate_and_disable_exact_identifier','confirm_same_product','correct_source_data'],examples:rows});
      }
    }
  }
  const unresolved_cases = cases.sort((a,b)=>a.case_id.localeCompare(b.case_id)).map(c=>({case_id:c.case_id,type:c.type,question_ru:c.question_ru,candidate_options:c.candidate_options ?? [],recommended_option:null,rationale:null,examples:(c.examples ?? records.filter(r=>(c.cluster_ids??[]).includes(r.cluster_id))).map(example).sort(ordering(sourceConfig)).slice(0,10)}));
  return {review_pack_schema_version:'1.0.0',status:'draft',source_inventory_sha256:taxonomy.source_inventory_sha256,proposal_version:taxonomy.proposal_version,proposal_sha256:proposalSha,classes,unresolved_cases,summary:{class_count:classes.length,unresolved_case_count:unresolved_cases.length,example_count:classes.reduce((n,c)=>n+c.representative_examples.length+c.boundary_examples.length+c.ambiguous_examples.length,0)}};
}
export function renderReviewPack(pack) {
  return ['# Private taxonomy review pack','','**DRAFT — NOT APPROVED FOR MASS ANNOTATION**','',`- Proposal: ${pack.proposal_version} (${pack.proposal_sha256})`,`- Source inventory: ${pack.source_inventory_sha256}`,`- Classes: ${pack.classes.length}`,`- Unresolved cases: ${pack.unresolved_cases.length}`,'',...pack.classes.flatMap(c=>[`## ${c.class_id} — ${c.name_ru}`,'',`Rows: ${c.source_row_count}; examples: ${c.representative_examples.length+c.boundary_examples.length+c.ambiguous_examples.length}`,''])].join('\n')+'\n';
}
