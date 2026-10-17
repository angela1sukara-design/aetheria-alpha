import { ADVENTURE_FIELDS, NARRATIVE_KINDS } from '../core/adventure-types.ts';
import { ENEMY_SPECIES_KINDS, DEFEAT_MATERIAL_KEYS, DEFEAT_PLAY_KEYS, GENERIC_TF_ATOMS } from '../core/district-types.ts';
import type { ContentPack, Condition, Effect } from '../core/types.ts';
import type { Registry } from './registry.ts';
import { shape, stableId } from './foundation-schema.ts';
import {validateNodeAssembly} from './prose-schema.ts';
type Helpers = { condition(v: unknown, p: string): void; effect(v: unknown, p: string): void };
const bad = (reason: string): never => { throw Error('故事与成长内容：' + reason); };
const text = (v: unknown) => { if (typeof v !== 'string' || !v.trim() || v.length > 10000) bad('文字无效。'); };
const integer = (v: unknown, min: number, max: number) => { if (!Number.isSafeInteger(v) || (v as number) < min || (v as number) > max) bad('数值越界。'); };
const array = (v: unknown, fn: (v: any) => void, max = 500) => { if (!Array.isArray(v) || v.length > max) bad('数组无效。'); (v as unknown[]).forEach(fn); };
const scoped = (v: unknown) => { const x = shape(v, ['role', 'tagId']); if (!['player','opponent','environment'].includes(x.role)) bad('角色作用域无效。'); stableId(x.tagId); };
const weights = (v: unknown) => array(v, x => { shape(x, ['tagId','weight']); stableId(x.tagId); integer(x.weight, 0, 100); });
const defeatCombo = (v: unknown) => {
  const dc = shape(v, [], ['materials', 'parts', 'plays', 'tfs', 'autoCombo']);
  if (dc.materials !== undefined) array(dc.materials, m => { if (!DEFEAT_MATERIAL_KEYS.includes(m)) bad('材质键无效。'); });
  if (dc.parts !== undefined) array(dc.parts, text);
  if (dc.plays !== undefined) array(dc.plays, pl => { if (!DEFEAT_PLAY_KEYS.includes(pl)) bad('玩法键无效。'); });
  if (dc.tfs !== undefined) array(dc.tfs, tf => { if (!GENERIC_TF_ATOMS.includes(tf)) bad('通用转化原子无效。'); });
  if (dc.autoCombo !== undefined && typeof dc.autoCombo !== 'boolean') bad('autoCombo 须为布尔值。');
};
export function parseAdventurePack(p: ContentPack, h: Helpers): void {
  array(p.narrativeProfiles ?? [], x => {
    shape(x, ['id','tags','goals','tendencies'], ['enemyId','npcId','defeatTags','nodeIds','speciesKind','attributeTags','fetishTags','fetishTendencies','defeatCombo']);
    stableId(x.id); if (x.enemyId) stableId(x.enemyId); if (x.npcId) stableId(x.npcId);
    array(x.tags, stableId); array(x.goals, stableId); weights(x.tendencies); array(x.defeatTags??[],scoped);
    if(x.nodeIds!==undefined){array(x.nodeIds,stableId);if(new Set(x.nodeIds).size!==x.nodeIds.length)bad('档案候选节点重复。');}
    if(x.speciesKind!==undefined&&!ENEMY_SPECIES_KINDS.includes(x.speciesKind))bad('档案物种类型无效。');
    if(x.attributeTags!==undefined)array(x.attributeTags,stableId);
    if(x.fetishTags!==undefined)array(x.fetishTags,stableId);
    if(x.fetishTendencies!==undefined)weights(x.fetishTendencies);
    if(x.defeatCombo!==undefined)defeatCombo(x.defeatCombo);
  });
  array(p.environmentEnemyRules ?? [], x => {
    shape(x, ['id','enemyId','requiresTags','weight'], ['excludesTags','priority','name','hp','reward','combat','defeatTags','speciesKind','attributeTags','fetishTags','fetishTendencies','defeatCombo']);
    stableId(x.id); stableId(x.enemyId); array(x.requiresTags, stableId); if (!x.requiresTags.length) bad('环境选敌须声明 requiresTags。');
    array(x.excludesTags??[], stableId); integer(x.weight,1,1000); if (x.priority!==undefined) integer(x.priority,0,100);
    if (x.name!==undefined) text(x.name); if (x.hp!==undefined) integer(x.hp,1,500); if (x.reward!==undefined) integer(x.reward,0,100);
    if (x.combat!==undefined){const c=shape(x.combat,[],['attack','defense','speed','skillPower','crit','hit','evasion','actionsPerTurn','skillResource']);
      for(const k of ['attack','defense','speed','skillPower'] as const) if(c[k]!==undefined) integer(c[k],0,999);
      for(const k of ['crit','hit','evasion'] as const) if(c[k]!==undefined) integer(c[k],0,100);
      if(c.actionsPerTurn!==undefined) integer(c.actionsPerTurn,1,5); if(c.skillResource!==undefined) integer(c.skillResource,0,100);
      if(!Object.keys(c).length) bad('combat 覆盖不能为空。');}
    array(x.defeatTags??[], scoped);
    if(x.speciesKind!==undefined&&!ENEMY_SPECIES_KINDS.includes(x.speciesKind))bad('环境选敌物种类型无效。');
    if(x.attributeTags!==undefined)array(x.attributeTags,stableId);
    if(x.fetishTags!==undefined)array(x.fetishTags,stableId);
    if(x.fetishTendencies!==undefined)weights(x.fetishTendencies);
    if(x.defeatCombo!==undefined)defeatCombo(x.defeatCombo);
  });
  array(p.narrativeNodes ?? [], n => {
    shape(n, ['id','kind','stage','title','textKey','requiresTags','excludesTags','conditions','tendencies','weight','priority','maxVisits','choices'],['proseAssembly']); stableId(n.id); stableId(n.textKey); if (!NARRATIVE_KINDS.includes(n.kind)) bad('节点类别无效。'); text(n.stage); text(n.title); integer(n.weight,1,100); integer(n.priority,0,100); integer(n.maxVisits,1,3); array(n.requiresTags,scoped); array(n.excludesTags,scoped); weights(n.tendencies); array(n.conditions,c=>h.condition(c,'/narrativeNodes/conditions')); if(n.proseAssembly!==undefined)validateNodeAssembly(n.proseAssembly);
    array(n.choices,c=>{shape(c,['label','resultText','conditions','effects','setTags','unsetTags','next']);text(c.label);stableId(c.resultText);if(c.next!==null)text(c.next);array(c.conditions,x=>h.condition(x,'/narrativeNodes/choices/conditions'));array(c.effects,x=>{if(['event.start','event.advance','event.exit','combat.start','scene.start','scene.act','narrative.start','narrative.choose'].includes(x?.op))bad('节点效果不能递归跳转；使用next。');h.effect(x,'/narrativeNodes/choices/effects');});array(c.setTags,scoped);array(c.unsetTags,scoped);},4);
    if (!n.choices.length || !n.choices.some((c: any)=>c.next===null&&!c.conditions.length&&!c.effects.some((e: Effect)=>e.op==='var.change'&&e.amount<0||e.op==='progression.act'))) bad('每个节点须有免费无条件退出。');
  });
  array(p.defeatReactionRules ?? [], r => {
    shape(r, ['id','label','stages','playerConditions','opponentConditions','choiceLabel','resultText','targetStage','effects','setTags','unsetTags','priority']);
    stableId(r.id); text(r.label); array(r.stages, text); if (!r.stages.length) bad('反应规则须声明适用阶段。');
    array(r.playerConditions, c => h.condition(c, '/defeatReactionRules/playerConditions'));
    array(r.opponentConditions, c => h.condition(c, '/defeatReactionRules/opponentConditions'));
    text(r.choiceLabel); stableId(r.resultText);
    if (r.targetStage !== null) text(r.targetStage);
    array(r.effects, x => {
      if (['event.start','event.advance','event.exit','combat.start','scene.start','scene.act','narrative.start','narrative.choose'].includes(x?.op)) bad('反应规则效果不能递归跳转。');
      h.effect(x, '/defeatReactionRules/effects');
    });
    array(r.setTags, scoped); array(r.unsetTags, scoped);
    integer(r.priority, 0, 100);
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
  for(const profile of p.narrativeProfiles??[]){if(profile.enemyId&&!r.enemies.some(e=>e.id===profile.enemyId))bad('敌人档案引用不存在。');if(profile.npcId)r.npc(profile.npcId);[...profile.tags,...profile.goals,...profile.tendencies.map(t=>t.tagId),...(profile.defeatTags??[]).map(t=>t.tagId),...(profile.attributeTags??[]),...(profile.fetishTags??[]),...(profile.fetishTendencies??[]).map(t=>t.tagId)].forEach(tag);for(const id of profile.nodeIds??[]){if(!r.narrativeNodes.some(n=>n.id===id))bad('档案候选节点不存在。');const owner=r.provenance(id);if(owner.id!==p.manifest.id&&!p.manifest.dependencies.some(d=>d.id===owner.id))bad('档案候选节点缺少依赖。');}}
  for(const rule of p.environmentEnemyRules??[]){if(!r.enemies.some(e=>e.id===rule.enemyId))bad('环境选敌引用不存在的敌人。');[...rule.requiresTags,...(rule.excludesTags??[]),...(rule.defeatTags??[]).map(t=>t.tagId),...(rule.attributeTags??[]),...(rule.fetishTags??[]),...(rule.fetishTendencies??[]).map(t=>t.tagId)].forEach(tag);}
  for(const node of p.narrativeNodes??[]){r.text(node.textKey);[...node.requiresTags,...node.excludesTags,...node.tendencies].forEach(t=>tag(t.tagId));node.conditions.forEach(c=>checkCondition(p,c,'/narrativeNodes/'+node.id));for(const c of node.choices){r.text(c.resultText);[...c.setTags,...c.unsetTags].forEach(t=>{tag(t.tagId);if(r.tag(t.tagId).facets.includes('body')||r.derivedTags.some(d=>d.tagId===t.tagId))bad('真实身体和环境语义必须查询，不能由故事标签赋予。');});c.conditions.forEach(x=>checkCondition(p,x,'/narrativeNodes/choices'));c.effects.forEach(x=>checkEffect(p,x,'/narrativeNodes/choices'));if(c.next&&!r.narrativeNodes.some(n=>n.kind===node.kind&&n.stage===c.next))bad('后续阶段不存在。');}}
  for(const rule of p.defeatReactionRules??[]){r.text(rule.resultText);[...rule.setTags,...rule.unsetTags].forEach(t=>{tag(t.tagId);if(r.tag(t.tagId).facets.includes('body')||r.derivedTags.some(d=>d.tagId===t.tagId))bad('真实身体和环境语义必须查询，不能由故事标签赋予。');});rule.playerConditions.forEach(c=>checkCondition(p,c,'/defeatReactionRules/'+rule.id+'/player'));rule.opponentConditions.forEach(c=>checkCondition(p,c,'/defeatReactionRules/'+rule.id+'/opponent'));rule.effects.forEach(e=>checkEffect(p,e,'/defeatReactionRules/'+rule.id+'/effects'));}
  for(const kind of NARRATIVE_KINDS){const nodes=(p.narrativeNodes??[]).filter(n=>n.kind===kind);const fallback=r.narrativeNodes.some(n=>n.kind===kind&&n.stage==='start'&&!n.requiresTags.length&&!n.conditions.length&&(r.provenance(n.id).id===p.manifest.id||p.manifest.dependencies.some(d=>d.id===r.provenance(n.id).id)));if(nodes.length&&!fallback)bad('每类故事须有本包或显式依赖提供的无条件起始回退。');}
}
export const PROGRESSION_MOVES = ['train','buy','order','invest','patrol','aid','reconcile'] as const;
export { ADVENTURE_FIELDS, NARRATIVE_KINDS };
