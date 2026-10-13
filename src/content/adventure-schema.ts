import { ADVENTURE_FIELDS, NARRATIVE_KINDS } from '../core/adventure-types.ts';
import type { ContentPack, Condition, Effect } from '../core/types.ts';
import type { Registry } from './registry.ts';
import { shape, stableId } from './foundation-schema.ts';
type Helpers = { condition(v: unknown, p: string): void; effect(v: unknown, p: string): void };
const bad = (reason: string): never => { throw Error('故事与成长内容：' + reason); };
const text = (v: unknown) => { if (typeof v !== 'string' || !v.trim() || v.length > 10000) bad('文字无效。'); };
const integer = (v: unknown, min: number, max: number) => { if (!Number.isSafeInteger(v) || (v as number) < min || (v as number) > max) bad('数值越界。'); };
const array = (v: unknown, fn: (v: any) => void, max = 500) => { if (!Array.isArray(v) || v.length > max) bad('数组无效。'); (v as unknown[]).forEach(fn); };
const scoped = (v: unknown) => { const x = shape(v, ['role', 'tagId']); if (!['player','opponent','environment'].includes(x.role)) bad('角色作用域无效。'); stableId(x.tagId); };
const weights = (v: unknown) => array(v, x => { shape(x, ['tagId','weight']); stableId(x.tagId); integer(x.weight, 0, 100); });
export function parseAdventurePack(p: ContentPack, h: Helpers): void {
  array(p.narrativeProfiles ?? [], x => { shape(x, ['id','tags','goals','tendencies'], ['enemyId','npcId','defeatTags']); stableId(x.id); if (x.enemyId) stableId(x.enemyId); if (x.npcId) stableId(x.npcId); array(x.tags, stableId); array(x.goals, stableId); weights(x.tendencies); array(x.defeatTags??[],scoped); });
  array(p.narrativeNodes ?? [], n => {
    shape(n, ['id','kind','stage','title','textKey','requiresTags','excludesTags','conditions','tendencies','weight','priority','maxVisits','choices']); stableId(n.id); stableId(n.textKey); if (!NARRATIVE_KINDS.includes(n.kind)) bad('节点类别无效。'); text(n.stage); text(n.title); integer(n.weight,1,100); integer(n.priority,0,100); integer(n.maxVisits,1,3); array(n.requiresTags,scoped); array(n.excludesTags,scoped); weights(n.tendencies); array(n.conditions,c=>h.condition(c,'/narrativeNodes/conditions'));
    array(n.choices,c=>{shape(c,['label','resultText','conditions','effects','setTags','unsetTags','next']);text(c.label);stableId(c.resultText);if(c.next!==null)text(c.next);array(c.conditions,x=>h.condition(x,'/narrativeNodes/choices/conditions'));array(c.effects,x=>{if(['event.start','event.advance','event.exit','combat.start','scene.start','scene.act','narrative.start','narrative.choose'].includes(x?.op))bad('节点效果不能递归跳转；使用next。');h.effect(x,'/narrativeNodes/choices/effects');});array(c.setTags,scoped);array(c.unsetTags,scoped);},4);
    if (!n.choices.length || !n.choices.some((c: any)=>c.next===null&&!c.conditions.length&&!c.effects.some((e: Effect)=>e.op==='var.change'&&e.amount<0||e.op==='progression.act'))) bad('每个节点须有免费无条件退出。');
  });
}
export function validateAdventureDefinitions(p: ContentPack, r: Registry, checkCondition: (p:ContentPack,c:Condition,path:string)=>void, checkEffect:(p:ContentPack,e:Effect,path:string)=>void): void {
  if(p.narrativeNodes?.length)for(let index=0;index<4;index++){
    const action=r.action(`progression:action.story.${index}`);
    if(!action.effects.some(e=>e.op==='narrative.choose'&&e.index===index))bad('缺少对应的故事选项执行入口。');
    const source=r.provenance(action.id);
    if(source.id!==p.manifest.id&&!p.manifest.dependencies.some(d=>d.id===source.id))bad('故事执行入口缺少显式依赖。');
  }
  const tag = (id: Parameters<Registry['tag']>[0]) => { if(r.tag(id).status!=='active')bad('引用废弃标签。'); const source=r.provenance(id);if(source.id!==p.manifest.id&&!p.manifest.dependencies.some(d=>d.id===source.id))bad('标签引用缺少显式依赖。'); };
  for(const profile of p.narrativeProfiles??[]){if(profile.enemyId&&!r.enemies.some(e=>e.id===profile.enemyId))bad('敌人档案引用不存在。');if(profile.npcId)r.npc(profile.npcId);[...profile.tags,...profile.goals,...profile.tendencies.map(t=>t.tagId),...(profile.defeatTags??[]).map(t=>t.tagId)].forEach(tag);}
  for(const node of p.narrativeNodes??[]){r.text(node.textKey);[...node.requiresTags,...node.excludesTags,...node.tendencies].forEach(t=>tag(t.tagId));node.conditions.forEach(c=>checkCondition(p,c,'/narrativeNodes/'+node.id));for(const c of node.choices){r.text(c.resultText);[...c.setTags,...c.unsetTags].forEach(t=>{tag(t.tagId);if(r.tag(t.tagId).facets.includes('body')||r.derivedTags.some(d=>d.tagId===t.tagId))bad('真实身体和环境语义必须查询，不能由故事标签赋予。');});c.conditions.forEach(x=>checkCondition(p,x,'/narrativeNodes/choices'));c.effects.forEach(x=>checkEffect(p,x,'/narrativeNodes/choices'));if(c.next&&!r.narrativeNodes.some(n=>n.kind===node.kind&&n.stage===c.next))bad('后续阶段不存在。');}}
  for(const kind of NARRATIVE_KINDS){const nodes=(p.narrativeNodes??[]).filter(n=>n.kind===kind);if(nodes.length&&!nodes.some(n=>n.stage==='start'&&!n.requiresTags.length&&!n.conditions.length))bad('每类故事须有无条件起始回退。');}
}
export const PROGRESSION_MOVES = ['train','buy','order','invest','patrol','aid','reconcile'] as const;
export { ADVENTURE_FIELDS, NARRATIVE_KINDS };
