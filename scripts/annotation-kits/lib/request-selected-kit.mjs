import { isDeepStrictEqual } from 'node:util';
import { externalRefs, stable } from './annotation-kits.mjs';

const DISPATCH = 'https://example.local/schemas/annotation/generated/request-line.dispatch.schema.json';
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

export function buildSelectedRequestKit(fullKit, selectedClassIds, lineCandidates) {
  const union = exactUnion(lineCandidates);
  const selected = [...new Set(selectedClassIds)].sort();
  if (!isDeepStrictEqual(selected, union)) fail('selected_class_ids must equal the exact candidate union');
  selected.forEach((id) => { if (!fullKit.class_schema_ids[id]) fail(`Unknown class_id: ${id}`); });
  const sourceDispatcher = fullKit.schemas_by_id[DISPATCH];
  const classSchemaIds = Object.fromEntries(selected.map((id) => [id, fullKit.class_schema_ids[id]]));
  const wantedSchemaIds = new Set(Object.values(classSchemaIds));
  const dispatcher = clone(sourceDispatcher);
  dispatcher.oneOf = sourceDispatcher.oneOf.filter(({ $ref }) => wantedSchemaIds.has(new URL($ref, sourceDispatcher.$id).href.split('#')[0]));
  if (dispatcher.oneOf.length !== selected.length) fail('Production dispatcher does not contain every selected class');
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
  return stable({ kind: 'request_selected_annotation_kit', source_kit_version: fullKit.kit_version, taxonomy_version: fullKit.taxonomy_version, annotation_schema_version: fullKit.annotation_schema_version, bundle_schema_version: fullKit.bundle_schema_version, root_schema_id: fullKit.root_schema_id, selected_class_ids: selected, line_candidates: clone(lineCandidates), taxonomy, class_schema_ids: classSchemaIds, schemas_by_id: schemasById });
}

export function validateSelectedRequestKit(fullKit, selectedKit, source) {
  const expected = buildSelectedRequestKit(fullKit, selectedKit.selected_class_ids, selectedKit.line_candidates);
  if (!isDeepStrictEqual(stable(selectedKit), expected)) fail('Selected kit is not the canonical full-kit projection (version, taxonomy, schema, dispatcher, or dependency tampering detected)');
  if (source) {
    const sourceIds = source.lines.map((line) => line.line_id);
    const candidateIds = selectedKit.line_candidates.map((line) => line.line_id);
    if (!isDeepStrictEqual(candidateIds, sourceIds)) fail('line_candidates must correspond exactly, and in order, to request-source lines');
  }
  return true;
}
