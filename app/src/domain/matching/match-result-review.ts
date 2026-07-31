import type { CatalogRecord } from "../catalog";
import type { SessionRecord } from "../session";
import type { MatchRunRecord } from "./match-run";
import { formatMatchTarget, formatMatchValue, getReasonCodeLabel } from "./match-result-labels";
import { equalOfferRefs, offerRefKey, type OfferRef } from "./offer-ref";
import { SelectionError, type SelectionStateRecord } from "./selection-state";
export type MatchLevel = "exact" | "equivalent" | "alternative";
export type CandidateAvailability = "eligible" | "manual_only";
export type MatchLineResolution = "single_exact" | "multiple_exact" | "equivalent_only" | "alternative_only" | "excluded_by_policy" | "no_match" | "request_review_required" | "request_invalid";
export interface MatchCheckView { scope:string; target:string; operator?:string; expected?:string; actual?:string; outcome:string; effect:string; code:string; label:string }
export interface CandidateReviewView { key:string; offerRef:OfferRef; catalogLabel:string; sourceItemId:string; productLabel:string; classId?:string; brand?:string; matchLevel:MatchLevel; availability:CandidateAvailability; checks:MatchCheckView[]; differences:MatchCheckView[]; selected:boolean; suggested:boolean; selectable:boolean }
export interface ExcludedCandidateReviewView extends CandidateReviewView { exclusionCodes:string[] }
export interface MatchLineReviewView { lineId:string; position:number; requestText:string; quantityLabel?:string; classId?:string; resolution:MatchLineResolution; candidates:CandidateReviewView[]; excludedCandidates:ExcludedCandidateReviewView[]; rejectionSummary:Array<{code:string;label:string;count:number}>; selectedOfferRef?:OfferRef; hasSelection:boolean; selectable:boolean }
export interface MatchResultReviewDiagnostic { code:"RESULT_LINE_INVALID"|"REQUEST_LINE_MISSING"|"CATALOG_RECORD_REFERENCE_MISSING"|"CATALOG_ITEM_REFERENCE_MISSING"|"SELECTION_CANDIDATE_MISSING"; path:string; message:string }
export interface MatchResultReviewView { runId:string; current:boolean; lines:MatchLineReviewView[]; selectedCount:number; selectableLineCount:number; unresolvedSelectableCount:number; diagnostics:MatchResultReviewDiagnostic[] }
type Obj = Record<string, unknown>;
const object = (x: unknown): x is Obj => typeof x === "object" && x !== null && !Array.isArray(x);
const text = (x: unknown) => typeof x === "string" ? x : undefined;
const array = (x: unknown): unknown[] => Array.isArray(x) ? x : [];
function offer(x: unknown): OfferRef | undefined { if (!object(x)) return; const values=[x.catalog_record_id,x.catalog_id,x.source_sha256,x.source_item_id]; if(values.every(v=>typeof v==="string")) return x as unknown as OfferRef; }
export function getCatalogItemDisplayLabel(item: unknown, fallback: string): string { if(!object(item)) return fallback; for(const key of ["raw_text","name","product_name","title"]){const value=text(item[key])?.trim();if(value)return value} const brand=text(item.brand)?.trim(); return brand ? `${brand} ${fallback}` : fallback; }
function itemData(raw: unknown): Obj | undefined { if(!object(raw))return; return object(raw.catalog_item) ? raw.catalog_item : raw; }
function check(raw: unknown): MatchCheckView | undefined { if(!object(raw))return; const code=text(raw.code)??"UNKNOWN"; return { scope:text(raw.scope)??"", target:formatMatchTarget(raw.target), operator:text(raw.operator), expected:formatMatchValue(raw.expected), actual:formatMatchValue(raw.actual), outcome:text(raw.outcome)??"", effect:text(raw.effect)??"", code, label:getReasonCodeLabel(code) }; }

