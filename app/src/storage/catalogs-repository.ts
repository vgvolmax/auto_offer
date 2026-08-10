import { normalizeCatalogRecord, type CatalogRecord } from '../domain/catalog';
import { getDatabase } from './database';

export const catalogsRepository = {
  async all() {
    return (await getDatabase()).getAll('catalogs').then(records=>records.map(normalizeCatalogRecord));
  },

  async get(id: string) {
    return (await getDatabase()).get('catalogs', id).then(record=>record&&normalizeCatalogRecord(record));
  },

  async findByCatalogId(id: string) {
    return (await getDatabase()).getFromIndex('catalogs', 'catalogId', id).then(record=>record&&normalizeCatalogRecord(record));
  },

  async save(record: CatalogRecord) {
    await (await getDatabase()).put('catalogs', {
      ...record,
      enabled: Boolean(record.enabled),
    });
    return record;
  },

  async replace(oldId: string, next: CatalogRecord) {
    const database = await getDatabase();
    const transaction = database.transaction('catalogs', 'readwrite');

    await transaction.store.delete(oldId);
    await transaction.store.put(next);
    await transaction.done;

    return next;
  },

  async updateReviewedCatalog(input:{recordId:string;expectedSemanticRevision:number;next:CatalogRecord}) {
    const database=await getDatabase(),transaction=database.transaction('catalogs','readwrite');
    const current=await transaction.store.get(input.recordId);
    if(!current||normalizeCatalogRecord(current).semanticRevision!==input.expectedSemanticRevision){transaction.abort();await transaction.done.catch(()=>undefined);throw new CatalogRevisionChangedError()}
    await transaction.store.put(input.next);await transaction.done;return input.next;
  },

  async setEnabled(id: string, enabled: boolean) {
    const record = await this.get(id);
    if (!record) {
      throw new Error('Каталог не найден');
    }

    return this.save({
      ...record,
      enabled,
      updatedAt: new Date().toISOString(),
    });
  },

  async remove(id: string) {
    const record = await this.get(id);
    if (record) {
      await (await getDatabase()).delete('catalogs', id);
    }
    return record;
  },
};
export class CatalogRevisionChangedError extends Error {readonly code='CATALOG_REVISION_CHANGED';constructor(){super('Каталог был изменён в другой вкладке');this.name='CatalogRevisionChangedError'}}
