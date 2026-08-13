declare module '*.md?raw' { const content:string; export default content; }
declare module '*request-selected-kit-from-routing.mjs' { export function buildSelectedRequestKitFromRouting(input:any):any; }
declare module '*request-selected-kit.mjs' { export function validateSelectedRequestKit(fullKit:any,selectedKit:any,source:any):true; }
