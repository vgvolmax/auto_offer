import Ajv2020, {type ValidateFunction} from 'ajv/dist/2020';
import addFormats from 'ajv-formats';
import catalogKit from '../../../annotation-kits/catalog-annotation-kit.json';
import requestKit from '../../../annotation-kits/request-annotation-kit.json';
export interface BrowserValidationContext {taxonomy:typeof catalogKit.taxonomy;catalogBundleValidator:ValidateFunction;requestBundleValidator:ValidateFunction}
function build(kit:typeof catalogKit|typeof requestKit){const ajv=new Ajv2020({allErrors:true,strict:false});addFormats(ajv);Object.values(kit.schemas_by_id).forEach(schema=>{if(!ajv.getSchema(schema.$id))ajv.addSchema(schema)});return ajv.getSchema(kit.root_schema_id)!}
let context:BrowserValidationContext|undefined;
export function createBrowserValidationContext(){return context??={taxonomy:catalogKit.taxonomy,catalogBundleValidator:build(catalogKit),requestBundleValidator:build(requestKit)}}
