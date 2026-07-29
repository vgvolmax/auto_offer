import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { loadPrivateGzipJson } from './lib/private-payload-loader.mjs';
import { buildReviewPack, canonical, readInventory, renderReviewPack, sha256 } from './lib/review-pack-builder.mjs';
const json = async p => JSON.parse(await readFile(p,'utf8'));
try {
 const inventoryPath=process.env.TAXONOMY_INVENTORY_PATH??'data/generated/catalog-source-inventory.jsonl';
 const paths={taxonomy:process.env.TAXONOMY_INDEX_PATH??'taxonomy/taxonomy.proposed.json',classMap:process.env.TAXONOMY_CLASS_MAP_INDEX_PATH??'taxonomy/class-map.proposed.json',unresolved:process.env.TAXONOMY_UNRESOLVED_INDEX_PATH??'taxonomy/unresolved-cases.json'};
 const [taxonomyIndex,classMapIndex,unresolvedIndex,manifest,sourceConfig]=await Promise.all([json(paths.taxonomy),json(paths.classMap),json(paths.unresolved),json(process.env.TAXONOMY_INVENTORY_MANIFEST_PATH??'reports/catalog-source-inventory-manifest.json'),json(process.env.TAXONOMY_SOURCE_CONFIG_PATH??'config/catalog-sources.json')]);
 const {text:inventoryText,records}=await readInventory(inventoryPath); const actual=sha256(inventoryText);
 if(actual!==manifest.inventory_sha256) throw new Error(`PRIVATE_INVENTORY_SHA256_MISMATCH: local file path=${inventoryPath}; expected hash=${manifest.inventory_sha256}; actual hash=${actual}`);
 if(manifest.proposal_input_sha256!==taxonomyIndex.source_inventory_sha256) throw new Error(`PRIVATE_INVENTORY_SHA256_MISMATCH: proposal input expected hash=${taxonomyIndex.source_inventory_sha256}; actual hash=${manifest.proposal_input_sha256}`);
 const [taxonomy,classMap,unresolved]=await Promise.all([
  loadPrivateGzipJson({compactIndex:taxonomyIndex,compactIndexName:paths.taxonomy,filePath:process.env.TAXONOMY_FULL_PROPOSAL_PATH??'taxonomy/generated/taxonomy.proposed.full.json.gz',expectedArtifactKind:'taxonomy_proposal_full'}),
  loadPrivateGzipJson({compactIndex:classMapIndex,compactIndexName:paths.classMap,filePath:process.env.TAXONOMY_FULL_CLASS_MAP_PATH??'taxonomy/generated/class-map.proposed.full.json.gz',expectedArtifactKind:'class_map_full'}),
  loadPrivateGzipJson({compactIndex:unresolvedIndex,compactIndexName:paths.unresolved,filePath:process.env.TAXONOMY_FULL_UNRESOLVED_PATH??'taxonomy/generated/unresolved-cases.full.json.gz',expectedArtifactKind:'unresolved_cases_full'})]);
 const pack=buildReviewPack({inventoryText,records,taxonomyIndex,taxonomyFull:taxonomy.data,classMapIndex,classMapFull:classMap.data,unresolvedIndex,unresolvedFull:unresolved.data,sourceConfig});
 const jsonPath=process.env.TAXONOMY_REVIEW_PACK_JSON_PATH??'reports/local/taxonomy-review-pack.json', mdPath=process.env.TAXONOMY_REVIEW_PACK_MD_PATH??'reports/local/taxonomy-review-pack.md';
 await Promise.all([mkdir(dirname(jsonPath),{recursive:true}),mkdir(dirname(mdPath),{recursive:true})]); await Promise.all([writeFile(jsonPath,canonical(pack)),writeFile(mdPath,renderReviewPack(pack))]);
 console.log(`Built private review pack with ${pack.classes.length} classes and ${pack.unresolved_cases.length} unresolved cases.`);
} catch(error) { console.error(error.message); process.exitCode=1; }
