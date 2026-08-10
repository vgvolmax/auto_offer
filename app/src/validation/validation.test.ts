import {describe,expect,it} from 'vitest';import catalog from '../../../tests/fixtures/bundles/catalog.valid.json';import request from '../../../tests/fixtures/bundles/request.valid.json';import {validateCatalogBundle} from './validate-catalog-bundle';import {validateRequestBundle} from './validate-request-bundle';
describe('browser validation adapter — A7, H3',()=>{it('accepts production catalog and request fixtures',()=>{expect(validateCatalogBundle(catalog).valid).toBe(true);expect(validateRequestBundle(request).valid).toBe(true)});it('uses production error codes and does not mutate input',()=>{const bad=structuredClone(catalog);bad.taxonomy_version='0.0.0';const before=JSON.stringify(bad),result=validateCatalogBundle(bad);expect(result.errors.some(e=>e.code==='TAXONOMY_VERSION_MISMATCH')).toBe(true);expect(JSON.stringify(bad)).toBe(before)});it('rejects damaged bundles',()=>{expect(validateRequestBundle({kind:'request_bundle'}).errors.some(e=>e.code==='BUNDLE_SCHEMA_INVALID')).toBe(true)})})

describe('browser semantic validation parity',()=>{
  it('checks catalog identity, counts, taxonomy, class rules, evidence and pointers',()=>{
    const bad=structuredClone(catalog);
    bad.items.push(structuredClone(bad.items[0]));
    Reflect.set(bad.items[1].catalog_item,'taxonomy_version','mismatch');
    bad.items[0].catalog_item.annotation.evidence=[];
    Reflect.set(bad.items[0].catalog_item.annotation,'unknown_fields',['/not-allowed']);
    const result=validateCatalogBundle(bad),codes=new Set(result.errors.map(error=>error.code));
    for(const code of ['DUPLICATE_SOURCE_ITEM_ID','ITEM_COUNT_MISMATCH','TAXONOMY_VERSION_MISMATCH','MISSING_EVIDENCE','UNKNOWN_PATH_NOT_ALLOWED'])expect(codes).toContain(code);
    expect(result.errors.find(error=>error.code==='DUPLICATE_SOURCE_ITEM_ID')?.path).toBe('/items/1/catalog_item/source_item_id');
  });
  it('checks request identity, counts, source names and annotation semantics',()=>{
    const bad=structuredClone(request);
    bad.request_document.document.source_file='different.xlsx';
    bad.request_document.lines.push(structuredClone(bad.request_document.lines[0]));
    bad.request_document.lines[0].annotation.evidence=[];
    const result=validateRequestBundle(bad),codes=new Set(result.errors.map(error=>error.code));
    for(const code of ['DUPLICATE_LINE_ID','LINE_COUNT_MISMATCH','SOURCE_FILE_MISMATCH','MISSING_EVIDENCE'])expect(codes).toContain(code);
    expect(result.errors.find(error=>error.code==='DUPLICATE_LINE_ID')?.path).toBe('/request_document/lines/1/line_id');
  });
});

import mixedCatalog from '../../../tests/fixtures/bundles/catalog.mixed.json';
describe('mixed catalog browser parity',()=>{it('accepts unsupported alongside typed statuses',()=>{expect(validateCatalogBundle(mixedCatalog).valid).toBe(true);expect(mixedCatalog.catalog.item_count).toBe(mixedCatalog.items.length);expect('class_id' in mixedCatalog.items.at(-1)!.catalog_item).toBe(false)})});
