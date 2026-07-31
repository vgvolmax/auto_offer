export interface OfferRef {
  catalog_record_id: string;
  catalog_id: string;
  source_sha256: string;
  source_item_id: string;
}

export function equalOfferRefs(left: OfferRef, right: OfferRef): boolean {
  return offerRefKey(left) === offerRefKey(right);
}

export function offerRefKey(ref: OfferRef): string {
  return JSON.stringify([
    ref.catalog_record_id,
    ref.catalog_id,
    ref.source_sha256,
    ref.source_item_id,
  ]);
}
