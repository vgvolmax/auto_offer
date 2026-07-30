import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { CatalogRecord } from '../domain/catalog';
import type { SessionRecord } from '../domain/session';

interface AutoOfferDB extends DBSchema {
  catalogs: {
    key: string;
    value: CatalogRecord;
    indexes: {
      catalogId: string;
      enabled: number;
      addedAt: string;
      sourceSha256: string;
    };
  };
  sessions: {
    key: string;
    value: SessionRecord;
    indexes: {
      status: string;
      updatedAt: string;
      requestId: string;
    };
  };
  settings: {
    key: string;
    value: { key: string; value: unknown };
  };
}

let dbPromise: Promise<IDBPDatabase<AutoOfferDB>> | undefined;
let dbInstance: IDBPDatabase<AutoOfferDB> | undefined;

export const getDatabase = () => {
  if (!dbPromise) {
    dbPromise = openDB<AutoOfferDB>('auto-offer', 1, {
      upgrade(db) {
        const catalogs = db.createObjectStore('catalogs', { keyPath: 'recordId' });
        catalogs.createIndex('catalogId', 'catalogId');
        catalogs.createIndex('enabled', 'enabled');
        catalogs.createIndex('addedAt', 'addedAt');
        catalogs.createIndex('sourceSha256', 'sourceSha256');

        const sessions = db.createObjectStore('sessions', { keyPath: 'sessionId' });
        sessions.createIndex('status', 'status');
        sessions.createIndex('updatedAt', 'updatedAt');
        sessions.createIndex('requestId', 'requestId');

        db.createObjectStore('settings', { keyPath: 'key' });
      },
    }).then((database) => {
      dbInstance = database;
      return database;
    });
  }

  return dbPromise;
};

export function resetDatabaseConnection() {
  dbInstance?.close();
  dbInstance = undefined;
  dbPromise = undefined;
}
