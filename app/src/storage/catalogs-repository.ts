import type { CatalogRecord } from '../domain/catalog';
import { getDatabase } from './database';

export const catalogsRepository = {
  async all() {
    return (await getDatabase()).getAll('catalogs');
  },

  async get(id: string) {
    return (await getDatabase()).get('catalogs', id);
  },

  async findByCatalogId(id: string) {
    return (await getDatabase()).getFromIndex('catalogs', 'catalogId', id);
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
