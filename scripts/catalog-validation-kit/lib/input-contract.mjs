const ROLE_DEFINITIONS = {
  catalog_kit: {
    conventionalName: 'catalog-annotation-kit.json',
    kind: 'json',
  },
  class_registry: {
    conventionalName: 'class-schema-registry.json',
    kind: 'json',
  },
  bundle_validator: {
    conventionalName: 'bundle-validator.mjs',
    kind: 'module',
    exportName: 'validateCatalogBundle',
  },
  annotation_contract_validator: {
    conventionalName: 'annotation-contract-validator.mjs',
    kind: 'module',
    exportName: 'validateAnnotation',
  },
  catalog_identifiers: {
    conventionalName: 'catalog-identifiers.mjs',
    kind: 'module',
    exportName: 'classifyGtin',
  },
  request_port_contracts: {
    conventionalName: 'request-port-contracts.mjs',
    kind: 'module',
    exportName: 'buildRequestPortContracts',
  },
};

const REQUIRED_ROLES = Object.keys(ROLE_DEFINITIONS).sort();
const JSON_ROLES = new Set(REQUIRED_ROLES.filter(role => ROLE_DEFINITIONS[role].kind === 'json'));
const MODULE_ROLES = new Set(REQUIRED_ROLES.filter(role => ROLE_DEFINITIONS[role].kind === 'module'));

const error = (code, path, message, details) => ({
  code,
  path,
  message,
  ...(details === undefined ? {} : { details }),
});

const sorted = values => [...values].sort((left, right) =>
  left.path.localeCompare(right.path)
  || left.code.localeCompare(right.code)
  || left.message.localeCompare(right.message));

const basename = value => String(value).replaceAll('\\', '/').split('/').at(-1);

