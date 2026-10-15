import {shape} from './foundation-schema.ts';
import {validateAssemblyCatalog} from '../engine/prose-assembly.generated.ts';
import {A_TEMPLATE_CATALOG} from '../world/a-template-data.ts';
import type {ProseCatalog,ProseRule} from '../core/prose-types.ts';
export function proseCatalog(rule:ProseRule):ProseCatalog{return {...A_TEMPLATE_CATALOG,rules:[rule]};}
export function validateNodeAssembly(value:unknown):void{
 const a=shape(value,['version','mode','rule']);
 if(a.version!==1||!['environment','person','body'].includes(a.mode)||a.rule?.mode!=='prose'||a.rule?.contentTier!=='general'||a.rule?.fallbackTier!=='general')throw Error('仅支持版本1的普通观察模板。');
 validateAssemblyCatalog(proseCatalog(a.rule));
}
