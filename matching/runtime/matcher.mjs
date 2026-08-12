import { validateInput } from './input-validation.mjs';
import { projectRequestLine } from './projectors.mjs';
import { buildCatalogIndex } from './catalog-index.mjs';
import { effectiveMaximumMatchLevel } from './substitution-policy.mjs';
import { evaluateCandidate } from './candidate-evaluator.mjs';
import { applyPolicy } from './policy-filter.mjs';
import { candidateComparator, ordinalCompare } from './candidate-ordering.mjs';
import { matchingInputFingerprint } from './matching-fingerprint.mjs';
import { determineResolution, serializeCandidate } from './result-builder.mjs';

const reasonOrder = ['CLASS_MISMATCH', 'IDENTITY_EXCLUDED', 'IDENTITY_DIFFERENCE', 'ATTRIBUTE_CONSTRAINT_FAILED', 'PORT_ROLE_MISSING', 'PORT_CONSTRAINT_FAILED', 'CATALOG_VALUE_MISSING', 'CATALOG_ITEM_INVALID'];

function incrementTechnicalRejections(counts, codes) {
  for (const code of new Set(codes)) counts.set(code, (counts.get(code) ?? 0) + 1);
}

function catalogReferences(catalogs, policy) {
  const priority = new Map(policy.catalog_priority.map((id, index) => [id, index]));
  return catalogs.map(({ catalogRecordId, catalogRevision, bundle }) => ({
    catalog_record_id: catalogRecordId,
    catalog_id: bundle.catalog.catalog_id,
    source_sha256: bundle.catalog.source_sha256,
    catalog_revision: catalogRevision ?? 0,
  })).sort((left, right) =>
    (priority.get(left.catalog_record_id) ?? Infinity) - (priority.get(right.catalog_record_id) ?? Infinity)
    || ordinalCompare(left.catalog_id, right.catalog_id)
    || ordinalCompare(left.catalog_record_id, right.catalog_record_id)
    || ordinalCompare(left.source_sha256, right.source_sha256));
}

function reviewRequiredLine(request) {
  return { line_id: request.line_id, resolution: determineResolution([], [], false), candidates: [], excluded_candidates: [], rejection_summary: [{ code: 'REQUEST_REVIEW_REQUIRED', count: 1 }] };
}

function unsupportedLine(request) {
  return { line_id: request.line_id, resolution: 'request_unsupported', candidates: [], excluded_candidates: [], rejection_summary: [{ code: 'REQUEST_UNSUPPORTED', count: 1 }] };
}

function matchLine(request, catalogIndex, policy, registry) {
  if (request.annotation_status === 'unsupported') return unsupportedLine(request);
  if (request.annotation_status !== 'validated') return reviewRequiredLine(request);

  const maximumLevel = effectiveMaximumMatchLevel(request.substitution_statement, policy.max_match_level);
  const candidates = [];
  const excludedCandidates = [];
  const rejectionCounts = new Map();

  const classCandidates = catalogIndex.get(request.class_id) ?? [];
  for (const catalogCandidate of classCandidates) {
    const technical = evaluateCandidate(request, catalogCandidate, registry);
    if (technical.rejectionCodes.size > 0) {
      incrementTechnicalRejections(rejectionCounts, technical.rejectionCodes);
      continue;
    }
    const policyResult = applyPolicy(catalogCandidate, technical, policy, maximumLevel);
    const serialized = serializeCandidate(catalogCandidate, technical, policyResult);
    serialized.brand = catalogCandidate.identity.brand;
    if (policyResult.exclusionCodes.length > 0) excludedCandidates.push(serialized);
    else candidates.push(serialized);
  }

  const compareCandidates = candidateComparator(policy);
  candidates.sort(compareCandidates);
  excludedCandidates.sort(compareCandidates);
  for (const candidate of [...candidates, ...excludedCandidates]) delete candidate.brand;

  return {
    line_id: request.line_id,
    resolution: determineResolution(candidates, excludedCandidates),
    candidates,
    excluded_candidates: excludedCandidates,
    rejection_summary: reasonOrder.filter((code) => rejectionCounts.has(code)).map((code) => ({ code, count: rejectionCounts.get(code) })),
  };
}

export async function runPilotMatcher(input) {
  validateInput(input);
  const { requestBundle, catalogs, policy, registry, engineVersion } = input;
  const refs = catalogReferences(catalogs, policy);
  const catalogIndex = buildCatalogIndex(catalogs);
  const lines = requestBundle.request_document.lines.map((line) => matchLine(projectRequestLine(line), catalogIndex, policy, registry));
  const inputFingerprint = await matchingInputFingerprint({ requestBundle, catalogRefs: refs, policy, policyRegistryVersion: registry.policy_version, engineVersion });

  return {
    schema_version: '1.0.0', kind: 'match_result', engine_version: engineVersion,
    policy_registry_version: registry.policy_version, taxonomy_version: requestBundle.taxonomy_version,
    request_id: requestBundle.request_document.request_id, input_fingerprint: inputFingerprint,
    policy: structuredClone(policy), catalog_refs: refs, lines, summary: { lines: lines.length },
  };
}
