import type { ContentPack, Condition, Id } from '../core/types.ts';
import type { Registry } from './registry.ts';
import type { PartAttributes } from '../core/query-types.ts';
import { attributes } from './foundation-schema.ts';
import { resolveTag } from './tags.ts';
import { instantiateBody, patchedBody } from '../engine/body.ts';
/** 默认值、引用和作用域共用同一个验证器；加载和存档都不能接受自由属性 JSON。 */
export function validateAttributes(a:PartAttributes,r:Registry,kind?:string):void {
  attributes(a,kind);
  if(a.materialId)r.material(a.materialId);
  if(a.morphologyId){const m=r.morphology(a.morphologyId);if(kind&&!m.kinds.includes(kind as never))throw Error('局部形态不适用于此部件。');}
}
export function validateFoundation(packs:ContentPack[],r:Registry,ref:(p:ContentPack,id:Id,kind:string,path:string)=>void,checkCondition:(p:ContentPack,c:Condition,path:string)=>void):void {
  const alias=new Set<string>(),profiles=new Set<Id>(),npcs=new Set<Id>(),locations=new Set<Id>(),adaptations=new Set<Id>();
  for(const t of r.tags){for(const a of t.aliases){const key=`${a.scope}/${a.value}`;if(alias.has(key))throw Error(`歧义 Tag 别名 ${key}`);alias.add(key);if(r.tags.some(x=>x.id===a.value&&x.id!==t.id))throw Error('别名与规范 ID 冲突。');}let cursor=t;const seen=new Set<Id>();while(cursor.replacementId){if(seen.has(cursor.id))throw Error('Tag 替代循环。');seen.add(cursor.id);cursor=r.tag(cursor.replacementId);}}
  const attrRefs=(p:ContentPack,a:PartAttributes,path:string)=>{if(a.materialId)ref(p,a.materialId,'materials',path);if(a.morphologyId)ref(p,a.morphologyId,'morphologies',path);};
  for(const p of packs){
    for(const m of p.proseMaterials??[])for(const id of m.tags){ref(p,id,'tags','/proseMaterials/tags');r.tag(id);}
    for(const rule of p.proseSelections??[]){ref(p,rule.entryId,'proseMaterials','/proseSelections/entryId');rule.when.forEach(c=>checkCondition(p,c,'/proseSelections/when'));}
    for(const t of p.tags??[])if(t.replacementId)ref(p,t.replacementId,'tags','/tags/replacementId');
    for(const part of p.bodyParts??[])if(part.defaults){validateAttributes(part.defaults,r,part.kind);attrRefs(p,part.defaults,'/bodyParts/defaults');}
    for(const profile of p.partProfiles??[]){ref(p,profile.partId,'bodyParts','/partProfiles/partId');if(profiles.has(profile.partId)||r.bodyPart(profile.partId).defaults)throw Error('部件默认值存在多个权威来源。');profiles.add(profile.partId);validateAttributes(profile.defaults,r,r.bodyPart(profile.partId).kind);attrRefs(p,profile.defaults,'/partProfiles/defaults');}
    for(const b of p.npcBodies??[]){ref(p,b.npcId,'npcs','/npcBodies/npcId');ref(p,b.bodyTemplateId,'bodyTemplates','/npcBodies/bodyTemplateId');b.patchIds.forEach(id=>ref(p,id,'bodyPatches','/npcBodies/patchIds'));if(npcs.has(b.npcId))throw Error('NPC 身体声明重复。');npcs.add(b.npcId);let body=instantiateBody(r.bodyTemplate(b.bodyTemplateId));for(const id of b.patchIds)body=patchedBody(body,r.bodyPatch(id),r);}
    for(const l of p.locationProfiles??[]){ref(p,l.locationId,'locations','/locationProfiles/locationId');(l.tags??[]).forEach(id=>ref(p,id,'tags','/locationProfiles/tags'));if(locations.has(l.locationId))throw Error('地点参数默认值重复。');locations.add(l.locationId);}
    for(const a of p.residentAdaptations??[]){ref(p,a.templateId,'residentTemplates','/residentAdaptations/templateId');if(adaptations.has(a.templateId))throw Error('居民活动适配重复。');adaptations.add(a.templateId);}
    for(const patch of p.bodyPatches??[])for(const op of patch.operations)if(op.type==='attributes'){attrRefs(p,op.set,'/bodyPatches/set');const possible=r.contentPacks.flatMap(p=>p.bodyTemplates??[]).flatMap(t=>t.parts).filter(part=>part.instanceId===op.partId);if(possible.length&&!possible.some(part=>{try{validateAttributes(op.set,r,r.bodyPart(part.definitionId).kind);return true;}catch{return false;}}))throw Error('属性补丁不适用于已声明的部件作用域。');}
    for(const d of p.derivedTags??[]){ref(p,d.tagId,'tags','/derivedTags/tagId');checkCondition(p,d.when,'/derivedTags/when');}
    // 旧域字符串仅在查询视图映射；不修改旧包及哈希。新包严格使用 canonical ID。
    if(p.manifest.schemaVersion===2)for(const st of p.storylets??[])for(const tag of st.tags){if(r.tag(tag as Id).status!=='active')throw Error('新版故事不可使用废弃 Tag。');ref(p,tag as Id,'tags','/storylets/tags');}
  }
  if(r.tags.length)for(const st of r.storylets)for(const tag of st.tags)resolveTag(r,tag,'story.v1');
}
