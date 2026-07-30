import { readFile } from 'node:fs/promises';

function targetKey(target) {
  return [target.kind, target.role ?? '', target.field].join(':');
}

function classContract(schema) {
  const classShape = schema.allOf.find((entry) => entry.properties?.class_id);
  const attributes = classShape?.properties?.attributes?.properties ?? {};
  const ports = new Map();

  for (const port of classShape?.properties?.ports?.prefixItems ?? []) {
    const role = port.properties?.role?.const;
    if (role) {
      ports.set(role, port.properties ?? {});
    }
  }

  return { attributes, ports };
}

function validateTarget(classId, target, contract) {
  const printable = JSON.stringify(target);
  if (target.kind === 'attribute' && !contract.attributes[target.field]) {
    return `class ${classId}: unknown attribute target ${printable}`;
  }
  if (target.kind === 'port' && !contract.ports.has(target.role)) {
    return `class ${classId}: unsupported port role in target ${printable}`;
  }
  if (target.kind === 'port' && !contract.ports.get(target.role)?.[target.field]) {
    return `class ${classId}: unknown port field in target ${printable}`;
  }
  return null;
}

export async function loadProductionClassContracts() {
  const registryUrl = new URL('../../../schemas/annotation/class-schema-registry.json', import.meta.url);
  const registry = JSON.parse(await readFile(registryUrl));
  const contracts = new Map();

  for (const [classId, entry] of Object.entries(registry.classes)) {
    const schemaUrl = new URL(`../../../schemas/annotation/${entry.catalog_schema}`, import.meta.url);
    contracts.set(classId, classContract(JSON.parse(await readFile(schemaUrl))));
  }

  return contracts;
}

export async function validatePolicyRegistry(registry, contracts) {
  const availableContracts = contracts ?? await loadProductionClassContracts();
  const errors = [];

  for (const [classId, classRules] of Object.entries(registry.class_rules ?? {})) {
    const contract = availableContracts.get(classId);
    if (!contract) {
      errors.push(`unknown class ${classId}`);
      continue;
    }

    const seen = new Set();
    const groups = [
      ['hard_targets', classRules.hard_targets.map((target) => ({ target }))],
      ['equivalent_rules', classRules.equivalent_rules],
      ['alternative_rules', classRules.alternative_rules],
    ];

    for (const [groupName, rules] of groups) {
      for (const rule of rules) {
        const target = rule.target;
        const semanticError = validateTarget(classId, target, contract);
        if (semanticError) {
          errors.push(`${groupName}: ${semanticError}`);
        }

        const key = targetKey(target);
        if (seen.has(key)) {
          errors.push(`class ${classId}: duplicate target ${JSON.stringify(target)}`);
        }
        seen.add(key);

        if (groupName === 'equivalent_rules') {
          const canonicalValues = contract.attributes[target.field]?.enum
            ?? contract.ports.get(target.role)?.[target.field]?.enum;
          if (!canonicalValues) {
            errors.push(`class ${classId}: ordered_values target is not a canonical enum ${JSON.stringify(target)}`);
          } else {
            for (const value of rule.ordered_values) {
              if (!canonicalValues.includes(value)) {
                errors.push(`class ${classId}: ordered_values contains non-canonical value ${JSON.stringify(value)} for ${JSON.stringify(target)}`);
              }
            }
          }
        }
      }
    }
  }

  return errors;
}
