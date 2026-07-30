function isRational(value) {
  return value && typeof value === 'object' && Number.isFinite(value.numerator) && Number.isFinite(value.denominator);
}

export function equalValue(left, right) {
  if (isRational(left) && isRational(right)) {
    return left.numerator * right.denominator === right.numerator * left.denominator;
  }
  return left === right;
}

export function evaluateConstraint(constraint, actual) {
  if (actual === undefined || actual === null) return { outcome: 'missing', code: 'CATALOG_VALUE_MISSING' };

  const { operator, value } = constraint;
  let pass = false;
  if (operator === 'eq') pass = equalValue(actual, value);
  else if (operator === 'neq') pass = !equalValue(actual, value);
  else if (operator === 'in') pass = value.some((allowed) => equalValue(actual, allowed));
  else if (operator === 'gte') pass = actual >= value;
  else if (operator === 'lte') pass = actual <= value;

  return { outcome: pass ? 'pass' : 'fail', code: pass ? null : 'ATTRIBUTE_CONSTRAINT_FAILED' };
}
