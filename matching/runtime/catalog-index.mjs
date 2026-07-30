import { projectCatalog } from './projectors.mjs';
import { ordinalCompare } from './candidate-ordering.mjs';
export function buildCatalogIndex(catalogs) { const index=new Map(); for (const {catalogRecordId,bundle} of catalogs) for (const c of projectCatalog(catalogRecordId,bundle)) { const xs=index.get(c.class_id)??[]; xs.push(c); index.set(c.class_id,xs); } for (const [k,xs] of index) index.set(k,[...xs].sort((a,b)=>ordinalCompare(a.catalog_id,b.catalog_id)||ordinalCompare(a.source_item_id,b.source_item_id))); return index; }
