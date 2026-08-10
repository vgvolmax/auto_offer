import type {CatalogEditField} from '../../domain/catalog-review-fields';
import {createBrowserValidationContext} from '../../validation/create-browser-validation-context';
const labels:Record<string,string>={profile:'Пресс-профиль',construction:'Тип фитинга',connection_kind:'Тип соединения',system:'Система труб',pipe_outer_diameter_mm:'Наружный диаметр трубы',pipe_wall_thickness_mm:'Толщина стенки трубы',nominal_diameter_dn:'Условный диаметр DN',thread_size:'Размер резьбы',thread_standard:'Стандарт резьбы',control_equipment:'Тип регулирующего оборудования',handle_type:'Тип рукоятки',body_material:'Материал',material:'Материал',tool_kind:'Тип инструмента'};
const values:Record<string,string>={adapter:'Переходник',cap:'Заглушка',coupling:'Муфта',cross:'Крестовина',elbow:'Угольник',flange_adapter:'Фланцевый адаптер',nipple:'Ниппель',plug:'Пробка',reducer:'Переход',repair_coupling:'Ремонтная муфта',saddle:'Седелка',tee:'Тройник',union:'Разъёмное соединение',cleanout:'Ревизия',compensator:'Компенсационный патрубок',male_thread:'Наружная резьба',female_thread:'Внутренняя резьба',radial_press:'Радиальный пресс',axial_press:'Аксиальный пресс',compression:'Компрессионное соединение',socket_fusion:'Раструбная сварка',flange:'Фланец',sewer_socket:'Раструб',sewer_spigot:'Гладкий конец',lever:'Рычаг',butterfly:'Бабочка',wheel:'Маховик',removable_key:'Съёмная рукоятка',flowmeters:'Расходомеры',manual_valves:'Ручные клапаны',thermostatic_valves:'Термостатические клапаны',press_tool:'Пресс-инструмент',calibrator:'Калибратор',cutter:'Труборез',brass:'Латунь',stainless_steel:'Нержавеющая сталь'};
const humanize=(id:string)=>id.replaceAll('_',' ').replace(/^./,x=>x.toUpperCase());
export function fieldLabel(field:CatalogEditField){const base=labels[field.fieldId]??humanize(field.fieldId);return field.portIndex===undefined?base:`${base} — сторона ${field.portIndex+1}`}
export function valueLabel(value:unknown,taxonomyLabel?:string){if(typeof value!=='string')return String(value);return values[value]??taxonomyLabel??humanize(value)}
export function classLabel(classId?:string){
  if(!classId)return'Тип товара не указан';
  const definition=(createBrowserValidationContext().taxonomy.classes as Record<string,{name_ru?:string}>)[classId];
  return definition?.name_ru??humanize(classId.split('.').at(-1)??'товар');
}
