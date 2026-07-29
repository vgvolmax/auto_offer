import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { buildReviewPack, canonical, readInventory, renderReviewPack } from './lib/review-pack-builder.mjs';
const json = async p => JSON.parse(await readFile(p, 'utf8'));
try {
  const {text,records}=await readInventory(process.env.TAXONOMY_INVENTORY_PATH ?? 'data/generated/catalog-source-inventory.jsonl');
  const pack=buildReviewPack({inventoryText:text,records,taxonomy:await json('taxonomy/taxonomy.proposed.json'),classMap:await json('taxonomy/class-map.proposed.json'),unresolvedIndex:await json('taxonomy/unresolved-cases.json'),rules:await json('taxonomy/classification-rules.proposed.json'),sourceConfig:await json('config/catalog-sources.json')});
  await mkdir('reports/local',{recursive:true}); await writeFile('reports/local/taxonomy-review-pack.json',canonical(pack)); await writeFile('reports/local/taxonomy-review-pack.md',renderReviewPack(pack));
  console.log(`Built private review pack with ${pack.classes.length} classes and ${pack.unresolved_cases.length} unresolved cases.`);
} catch(error) { console.error(error.message); process.exitCode=1; }
