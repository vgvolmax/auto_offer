export interface ValidationIssue {code:string;path:string;message:string;details?:unknown}
export interface ValidationResult {valid:boolean;kind:'catalog_bundle'|'request_bundle';errors:ValidationIssue[];summary:{records:number;taxonomy_version?:string}}
export function validateCatalogBundle(bundle:unknown,context:unknown):ValidationResult;
export function validateRequestBundle(bundle:unknown,context:unknown):ValidationResult;
