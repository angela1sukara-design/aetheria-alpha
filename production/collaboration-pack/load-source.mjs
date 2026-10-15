import {readFile,readdir} from 'node:fs/promises';
import {schemas} from './schema.mjs';
import {version,slots,themes,pools,bindingRoles,facts} from './catalog.mjs';
const root=new URL('../../',import.meta.url);
async function packs(dir){const list=[];for(const e of await readdir(new URL(dir,root),{withFileTypes:true})){const p=dir+'/'+e.name;if(e.isDirectory())list.push(...await packs(p));else if(e.name.endsWith('.json')){const d=JSON.parse(await readFile(new URL(p,root),'utf8'));if(d.manifest&&Array.isArray(d.tags))list.push(d);}}return list;}
/** Repository tools load tracked sources; exported packages use tools/load.mjs. */
export async function loadBundle(){
 const definitions=schemas(),baseCatalog=JSON.parse(await readFile(new URL('production/tag-matrices/assembly-rules.json',root),'utf8'));
 return {schemas:Object.fromEntries(Object.entries(definitions).map(([k,v])=>[k.replace('.schema.json',''),v])),pools:{specVersion:version,slots,themes:{list:themes},pools,bindingRoles},facts:{facts},tags:{tags:(await packs('content')).flatMap(p=>p.tags.map(t=>({...t,canonicalId:t.id})))},baseCatalog:{...baseCatalog,rules:[]}};
}
