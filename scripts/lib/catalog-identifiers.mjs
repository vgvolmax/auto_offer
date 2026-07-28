const GTIN_LENGTHS = new Set([8, 12, 13, 14]);

export function classifyGtin(value) {
  if (typeof value !== 'string' || !/^\d+$/.test(value) || !GTIN_LENGTHS.has(value.length)) return 'invalid_format';
  const digits = [...value].map(Number);
  const checkDigit = digits.pop();
  const sum = digits.reverse().reduce((total, digit, index) => total + digit * (index % 2 === 0 ? 3 : 1), 0);
  return (10 - sum % 10) % 10 === checkDigit ? 'valid' : 'invalid_checksum';
}

const issueCode = status => status === 'invalid_checksum' ? 'INVALID_GTIN_CHECKSUM' : status === 'conflict' ? 'GTIN_PRODUCT_CONFLICT' : 'INVALID_GTIN_FORMAT';

export function importStructuredIdentifiers({ supplierSku = null, gtinCell = null, separator } = {}) {
  if (supplierSku !== null && typeof supplierSku !== 'string') throw new TypeError('supplier SKU must be imported as text');
  if (gtinCell === null || gtinCell === '') return { supplier_sku: supplierSku || null, gtins: [] };
  if (typeof gtinCell !== 'string') throw new TypeError('GTIN must be imported from the spreadsheet cell as text, without floating-point conversion');
  const gtins = separator ? gtinCell.split(separator).map(value => value.trim()).filter(Boolean) : [gtinCell.trim()];
  return { supplier_sku: supplierSku || null, gtins: [...new Set(gtins)] };
}

export function buildCatalogProduct({ rawItem, annotation, productId } = {}) {
  const imported = rawItem.structured_identifiers;
  const gtins = imported.gtins.map(value => {
    const status = classifyGtin(value);
    return { value, status, exactIndexEligible: status === 'valid', source: { kind: 'structured_import', source_item_id: rawItem.source_item_id, column: 'Штрихкод' } };
  });
  const supplier_skus = imported.supplier_sku ? [{ value: imported.supplier_sku, source: { kind: 'structured_import', source_item_id: rawItem.source_item_id, column: 'КОД' } }] : [];
  const data_quality_issues = gtins.filter(item => item.status !== 'valid').map(item => ({ code: issueCode(item.status), severity: 'warning', scope: 'identifier', identifier_type: 'gtin', value: item.value, effect: 'excluded_from_exact_index' }));
  const identity = { ...annotation.identity, gtins, supplier_skus };
  return {
    schema_version: '1.0.0', product_id: productId ?? stableProductId(annotation.identity.brand, imported.supplier_sku, rawItem.source_item_id),
    class_id: annotation.class_id, identity, identifiers: { gtins, supplier_skus }, attributes: annotation.attributes, ports: annotation.ports,
    status: 'active', technicalMatchingEligible: annotation.annotation.status === 'validated', data_quality_issues
  };
}

export function stableProductId(brand, supplierSku, sourceItemId) {
  return supplierSku ? `${brand ?? 'supplier'}:${supplierSku}` : `source:${sourceItemId}`;
}

export function createExactGtinIndex(products) {
  const candidates = new Map();
  for (const product of products) for (const identifier of product.identifiers.gtins) {
    if (!identifier.exactIndexEligible) continue;
    const entries = candidates.get(identifier.value) ?? [];
    entries.push({ product, identifier }); candidates.set(identifier.value, entries);
  }
  const productsByGtin = new Map();
  for (const [value, entries] of candidates) {
    const ids = new Set(entries.map(({ product }) => product.product_id));
    if (ids.size === 1) productsByGtin.set(value, entries[0].product);
    else for (const { product, identifier } of entries) {
      identifier.status = 'conflict'; identifier.exactIndexEligible = false;
      product.data_quality_issues.push({ code: 'GTIN_PRODUCT_CONFLICT', severity: 'warning', scope: 'identifier', identifier_type: 'gtin', value, effect: 'excluded_from_exact_index' });
    }
  }
  return productsByGtin;
}
