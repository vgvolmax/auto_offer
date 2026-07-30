export function offerRef(candidate) {
  return { catalog_record_id: candidate.catalog_record_id, catalog_id: candidate.catalog_id, source_sha256: candidate.source_sha256, source_item_id: candidate.source_item_id };
}

export function determineResolution(candidates, excludedCandidates, requestValidated = true) {
  if (!requestValidated) return 'request_review_required';
  const automatic = candidates.filter((candidate) => candidate.availability === 'eligible');
  const exactCount = automatic.filter((candidate) => candidate.match_level === 'exact').length;
  if (exactCount > 0) return exactCount === 1 ? 'single_exact' : 'multiple_exact';
  if (automatic.some((candidate) => candidate.match_level === 'equivalent')) return 'equivalent_only';
  if (automatic.some((candidate) => candidate.match_level === 'alternative')) return 'alternative_only';
  if (excludedCandidates.length > 0) return 'excluded_by_policy';
  return 'no_match';
}

export function serializeCandidate(candidate, technical, policyResult) {
  const result = { offer_ref: offerRef(candidate), match_level: technical.level, availability: policyResult.availability, checks: [...technical.checks, ...policyResult.checks], differences: [...technical.differences] };
  if (policyResult.exclusionCodes.length > 0) result.exclusion_codes = [...policyResult.exclusionCodes];
  return result;
}
