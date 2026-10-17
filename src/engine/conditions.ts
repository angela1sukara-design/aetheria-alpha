import { conversationResident,conversationPresent,conversationAdultEligible,conversationMemory } from './personality.ts';
import { bodyMatches, capabilityCount, entityBody, environment, timeWindow, PLAYER, entityKey } from './query.ts';
import type { Condition, GameState } from '../core/types.ts';
import type { Registry } from '../content/registry.ts';
import { RuleError } from '../core/errors.ts';
import { serviceAvailable } from './entity-functions.ts';
import { npcPresent, npcState, hasMemory } from './npc.ts';
import { residentPresent, residentRelation } from './resident-quests.ts';
import { adventureValue, progressionCheck } from './progression.ts';
import { narrativeTags } from './narrative.ts';
export interface Check { pass: boolean; reason: string; known?: boolean }
/** 条件求值是纯读取：不能在这里抽 RNG，也不能推进时钟。 */
export function evaluate(condition: Condition, state: GameState, registry: Registry): Check {
  let pass: boolean; let reason = '条件尚未满足。';
  switch (condition.op) {
    case 'conversation.present': return {pass:conversationPresent(state),reason:'交谈对象已经离开。'};
    case 'conversation.adultEligible': return {pass:conversationAdultEligible(state,registry),reason:'交谈人物未满足当前互动资格。'};
    case 'conversation.giftAvailable': return {pass:conversationPresent(state)&&!conversationResident(state)?.memories.includes(conversationMemory(state,'gift')),reason:'今天已经接受过赠礼。'};
    case 'conversation.trust': return {pass:conversationPresent(state)&&(conversationResident(state)?.trust??0)>=condition.value,reason:`与交谈对象的信任至少需要${condition.value}。`};
    case 'service.available': return {pass:serviceAvailable(state,registry,condition),reason:'当前地点或人物不提供这项功能。'};
    case 'adventure.compare': {const value=adventureValue(state,condition.field);pass=condition.comparison==='eq'?value===condition.value:condition.comparison==='gte'?value>=condition.value:value<=condition.value;reason=`${({assets:'经营份额',influence:'组织影响',safety:'街区安全',reputation:'公共声望',orders:'订单',contracts:'契约',victories:'有效战斗胜利'})[condition.field]}需${condition.comparison==='gte'?'至少':condition.comparison==='lte'?'不超过':'等于'}${condition.value}（当前${value}）。`;break;}
    case 'progression.available': return progressionCheck(state,registry,condition.move,condition.id);
    case 'narrative.tag': pass=!!state.adventure?.story&&narrativeTags(state,registry).some(t=>t.role===condition.role&&t.tagId===condition.id)===condition.value;reason='当前故事状态不满足这个选择。';break;
    case 'resident.present': pass = residentPresent(state, condition.residentId); reason = '约定的居民此刻不在这里，请按其日程再来。'; break;
    case 'resident.trust': pass=residentPresent(state,condition.residentId)&&(state.district?.residents.find(n=>n.id===condition.residentId)?.trust??0)>=condition.value;reason=`与约定居民的信任需要至少${condition.value}。`;break;
    case 'resident.relation': pass = residentRelation(state, condition.residentId, condition.relation); reason = '需要与该居民有相应的共同背景。'; break;
    case 'resident.memory': pass = (state.district?.residents.find(r => r.id === condition.residentId)?.memories.includes(condition.memoryId) ?? false) === condition.value; break;
    case 'body.matches': {const q=bodyMatches(state,registry,condition.target,condition.part);return q.known?{pass:q.value,reason:q.value?'':'身体部件条件不满足。',known:true}:{pass:false,reason:q.reason,known:false};}
    case 'environment.light': case 'environment.service': {const e=environment(state,registry,condition.locationId),q=condition.op==='environment.light'?e.light:e.service;return q.known?{pass:q.value===condition.value,reason:'环境条件不满足。',known:true}:{pass:false,reason:q.reason,known:false};}
    case 'day.after': { const at = state.district?.factsAt[condition.flagId]; pass = at !== undefined && Math.floor(state.clock.totalMinutes / 1440) >= Math.floor(at / 1440) + condition.days; reason = '需要等到下一个约定的游戏日。'; break; }
    case 'scene.state': pass = (state.district?.scene?.phase ?? 'none') === condition.value; break;
    case 'resident.available': pass = !!state.district?.residents.some(r => r.id === state.district?.currentResidentId && r.locationId === state.world.locationId); break;
    case 'player.created': pass = (state.district?.profile.created ?? false) === condition.value; break;
    case 'item.has': {
      const qty = state.adventure?.items?.[condition.id] ?? 0;
      pass = condition.comparison === 'eq' ? qty === condition.value : condition.comparison === 'gte' ? qty >= condition.value : qty <= condition.value;
      const name = registry.items.find(i => i.id === condition.id)?.name ?? '消耗品';
      reason = `${name}数量需${condition.comparison === 'gte' ? '至少' : condition.comparison === 'lte' ? '不超过' : '等于'}${condition.value}（当前${qty}）。`;
      break;
    }
    case 'preference.adultOptional': {
      const profile = state.district?.profile;
      const adult = !!(profile?.created && profile.adultOptional);
      pass = adult === condition.value;
      reason = condition.value ? '需要已创建的成年角色并开启成人可选文本偏好。' : '当前已开启成人可选文本。';
      break;
    }
    case 'all': {
      const failed = condition.conditions.map(x => evaluate(x, state, registry)).find(x => !x.pass);
      if(condition.conditions.some(x=>{const q=evaluate(x,state,registry);return q.known!==false&&!q.pass;}))return {pass:false,reason:failed?.reason??'',known:true};
      return failed ?? { pass: true, reason: '', known:true };
    }
    case 'any': {
      const checks = condition.conditions.map(x => evaluate(x, state, registry));
      return checks.some(x => x.pass) ? { pass: true, reason: '' } : { pass: false, reason: checks.map(x => x.reason).join(' / '), known:!checks.some(x=>x.known===false) };
    }
    case 'not': {const q=evaluate(condition.condition,state,registry);return q.known===false?q:{pass:!q.pass,reason:q.pass?'当前状态不允许这项行动。':'',known:true};}
    case 'var.compare': {
      const value = state.player.variables[condition.id];
      pass = condition.comparison === 'eq' ? value === condition.value : condition.comparison === 'gte' ? value >= condition.value : value <= condition.value;
      reason = `${registry.variable(condition.id).label}需${condition.comparison === 'gte' ? '至少' : condition.comparison === 'lte' ? '不超过' : '等于'} ${condition.value}（当前 ${value}）。`;
      break;
    }
    case 'flag.has': pass = (state.player.flags[condition.id] ?? false) === condition.value; break;
    case 'location.is': pass = state.world.locationId === condition.id; reason = `需要位于${registry.location(condition.id).name}。`; break;
    case 'time.window': {
      pass = timeWindow(state,condition.start,condition.end);
      reason = `开放时间 ${Math.floor(condition.start / 60)}:${String(condition.start % 60).padStart(2, '0')}–${Math.floor(condition.end / 60)}:${String(condition.end % 60).padStart(2, '0')}。`;
      break;
    }
    case 'event.state': {
      const instances = state.eventInstances.filter(x => x.definitionId === condition.id);
      const archived = state.ledger.checkpoint?.completedEvents.includes(condition.id) ?? false;
      pass = condition.state === 'unseen' ? instances.length === 0 && !archived : instances.some(x => x.status === condition.state) || condition.state === 'completed' && archived;
      reason = condition.state === 'unseen' ? '这件事已经处理过了。' : '当前事件进度不符合条件。';
      break;
    }
    case 'body.hasPart': {const b=entityBody(state,condition.target??PLAYER);if(!b.known)return {pass:false,reason:b.reason,known:false};pass=b.value.parts.some(x=>x.definitionId===condition.definitionId);} reason = `需要${registry.bodyPart(condition.definitionId).label}。`; break;
    case 'body.hasCapability': { const q=capabilityCount(state,registry,condition.target??PLAYER,condition.capability);if(!q.known)return {pass:false,reason:q.reason,known:false};const n=q.value; pass = n >= condition.count; reason = `需要 ${condition.count} 个可用${{ grasp: '抓握部位', walk: '行走部位', hear: '听觉部位', balance: '平衡部位', tailGrip: '尾部抓握部位' }[condition.capability]}（当前 ${n}）。`; break; }
    case 'tf.state': { const jobs = state.tfQueues.filter(x => x.definitionId === condition.id&&entityKey(x.target)===entityKey(condition.target)); pass = condition.state === 'idle' ? !jobs.some(x => ['active', 'paused', 'blocked'].includes(x.status)) : jobs.some(x => x.status === condition.state); reason = '当前改造进度不符合这项行动。'; break; }
    case 'opponent.matches': {
      const story = state.adventure?.story;
      const lastCombat = state.adventure?.lastCombat;
      const activeCombat = state.district?.combat;
      const profile = story?.profileId ? registry.narrativeProfiles.find(p => p.id === story.profileId) : undefined;
      const enemyId = profile?.enemyId ?? lastCombat?.enemyId ?? activeCombat?.enemyId;
      const enemy = enemyId ? registry.enemies.find(e => e.id === enemyId) : undefined;
      const rule = activeCombat?.selectionRuleId ? registry.environmentEnemyRules.find(r => r.id === activeCombat.selectionRuleId) : undefined;
      const activeOppTags = new Set([
        ...(story ? narrativeTags(state, registry).filter(t => t.role === 'opponent').map(t => t.tagId) : []),
        ...(enemy?.attributeTags ?? []),
        ...(enemy?.fetishTags ?? []),
        ...(profile?.attributeTags ?? []),
        ...(profile?.fetishTags ?? []),
        ...(rule?.attributeTags ?? []),
        ...(rule?.fetishTags ?? []),
      ]);
      const actualSpecies = rule?.speciesKind ?? profile?.speciesKind ?? enemy?.speciesKind ?? story?.fills?.opponentKind;
      const actualMat = story?.fills?.materialKey;
      const actualPlay = story?.fills?.playKey;
      const actualTf = story?.fills?.tf;
      pass = true;
      if (condition.enemyId !== undefined && enemyId !== condition.enemyId) pass = false;
      if (condition.speciesKind !== undefined && actualSpecies !== condition.speciesKind) pass = false;
      if (condition.attributeTag !== undefined && !activeOppTags.has(condition.attributeTag)) pass = false;
      if (condition.fetishTag !== undefined && !activeOppTags.has(condition.fetishTag)) pass = false;
      if (condition.materialKey !== undefined && actualMat !== condition.materialKey) pass = false;
      if (condition.playKey !== undefined && actualPlay !== condition.playKey && !activeOppTags.has(`progression:tag.defeat.play.${condition.playKey.toLowerCase()}`)) pass = false;
      if (condition.tf !== undefined && actualTf !== condition.tf) pass = false;
      reason = '当前对手的属性或倾向不符合该条件。';
      break;
    }
    case 'npc.present': pass = npcPresent(state, registry, condition.npcId); reason = `${registry.npc(condition.npcId).name}此刻不在这里。`; break;
    case 'npc.memory': pass = hasMemory(state, condition.npcId, condition.memoryId) === condition.value; reason = condition.value ? '还没有一起经历这件事。' : '这件事已经记住了。'; break;
    case 'npc.relation': { const value = npcState(state, condition.npcId).relationship[condition.field]; pass = condition.comparison === 'eq' ? value === condition.value : condition.comparison === 'gte' ? value >= condition.value : value <= condition.value; reason = `${registry.npc(condition.npcId).name}与你还不够熟悉。`; break; }
    default: throw new RuleError('UNSUPPORTED_CONDITION', '内容包使用了未实现的 Condition。');
  }
  return { pass, reason: pass ? '' : reason, known:true };
}
