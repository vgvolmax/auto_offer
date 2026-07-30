import { evaluateConstraint } from './constraint-evaluator.mjs';
import { resolveTarget } from './target-resolver.mjs';
const rank={exact:0,equivalent:1,alternative:2};
const raise=(state,level)=>{if(rank[level]>rank[state.level]) state.level=level};
export function evaluateCandidate(req,candidate,registry,effectiveMax) {
 const state={level:'exact',rejected:new Set(),reason:null}; const rules=registry.class_rules?.[req.class_id]??{};
 const hard=new Set((rules.hard_targets??[]).map(key)); const equivalents=new Map((rules.equivalent_rules??[]).map(r=>[key(r.target),r])); const alternatives=new Map((rules.alternative_rules??[]).map(r=>[key(r.target),r]));
 for(const [field,constraint] of Object.entries(req.constraints.attributes??{})) evaluate({kind:'attribute',field},constraint,candidate.attributes[field],state,hard,equivalents,alternatives,effectiveMax,'ATTRIBUTE_CONSTRAINT_FAILED');
 for(const requested of req.ports??[]) { const actualPort=candidate.ports.find(p=>p.role===requested.role); if(!actualPort){state.rejected.add('PORT_ROLE_MISSING');continue;} for(const [field,constraint] of Object.entries(requested)) if(field!=='role') evaluate({kind:'port',role:requested.role,field},constraint,actualPort[field],state,hard,equivalents,alternatives,effectiveMax,'PORT_CONSTRAINT_FAILED'); }
 for(const [field,constraint] of Object.entries(req.requested_identity??{})) { const actual=candidate.identity[field]; const r=evaluateConstraint(constraint,actual); if(r.outcome==='pass') continue; if(constraint.operator==='neq'){state.rejected.add('IDENTITY_EXCLUDED');continue;} if(r.outcome==='missing'){state.rejected.add('CATALOG_VALUE_MISSING');continue;} if(effectiveMax==='exact') state.rejected.add('IDENTITY_DIFFERENCE'); else {raise(state,'equivalent');state.reason='IDENTITY_DIFFERENCE';} }
 return state;
}
function key(t){return `${t.kind}:${t.role??''}:${t.field}`}
function evaluate(target,constraint,actual,state,hard,equivalents,alternatives,max,failure) { const result=evaluateConstraint(constraint,actual); if(result.outcome==='pass') return; if(result.outcome==='missing'){state.rejected.add('CATALOG_VALUE_MISSING');return;} const k=key(target); if(constraint.operator==='neq'||hard.has(k)){state.rejected.add(failure);return;} const eq=equivalents.get(k); if(eq&&constraint.operator==='eq'&&max!=='exact'){const a=eq.ordered_values.indexOf(constraint.value),b=eq.ordered_values.indexOf(actual);if(a>=0&&b>a){raise(state,'equivalent');state.reason='ATTRIBUTE_DIFFERENCE';return;}}
 if(alternatives.has(k)&&max==='alternative'){raise(state,'alternative');state.reason='ATTRIBUTE_DIFFERENCE';return;} state.rejected.add(failure); }
