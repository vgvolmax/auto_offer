import { matchLevelAllowed } from './substitution-policy.mjs';
export function applyPolicy(candidate, technical, policy, max) { const codes=[]; const brand=candidate.identity.brand;
 if(!policy.catalog_record_ids.includes(candidate.catalog_record_id)) codes.push('CATALOG_NOT_SELECTED');
 if(brand==null && policy.brands.unknown==='exclude') codes.push('BRAND_UNKNOWN_EXCLUDED');
 if(brand!=null && policy.brands.exclude.includes(brand)) codes.push('BRAND_EXCLUDED');
 if(brand!=null && policy.brands.include.length && !policy.brands.include.includes(brand)) codes.push('BRAND_NOT_INCLUDED');
 if(!matchLevelAllowed(technical.level,max)) codes.push('MATCH_LEVEL_EXCEEDS_POLICY');
 if(candidate.annotation_status==='needs_review'&&policy.catalog_needs_review==='exclude') codes.push('CATALOG_ITEM_NEEDS_REVIEW');
 return codes;
}
