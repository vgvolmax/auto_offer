const levels = { exact: 0, equivalent: 1, alternative: 2 };
export const ordinalCompare = (a, b) => a < b ? -1 : a > b ? 1 : 0;
export function candidateComparator(policy) { return (a,b) => levels[a.match_level]-levels[b.match_level]
  || position(policy.brands.preferred, a.brand)-position(policy.brands.preferred,b.brand)
  || position(policy.catalog_priority,a.offer_ref.catalog_record_id)-position(policy.catalog_priority,b.offer_ref.catalog_record_id)
  || ordinalCompare(a.offer_ref.catalog_id,b.offer_ref.catalog_id)
  || ordinalCompare(a.offer_ref.source_item_id,b.offer_ref.source_item_id)
  || ordinalCompare(a.offer_ref.catalog_record_id,b.offer_ref.catalog_record_id)
  || ordinalCompare(a.offer_ref.source_sha256,b.offer_ref.source_sha256); }
function position(list, value) { const i=list.indexOf(value); return i < 0 ? list.length : i; }
