import { buildSelectedRequestKit } from '../../annotation-kits/lib/request-selected-kit.mjs';
import { projectRequestRouting, validateRequestRoutingObjects } from './request-routing.mjs';

export function buildSelectedRequestKitFromRouting({ fullKit, requestSource, routing, taxonomyLight, validators }) {
  if (!validators) throw new Error('Request routing validators are required');
  const validation = validateRequestRoutingObjects(routing, requestSource, taxonomyLight, validators);
  if (!validation.valid) throw new Error(`Request routing validation failed: ${validation.errors.join('; ')}`);
  if (fullKit.taxonomy_version !== taxonomyLight.taxonomy_version) {
    throw new Error('fullKit.taxonomy_version must equal taxonomyLight.taxonomy_version');
  }
  const { selectedClassIds, lineCandidates, unsupportedLines } = projectRequestRouting(routing);
  return buildSelectedRequestKit(fullKit, selectedClassIds, lineCandidates, unsupportedLines);
}
