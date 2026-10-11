import type { Change, Effect, EventInstance, GameState } from '../core/types.ts';
import type { Registry } from '../content/registry.ts';
import { RuleError } from '../core/errors.ts';
import { advanceTransformationTime, performTransformation } from './transformations.ts';
import { formatClock } from './clock.ts';
import { draw } from './rng.ts';
import { activeEvent } from './events.ts';
import { npcPresent, rememberNPC } from './npc.ts';
export interface EffectContext { budget: number; changes: Change[]; resolvedTexts: string[]; transactionId: string; actionId: import('../core/types.ts').Id }
export function applyEffects(effects: Effect[], draft: GameState, registry: Registry, context: EffectContext): void {
  for (const effect of effects) {
    if (--context.budget < 0) throw new RuleError('EFFECT_BUDGET', '单次事务效果超过安全上限。');
    switch (effect.op) {
      case 'var.change': {
        const def = registry.variable(effect.id); const before = draft.player.variables[effect.id];
        const after = Math.min(def.max, before + effect.amount);
        if (after < def.min) throw new RuleError('INSUFFICIENT_RESOURCE', `${def.label}不足：当前 ${before}，本次需要 ${-effect.amount}。`);
        draft.player.variables[effect.id] = after;
        if (before !== after) context.changes.push({ label: def.label, before, after });
        break;
      }
      case 'flag.set': {
        registry.flag(effect.id); const before = draft.player.flags[effect.id]; draft.player.flags[effect.id] = effect.value;
        if (before !== effect.value) context.changes.push({ label: '记录已更新', before, after: effect.value });
        break;
      }
      case 'clock.advance': {
        const before = draft.clock.totalMinutes; advanceTransformationTime(draft, effect.minutes, registry, context.changes);
        if (effect.minutes) context.changes.push({ label: '时间', before: formatClock(before), after: formatClock(draft.clock.totalMinutes) });
        break;
      }
      case 'location.move': {
        if (activeEvent(draft)) throw new RuleError('EVENT_ACTIVE', '先完成或退出当前事件。');
        const route = registry.route(effect.routeId);
        if (route.from !== draft.world.locationId) throw new RuleError('INVALID_ROUTE_ORIGIN', '当前地点不是这条路线的起点。');
        const before = registry.location(route.from).name;
        draft.world.locationId = route.to;
        if (!draft.world.knownLocationIds.includes(route.to)) draft.world.knownLocationIds.push(route.to);
        context.changes.push({ label: '地点', before, after: registry.location(route.to).name });
        break;
      }
      case 'event.start': {
        if (activeEvent(draft)) throw new RuleError('EVENT_ACTIVE', '本切片暂不支持嵌套事件。');
        const def = registry.event(effect.id);
        for (const id of def.participantIds ?? []) if (!npcPresent(draft, registry, id)) throw new RuleError('NPC_ABSENT', `${registry.npc(id).name}不在这里。`);
        const instance: EventInstance = {
          instanceId: `event-${context.transactionId}`, definitionId: def.id, nodeId: def.startNode,
          status: 'active', textByNode: {}, draws: [], locals: {},
        };
        draft.eventInstances.push(instance); draft.activeEventStack.push(instance.instanceId);
        enterNode(instance, draft, registry, context);
        break;
      }
      case 'event.advance': {
        const instance = activeEvent(draft);
        if (!instance) throw new RuleError('NO_EVENT', '没有正在进行的事件。');
        instance.nodeId = effect.nodeId; enterNode(instance, draft, registry, context); break;
      }
      case 'event.exit': {
        const instance = activeEvent(draft);
        if (!instance) throw new RuleError('NO_EVENT', '没有正在进行的事件。');
        instance.status = 'completed'; draft.activeEventStack.pop(); break;
      }
      case 'tf.apply': case 'tf.enqueue': case 'tf.pause': case 'tf.resume': case 'tf.cancel':
        performTransformation(effect.op, effect.id, draft, registry, context.transactionId, context.actionId, context.changes); break;
      case 'npc.remember': rememberNPC(draft, registry, effect.npcId, effect.memoryId, effect.relationship, context.actionId, context.transactionId, context.changes); break;
      default: throw new RuleError('UNSUPPORTED_EFFECT', '效果未实现，事务未提交。');
    }
  }
}
function enterNode(instance: EventInstance, draft: GameState, registry: Registry, context: EffectContext): void {
  const node = registry.event(instance.definitionId).nodes.find(x => x.id === instance.nodeId);
  if (!node) throw new RuleError('INVALID_NODE', '事件节点不存在。');
  // 已抽结果固化到实例；重绘、存读和查看地图只读 textByNode，不重抽、不重放 onEnter。
  if (!instance.textByNode[node.id]) {
    const value = draw(draft, `event:${instance.instanceId}`);
    instance.draws.push({ nodeId: node.id, value });
    instance.textByNode[node.id] = node.textVariants[Math.floor(value * node.textVariants.length)];
    applyEffects(node.onEnter, draft, registry, context);
  }
  if (node.type === 'exit') context.resolvedTexts.push(registry.text(instance.textByNode[node.id]));
}
