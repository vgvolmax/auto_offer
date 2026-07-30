import { evaluateConstraint } from './constraint-evaluator.mjs';

const levelRank = { exact: 0, equivalent: 1, alternative: 2 };
const targetKey = (target) => `${target.kind}:${target.role ?? ''}:${target.field}`;

function raiseLevel(state, level) {
  if (levelRank[level] > levelRank[state.level]) state.level = level;
}

function checkShape(scope, target, constraint, actual, outcome, effect, code) {
  const check = { scope, target, operator: constraint.operator, expected: constraint.value };
  if (actual !== undefined) check.actual = actual;
  return { ...check, outcome, effect, code };
}

function evaluateTechnicalConstraint({ target, constraint, actual, state, hardTargets, equivalentRules, alternativeRules, failureCode }) {
  const result = evaluateConstraint(constraint, actual);
  const scope = target.kind;
  const publicTarget = target.kind === 'port'
    ? { role: target.role, field: target.field }
    : { field: target.field };

  if (result.outcome === 'pass') {
    state.checks.push(checkShape(scope, publicTarget, constraint, actual, 'pass', 'exact', scope === 'port' ? 'PORT_MATCH' : 'ATTRIBUTE_MATCH'));
    return;
  }
  if (result.outcome === 'missing') {
    const check = checkShape(scope, publicTarget, constraint, actual, 'missing', 'reject', 'CATALOG_VALUE_MISSING');
    state.checks.push(check);
    state.rejectionCodes.add('CATALOG_VALUE_MISSING');
    return;
  }

  const key = targetKey(target);
  const equivalentRule = equivalentRules.get(key);
  const requestedIndex = equivalentRule?.ordered_values.indexOf(constraint.value) ?? -1;
  const actualIndex = equivalentRule?.ordered_values.indexOf(actual) ?? -1;
  const equivalent = constraint.operator === 'eq' && requestedIndex >= 0 && actualIndex > requestedIndex;
  const alternative = constraint.operator !== 'neq' && alternativeRules.has(key);

  if (constraint.operator !== 'neq' && !hardTargets.has(key) && equivalent) {
    const check = checkShape(scope, publicTarget, constraint, actual, 'difference', 'equivalent', 'EQUIVALENT_RULE_APPLIED');
    state.checks.push(check);
    state.differences.push(check);
    raiseLevel(state, 'equivalent');
  } else if (constraint.operator !== 'neq' && !hardTargets.has(key) && alternative) {
    const check = checkShape(scope, publicTarget, constraint, actual, 'difference', 'alternative', 'ALTERNATIVE_RULE_APPLIED');
    state.checks.push(check);
    state.differences.push(check);
    raiseLevel(state, 'alternative');
  } else {
    state.checks.push(checkShape(scope, publicTarget, constraint, actual, 'fail', 'reject', failureCode));
    state.rejectionCodes.add(failureCode);
  }
}

export function evaluateCandidate(request, candidate, registry) {
  const state = { level: 'exact', checks: [], differences: [], rejectionCodes: new Set() };
  const classMatches = request.class_id === candidate.class_id;
  state.checks.push({ scope: 'class', target: { class_id: request.class_id }, expected: request.class_id, actual: candidate.class_id, outcome: classMatches ? 'pass' : 'fail', effect: classMatches ? 'exact' : 'reject', code: classMatches ? 'CLASS_MATCH' : 'CLASS_MISMATCH' });
  if (!classMatches) {
    state.rejectionCodes.add('CLASS_MISMATCH');
    return state;
  }

  const rules = registry.class_rules?.[request.class_id] ?? {};
  const hardTargets = new Set((rules.hard_targets ?? []).map(targetKey));
  const equivalentRules = new Map((rules.equivalent_rules ?? []).map((rule) => [targetKey(rule.target), rule]));
  const alternativeRules = new Map((rules.alternative_rules ?? []).map((rule) => [targetKey(rule.target), rule]));

  for (const [field, constraint] of Object.entries(request.constraints.attributes ?? {})) {
    evaluateTechnicalConstraint({ target: { kind: 'attribute', field }, constraint, actual: candidate.attributes[field], state, hardTargets, equivalentRules, alternativeRules, failureCode: 'ATTRIBUTE_CONSTRAINT_FAILED' });
  }
  for (const requestedPort of request.ports ?? []) {
    const actualPort = candidate.ports.find((port) => port.role === requestedPort.role);
    if (!actualPort) {
      state.checks.push({ scope: 'port', target: { role: requestedPort.role }, outcome: 'missing', effect: 'reject', code: 'PORT_ROLE_MISSING' });
      state.rejectionCodes.add('PORT_ROLE_MISSING');
      continue;
    }
    for (const [field, constraint] of Object.entries(requestedPort)) {
      if (field === 'role') continue;
      evaluateTechnicalConstraint({ target: { kind: 'port', role: requestedPort.role, field }, constraint, actual: actualPort[field], state, hardTargets, equivalentRules, alternativeRules, failureCode: 'PORT_CONSTRAINT_FAILED' });
    }
  }
  for (const [field, constraint] of Object.entries(request.requested_identity ?? {})) {
    const actual = candidate.identity[field];
    const result = evaluateConstraint(constraint, actual);
    if (result.outcome === 'pass') {
      state.checks.push(checkShape('identity', { field }, constraint, actual, 'pass', 'exact', 'IDENTITY_MATCH'));
    } else if (result.outcome === 'missing') {
      state.checks.push(checkShape('identity', { field }, constraint, actual, 'missing', 'reject', 'CATALOG_VALUE_MISSING'));
      state.rejectionCodes.add('CATALOG_VALUE_MISSING');
    } else if (constraint.operator === 'neq') {
      state.checks.push(checkShape('identity', { field }, constraint, actual, 'fail', 'reject', 'IDENTITY_EXCLUDED'));
      state.rejectionCodes.add('IDENTITY_EXCLUDED');
    } else {
      const check = checkShape('identity', { field }, constraint, actual, 'difference', 'equivalent', 'IDENTITY_DIFFERENCE');
      state.checks.push(check);
      state.differences.push(check);
      raiseLevel(state, 'equivalent');
    }
  }
  return state;
}
