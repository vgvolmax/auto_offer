import Ajv2020, {type ValidateFunction} from 'ajv/dist/2020';
import addFormats from 'ajv-formats';
import catalogKit from '../../../annotation-kits/catalog-annotation-kit.json';
import requestKit from '../../../annotation-kits/request-annotation-kit.json';
import registry from '../../../schemas/annotation/class-schema-registry.json';
import requestSourceSchema from '../../../schemas/chat-pipeline/request-source.schema.json';
import requestRoutingSchema from '../../../schemas/chat-pipeline/request-routing.schema.json';
import taxonomyLightSchema from '../../../schemas/chat-pipeline/taxonomy-light.schema.json';
import semanticMatchingCatalogSchema from '../../../schemas/chat-pipeline/semantic-matching-catalog.schema.json';
import semanticMatchResultSchema from '../../../schemas/chat-pipeline/semantic-match-result.schema.json';

type ClassSchema = {validator:ValidateFunction;classId:string;schema:object};
export interface BrowserValidationContext {
  taxonomy:typeof catalogKit.taxonomy;
  registry:typeof registry;
  classSchemas:Record<string,ClassSchema>;
  catalogBundleValidator:ValidateFunction;
  requestBundleValidator:ValidateFunction;
  catalogItemBaseValidator:ValidateFunction;
  requestLineBaseValidator:ValidateFunction;
  requestSourceValidator:ValidateFunction;
  requestRoutingValidator:ValidateFunction;
  taxonomyLightValidator:ValidateFunction;
  semanticMatchingCatalogValidator:ValidateFunction;
  semanticMatchResultValidator:ValidateFunction;
}

function compiler(kit:typeof catalogKit|typeof requestKit) {
  const ajv=new Ajv2020({allErrors:true,strict:false});
  addFormats(ajv);
  Object.values(kit.schemas_by_id).forEach(schema=>{if(!ajv.getSchema(schema.$id))ajv.addSchema(schema)});
  return ajv;
}

let context:BrowserValidationContext|undefined;
export function createBrowserValidationContext():BrowserValidationContext {
  if(context)return context;
  const catalogAjv=compiler(catalogKit),requestAjv=compiler(requestKit);
  const preparationAjv=new Ajv2020({allErrors:true,strict:false});
  const classSchemas:Record<string,ClassSchema>={};
  for(const [classId,entry] of Object.entries(registry.classes)) {
    for(const [relative,id,ajv] of [[entry.catalog_schema,catalogKit.class_schema_ids[classId as keyof typeof catalogKit.class_schema_ids],catalogAjv],[entry.request_schema,requestKit.class_schema_ids[classId as keyof typeof requestKit.class_schema_ids],requestAjv]] as const) {
      const validator=ajv.getSchema(id);
      if(!validator)throw new Error(`Annotation kit schema is unavailable: ${id}`);
      classSchemas[relative]={validator,classId,schema:ajv.getSchema(id)?.schema as object};
    }
  }
  const get=(ajv:Ajv2020,id:string)=>{const validator=ajv.getSchema(id);if(!validator)throw new Error(`Annotation kit schema is unavailable: ${id}`);return validator};
  return context={taxonomy:catalogKit.taxonomy,registry,classSchemas,
    catalogBundleValidator:get(catalogAjv,catalogKit.root_schema_id),requestBundleValidator:get(requestAjv,requestKit.root_schema_id),
    catalogItemBaseValidator:get(catalogAjv,'https://example.local/schemas/annotation/catalog-item-annotation.base.schema.json'),
    requestLineBaseValidator:get(requestAjv,'https://example.local/schemas/annotation/request-line-annotation.base.schema.json'),
    requestSourceValidator:preparationAjv.compile(requestSourceSchema),requestRoutingValidator:preparationAjv.compile(requestRoutingSchema),taxonomyLightValidator:preparationAjv.compile(taxonomyLightSchema),semanticMatchingCatalogValidator:preparationAjv.compile(semanticMatchingCatalogSchema),semanticMatchResultValidator:preparationAjv.compile(semanticMatchResultSchema)};
}
