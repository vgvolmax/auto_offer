import type { CatalogRecord, CatalogItem } from "../catalog";
import type { CandidateAvailability } from "./match-result-review";
import type { OfferRef } from "./offer-ref";

export interface SemanticOfferRef {
  catalog_record_id: string;
  source_item_id: string;
}

export function resolveSemanticOffer(
  ref: SemanticOfferRef,
  catalogs: readonly CatalogRecord[],
) {
  const catalog = catalogs.find((value) => value.recordId === ref.catalog_record_id);
  if (!catalog) return undefined;
  const entry = catalog.bundle.items.find(
    (value) => value.catalog_item?.source_item_id === ref.source_item_id,
  );
  const catalogItem = entry?.catalog_item;
  if (!entry || !catalogItem) return undefined;
  let availability: CandidateAvailability;
  if (catalogItem.annotation?.status === "validated") availability = "eligible";
  else if (catalogItem.annotation?.status === "needs_review") availability = "manual_only";
  else return undefined;
  const offerRef: OfferRef = {
    catalog_record_id: catalog.recordId,
    catalog_id: catalog.catalogId,
    source_sha256: catalog.sourceSha256,
    source_item_id: ref.source_item_id,
  };
  return { offerRef, catalog, entry, catalogItem: catalogItem as CatalogItem, availability };
}
