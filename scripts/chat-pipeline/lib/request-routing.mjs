import { isDeepStrictEqual } from 'node:util';

export function projectRequestRouting(routing) {
  const selected = new Set();
  const lineCandidates = [];
  const unsupportedLines = [];
  for (const route of routing.routes) {
    if (route.decision === 'candidates') {
      route.class_ids.forEach((classId) => selected.add(classId));
      lineCandidates.push({ line_id: route.line_id, class_ids: [...route.class_ids] });
    } else {
      unsupportedLines.push({ line_id: route.line_id, reason_code: route.reason_code });
    }
  }
  return { selectedClassIds: [...selected].sort(), lineCandidates, unsupportedLines };
}

export function validateRequestRoutingObjects(routing, requestSource, taxonomyLight, validators = {}) {
  const errors = [];
  for (const [name, value] of Object.entries({ routing, requestSource, taxonomyLight })) {
    const validate = validators[name];
    if (validate && !validate(value)) {
      errors.push(...validate.errors.map((error) => `${name}${error.instancePath || '/'} ${error.message}`));
    }
  }
  if (errors.length) return { valid: false, errors };

  if (taxonomyLight.class_count !== taxonomyLight.classes.length) errors.push('taxonomyLight.class_count must equal taxonomyLight.classes.length');
  const taxonomyIds = taxonomyLight.classes.map(({ class_id }) => class_id);
  if (new Set(taxonomyIds).size !== taxonomyIds.length) errors.push('taxonomyLight class_id values must be unique');
  if (routing.source_file !== requestSource.source_file) errors.push('routing.source_file must equal requestSource.source_file');
  if (routing.line_count !== requestSource.line_count) errors.push('routing.line_count must equal requestSource.line_count');
  if (requestSource.line_count !== requestSource.lines.length) errors.push('requestSource.line_count must equal requestSource.lines.length');
  if (routing.routes.length !== requestSource.lines.length) errors.push('routing.routes.length must equal requestSource.lines.length');
  const routeIds = routing.routes.map(({ line_id }) => line_id);
  const sourceIds = requestSource.lines.map(({ line_id }) => line_id);
  if (new Set(routeIds).size !== routeIds.length) errors.push('routing route line_id values must be unique');
  if (new Set(sourceIds).size !== sourceIds.length) errors.push('requestSource line_id values must be unique');
  if (!isDeepStrictEqual(routeIds, sourceIds)) errors.push('routing routes must cover source line_ids exactly once and preserve source order');
  if (routing.taxonomy_version !== taxonomyLight.taxonomy_version) errors.push('routing.taxonomy_version must equal taxonomyLight.taxonomy_version');
  const known = new Set(taxonomyIds);
  for (const route of routing.routes) {
    if (route.decision === 'candidates') for (const classId of route.class_ids) {
      if (!known.has(classId)) errors.push(`Unknown class_id for line ${route.line_id}: ${classId}`);
    }
  }
  if (errors.length) return { valid: false, errors };
  const projection = projectRequestRouting(routing);
  return {
    valid: true,
    line_count: routing.line_count,
    selected_class_count: projection.selectedClassIds.length,
    unsupported_count: projection.unsupportedLines.length,
  };
}
