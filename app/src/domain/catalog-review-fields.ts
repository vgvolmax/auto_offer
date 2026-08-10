import type {CatalogItem} from './catalog';
import {createBrowserValidationContext} from '../validation/create-browser-validation-context';

export type CatalogEditField={jsonPointer:string;fieldId:string;portIndex?:number;kind:'enum'|'number'|'boolean'|'rational_inch'|'unsupported';required:boolean;currentValue?:unknown;options?:Array<{value:unknown;taxonomyLabel?:string}>;confirmedAt?:string;technicalReason?:string};
const pointerValue=(item:CatalogItem,pointer:string)=>pointer.slice(1).split('/').reduce<unknown>((value,key)=>value&&typeof value==='object'?(value as Record<string,unknown>)[key]:undefined,item);
export function buildCatalogEditFields(item:CatalogItem):CatalogEditField[]{
  if(!item.class_id)return[];const {taxonomy}=createBrowserValidationContext(),classDefinition=(taxonomy.classes as Record<string,any>)[item.class_id];if(!classDefinition)return[];
  const annotation=item.annotation??{},pointers=[...(annotation.unknown_fields??[]),...(annotation.issues??[]).map(x=>x.json_pointer).filter(Boolean),...(annotation.ambiguities??[]).filter(x=>x.blocking!==false).map(x=>x.json_pointer),...(annotation.operator_confirmations??[]).map(x=>x.json_pointer)];
  return [...new Set(pointers.filter((x):x is string=>Boolean(x)))].map(jsonPointer=>{
    const attribute=/^\/attributes\/([^/]+)$/.exec(jsonPointer),port=/^\/ports\/(\d+)\/([^/]+)$/.exec(jsonPointer);let definition:any,fieldId:string,portIndex:number|undefined;
    if(attribute){fieldId=attribute[1];definition=classDefinition.attributes?.[fieldId]}
    else if(port){portIndex=Number(port[1]);fieldId=port[2];const slot=classDefinition.ports?.catalog_ordered_slots?.[portIndex];definition=fieldId==='connection_kind'?slot?.connection_kind:fieldId==='system'?slot?.system:slot?.allowed_fields?.includes(fieldId)?{type:fieldId==='thread_size'?'rational_inch':'number'}:undefined}
    else return{jsonPointer,fieldId:jsonPointer.split('/').at(-1)??jsonPointer,kind:'unsupported',required:true,technicalReason:'Путь не поддерживается редактором'};
    if(!definition)return{jsonPointer,fieldId,portIndex,kind:'unsupported',required:true,technicalReason:'Поле отсутствует в контракте класса'};
    const enumValues=definition.value_set_ref?Object.entries((taxonomy.value_sets as Record<string,any>)[definition.value_set_ref]?.values??{}).map(([value,entry]:[string,any])=>({value,taxonomyLabel:entry.name_ru})):definition.fixed?[definition.fixed]:(definition.allowed??[]);
    const kind:CatalogEditField['kind']=definition.type==='enum'||definition.allowed||definition.fixed?'enum':definition.type==='boolean'?'boolean':definition.type==='rational_inch'?'rational_inch':definition.type==='number'?'number':'unsupported';
    return{jsonPointer,fieldId,portIndex,kind,required:definition.required_for_validated!==false,currentValue:pointerValue(item,jsonPointer),options:kind==='enum'?enumValues.map((entry:any)=>typeof entry==='object'&&'value'in entry?entry:{value:entry}):undefined,confirmedAt:annotation.operator_confirmations?.find(x=>x.json_pointer===jsonPointer)?.confirmed_at,...(kind==='unsupported'?{technicalReason:`Тип ${definition.type??'не указан'} не поддерживается редактором`}:{})};
  });
}
