export function projectRequestLine(line) {
  return { line_id: line.line_id, raw_text: line.raw_text, class_id: line.class_id,
    requested_identity: line.requested_identity ?? {}, constraints: line.constraints ?? { attributes: {}, ports: [] },
    ports: line.constraints?.ports ?? [], substitution_statement: line.substitution_statement,
    quantity: line.quantity, annotation_status: line.annotation?.status, annotation_reason_code: line.annotation?.reason_code };
}
export function projectCatalog(catalogRecordId, bundle) {
  return bundle.items.filter((offer) => ['validated', 'needs_review'].includes(offer.catalog_item?.annotation?.status)).map((offer) => { const item = offer.catalog_item; return {
    catalog_record_id: catalogRecordId, catalog_id: bundle.catalog.catalog_id,
    source_sha256: bundle.catalog.source_sha256, source_item_id: item.source_item_id,
    class_id: item.class_id, identity: item.identity ?? {}, attributes: item.attributes ?? {}, ports: item.ports ?? [],
    annotation_status: item.annotation?.status, offer } });
}
