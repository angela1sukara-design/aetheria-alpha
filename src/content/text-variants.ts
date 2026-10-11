import type { GameState, Id } from '../core/types.ts';
import type { Registry } from './registry.ts';
import { adultNPCEligibility } from '../engine/npc.ts';
export interface TextExpansion { manifest:{ id:string; namespace:string; version:string; worldVersion:'0.2.0' }; variants:{slotId:Id;textKey:Id;text:string;tier:'general'|'adult_optional';priority:number;reviewStatus:'approved'}[] }
export function parseTextExpansion(raw:unknown,r:Registry):TextExpansion {
 const exact=(x:unknown,keys:string[])=>{if(!x||typeof x!=='object'||Array.isArray(x)||Object.keys(x).sort().join('|')!==[...keys].sort().join('|'))throw Error('文本包含未授权字段或缺少字段。');return x as Record<string,unknown>;};
 const root=exact(raw,['manifest','variants']),m=exact(root.manifest,['id','namespace','version','worldVersion']);
 if(typeof m.id!=='string'||typeof m.namespace!=='string'||!/^[a-z][a-z0-9_-]*$/.test(m.namespace)||typeof m.version!=='string'||!/^\d+\.\d+\.\d+$/.test(m.version)||m.worldVersion!=='0.2.0')throw Error('文本包版本无效。');
 if(!Array.isArray(root.variants)||root.variants.length>100)throw Error('文本条目数无效。');
 const seen=new Set<string>();
 for(const raw of root.variants){const v=exact(raw,['slotId','textKey','text','tier','priority','reviewStatus']);const slot=r.textSlots.find(s=>s.id===v.slotId);
 if(!slot||typeof v.textKey!=='string'||!v.textKey.startsWith(m.namespace+':')||typeof v.text!=='string'||!v.text.trim()||v.text.length>10000||!['general','adult_optional'].includes(String(v.tier))||v.reviewStatus!=='approved'||!Number.isSafeInteger(v.priority)||(v.priority as number)<0||(v.priority as number)>100||seen.has(String(v.slotId)))throw Error('文本槽、分级、审核或优先级无效。');
 for(const match of v.text.matchAll(/\{([^{}]+)\}/g))if(!slot.allowedVariables.includes(match[1]!))throw Error('出现未允许的动态变量。');
 if(v.tier==='adult_optional'&&slot.contentTier!=='adult_optional')throw Error('此槽不接受成人分级文本。');
 seen.add(String(v.slotId));}
 return structuredClone(raw) as TextExpansion;
}
/** Read-only presentation library. It never appears in authoritative saves or effects. */
export class TextLibrary {
 #packs:TextExpansion[]=[];#enabled=new Set<string>();
 install(raw:unknown,r:Registry):string {const p=parseTextExpansion(raw,r);if(this.#packs.some(x=>x.manifest.id!==p.manifest.id&&x.manifest.namespace===p.manifest.namespace))throw Error('文本包命名空间冲突。');const other=this.#packs.filter(x=>x.manifest.id!==p.manifest.id);if(other.some(x=>x.variants.some(a=>p.variants.some(b=>a.slotId===b.slotId&&a.priority===b.priority))))throw Error('同一文本槽优先级冲突。');this.#packs=[...other,p];this.#enabled.add(p.manifest.id);return p.manifest.id;}
 setEnabled(id:string,enabled:boolean):void {if(enabled)this.#enabled.add(id);else this.#enabled.delete(id);}
 remove(id:string):void{this.#packs=this.#packs.filter(x=>x.manifest.id!==id);this.#enabled.delete(id);}
 list(){return this.#packs.map(p=>({id:p.manifest.id,version:p.manifest.version,enabled:this.#enabled.has(p.manifest.id)}));}
 resolve(slotId:Id,s:GameState,r:Registry):string {
 const slot=r.textSlots.find(x=>x.id===slotId);if(!slot)throw Error('文本槽不存在。');
 const adult=!!s.district?.profile.created&&s.district.profile.ageYears>=18&&slot.participants.every(id=>id==='player'||adultNPCEligibility(r,id).pass);
 const facts=slot.requiredFacts.every(id=>s.player.flags[id]);
 const variants=this.#packs.filter(p=>this.#enabled.has(p.manifest.id)).flatMap(p=>p.variants).filter(v=>v.slotId===slotId&&facts&&(v.tier==='general'||(adult&&s.district?.profile.adultOptional))).sort((a,b)=>b.priority-a.priority||a.textKey.localeCompare(b.textKey,'en'));
 let tx=variants[0]?.text??r.text(slot.fallbackTextKey);
 const npcId=slot.participants.find(id=>id!=='player');const vars:Record<string,string>={'player.name':s.district?.profile.name??'旅人','npc.displayName':npcId?r.npc(npcId as Id).name:'对方'};
 tx=tx.replace(/\{([^{}]+)\}/g,(_,key:string)=>vars[key]??'');return tx;
 }
}
