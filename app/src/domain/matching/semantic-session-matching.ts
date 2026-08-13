import { buildSemanticMatchingCatalog } from "../../../../scripts/chat-pipeline/lib/semantic-matching-catalog.mjs";
import { validateSemanticMatchResultObjects } from "../../../../scripts/chat-pipeline/lib/semantic-match-result-core.mjs";
import type { AppRepositories } from "../../storage/repositories";
import { createBrowserValidationContext } from "../../validation/create-browser-validation-context";
import type { SessionMatchingSettings } from "./session-policy";
import { saveSessionMatchingSettings, SessionMatchingError } from "./run-session-matching";
import type { SemanticMatchResult, SemanticSelectionPolicy } from "./semantic-types";

export function buildSemanticSelectionPolicy(settings:SessionMatchingSettings):SemanticSelectionPolicy{return {max_match_level:settings.maxMatchLevel,catalog_needs_review:settings.catalogNeedsReview,brands:{include:[...settings.brands.include],exclude:[...settings.brands.exclude],preferred:[...settings.brands.preferred],unknown:settings.brands.unknown},catalog_priority:[...settings.catalogPriority]};}
async function loadCatalogs(session:{catalogRecordIds:string[]},repositories:AppRepositories){const catalogs=[];for(const id of session.catalogRecordIds){const catalog=await repositories.catalogs.get(id);if(!catalog)throw new SessionMatchingError(`Каталог ${id} не найден`,"CATALOG_RECORD_MISSING",id);catalogs.push(catalog);}return catalogs;}
export async function prepareSemanticMatchingPackage(input:{sessionId:string;settings:SessionMatchingSettings;repositories:AppRepositories}){
  const initial=await input.repositories.sessions.get(input.sessionId);if(!initial)throw new SessionMatchingError("Сессия не найдена","SESSION_NOT_FOUND");if(initial.status!=="draft")throw new SessionMatchingError("Подтверждённый результат доступен только для просмотра","SESSION_CONFIRMED");
  const session=await saveSessionMatchingSettings(input);const catalogs=await loadCatalogs(session,input.repositories);const selectionPolicy=buildSemanticSelectionPolicy(session.matchingSettings);
  const matchingCatalog=await buildSemanticMatchingCatalog({requestBundle:session.requestBundle,catalogs,selectionPolicy});return {session,matchingCatalog};
}
const importErrorMessages: Record<string, string> = {
  FINGERPRINT_MISMATCH: "Результат создан для другого пакета подбора",
  PACKAGE_TAMPERED: "Заявка, каталоги или настройки изменились после подготовки файлов",
  REQUEST_ID_MISMATCH: "Результат относится к другой заявке",
  UNKNOWN_OR_AMBIGUOUS_OFFER: "В результате указан товар, которого нет в подготовленном ассортименте",
  CLASS_MISMATCH: "Выбран товар другого класса",
  MATCH_LEVEL_EXCEEDED: "Результат превышает разрешённый уровень замены",
  BRAND_POLICY_VIOLATION: "Результат нарушает ограничения по брендам",
};
export class SemanticImportError extends Error {
  constructor(
    message: string,
    public readonly errors: Array<{ code: string; path: string; message: string }> = [],
  ) {
    super(message);
    this.name = "SemanticImportError";
  }
}
export function getSemanticImportErrorMessage(errors: SemanticImportError["errors"]): string {
  const first = errors[0];
  if (!first) return "JSON результата имеет неверный формат";
  return importErrorMessages[first.code]
    ?? (first.code.includes("SCHEMA") || first.code.includes("VALIDATION")
      ? "JSON результата имеет неверный формат"
      : "Файл результата не соответствует текущей сессии");
}
export async function importSemanticMatchResult(input:{sessionId:string;semanticResult:unknown;repositories:AppRepositories}){
 const session=await input.repositories.sessions.get(input.sessionId);if(!session)throw new SessionMatchingError("Сессия не найдена","SESSION_NOT_FOUND");if(session.status!=="draft")throw new SessionMatchingError("Подтверждённый результат доступен только для просмотра","SESSION_CONFIRMED");
 const catalogs=await loadCatalogs(session,input.repositories),selectionPolicy=buildSemanticSelectionPolicy(session.matchingSettings),matchingCatalog=await buildSemanticMatchingCatalog({requestBundle:session.requestBundle,catalogs,selectionPolicy});
 const validation=createBrowserValidationContext();const checked=await validateSemanticMatchResultObjects({result:input.semanticResult,requestBundle:session.requestBundle,matchingCatalog,validators:{requestBundle:validation.requestBundleValidator,matchingCatalog:validation.semanticMatchingCatalogValidator,result:validation.semanticMatchResultValidator}});if(!checked.valid){const errors=checked.errors??[];throw new SemanticImportError(getSemanticImportErrorMessage(errors),errors);}
 const result=input.semanticResult as SemanticMatchResult;const runRecord=await input.repositories.matchRuns.saveLatest({sessionId:session.sessionId,expectedSessionRevision:session.matchingRevision,result,runKind:"semantic",semanticContext:{taxonomyVersion:matchingCatalog.taxonomy_version,requestId:matchingCatalog.request_id,packageFingerprint:matchingCatalog.package_fingerprint,selectionPolicy,catalogRefs:matchingCatalog.catalog_refs}});return {session:{...session,latestMatchRunId:runRecord.id,updatedAt:runRecord.createdAt},runRecord};
}