export function buildMatchResultReviewView(input:{session:SessionRecord;catalogs:readonly CatalogRecord[];run:MatchRunRecord;selectionState:SelectionStateRecord;current:boolean}):MatchResultReviewView {
  const {run,selectionState}=input;
  if(selectionState.matchRunId!==run.id||selectionState.sessionId!==run.sessionId||selectionState.inputFingerprint!==run.result.input_fingerprint) throw new SelectionError("SelectionState не соответствует запуску", "SELECTION_STATE_RUN_MISMATCH");
  const diagnostics:MatchResultReviewDiagnostic[]=[];
  const requests=new Map(input.session.requestBundle.request_document.lines.map(x=>[x.line_id,x]));
  const catalogs=new Map(input.catalogs.map(c=>[c.recordId,c]));
  const items=new Map<string,Obj>();
  for(const catalog of input.catalogs) for(const raw of catalog.bundle.items){ const data=itemData(raw); const id=data&&text(data.source_item_id); if(id) items.set(offerRefKey({catalog_record_id:catalog.recordId,catalog_id:catalog.catalogId,source_sha256:catalog.sourceSha256,source_item_id:id}),data); }
  const lines:MatchLineReviewView[]=[];
  array(run.result.lines).forEach((raw,index)=>{
    if(!object(raw)||!text(raw.line_id)){diagnostics.push({code:"RESULT_LINE_INVALID",path:`lines[${index}]`,message:"Повреждённая строка результата"});return}
    const lineId=text(raw.line_id)!; const request=requests.get(lineId);
    if(!request) diagnostics.push({code:"REQUEST_LINE_MISSING",path:`lines[${index}]`,message:`Строка ${lineId} отсутствует в заявке`});
    const decision=selectionState.decisions[lineId]; let brokenSelection=false;
    const mapCandidate=(value:unknown,excluded:boolean):CandidateReviewView|ExcludedCandidateReviewView|undefined=>{
      if(!object(value))return; const ref=offer(value.offer_ref); if(!ref)return;
      const catalog=catalogs.get(ref.catalog_record_id); const found=items.get(offerRefKey(ref));
      if(!catalog) diagnostics.push({code:"CATALOG_RECORD_REFERENCE_MISSING",path:`${lineId}.${ref.source_item_id}`,message:"Версия каталога не найдена"});
      else if(!found) diagnostics.push({code:"CATALOG_ITEM_REFERENCE_MISSING",path:`${lineId}.${ref.source_item_id}`,message:"Товар каталога не найден"});
      const selected=Boolean(decision&&equalOfferRefs(decision.offerRef,ref));
      const base:CandidateReviewView={key:offerRefKey(ref),offerRef:ref,catalogLabel:catalog?.sourceFileName??ref.catalog_id,sourceItemId:ref.source_item_id,productLabel:found?getCatalogItemDisplayLabel(found,ref.source_item_id):"Товар не найден в сохранённой версии каталога",classId:found&&text(found.class_id),brand:found&&text(found.brand),matchLevel:(text(value.match_level)??"alternative") as MatchLevel,availability:(text(value.availability)??"eligible") as CandidateAvailability,checks:array(value.checks).map(check).filter((x):x is MatchCheckView=>Boolean(x)),differences:array(value.differences).map(check).filter((x):x is MatchCheckView=>Boolean(x)),selected,suggested:false,selectable:input.current&&!excluded&&Boolean(found)};
      return excluded?{...base,selectable:false,exclusionCodes:array(value.exclusion_codes).map(String)}:base;
    };
    const candidates=array(raw.candidates).map(x=>mapCandidate(x,false)).filter((x):x is CandidateReviewView=>Boolean(x));
    const excluded=array(raw.excluded_candidates).map(x=>mapCandidate(x,true)).filter((x):x is ExcludedCandidateReviewView=>Boolean(x));
    if(decision&&!candidates.some(c=>c.selected)){brokenSelection=true;diagnostics.push({code:"SELECTION_CANDIDATE_MISSING",path:`decisions.${lineId}`,message:"Выбранное предложение отсутствует в запуске"});}
    const resolution=(text(raw.resolution)??"request_invalid") as MatchLineResolution;
    if(resolution==="single_exact"){const suggested=candidates.find(c=>c.selectable&&c.matchLevel==="exact");if(suggested)suggested.suggested=true}
    const quantity=request?.quantity; const quantityLabel=quantity?`${quantity.value} ${quantity.unit}`:undefined;
    lines.push({lineId,position:index+1,requestText:request?.raw_text??"Техническая ошибка строки",quantityLabel,classId:request?.class_id,resolution,candidates,excludedCandidates:excluded,rejectionSummary:array(raw.rejection_summary).filter(object).map(r=>({code:text(r.code)??"UNKNOWN",label:getReasonCodeLabel(text(r.code)??"UNKNOWN"),count:typeof r.count==="number"?r.count:0})),selectedOfferRef:decision?.offerRef,hasSelection:Boolean(decision),selectable:!brokenSelection&&candidates.some(c=>c.selectable)});
  });
  return {runId:run.id,current:input.current,lines,selectedCount:lines.filter(x=>x.hasSelection).length,selectableLineCount:lines.filter(x=>x.candidates.length>0).length,unresolvedSelectableCount:lines.filter(x=>x.selectable&&!x.hasSelection).length,diagnostics};
}
