import { matchLevelAllowed } from './substitution-policy.mjs';

function policyCheck(target, outcome, code) {
  return { scope: 'policy', target, outcome, effect: outcome === 'pass' ? 'exact' : 'reject', code };
}

export function applyPolicy(candidate, technical, policy, maximumLevel) {
  const checks = [];
  const exclusionCodes = [];
  const brand = candidate.identity.brand;
  const exclude = (target, code) => {
    checks.push(policyCheck(target, 'fail', code));
    exclusionCodes.push(code);
  };

  if (!policy.catalog_record_ids.includes(candidate.catalog_record_id)) exclude({ catalog_record_id: candidate.catalog_record_id }, 'CATALOG_NOT_SELECTED');
  if (brand == null && policy.brands.unknown === 'exclude') exclude({ field: 'brand' }, 'BRAND_UNKNOWN_EXCLUDED');
  if (brand != null && policy.brands.exclude.includes(brand)) exclude({ field: 'brand' }, 'BRAND_EXCLUDED');
  if (brand != null && policy.brands.include.length > 0 && !policy.brands.include.includes(brand)) exclude({ field: 'brand' }, 'BRAND_NOT_INCLUDED');
  if (!matchLevelAllowed(technical.level, maximumLevel)) exclude({ max_match_level: maximumLevel }, 'MATCH_LEVEL_NOT_ALLOWED');
  if (candidate.annotation_status === 'needs_review' && policy.catalog_needs_review === 'exclude') exclude({ annotation_status: 'needs_review' }, 'CATALOG_ITEM_NEEDS_REVIEW');
  if (candidate.annotation_status === 'needs_review' && policy.catalog_needs_review === 'manual_only') checks.push(policyCheck({ annotation_status: 'needs_review' }, 'pass', 'CATALOG_ITEM_NEEDS_REVIEW'));

  return { checks, exclusionCodes, availability: candidate.annotation_status === 'needs_review' ? 'manual_only' : 'eligible' };
}
