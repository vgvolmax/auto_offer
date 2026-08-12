import fullKit from '../../../annotation-kits/request-annotation-kit.json';
import taxonomyLight from '../../../taxonomy/taxonomy-light.json';
import {buildSelectedRequestKitFromRouting} from '../../../scripts/chat-pipeline/lib/request-selected-kit-from-routing.mjs';
import {validateSelectedRequestKit} from '../../../scripts/annotation-kits/lib/request-selected-kit.mjs';
import {createBrowserValidationContext} from '../validation/create-browser-validation-context';
import type {RequestBundle} from './session';

export type RequestSource={kind:'request_source';source_file:string;line_count:number;lines:Array<{line_id:string;raw_text:string;quantity_raw:string|null}>};
export type RequestRouting={kind:'request_routing';source_file:string;line_count:number;taxonomy_version:string;routes:unknown[]};
export function prepareRequestRouting({requestSource,requestRouting,originalFileName}:{requestSource:unknown;requestRouting:unknown;originalFileName:string}) {
  const context=createBrowserValidationContext();
  const source=requestSource as RequestSource,routing=requestRouting as RequestRouting;
  if(source?.source_file!==originalFileName) throw new Error(`request-source создан для другого исходного файла: ожидался ${originalFileName}, получен ${source?.source_file??'не указан'}`);
  const validators={requestSource:context.requestSourceValidator,routing:context.requestRoutingValidator,taxonomyLight:context.taxonomyLightValidator};
  const selectedKit=buildSelectedRequestKitFromRouting({fullKit,requestSource:source,routing,taxonomyLight,validators});
  validateSelectedRequestKit(fullKit,selectedKit,source);
  const unsupportedCount=(selectedKit.unsupported_lines as unknown[]).length;
  return {requestSource:source,requestRouting:routing,selectedKit,summary:{lineCount:source.line_count,selectedClassCount:selectedKit.selected_class_ids.length,unsupportedCount}};
}
export function assertBundleMatchesRequestSource(bundle:RequestBundle,source:RequestSource) {
  const lines=bundle.request_document.lines;
  if(lines.length!==source.lines.length||lines.some((line,index)=>line.line_id!==source.lines[index].line_id||line.raw_text!==source.lines[index].raw_text)) throw new Error('Финальный JSON относится к другой заявке');
}
