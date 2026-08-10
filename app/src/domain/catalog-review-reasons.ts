import type {CatalogAnnotation,CatalogIssue} from './catalog';

export function getIssueMissingPaths(issue:CatalogIssue):string[]{
  if(!issue.details||typeof issue.details!=='object'||Array.isArray(issue.details))return[];
  const paths=(issue.details as Record<string,unknown>).missing_paths;
  return Array.isArray(paths)?paths.filter((path):path is string=>typeof path==='string'):[];
}

export function collectUnresolvedReviewPointers(annotation:CatalogAnnotation):string[]{
  return [...new Set([
    ...(annotation.unknown_fields??[]),
    ...(annotation.issues??[]).flatMap(issue=>[...(issue.json_pointer?[issue.json_pointer]:[]),...getIssueMissingPaths(issue)]),
    ...(annotation.ambiguities??[]).filter(ambiguity=>ambiguity.blocking!==false).flatMap(ambiguity=>ambiguity.json_pointer?[ambiguity.json_pointer]:[]),
  ])];
}

export function countUnresolvedReviewReasons(annotation:CatalogAnnotation):number{
  const fieldPointers=collectUnresolvedReviewPointers(annotation);
  const genericIssues=(annotation.issues??[]).filter(issue=>!issue.json_pointer&&!getIssueMissingPaths(issue).length).length;
  const genericAmbiguities=(annotation.ambiguities??[]).filter(ambiguity=>ambiguity.blocking!==false&&!ambiguity.json_pointer).length;
  return fieldPointers.length+genericIssues+genericAmbiguities;
}

export function resolveReviewReasonForPointer(annotation:CatalogAnnotation,pointer:string):CatalogAnnotation{
  return {
    ...annotation,
    unknown_fields:(annotation.unknown_fields??[]).filter(value=>value!==pointer),
    ambiguities:(annotation.ambiguities??[]).filter(value=>value.json_pointer!==pointer),
    issues:(annotation.issues??[]).flatMap(issue=>{
      if(issue.json_pointer===pointer)return[];
      const missingPaths=getIssueMissingPaths(issue);
      if(!missingPaths.includes(pointer))return[issue];
      const remaining=missingPaths.filter(value=>value!==pointer);
      if(!remaining.length&&!issue.json_pointer)return[];
      return [{...issue,details:{...(issue.details as Record<string,unknown>),missing_paths:remaining}}];
    }),
  };
}
