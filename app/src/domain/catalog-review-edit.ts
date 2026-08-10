import {getCatalogItemStatusCounts,type CatalogRecord} from './catalog';
import {validateCatalogBundle} from '../validation/validate-catalog-bundle';
import {createBrowserValidationContext} from '../validation/create-browser-validation-context';
import {countUnresolvedReviewReasons,resolveReviewReasonForPointer} from './catalog-review-reasons';

export type CatalogManualEdit={jsonPointer:string;value:unknown};
export type CatalogReviewEditFailure={ok:false;code:'ITEM_NOT_FOUND'|'ITEM_NOT_EDITABLE'|'EDIT_PATH_NOT_ALLOWED'|'INVALID_EDIT';message:string;errors?:Array<{code:string;path?:string;message:string}>};
export type CatalogReviewEditResult={ok:true;record:CatalogRecord;becameValidated:boolean;remainingReviewCount:number}|CatalogReviewEditFailure;
const decode=(token:string)=>token.replaceAll('~1','/').replaceAll('~0','~');
const matches=(pattern:string,pointer:string)=>{const a=pattern.split('/'),b=pointer.split('/');return a.length===b.length&&a.every((part,index)=>part==='*'||part===b[index])};
function setAt(root:Record<string,unknown>,pointer:string,value:unknown){
  if(!/^\/(?:[^~/]|~[01])+(?:\/(?:[^~/]|~[01])+)*$/.test(pointer))return false;
  const tokens=pointer.slice(1).split('/').map(decode);let target:unknown=root;
  for(const token of tokens.slice(0,-1)){if(!target||typeof target!=='object'||!(token in target))return false;target=(target as Record<string,unknown>)[token]}
  if(!target||typeof target!=='object')return false;(target as Record<string,unknown>)[tokens.at(-1)!]=value;return true;
}
type PortSlot={role:string;connection_kind?:{fixed?:unknown};system?:{fixed?:unknown}};
function setCatalogSemanticValue(item:Record<string,unknown>,classDefinition:Record<string,any>,pointer:string,value:unknown){
  const portMatch=/^\/ports\/(\d+)\/([^/]+)$/.exec(pointer);
  if(portMatch){
    const index=Number(portMatch[1]),ports=item.ports;
    if(!Array.isArray(ports)||index>ports.length)return false;
    if(index===ports.length){
      const slot=classDefinition.ports?.catalog_ordered_slots?.[index] as PortSlot|undefined;
      if(!slot)return false;
      const port:Record<string,unknown>={role:slot.role};
      if(slot.connection_kind?.fixed!==undefined)port.connection_kind=slot.connection_kind.fixed;
      if(slot.system?.fixed!==undefined)port.system=slot.system.fixed;
      ports.push(port);
    }
  }
  return setAt(item,pointer,value);
}

export function applyCatalogReviewEdits(input:{record:CatalogRecord;sourceItemId:string;edits:CatalogManualEdit[];now:string}):CatalogReviewEditResult{
  const indexes=input.record.bundle.items.map((entry,index)=>entry.catalog_item?.source_item_id===input.sourceItemId?index:-1).filter(index=>index>=0);
  if(indexes.length!==1)return{ok:false,code:'ITEM_NOT_FOUND',message:'Позиция каталога не найдена однозначно'};
  const next=structuredClone(input.record),item=next.bundle.items[indexes[0]].catalog_item!;
  if(item.annotation?.status!=='needs_review'||!item.class_id)return{ok:false,code:'ITEM_NOT_EDITABLE',message:'В PR3 редактируются только типизированные позиции, требующие проверки'};
  const context=createBrowserValidationContext(),registration=(context.registry.classes as Record<string,{allowed_annotation_paths?:string[]}>)[item.class_id];
  const classDefinition=(context.taxonomy.classes as Record<string,Record<string,any>>)[item.class_id];
  const allowed=(registration as {allowed_annotation_paths?:string[]}|undefined)?.allowed_annotation_paths??[];
  for(const edit of input.edits){
    if(!classDefinition||!allowed.some(pattern=>matches(pattern,edit.jsonPointer))||!setCatalogSemanticValue(item,classDefinition,edit.jsonPointer,edit.value))return{ok:false,code:'EDIT_PATH_NOT_ALLOWED',message:`Поле ${edit.jsonPointer} нельзя редактировать`};
    item.annotation=resolveReviewReasonForPointer(item.annotation!,edit.jsonPointer);
    const annotation=item.annotation;
    annotation.evidence=(annotation.evidence??[]).filter(value=>value.json_pointer!==edit.jsonPointer);
    annotation.operator_confirmations=[...(annotation.operator_confirmations??[]).filter(value=>value.json_pointer!==edit.jsonPointer),{json_pointer:edit.jsonPointer,value:structuredClone(edit.value),confirmed_at:input.now}];
  }
  const reviewCount=countUnresolvedReviewReasons(item.annotation!);item.annotation!.status=reviewCount?'needs_review':'validated';
  const validation=validateCatalogBundle(next.bundle);
  if(!validation.valid)return{ok:false,code:'INVALID_EDIT',message:'Значение не соответствует правилам каталога',errors:validation.errors.map(x=>({code:x.code,path:x.path,message:x.message}))};
  const counts=getCatalogItemStatusCounts(next.bundle);next.validatedCount=counts.validated;next.needsReviewCount=counts.needsReview;next.semanticRevision=(input.record.semanticRevision??0)+1;next.updatedAt=input.now;
  return{ok:true,record:next,becameValidated:item.annotation.status==='validated',remainingReviewCount:reviewCount};
}
