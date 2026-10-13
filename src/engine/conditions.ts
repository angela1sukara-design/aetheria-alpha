import { bodyMatches, capabilityCount, entityBody, environment, timeWindow, PLAYER, entityKey } from './query.ts';
import type { Condition, GameState } from '../core/types.ts';
import type { Registry } from '../content/registry.ts';
import { RuleError } from '../core/errors.ts';
import { npcPresent, npcState, hasMemory } from './npc.ts';
import { residentPresent, residentRelation } from './resident-quests.ts';
export interface Check { pass: boolean; reason: string; known?: boolean }
/** 条件求值是纯读取：不能在这里抽 RNG，也不能推进时钟。 */
export function evaluate(condition: Condition, state: GameState, registry: Registry): Check {
  let pass: boolean; let reason = '条件尚未满足。';
  switch (condition.op) {
    case 'resident.present': pass = residentPresent(state, condition.residentId); reason = '约定的居民此刻不在这里，请按其日程再来。'; break;
    case 'resident.relation': pass = residentRelation(state, condition.residentId, condition.relation); reason = '需要与该居民有相应的共同背景。'; break;
    case 'resident.memory': pass = (state.district?.residents.find(r => r.id === condition.residentId)?.memories.includes(condition.memoryId) ?? false) === condition.value; break;
    case 'body.matches': {const q=bodyMatches(state,registry,condition.target,condition.part);return q.known?{pass:q.value,reason:q.value?'':'身体部件条件不满足。',known:true}:{pass:false,reason:q.reason,known:false};}
    case 'environment.light': case 'environment.service': {const e=environment(state,registry,condition.locationId),q=condition.op==='environment.light'?e.light:e.service;return q.known?{pass:q.value===condition.value,reason:'环境条件不满足。',known:true}:{pass:false,reason:q.reason,known:false};}
    case 'day.after': { const at = state.district?.factsAt[condition.flagId]; pass = at !== undefined && Math.floor(state.clock.totalMinutes / 1440) >= Math.floor(at / 1440) + condition.days; reason = '需要等到下一个约定的游戏日。'; break; }
    case 'scene.state': pass = (state.district?.scene?.phase ?? 'none') === condition.value; break;
    case 'resident.available': pass = !!state.district?.residents.some(r => r.id === state.district?.currentResidentId && r.locationId === state.world.locationId); break;
    case 'player.created': pass = (state.district?.profile.created ?? false) === condition.value; break;
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
    case 'flag.has': pass = state.player.flags[condition.id] === condition.value; break;
    case 'location.is': pass = state.world.locationId === condition.id; reason = `需要位于${registry.location(condition.id).name}。`; break;
    case 'time.window': {
      pass = timeWindow(state,condition.start,condition.end);
      reason = `开放时间 ${Math.floor(condition.start / 60)}:${String(condition.start % 60).padStart(2, '0')}–${Math.floor(condition.end / 60)}:${String(condition.end % 60).padStart(2, '0')}。`;
      break;
    }
    case 'event.state': {
      const instances = state.eventInstances.filter(x => x.definitionId === condition.id);
      pass = condition.state === 'unseen' ? instances.length === 0 : instances.some(x => x.status === condition.state);
      reason = condition.state === 'unseen' ? '这件事已经处理过了。' : '当前事件进度不符合条件。';
      break;
    }
    case 'body.hasPart': {const b=entityBody(state,condition.target??PLAYER);if(!b.known)return {pass:false,reason:b.reason,known:false};pass=b.value.parts.some(x=>x.definitionId===condition.definitionId);} reason = `需要${registry.bodyPart(condition.definitionId).label}。`; break;
    case 'body.hasCapability': { const q=capabilityCount(state,registry,condition.target??PLAYER,condition.capability);if(!q.known)return {pass:false,reason:q.reason,known:false};const n=q.value; pass = n >= condition.count; reason = `需要 ${condition.count} 个可用${{ grasp: '抓握部位', walk: '行走部位', hear: '听觉部位', balance: '平衡部位', tailGrip: '尾部抓握部位' }[condition.capability]}（当前 ${n}）。`; break; }
    case 'tf.state': { const jobs = state.tfQueues.filter(x => x.definitionId === condition.id&&entityKey(x.target)===entityKey(condition.target)); pass = condition.state === 'idle' ? !jobs.some(x => ['active', 'paused', 'blocked'].includes(x.status)) : jobs.some(x => x.status === condition.state); reason = '当前改造进度不符合这项行动。'; break; }
    case 'npc.present': pass = npcPresent(state, registry, condition.npcId); reason = `${registry.npc(condition.npcId).name}此刻不在这里。`; break;
    case 'npc.memory': pass = hasMemory(state, condition.npcId, condition.memoryId) === condition.value; reason = condition.value ? '还没有一起经历这件事。' : '这件事已经记住了。'; break;
    case 'npc.relation': { const value = npcState(state, condition.npcId).relationship[condition.field]; pass = condition.comparison === 'eq' ? value === condition.value : condition.comparison === 'gte' ? value >= condition.value : value <= condition.value; reason = `${registry.npc(condition.npcId).name}与你还不够熟悉。`; break; }
    default: throw new RuleError('UNSUPPORTED_CONDITION', '内容包使用了未实现的 Condition。');
  }
  return { pass, reason: pass ? '' : reason, known:true };
}
