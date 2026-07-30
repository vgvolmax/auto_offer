const rank={exact:0,equivalent:1,alternative:2}; const lineLevel={exact_only:'exact',equivalent_allowed:'equivalent',alternative_allowed:'alternative'};
export function effectiveMaximumMatchLevel(statement, session) { const requested=lineLevel[statement?.policy]??session; return rank[requested] < rank[session] ? requested : session; }
export const matchLevelAllowed=(level,max)=>rank[level]<=rank[max];
