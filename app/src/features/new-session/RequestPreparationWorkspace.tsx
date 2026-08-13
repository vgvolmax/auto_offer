import {useState} from 'react';
import {FileDropzone} from '../../components/FileDropzone';
import {assertBundleMatchesRequestSource,prepareRequestRouting,type RequestSource} from '../../domain/request-preparation';
import type {RequestBundle} from '../../domain/session';
import {downloadJsonFile,downloadTextFile} from '../../lib/download-file';
import {validateRequestBundle} from '../../validation/validate-request-bundle';
import preparePrompt from '../../../../annotation-kits/request/REQUEST_PREPARE_PROMPT.md?raw';
import annotationPrompt from '../../../../annotation-kits/request/REQUEST_ANNOTATION_PROMPT.md?raw';
import taxonomyLight from '../../../../taxonomy/taxonomy-light.json';

type Preparation=ReturnType<typeof prepareRequestRouting>;
export function RequestPreparationWorkspace({onBundleReady}:{onBundleReady:(bundle:RequestBundle,fileName:string)=>void}) {
  const [original,setOriginal]=useState<File>();
  const [preparation,setPreparation]=useState<Preparation>();
  const [message,setMessage]=useState('Сначала выберите исходную заявку.');
  async function importStep1(files:File[]) {
    try {
      const values=await Promise.all(files.map(async file=>{try{return JSON.parse(await file.text()) as {kind?:string}}catch{throw new Error(`Файл ${file.name} содержит некорректный JSON`)}}));
      const sources=values.filter(value=>value.kind==='request_source'),routings=values.filter(value=>value.kind==='request_routing');
      if(values.some(value=>!['request_source','request_routing'].includes(value.kind??''))) throw new Error('Загружен JSON неизвестного типа');
      if(sources.length>1) throw new Error('Загружены два request-source.json');
      if(routings.length>1) throw new Error('Загружены два request-routing.json');
      if(!sources.length) throw new Error('Не найден request-source.json');
      if(!routings.length) throw new Error('Не найден request-routing.json');
      const next=prepareRequestRouting({requestSource:sources[0],requestRouting:routings[0],originalFileName:original!.name});
      setPreparation(next);setMessage('Разметка классов проверена');
    } catch(error) { setMessage(`${error instanceof Error?error.message:'Файлы не прошли проверку'}${preparation?' Новые файлы не прошли проверку. Предыдущий корректный результат сохранён.':''}`); }
  }
  async function importBundle(files:File[]) {
    const file=files[0];if(!file||!preparation)return;
    try {const raw=JSON.parse(await file.text());const result=validateRequestBundle(raw);if(!result.valid)throw new Error(result.errors[0]?.message??'Bundle не прошёл проверку');assertBundleMatchesRequestSource(raw as RequestBundle,preparation.requestSource as RequestSource);onBundleReady(raw as RequestBundle,file.name);setMessage('Финальная заявка проверена');} catch(error){setMessage(`${error instanceof Error?error.message:'Файл не прочитан'}. Предыдущий корректный результат сохранён.`)}
  }
  return <section aria-label="Подготовить заявку">
    <div className="card"><h2>1. Исходная заявка</h2><FileDropzone accept="*/*" label="Выберите исходный документ заявки" onFiles={files=>{if(files[0]){setOriginal(files[0]);setPreparation(undefined);setMessage(`Выбран файл: ${files[0].name}`)}}}/>{original&&<p><b>{original.name}</b></p>}</div>
    <div className="card"><h2>2. Определить классы товаров</h2><ol><li>Скачайте два файла.</li><li>Создайте новый чат с LLM.</li><li>Приложите исходную заявку, REQUEST_PREPARE_PROMPT.md и taxonomy-light.json.</li><li>Получите два JSON и загрузите их сюда.</li></ol><div className="actions"><button className="button button--secondary" disabled={!original} onClick={()=>downloadTextFile('REQUEST_PREPARE_PROMPT.md',preparePrompt,'text/markdown;charset=utf-8')}>Скачать промпт STEP 1</button><button className="button button--secondary" disabled={!original} onClick={()=>downloadJsonFile('taxonomy-light.json',taxonomyLight)}>Скачать light taxonomy</button></div><FileDropzone multiple disabled={!original} label="Загрузите два JSON из STEP 1" onFiles={importStep1}/><p role="status">{message}</p>{preparation&&<p><b>Разметка классов проверена</b><br/>{preparation.summary.lineCount} строк · {preparation.summary.selectedClassCount} классов выбрано · {preparation.summary.unsupportedCount} строк вне taxonomy</p>}</div>
    {preparation&&<div className="card"><h2>3. Разметить характеристики заявки</h2><p><strong>Создайте обязательно новый чат.</strong> Приложите только три файла ниже.</p><p>Не прикладывайте оригинальную заявку, taxonomy-light, STEP 1 prompt, полный annotation kit или каталоги.</p><div className="actions"><button className="button button--secondary" onClick={()=>downloadTextFile('REQUEST_ANNOTATION_PROMPT.md',annotationPrompt,'text/markdown;charset=utf-8')}>Скачать промпт STEP 2</button><button className="button button--secondary" onClick={()=>downloadJsonFile('request-source.json',preparation.requestSource)}>Скачать request-source.json</button><button className="button button--secondary" onClick={()=>downloadJsonFile('request-selected-kit.json',preparation.selectedKit)}>Скачать selected kit</button></div><FileDropzone label="Загрузите request_bundle.json из STEP 2" onFiles={importBundle}/></div>}
  </section>;
}
