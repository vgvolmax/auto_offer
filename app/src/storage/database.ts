import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import type { CatalogRecord } from "../domain/catalog";
import type { MatchRunRecord } from "../domain/matching/match-run";
import type { StoredSessionRecord } from "../domain/session";
import type { SelectionStateRecord } from "../domain/matching/selection-state";

export interface AutoOfferDB extends DBSchema {
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
    value: StoredSessionRecord;
    indexes: { status: string; updatedAt: string; requestId: string };
  };
  settings: { key: string; value: { key: string; value: unknown } };
  matchRuns: {
    key: string;
    value: MatchRunRecord;
    indexes: { "by-session": string };
  };
  selectionStates: { key: string; value: SelectionStateRecord; indexes: { "by-session": string } };
}
let dbPromise: Promise<IDBPDatabase<AutoOfferDB>> | undefined;
let dbInstance: IDBPDatabase<AutoOfferDB> | undefined;
export const getDatabase = () => {
  if (!dbPromise)
    dbPromise = openDB<AutoOfferDB>("auto-offer", 3, {
      upgrade(db, oldVersion) {
        if (oldVersion < 1) {
          const catalogs = db.createObjectStore("catalogs", {
            keyPath: "recordId",
          });
          catalogs.createIndex("catalogId", "catalogId");
          catalogs.createIndex("enabled", "enabled");
          catalogs.createIndex("addedAt", "addedAt");
          catalogs.createIndex("sourceSha256", "sourceSha256");
          const sessions = db.createObjectStore("sessions", {
            keyPath: "sessionId",
          });
          sessions.createIndex("status", "status");
          sessions.createIndex("updatedAt", "updatedAt");
          sessions.createIndex("requestId", "requestId");
          db.createObjectStore("settings", { keyPath: "key" });
        }
        if (oldVersion < 2) {
          const runs = db.createObjectStore("matchRuns", { keyPath: "id" });
          runs.createIndex("by-session", "sessionId");
        }
        if (oldVersion < 3) {
          const selections = db.createObjectStore("selectionStates", { keyPath: "matchRunId" });
          selections.createIndex("by-session", "sessionId");
        }
      },
    }).then((database) => {
      dbInstance = database;
      return database;
    });
  return dbPromise;
};
export function resetDatabaseConnection() {
  dbInstance?.close();
  dbInstance = undefined;
  dbPromise = undefined;
}
