import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import {readFile,readdir} from 'node:fs/promises'; import path from 'node:path'; import {spawnSync} from 'node:child_process';
async function files(dir){return (await Promise.all((await readdir(dir,{withFileTypes:true})).map(x=>x.isDirectory()?files(path.join(dir,x.name)):path.join(dir,x.name)))).flat()}
const all=(await files('schemas/annotation')).filter(x=>x.endsWith('.schema.json'));const schemas=await Promise.all(all.map(async x=>JSON.parse(await readFile(x))));const ajv=new Ajv2020({allErrors:true,strict:false});addFormats(ajv);for(const s of schemas){if(!ajv.validateSchema(s))throw new Error(`${s.$id}: ${ajv.errorsText()}`);ajv.addSchema(s)}
const generated=spawnSync(process.execPath,['scripts/generate-annotation-dispatchers.mjs'],{stdio:'inherit'});if(generated.status)process.exit(generated.status);const diff=spawnSync('git',['diff','--exit-code','--','schemas/annotation/generated'],{stdio:'inherit'});if(diff.status)throw new Error('Generated annotation dispatchers are stale');console.log(`Validated ${schemas.length} Draft 2020-12 schemas and registry dispatchers.`);
