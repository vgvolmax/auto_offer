export function equalValue(a,b) { if (isRational(a)&&isRational(b)) return a.numerator*b.denominator===b.numerator*a.denominator; return a===b; }
const isRational = v => v && typeof v==='object' && Number.isFinite(v.numerator) && Number.isFinite(v.denominator);
export function evaluateConstraint(constraint, actual) { if (actual===undefined || actual===null) return {outcome:'missing',code:'CATALOG_VALUE_MISSING'}; const {operator,value}=constraint; let pass;
  if(operator==='eq') pass=equalValue(actual,value); else if(operator==='neq') pass=!equalValue(actual,value); else if(operator==='in') pass=value.some(v=>equalValue(actual,v)); else if(operator==='gte') pass=actual>=value; else if(operator==='lte') pass=actual<=value; else pass=false;
  return {outcome:pass?'pass':'fail',code:pass?null:'ATTRIBUTE_CONSTRAINT_FAILED'}; }
