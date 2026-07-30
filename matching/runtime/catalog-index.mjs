import { projectCatalog } from './projectors.mjs';
import { ordinalCompare } from './candidate-ordering.mjs';

export function buildCatalogIndex(catalogs) {
  const index = new Map();
  for (const { catalogRecordId, bundle } of catalogs) {
    for (const candidate of projectCatalog(catalogRecordId, bundle)) {
      const classCandidates = index.get(candidate.class_id) ?? [];
      classCandidates.push(candidate);
      index.set(candidate.class_id, classCandidates);
    }
  }
  const compare = (left, right) => ordinalCompare(left.catalog_id, right.catalog_id) || ordinalCompare(left.source_item_id, right.source_item_id);
  for (const [classId, candidates] of index) index.set(classId, [...candidates].sort(compare));
  return index;
}