function parseImports(source) {
  const imports = [];
  const pattern = /(?:^|[;\n]\s*)import\s+(?:(?:([^'";]+?)\s+from\s+)?['"]([^'"]+)['"])/gm;
  for (const match of source.matchAll(pattern)) {
    const clause = (match[1] ?? '').trim();
    const importedNames = [];
    const named = /\{([^}]+)\}/.exec(clause)?.[1];
    if (named) {
      for (const entry of named.split(',')) {
        const imported = entry.trim().split(/\s+as\s+/)[0]?.trim();
        if (imported) importedNames.push(imported);
      }
    }
    if (clause && !named && !clause.startsWith('*')) {
      const defaultName = clause.split(',')[0]?.trim();
      if (defaultName) importedNames.push('default');
    }
    imports.push({ specifier: match[2], importedNames: [...new Set(importedNames)].sort() });
  }
  return imports;
}

function exportedNames(source) {
  const names = new Set();
  for (const match of source.matchAll(/\bexport\s+(?:async\s+)?(?:function|class|const|let|var)\s+([A-Za-z_$][\w$]*)/g)) names.add(match[1]);
  for (const match of source.matchAll(/\bexport\s*\{([^}]+)\}/g)) {
    for (const entry of match[1].split(',')) {
      const parts = entry.trim().split(/\s+as\s+/);
      const name = (parts[1] ?? parts[0])?.trim();
      if (name) names.add(name);
    }
  }
  if (/\bexport\s+default\b/.test(source)) names.add('default');
  return [...names].sort();
}

function identifyJsonRole(data) {
  if (data?.kind === 'catalog_annotation_kit'
    && data.taxonomy
    && data.schemas_by_id
    && data.class_schema_ids) return 'catalog_kit';
  if (data?.classes
    && typeof data.classes === 'object'
    && Object.values(data.classes).some(entry => entry && typeof entry === 'object' && typeof entry.catalog_schema === 'string')) return 'class_registry';
  return null;
}

function identifyModuleRole(exports) {
  const matches = [...MODULE_ROLES].filter(role => exports.includes(ROLE_DEFINITIONS[role].exportName));
  return matches.length === 1 ? matches[0] : null;
}

function shouldParseAsJson(file) {
  return /\.json$/i.test(file.name) || /^\s*[\[{]/.test(file.text);
}

export function classifyCatalogValidationInputs(files) {
  const candidates = Object.fromEntries(REQUIRED_ROLES.map(role => [role, []]));
  const errors = [];
  const unclassified = [];

  for (const [index, supplied] of (files ?? []).entries()) {
    const file = {
      name: String(supplied?.name ?? `input-${index + 1}`),
      text: typeof supplied?.text === 'string' ? supplied.text : '',
      index,
    };
    let role = null;
    let data;
    let exports = [];
    let imports = [];

    if (shouldParseAsJson(file)) {
      try {
        data = JSON.parse(file.text);
        role = identifyJsonRole(data);
      } catch (cause) {
        errors.push(error(
          'INPUT_JSON_PARSE_FAILED',
          `/inputs/${index}`,
          `Не удалось прочитать JSON-файл ${file.name}`,
          { filename: file.name, reason: cause instanceof Error ? cause.message : String(cause) },
        ));
      }
    }

    if (!role && data === undefined) {
      exports = exportedNames(file.text);
      imports = parseImports(file.text);
      role = identifyModuleRole(exports);
    }

    const record = { ...file, data, exports, imports };
    if (role) candidates[role].push(record);
    else unclassified.push(record);
  }

  const roles = {};
  for (const role of REQUIRED_ROLES) {
    const matches = candidates[role];
    if (matches.length) roles[role] = matches[0];
    if (matches.length > 1) {
      errors.push(error(
        'DUPLICATE_INPUT_ROLE',
        `/roles/${role}`,
        `Несколько файлов определены как ${role}`,
        { filenames: matches.map(item => item.name).sort() },
      ));
    }
  }

  return { roles, candidates, unclassified, errors: sorted(errors) };
}

function externalSchemaRefs(schema, baseId = schema?.$id) {
  const refs = new Set();
  function visit(value) {
    if (!value || typeof value !== 'object') return;
    if (typeof value.$ref === 'string' && !value.$ref.startsWith('#')) {
      try {
        refs.add(new URL(value.$ref, baseId).href.split('#')[0]);
      } catch {
        refs.add(value.$ref.split('#')[0]);
      }
    }
    for (const child of Object.values(value)) visit(child);
  }
  visit(schema);
  return [...refs].sort();
}

function sameSet(left, right) {
  const a = [...left].sort();
  const b = [...right].sort();
  return a.length === b.length && a.every((value, index) => value === b[index]);
}

function roleForImportedName(name) {
  return [...MODULE_ROLES].find(role => ROLE_DEFINITIONS[role].exportName === name) ?? null;
}

function validateModuleGraph(roles, errors) {
  for (const sourceRole of [...MODULE_ROLES].sort()) {
    const source = roles[sourceRole];
    if (!source) continue;
    for (const imported of source.imports) {
      if (!imported.specifier.startsWith('.')) {
        errors.push(error(
          'EXTERNAL_IMPORT_NOT_ALLOWED',
          `/roles/${sourceRole}/imports`,
          `Внешний импорт ${imported.specifier} запрещён`,
          { filename: source.name, specifier: imported.specifier },
        ));
        continue;
      }

      const targetRoles = imported.importedNames
        .map(roleForImportedName)
        .filter(Boolean);
      const uniqueTargetRoles = [...new Set(targetRoles)];
      const requestedBasename = basename(imported.specifier);
      const targetRole = uniqueTargetRoles.length === 1 ? uniqueTargetRoles[0] : null;
      const target = targetRole ? roles[targetRole] : null;
      const conventional = targetRole ? ROLE_DEFINITIONS[targetRole].conventionalName : null;
      const filenameMatches = target && (requestedBasename === basename(target.name) || requestedBasename === conventional);
      const exportsMatch = target && imported.importedNames.every(name => name === 'default' || target.exports.includes(name));

      if (!targetRole || !target || !filenameMatches || !exportsMatch) {
        errors.push(error(
          'UNRESOLVED_LOCAL_IMPORT',
          `/roles/${sourceRole}/imports`,
          `Не удалось разрешить локальный импорт ${imported.specifier}`,
          { filename: source.name, specifier: imported.specifier, imported_names: imported.importedNames },
        ));
      }
    }
  }
}

export function preflightCatalogValidationInputs(classified) {
  const roles = classified?.roles ?? {};
  const errors = [...(classified?.errors ?? [])];
  const warnings = [];

  for (const role of REQUIRED_ROLES) {
    if (!roles[role]) {
      errors.push(error(
        'MISSING_INPUT_ROLE',
        `/roles/${role}`,
        `Не найден обязательный входной файл для роли ${role}`,
      ));
      continue;
    }
    const conventionalName = ROLE_DEFINITIONS[role].conventionalName;
    if (basename(roles[role].name) !== conventionalName) {
      warnings.push(error(
        'NONSTANDARD_FILENAME',
        `/roles/${role}`,
        `Файл ${roles[role].name} распознан по содержимому; стандартное имя — ${conventionalName}`,
        { filename: roles[role].name, expected: conventionalName },
      ));
    }
  }

  const kit = roles.catalog_kit?.data;
  const registry = roles.class_registry?.data;
  if (kit) {
    if (kit.kind !== 'catalog_annotation_kit') {
      errors.push(error('CATALOG_KIT_KIND_MISMATCH', '/roles/catalog_kit/kind', 'Ожидался catalog_annotation_kit'));
    }
    if (!kit.root_schema_id || !kit.schemas_by_id?.[kit.root_schema_id]) {
      errors.push(error('ROOT_SCHEMA_MISSING', '/roles/catalog_kit/root_schema_id', 'Корневая catalog schema отсутствует в schemas_by_id'));
    }
    const rootSchema = kit.schemas_by_id?.[kit.root_schema_id];
    if (rootSchema?.properties?.schema_version?.const !== kit.bundle_schema_version) {
      errors.push(error('BUNDLE_SCHEMA_VERSION_MISMATCH', '/roles/catalog_kit/bundle_schema_version', 'Версия bundle schema не совпадает с корневой схемой'));
    }
    if (kit.taxonomy?.taxonomy_version !== kit.taxonomy_version) {
      errors.push(error('TAXONOMY_VERSION_MISMATCH', '/roles/catalog_kit/taxonomy_version', 'Версия taxonomy внутри комплекта не совпадает'));
    }
    for (const [schemaId, schema] of Object.entries(kit.schemas_by_id ?? {})) {
      for (const reference of externalSchemaRefs(schema, schemaId)) {
        if (!kit.schemas_by_id?.[reference]) {
          errors.push(error(
            'UNRESOLVED_SCHEMA_REFERENCE',
            `/roles/catalog_kit/schemas_by_id/${schemaId}`,
            `Schema reference ${reference} отсутствует в комплекте`,
          ));
        }
      }
    }
  }

  if (kit && registry) {
    const taxonomyClasses = Object.keys(kit.taxonomy?.classes ?? {});
    const registryClasses = Object.keys(registry.classes ?? {});
    const kitClasses = Object.keys(kit.class_schema_ids ?? {});
    if (!sameSet(taxonomyClasses, registryClasses) || !sameSet(taxonomyClasses, kitClasses)) {
      errors.push(error(
        'CLASS_SET_MISMATCH',
        '/roles/class_registry/classes',
        'Наборы классов taxonomy, registry и annotation kit различаются',
        {
          taxonomy_count: taxonomyClasses.length,
          registry_count: registryClasses.length,
          kit_count: kitClasses.length,
        },
      ));
    }
    if (registry.schema_version !== undefined && registry.schema_version !== kit.annotation_schema_version) {
      errors.push(error('ANNOTATION_SCHEMA_VERSION_MISMATCH', '/roles/class_registry/schema_version', 'Версия registry не совпадает с annotation kit'));
    }
    for (const classId of taxonomyClasses.sort()) {
      const schemaId = kit.class_schema_ids?.[classId];
      if (!schemaId || !kit.schemas_by_id?.[schemaId]) {
        errors.push(error(
          'CLASS_SCHEMA_MISSING',
          `/roles/catalog_kit/class_schema_ids/${classId}`,
          `Catalog schema для класса ${classId} отсутствует в комплекте`,
        ));
      }
      if (typeof registry.classes?.[classId]?.catalog_schema !== 'string') {
        errors.push(error(
          'CLASS_REGISTRY_ENTRY_INVALID',
          `/roles/class_registry/classes/${classId}/catalog_schema`,
          `Registry не содержит catalog_schema для класса ${classId}`,
        ));
      }
    }
  }

  validateModuleGraph(roles, errors);
  const finalErrors = sorted(errors);
  const finalWarnings = sorted(warnings);
  if (finalErrors.length) return { ok: false, errors: finalErrors, warnings: finalWarnings };

  const modules = Object.fromEntries([...MODULE_ROLES].sort().map(role => [role, roles[role]]));
  return {
    ok: true,
    kit,
    registry,
    modules,
    warnings: finalWarnings,
    summary: {
      taxonomy_version: kit.taxonomy_version,
      annotation_schema_version: kit.annotation_schema_version,
      bundle_schema_version: kit.bundle_schema_version,
      class_count: Object.keys(kit.taxonomy.classes).length,
      schema_count: Object.keys(kit.schemas_by_id).length,
      module_count: Object.keys(modules).length,
    },
  };
}

export const catalogValidationInputRoles = Object.freeze(
  Object.fromEntries(REQUIRED_ROLES.map(role => [role, { ...ROLE_DEFINITIONS[role] }])),
);
