import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { CatalogRecord } from '../domain/catalog'; import type { SessionRecord } from '../domain/session';
interface AutoOfferDB extends DBSchema {catalogs:{key:string;value:CatalogRecord;indexes:{catalogId:string;enabled:number;addedAt:string;sourceSha256:string}};sessions:{key:string;value:SessionRecord;indexes:{status:string;updatedAt:string;requestId:string}};settings:{key:string;value:{key:string;value:unknown}}}
let dbPromise:Promise<IDBPDatabase<AutoOfferDB>>|undefined;
export const getDatabase=()=>dbPromise??=openDB<AutoOfferDB>('auto-offer',1,{upgrade(db){const c=db.createObjectStore('catalogs',{keyPath:'recordId'});c.createIndex('catalogId','catalogId');c.createIndex('enabled','enabled');c.createIndex('addedAt','addedAt');c.createIndex('sourceSha256','sourceSha256');const s=db.createObjectStore('sessions',{keyPath:'sessionId'});s.createIndex('status','status');s.createIndex('updatedAt','updatedAt');s.createIndex('requestId','requestId');db.createObjectStore('settings',{keyPath:'key'});}});
export function resetDatabaseConnection(){dbPromise=undefined}
