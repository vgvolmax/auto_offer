import { externalRefs, jsonDeepEqual, stableJsonValue as stable } from '../../lib/json-contract-utils.mjs';

const DISPATCH = 'https://example.local/schemas/annotation/generated/request-line.dispatch.schema.json';
const UNSUPPORTED = 'https://example.local/schemas/annotation/unsupported-request-line.schema.json';
const REASONS = new Set(['NO_TAXONOMY_CLASS', 'AMBIGUOUS_CLASS', 'UNCLASSIFIABLE_SOURCE']);
const clone = (value) => structuredClone(value);
const fail = (message) => { throw new Error(message); };

function exactUnion(lineCandidates) {
  const lineIds = new Set();
  const union = new Set();
  for (const entry of lineCandidates) {
    if (lineIds.has(entry.line_id)) fail(`Duplicate line candidate: ${entry.line_id}`);
    lineIds.add(entry.line_id);
    if (!Array.isArray(entry.class_ids) || entry.class_ids.length < 1 || entry.class_ids.length > 3 || new Set(entry.class_ids).size !== entry.class_ids.length) fail(`Invalid candidates for line ${entry.line_id}`);
    entry.class_ids.forEach((id) => union.add(id));
  }
  return [...union].sort();
}

function validateUnsupportedLines(unsupportedLines) {
  const ids = new Set();
  for (const entry of unsupportedLines) {
    if (ids.has(entry.line_id)) fail(`Duplicate unsupported line: ${entry.line_id}`);
    ids.add(entry.line_id);
    if (!REASONS.has(entry.reason_code)) fail(`Invalid unsupported reason_code for line ${entry.line_id}`);
  }
}

export function buildSelectedRequestKit(fullKit, selectedClassIds, lineCandidates, unsupportedLines = []) {
  const union = exactUnion(lineCandidates);
  validateUnsupportedLines(unsupportedLines);
  const selected = [...new Set(selectedClassIds)].sort();
  if (!jsonDeepEqual(selected, union)) fail('selected_class_ids must equal the exact candidate union');
  selected.forEach((id) => { if (!fullKit.class_schema_ids[id]) fail(`Unknown class_id: ${id}`); });
  const sourceDispatcher = fullKit.schemas_by_id[DISPATCH];
  const classSchemaIds = Object.fromEntries(selected.map((id) => [id, fullKit.class_schema_ids[id]]));
  const wantedSchemaIds = new Set([UNSUPPORTED, ...Object.values(classSchemaIds)]);
  const dispatcher = clone(sourceDispatcher);
  dispatcher.oneOf = sourceDispatcher.oneOf.filter(({ $ref }) => wantedSchemaIds.has(new URL($ref, sourceDispatcher.$id).href.split('#')[0]));
  if (dispatcher.oneOf.length !== selected.length + 1 || !dispatcher.oneOf.some(({ $ref }) => new URL($ref, sourceDispatcher.$id).href === UNSUPPORTED)) fail('Production dispatcher does not contain unsupported and every selected class');
  const overrides = new Map([[DISPATCH, dispatcher]]);
  const pending = [fullKit.root_schema_id, ...wantedSchemaIds];
  const closure = new Set();
  while (pending.length) {
    const id = pending.pop();
    if (closure.has(id)) continue;
    const schema = overrides.get(id) ?? fullKit.schemas_by_id[id];
    if (!schema) fail(`Unresolved schema reference: ${id}`);
    closure.add(id); pending.push(...externalRefs(schema));
  }
  const schemasById = Object.fromEntries([...closure].sort().map((id) => [id, clone(overrides.get(id) ?? fullKit.schemas_by_id[id])]));
  const taxonomy = clone(fullKit.taxonomy);
  taxonomy.classes = Object.fromEntries(selected.map((id) => [id, clone(fullKit.taxonomy.classes[id])]));
  taxonomy.class_count = selected.length;
  return stable({ kind: 'request_selected_annotation_kit', source_kit_version: fullKit.kit_version, taxonomy_version: fullKit.taxonomy_version, annotation_schema_version: fullKit.annotation_schema_version, bundle_schema_version: fullKit.bundle_schema_version, root_schema_id: fullKit.root_schema_id, selected_class_ids: selected, line_candidates: clone(lineCandidates), unsupported_lines: clone(unsupportedLines), taxonomy, class_schema_ids: classSchemaIds, schemas_by_id: schemasById });
}

export function validateSelectedRequestKit(fullKit, selectedKit, source) {
  if (!source) fail('request-source is required');
  const expected = buildSelectedRequestKit(fullKit, selectedKit.selected_class_ids, selectedKit.line_candidates, selectedKit.unsupported_lines);
  if (!jsonDeepEqual(stable(selectedKit), expected)) fail('Selected kit is not the canonical full-kit projection (version, taxonomy, schema, dispatcher, or dependency tampering detected)');
  const sourceIds = source.lines.map((line) => line.line_id);
  const candidateIds = selectedKit.line_candidates.map((line) => line.line_id);
  const unsupportedIds = selectedKit.unsupported_lines.map((line) => line.line_id);
  const sourceSet = new Set(sourceIds);
  for (const id of [...candidateIds, ...unsupportedIds]) if (!sourceSet.has(id)) fail(`Unknown routed line_id: ${id}`);
  if (new Set([...candidateIds, ...unsupportedIds]).size !== candidateIds.length + unsupportedIds.length) fail('Each source line must be routed exactly once (candidate XOR unsupported)');
  if (!jsonDeepEqual(candidateIds, sourceIds.filter((id) => candidateIds.includes(id))) || !jsonDeepEqual(unsupportedIds, sourceIds.filter((id) => unsupportedIds.includes(id))) || candidateIds.length + unsupportedIds.length !== sourceIds.length) fail('Routing entries must cover source lines exactly once and preserve source order');
  return true;
}
