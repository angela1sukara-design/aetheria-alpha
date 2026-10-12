import { clone } from '../core/types.ts';
import type { ContentPack, Condition } from '../core/types.ts';
import type { EntityRef, PartAttributes, PartPredicate } from '../core/query-types.ts';
import { PART_KINDS, BODY_CAPABILITIES } from '../core/body-types.ts';
export const FOUNDATION_KEYS = ['tags', 'materials', 'morphologies', 'partProfiles', 'npcBodies', 'locationProfiles', 'residentAdaptations', 'derivedTags', 'proseMaterials', 'proseSelections'] as const;
const bad = (reason: string): never => { throw Error(`内容 v2：${reason}`); };
export function shape(v: unknown, required: string[], optional: string[] = []): Record<string, any> {
  if (!v || typeof v !== 'object' || Array.isArray(v)) bad('需要对象。');
  const o = v as Record<string, any>;
  if (required.some(k => !Object.hasOwn(o, k)) || Object.keys(o).some(k => ![...required, ...optional].includes(k))) bad('未知或缺失字段。');
  return o;
}
export function stableId(v: unknown): void { if (typeof v !== 'string' || !/^[a-z][a-z0-9_-]*:[a-z][a-z0-9_.-]*$/.test(v)) bad('引用必须是稳定 ID。'); }
function text(v: unknown): void { if (typeof v !== 'string' || !v.trim() || v.length > 10000) bad('文字无效。'); }
function values(v: unknown, allowed: readonly unknown[]): void { if (!allowed.includes(v)) bad(`不支持的值 ${String(v)}。`); }
function array(v: unknown, visit: (v: any) => void): void { if (!Array.isArray(v) || v.length > 5000) bad('数组无效。'); (v as unknown[]).forEach(visit); }
export function entityRef(v: unknown): asserts v is EntityRef {
  const o = shape(v, ['kind'], ['id']); values(o.kind, ['player', 'npc', 'resident']);
  if (o.kind === 'player') { if (Object.hasOwn(o, 'id')) bad('玩家引用不带 ID。'); }
  else if (o.kind === 'npc') stableId(o.id);
  else { text(o.id); if (o.id.length > 500) bad('居民 ID 过长。'); }
}
/** lengthMm 仅用于尾部空间/装备和文本阈值；不为所有器官增加无消费者数字。 */
export function attributes(v: unknown, kind?: string): asserts v is PartAttributes {
  const o = shape(v, [], ['materialId', 'morphologyId', 'color', 'lengthMm']);
  if (o.materialId !== undefined) stableId(o.materialId);
  if (o.morphologyId !== undefined) stableId(o.morphologyId);
  if (o.color !== undefined) values(o.color, ['black', 'white', 'grey', 'brown', 'silver']);
  if (Object.hasOwn(o, 'lengthMm') && (!Number.isSafeInteger(o.lengthMm) || o.lengthMm < 1 || o.lengthMm > 5000 || (kind !== undefined && kind !== 'tail'))) bad('lengthMm 必须是尾部的 1–5000 毫米整数；缺值表示未知。');
}
export function predicate(v: unknown): asserts v is PartPredicate {
  const o = shape(v, [], ['kind', 'materialFamily', 'instanceId', 'materialId', 'morphologyId', 'color', 'lengthMm', 'minLengthMm']);
  if (!Object.keys(o).length) bad('部件条件不可为空。');
  if (o.kind !== undefined) values(o.kind, PART_KINDS);
  if (o.materialFamily !== undefined) values(o.materialFamily, ['organic', 'mechanical']);
  if (o.instanceId !== undefined && (typeof o.instanceId !== 'string' || !/^[a-z][a-z0-9_.-]{0,79}$/.test(o.instanceId))) bad('部件实例 ID 无效。');
  attributes(Object.fromEntries(Object.entries(o).filter(([k]) => ['materialId','morphologyId','color','lengthMm'].includes(k))), o.kind);
  if (Object.hasOwn(o, 'lengthMm') && o.kind !== 'tail') bad('长度谓词必须声明 tail 作用域。');
  if (o.minLengthMm !== undefined && (o.kind !== 'tail' || !Number.isSafeInteger(o.minLengthMm) || o.minLengthMm < 1 || o.minLengthMm > 5000)) bad('长度谓词必须声明 tail 作用域和毫米范围。');
}
/** 新格式单独验收，再把旧字段交给严格 v1 parser；不放宽 v1 的未知字段规则。 */
export function projectV2(input: unknown, parseV1: (v: unknown) => ContentPack): ContentPack {
  const p = clone(input) as ContentPack, legacy = clone(input) as ContentPack;
  for (const key of FOUNDATION_KEYS) delete legacy[key];
  legacy.manifest.schemaVersion = 1;
  legacy.manifest.requiresCapabilities = legacy.manifest.requiresCapabilities.filter(c => c !== 'foundation.v2');
  if (!p.manifest.requiresCapabilities.includes('foundation.v2')) bad('必须声明 foundation.v2。');
  const projectCondition = (v: unknown, depth = 0): Condition => {
    if (depth > 20) bad('条件超过 20 层。');
    const c = v as Condition;
    if (c.op === 'all' || c.op === 'any') return { ...c, conditions: c.conditions.map(x => projectCondition(x, depth + 1)) };
    if (c.op === 'not') return { ...c, condition: projectCondition(c.condition, depth + 1) };
    if (c.op === 'body.matches') { shape(c, ['op','target','part']); entityRef(c.target); predicate(c.part); return { op:'time.window',start:0,end:1 }; }
    if (c.op === 'environment.light' || c.op === 'environment.service') { shape(c,['op','value'],['locationId']); if(Object.hasOwn(c,'locationId'))stableId(c.locationId); values(c.value,c.op==='environment.light'?['lit','dark']:['home','market','workshop','clinic','commons']); return {op:'time.window',start:0,end:1}; }
    const copy = clone(c);
    if ('target' in copy) { if (!['body.hasPart','body.hasCapability','tf.state'].includes(copy.op)) bad('该条件不支持实体作用域。'); entityRef(copy.target); delete copy.target; }
    return copy;
  };
  for (const key of FOUNDATION_KEYS) array(p[key] ?? [], d => {
    stableId(d.id);
    if(key==='proseMaterials'){shape(d,['id','text','tags','review','source','tier']);text(d.text);text(d.source);array(d.tags,stableId);values(d.review,['approved','hold']);values(d.tier,['general']);}
    if(key==='proseSelections'){shape(d,['id','entryId','channel','when']);stableId(d.entryId);values(d.channel,['body','environment']);array(d.when,c=>{const check=projectCondition(c);parseV1({...emptyLegacy(),actions:[{id:'probe:check',label:'校验',hint:'校验',group:'daily',conditions:[check],effects:[{op:'clock.advance',minutes:0}],resultText:'probe:text'}]});});}
    if (key === 'tags') { shape(d,['id','label','definition','facets','status','aliases'],['replacementId']); text(d.label); if(!/[\u3400-\u9fff]/.test(d.label))bad('显示名需要中文。'); text(d.definition); array(d.facets,x=>values(x,['setting','ecology','service','body','theme','context','retrieval'])); values(d.status,['active','deprecated']); array(d.aliases,a=>{shape(a,['scope','value']);values(a.scope,['generation.v1','story.v1','lexicon.v2']);text(a.value);}); if(Object.hasOwn(d,'replacementId')){stableId(d.replacementId);if(d.status!=='deprecated')bad('仅废弃项可声明替代。');} }
    if (key === 'materials') {shape(d,['id','label','family']);text(d.label);values(d.family,['organic','mechanical']);}
    if (key === 'morphologies') {shape(d,['id','label','kinds']);text(d.label);array(d.kinds,x=>values(x,PART_KINDS));if(!d.kinds.length)bad('形态需要部件范围。');}
    if (key === 'partProfiles') {shape(d,['id','partId','defaults']);stableId(d.partId);attributes(d.defaults);}
    if (key === 'npcBodies') {shape(d,['id','npcId','bodyTemplateId','patchIds']);stableId(d.npcId);stableId(d.bodyTemplateId);array(d.patchIds,stableId);}
    if (key === 'locationProfiles') {shape(d,['id','locationId'],['service','light']);stableId(d.locationId);if(Object.hasOwn(d,'service'))values(d.service,['home','market','workshop','clinic','commons']);if(Object.hasOwn(d,'light'))values(d.light,['lit','dark']);if(!d.service&&!d.light)bad('地点扩展需要实际属性。');}
    if (key === 'residentAdaptations') {shape(d,['id','templateId','workCapabilities','mobility']);stableId(d.templateId);array(d.workCapabilities,x=>values(x,BODY_CAPABILITIES));values(d.mobility,['walk','assisted']);}
    if (key === 'derivedTags') {shape(d,['id','tagId','subject','when']);stableId(d.tagId);values(d.subject,['entity','location','world']);const check=projectCondition(d.when);parseV1({...emptyLegacy(),actions:[{id:'probe:check',label:'校验',hint:'校验',group:'daily',conditions:[check],effects:[{op:'clock.advance',minutes:0}],resultText:'probe:text'}]});if(d.subject==='entity'&&!['body.matches','body.hasPart','body.hasCapability'].includes(d.when.op))bad('实体派生仅接受身体查询。');if(d.subject==='location'&&!['environment.light','environment.service'].includes(d.when.op))bad('地点派生仅接受环境查询。');if(d.subject==='world'&&d.when.op!=='time.window')bad('世界派生仅接受时钟查询。');}
  });
  for (let i=0;i<(p.bodyParts??[]).length;i++){const d=p.bodyParts![i];if(d.defaults){attributes(d.defaults,d.kind);delete legacy.bodyParts![i].defaults;}}
  for (const t of legacy.bodyTemplates??[])for(const part of t.parts){if(Object.hasOwn(part,'overrides'))attributes(part.overrides);delete part.overrides;if(part.provenance)bad('模板不可伪造 TF 来源。');}
  for (let i=0;i<(p.bodyPatches??[]).length;i++)legacy.bodyPatches![i].operations=p.bodyPatches![i].operations.map(op=>{
    if(op.type!=='attributes')return op;
    shape(op,['type','partId','set','unset']);if(!/^[a-z][a-z0-9_.-]{0,79}$/.test(op.partId))bad('属性补丁部件 ID 无效。');attributes(op.set);array(op.unset,k=>values(k,['materialId','morphologyId','color','lengthMm']));if(new Set(op.unset).size!==op.unset.length||op.unset.some(k=>Object.hasOwn(op.set,k))||!Object.keys(op.set).length&&!op.unset.length)bad('属性补丁为空或自相矛盾。');return {type:'remove',partId:op.partId};
  });
  for (const key of ['actions','storylets','interactions','sceneTexts','equipment'] as const)for(const d of legacy[key]??[]){if('conditions'in d)d.conditions=d.conditions.map(x=>projectCondition(x));if('requires'in d)d.requires=d.requires.map(x=>projectCondition(x));}
  const fx=(e:any)=>{if(e.op==='environment.setLight'){shape(e,['op','locationId','value']);stableId(e.locationId);values(e.value,['lit','dark']);return {op:'clock.advance',minutes:0};}if(Object.hasOwn(e,'target')){if(!e.op.startsWith('tf.'))bad('该效果不支持目标。');entityRef(e.target);const x=clone(e);delete x.target;return x;}return e;};
  for(const a of legacy.actions)a.effects=a.effects.map(fx);
  for(const e of legacy.events)for(const n of e.nodes)n.onEnter=n.onEnter.map(fx);
  parseV1(legacy);
  return p;
}
function emptyLegacy(): ContentPack { return {manifest:{id:'probe',namespace:'probe',version:'1.0.0',schemaVersion:1,engineApiVersion:'0.1',author:'validator',status:'draft',dependencies:[],requiresCapabilities:[],migrations:[]},variables:[],flags:[],hooks:[],locations:[],routes:[],actions:[],events:[],texts:{'probe:text':'校验'},contributions:[]}; }
