import { validateTraitTags } from '../engine/personality.ts';
import type { ContentPack, Condition, Id } from '../core/types.ts';
import type { Registry } from './registry.ts';
type Helpers = { obj(v:unknown,p:string,k:string[]):Record<string,unknown>; str(v:unknown,p:string):void; id(v:unknown,p:string):void; integer(v:unknown,p:string,min?:number,max?:number):void; boolean(v:unknown,p:string):void; list(v:unknown,p:string,fn:(x:unknown,p:string)=>void):void; choice(v:unknown,p:string,a:unknown[]):void; condition(v:unknown,p:string):void };
export function parseDistrict(input:unknown,h:Helpers):void {
 const r = input as Record<string,unknown>; const {obj,str,id,integer,boolean,list,choice,condition} = h;
 list(r.storylets ?? [],'/storylets',(v,p)=>{const x=obj(v,p,['id','locationId','conditions','eventId','weight','priority','cooldownMinutes','cooldownGroup','repeat','hidden','tags']); for(const k of ['id','locationId','eventId']) id(x[k],p+'/'+k); list(x.conditions,p,condition); integer(x.weight,p,1,1000); integer(x.priority,p,0,100); integer(x.cooldownMinutes,p,0,10080); str(x.cooldownGroup,p); choice(x.repeat,p,['once','daily','repeat']); boolean(x.hidden,p); list(x.tags,p,str);});
 list(r.residentTemplates ?? [],'/residentTemplates',(v,p)=>{const x=obj(v,p,['id','locationIds','start','end','names','profession','appearance','personality','behavior','speciesId','ageYears','bodyTemplateId','patchIds','dialogue','attire','services','roleName','traitTags','traitVariants']); for(const k of ['id','speciesId','bodyTemplateId']) id(x[k],p); for(const k of ['locationIds','patchIds']) list(x[k],p,id); for(const k of ['names','appearance','personality']) {list(x[k],p,str); integer((x[k] as unknown[])?.length,p,1,100);} if(x.attire!==undefined){list(x.attire,p+'/attire',str);integer((x.attire as unknown[])?.length,p+'/attire',1,100);} str(x.profession,p); integer(x.start,p,0,1439); integer(x.end,p,0,1439); integer(x.ageYears,p,18,120); choice(x.behavior,p,['trade','repair','guide']);if(x.dialogue!==undefined){const d=obj(x.dialogue,p+'/dialogue',['intro','repeat','help']);for(const k of ['intro','repeat','help'])str(d[k],p+'/dialogue/'+k);}});
 list(r.residentTemplates??[],'/residentTemplates',(v,p)=>{if(!v||typeof v!=='object'||Array.isArray(v))return;const x=v as Record<string,unknown>;if(x.roleName!==undefined)str(x.roleName,p+'/roleName');if(x.traitTags!==undefined){list(x.traitTags,p+'/traitTags',id);integer((x.traitTags as unknown[]).length,p,0,6);if(new Set(x.traitTags as unknown[]).size!==(x.traitTags as unknown[]).length)integer(-1,p,0);}if(x.traitVariants!==undefined){list(x.traitVariants,p+'/traitVariants',(v,pp)=>{const q=obj(v,pp,['personality','traitTags']);str(q.personality,pp);list(q.traitTags,pp,id);integer((q.traitTags as unknown[]).length,pp,1,2);});integer((x.traitVariants as unknown[]).length,p,1,32);}if(x.services===undefined)return;const s=obj(x.services,p+'/services',['work','trade','teach','orders','investments']);if(s.work!==undefined){const w=obj(s.work,p+'/services/work',['label','text']);str(w.label,p);str(w.text,p);}for(const key of ['orders','investments'])if(s[key]!==undefined)boolean(s[key],p+'/services/'+key);for(const kind of ['trade','teach'])if(s[kind]!==undefined){list(s[kind],p+'/services/'+kind,id);integer((s[kind] as unknown[]).length,p,0,32);if(new Set(s[kind] as unknown[]).size!==(s[kind] as unknown[]).length)integer(-1,p+'/services/'+kind,0);}});
 list(r.enemies ?? [],'/enemies',(v,p)=>{const x=obj(v,p,['id','name','hp','reward','intents','victoryEventId','defeatEventId','escapeEventId','tier','combat','phases']); for(const k of ['id','victoryEventId','defeatEventId','escapeEventId']) id(x[k],p); str(x.name,p); integer(x.hp,p,1,500); integer(x.reward,p,0,100); if(x.tier!==undefined) choice(x.tier,p+'/tier',['S','M','L','boss']); if(x.combat!==undefined){const c=obj(x.combat,p+'/combat',['attack','defense','speed','skillPower','crit','hit','evasion','actionsPerTurn','skillResource']); for(const k of ['attack','defense','speed','skillPower']) integer(c[k],p+'/combat/'+k,0,999); for(const k of ['crit','hit','evasion']) integer(c[k],p+'/combat/'+k,0,100); integer(c.actionsPerTurn,p+'/combat/actionsPerTurn',1,5); integer(c.skillResource,p+'/combat/skillResource',0,100);} if(x.phases!==undefined) list(x.phases,p+'/phases',(v,pp)=>{const ph=obj(v,pp,['hpRatio','defenseBonus','extraActions']); if(typeof ph.hpRatio!=='number'||ph.hpRatio<=0||ph.hpRatio>1) integer(-1,pp+'/hpRatio'); integer(ph.defenseBonus,pp+'/defenseBonus',0,50); integer(ph.extraActions,pp+'/extraActions',0,3);}); list(x.intents,p,(v,p)=>{const i=obj(v,p,['label','damage','guard','drain']); str(i.label,p); for(const k of ['damage','guard','drain']) integer(i[k],p,0,100);}); integer((x.intents as unknown[])?.length,p,1,20);});
 list(r.interactions ?? [],'/interactions',(v,p)=>{const x=obj(v,p,['id','npcId','conditions','textSlotId','endEventId','poses','contact']); for(const k of ['id','npcId','textSlotId','endEventId']) id(x[k],p); list(x.conditions,p,condition); list(x.poses,p,(v,p)=>{const a=obj(v,p,['id','label','facing','zone','requires']); str(a.id,p); str(a.label,p); choice(a.facing,p,['front','away']); choice(a.zone,p,['near','across']); choice(a.requires,p,[null,'grasp','walk','balance','tailGrip','hear']);}); const c=obj(x.contact,p,['playerKind','npcKind','label']); choice(c.playerKind,p,['hand']); choice(c.npcKind,p,['hand']); str(c.label,p);});
 list(r.textSlots ?? [],'/textSlots',(v,p)=>{const x=obj(v,p,['id','owner','contentTier','fallbackTextKey','participants','allowedVariables','requiredFacts','sceneRequirements','before','after','purpose','requiredBeats','nextNodeId','exitActionIds','allowedReplacement']); id(x.id,p); id(x.fallbackTextKey,p); const o=obj(x.owner,p,['eventId','nodeId']); id(o.eventId,p); str(o.nodeId,p); choice(x.contentTier,p,['mature_fade','adult_optional']); list(x.participants,p,(a,p)=>{if(a!=='player')id(a,p);}); for(const k of ['allowedVariables','sceneRequirements','requiredBeats']) list(x[k],p,str); for(const k of ['requiredFacts','exitActionIds']) list(x[k],p,id); for(const k of ['before','after','purpose','nextNodeId']) str(x[k],p); choice(x.allowedReplacement,p,['prose_only']);});
 list(r.sceneTexts ?? [],'/sceneTexts',(v,p)=>{const x=obj(v,p,['id','locationId','conditions','priority','textKey','owner']); if(x.owner){const owner=obj(x.owner,p,['eventId','nodeId']);id(owner.eventId,p);str(owner.nodeId,p);} for(const k of ['id','locationId','textKey']) id(x[k],p); list(x.conditions,p,condition); integer(x.priority,p,0,100);});
 list(r.equipment ?? [],'/equipment',(v,p)=>{
  const x=obj(v,p,['id','name','requires','description','slot','bonuses']);
  id(x.id,p); str(x.name,p); str(x.description,p); list(x.requires,p,condition);
  if(x.slot!==undefined) choice(x.slot,`${p}/slot`,['held','head','body','hands','legs','accessory','weapon','armor','cosmetic','wings','tail','other']);
  const slot = (x.slot as string|undefined) ?? 'cosmetic';
  if(x.bonuses!==undefined){
    const b=obj(x.bonuses,`${p}/bonuses`,['attack','defense','evasion']);
    for(const k of ['attack','defense','evasion'] as const){
      if(b[k]!==undefined) integer(b[k],`${p}/bonuses/${k}`,0,k==='evasion'?6:4);
    }
    if(['cosmetic','accessory','other'].includes(slot)){
      for(const k of ['attack','defense','evasion'] as const){
        if(typeof b[k]==='number' && (b[k] as number)!==0) choice(b[k],`${p}/bonuses/${k}`,[0]);
      }
    }
  }
 });
 list(r.items ?? [],'/items',(v,p)=>{
  const x=obj(v,p,['id','name','description','category','effects','maxStack','price','usableInCombat']);
  id(x.id,p); str(x.name,p); str(x.description,p);
  choice(x.category,`${p}/category`,['recovery','combat','explore']);
  if(x.maxStack!==undefined) integer(x.maxStack,`${p}/maxStack`,1,99);
  if(x.price!==undefined) integer(x.price,`${p}/price`,0,100);
  if(x.usableInCombat!==undefined) boolean(x.usableInCombat,`${p}/usableInCombat`);
  list(x.effects,`${p}/effects`,(ev,ep)=>{
    const e=obj(ev,ep,['op','id','amount']);
    choice(e.op,`${ep}/op`,['var.change']);
    id(e.id,`${ep}/id`);
    choice(e.id,`${ep}/id`,['core:health','core:energy','core:stamina','core:sanity','core:skillResource']);
    integer(e.amount,`${ep}/amount`,-100,100);
    if((e.amount as number)===0) integer(e.amount,`${ep}/amount`,1,100);
  });
  integer((x.effects as unknown[])?.length,`${p}/effects`,1,8);
 });
}
export function validateDistrictDefinitions(packs:ContentPack[],r:Registry,fail:(p:ContentPack,c:string,ptr:string,reason:string,id?:string)=>void,check:(p:ContentPack,c:Condition,path:string)=>void):void {
 for(const p of packs) {
 const test=(id:Id,fn:()=>unknown)=>{try{fn();}catch{fail(p,'DISTRICT_REFERENCE','/'+id,'街区定义引用不存在。',id);}};
 for(const s of p.storylets ?? []) {test(s.id,()=>{r.location(s.locationId);r.event(s.eventId);}); s.conditions.forEach(c=>check(p,c,'/storylets/'+s.id));}
 for(const t of p.residentTemplates ?? []) test(t.id,()=>{t.locationIds.forEach(id=>r.location(id));r.bodyTemplate(t.bodyTemplateId);t.patchIds.forEach(id=>r.bodyPatch(id));const species=r.species(t.speciesId);if(!species.intelligent || t.ageYears < species.adultAgeYears) throw Error();});
 for(const t of p.residentTemplates??[])test(t.id,()=>{for(const tags of [t.traitTags??[],...(t.traitVariants??[]).map(v=>v.traitTags)]){validateTraitTags(tags,r);for(const id of tags){const owner=r.provenance(id);if(owner.id!==p.manifest.id&&!p.manifest.dependencies.some(d=>d.id===owner.id))throw Error();}}for(const v of t.traitVariants??[])if(!t.personality.includes(v.personality))throw Error();});
 for(const t of p.residentTemplates??[])test(t.id,()=>{for(const id of t.services?.trade??[]){if(!r.equipment.some(e=>e.id===id)&&!r.items.some(e=>e.id===id))throw Error();const owner=r.provenance(id);if(owner.id!==p.manifest.id&&!p.manifest.dependencies.some(d=>d.id===owner.id))throw Error();}for(const id of t.services?.teach??[]){r.variable(id);if(!['core:attack','core:defense','core:speed','core:skillPower','core:hit','core:evasion','core:crit'].includes(id))throw Error();const owner=r.provenance(id);if(owner.id!==p.manifest.id&&!p.manifest.dependencies.some(d=>d.id===owner.id))throw Error();}});
 for(const e of p.enemies ?? []) test(e.id,()=>{r.event(e.victoryEventId);r.event(e.defeatEventId);r.event(e.escapeEventId);});
 for(const i of p.interactions ?? []) {test(i.id,()=>{const n=r.npc(i.npcId),sp=r.species(n.speciesId),slot=r.textSlots.find(s=>s.id===i.textSlotId);if(!slot || (slot.contentTier==='adult_optional'&&(n.ageYears===null || n.ageYears<sp.adultAgeYears)) || !sp.intelligent || !i.poses.length || new Set(i.poses.map(p=>p.id)).size!==i.poses.length)throw Error();r.event(i.endEventId);});i.conditions.forEach(c=>check(p,c,'/interactions/'+i.id));}
 for(const s of p.textSlots ?? []) test(s.id,()=>{const e=r.event(s.owner.eventId);if(!e.nodes.some(n=>n.id===s.owner.nodeId)||!e.nodes.some(n=>n.id===s.nextNodeId))throw Error();r.text(s.fallbackTextKey);s.requiredFacts.forEach(id=>r.flag(id));s.exitActionIds.forEach(id=>r.action(id));for(const id of s.participants)if(id!=='player'){const n=r.npc(id),sp=r.species(n.speciesId);if((s.contentTier==='adult_optional'&&(n.ageYears===null||n.ageYears<sp.adultAgeYears))||!sp.intelligent)throw Error();}if(s.allowedVariables.some(v=>!['player.name','npc.displayName'].includes(v)))throw Error();});
 for(const s of p.sceneTexts ?? []) {test(s.id,()=>{r.location(s.locationId);r.text(s.textKey);});s.conditions.forEach(c=>check(p,c,'/sceneTexts/'+s.id));}
 for(const e of p.equipment ?? []) e.requires.forEach(c=>check(p,c,'/equipment/'+e.id));
 }
}
