import catalogTemplate from "../../../../tests/fixtures/bundles/catalog.valid.json";
import requestTemplate from "../../../../tests/fixtures/bundles/request.valid.json";
import type { CatalogBundle } from "../../domain/catalog";
import type { OfferRef } from "../../domain/matching/offer-ref";
import type { RequestBundle } from "../../domain/session";

export interface PilotWorkflowFixture {
  primaryCatalogBundle: CatalogBundle;
  secondaryCatalogBundle: CatalogBundle;
  requestBundle: RequestBundle;
  expected: {
    primaryCatalogId: string;
    secondaryCatalogId: string;
    selectedLineId: string;
    selectedOfferRef: OfferRef;
    rankedLineId: string;
    rankedCorrectOfferRef: OfferRef;
    noOfferLineId: string;
  };
}

const clone = <T,>(value: T): T => structuredClone(value);

export function createPilotWorkflowFixture(): PilotWorkflowFixture {
  const primary = clone(catalogTemplate) as unknown as CatalogBundle;
  const secondary = clone(catalogTemplate) as unknown as CatalogBundle;
  primary.catalog.catalog_id = "pilot-primary";
  primary.catalog.source_file_name = "pilot-primary.json";
  primary.catalog.source_sha256 = "a".repeat(64);
  secondary.catalog.catalog_id = "pilot-secondary";
  secondary.catalog.source_file_name = "pilot-secondary.json";
  secondary.catalog.source_sha256 = "b".repeat(64);
  const primaryItem = primary.items[0] as any;
  const secondaryItem = secondary.items[0] as any;
  primaryItem.catalog_item.source_item_id = "pilot-primary-valve";
  secondaryItem.catalog_item.source_item_id = "pilot-secondary-valve";
  primaryItem.source.supplier_sku = "PILOT-P";
  secondaryItem.source.supplier_sku = "PILOT-S";

  const request = clone(requestTemplate) as unknown as RequestBundle;
  const base = (request.request_document.lines[0] as any);
  const line = (id: string, material: string, text: string) => ({
    ...clone(base),
    line_id: id,
    raw_text: text,
    constraints: {
      ...clone(base.constraints),
      attributes: { body_material: { operator: "eq", value: material } },
    },
  });
  request.source.source_file_name = "pilot-request.json";
  (request.request_document as any).document.source_file = "pilot-request.json";
  (request.source as any).source_sha256 = "c".repeat(64);
  request.source.line_count = 3;
  request.request_document.request_id = "pilot-workflow-request";
  request.request_document.lines = [
    line("pilot-selected", "aluminum", "Кран для обычного выбора"),
    line("pilot-ranked-low", "aluminum", "Кран с выбором ниже рейтинга"),
    line("pilot-no-offer", "steel", "Стальной кран отсутствует"),
  ];

  const offer = (record: string, catalog: CatalogBundle): OfferRef => ({
    catalog_record_id: record,
    catalog_id: catalog.catalog.catalog_id,
    source_sha256: catalog.catalog.source_sha256,
    source_item_id: (catalog.items[0] as any).catalog_item.source_item_id,
  });
  return {
    primaryCatalogBundle: primary,
    secondaryCatalogBundle: secondary,
    requestBundle: request,
    expected: {
      primaryCatalogId: primary.catalog.catalog_id,
      secondaryCatalogId: secondary.catalog.catalog_id,
      selectedLineId: "pilot-selected",
      selectedOfferRef: offer("pilot-primary-record", primary),
      rankedLineId: "pilot-ranked-low",
      rankedCorrectOfferRef: offer("pilot-secondary-record", secondary),
      noOfferLineId: "pilot-no-offer",
    },
  };
}
