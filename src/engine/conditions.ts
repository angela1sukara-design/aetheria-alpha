import type { Condition, GameState } from '../core/types.ts';
import type { Registry } from '../content/registry.ts';
import { RuleError } from '../core/errors.ts';
import { bodyTraits } from './body.ts';
import { MINUTES_PER_DAY } from './clock.ts';
import { npcPresent, npcState, hasMemory } from './npc.ts';
export interface Check { pass: boolean; reason: string }
/** 条件求值是纯读取：不能在这里抽 RNG，也不能推进时钟。 */
export function evaluate(condition: Condition, state: GameState, registry: Registry): Check {
  let pass: boolean; let reason = '条件尚未满足。';
  switch (condition.op) {
    case 'all': {
      const failed = condition.conditions.map(x => evaluate(x, state, registry)).find(x => !x.pass);
      return failed ?? { pass: true, reason: '' };
    }
    case 'any': {
      const checks = condition.conditions.map(x => evaluate(x, state, registry));
      return checks.some(x => x.pass) ? { pass: true, reason: '' } : { pass: false, reason: checks.map(x => x.reason).join(' / ') };
    }
    case 'not': pass = !evaluate(condition.condition, state, registry).pass; reason = '当前状态不允许这项行动。'; break;
    case 'var.compare': {
      const value = state.player.variables[condition.id];
      pass = condition.comparison === 'eq' ? value === condition.value : condition.comparison === 'gte' ? value >= condition.value : value <= condition.value;
      reason = `${registry.variable(condition.id).label}需${condition.comparison === 'gte' ? '至少' : condition.comparison === 'lte' ? '不超过' : '等于'} ${condition.value}（当前 ${value}）。`;
      break;
    }
    case 'flag.has': pass = state.player.flags[condition.id] === condition.value; break;
    case 'location.is': pass = state.world.locationId === condition.id; reason = `需要位于${registry.location(condition.id).name}。`; break;
    case 'time.window': {
      const now = state.clock.totalMinutes % MINUTES_PER_DAY;
      pass = condition.start < condition.end ? now >= condition.start && now < condition.end : now >= condition.start || now < condition.end;
      reason = `开放时间 ${Math.floor(condition.start / 60)}:${String(condition.start % 60).padStart(2, '0')}–${Math.floor(condition.end / 60)}:${String(condition.end % 60).padStart(2, '0')}。`;
      break;
    }
    case 'event.state': {
      const instances = state.eventInstances.filter(x => x.definitionId === condition.id);
      pass = condition.state === 'unseen' ? instances.length === 0 : instances.some(x => x.status === condition.state);
      reason = condition.state === 'unseen' ? '这件事已经处理过了。' : '当前事件进度不符合条件。';
      break;
    }
    case 'body.hasPart': pass = state.player.body?.parts.some(x => x.definitionId === condition.definitionId) ?? false; reason = `需要${registry.bodyPart(condition.definitionId).label}。`; break;
    case 'body.hasCapability': { const n = bodyTraits(state.player.body, registry)[condition.capability]; pass = n >= condition.count; reason = `需要 ${condition.count} 个可用${{ grasp: '抓握部位', walk: '行走部位', hear: '听觉部位', balance: '平衡部位', tailGrip: '尾部抓握部位' }[condition.capability]}（当前 ${n}）。`; break; }
    case 'tf.state': { const jobs = state.tfQueues.filter(x => x.definitionId === condition.id); pass = condition.state === 'idle' ? !jobs.some(x => ['active', 'paused', 'blocked'].includes(x.status)) : jobs.some(x => x.status === condition.state); reason = '当前改造进度不符合这项行动。'; break; }
    case 'npc.present': pass = npcPresent(state, registry, condition.npcId); reason = `${registry.npc(condition.npcId).name}此刻不在这里。`; break;
    case 'npc.memory': pass = hasMemory(state, condition.npcId, condition.memoryId) === condition.value; reason = condition.value ? '还没有一起经历这件事。' : '这件事已经记住了。'; break;
    case 'npc.relation': { const value = npcState(state, condition.npcId).relationship[condition.field]; pass = condition.comparison === 'eq' ? value === condition.value : condition.comparison === 'gte' ? value >= condition.value : value <= condition.value; reason = `${registry.npc(condition.npcId).name}与你还不够熟悉。`; break; }
    default: throw new RuleError('UNSUPPORTED_CONDITION', '内容包使用了未实现的 Condition。');
  }
  return { pass, reason: pass ? '' : reason };
}
