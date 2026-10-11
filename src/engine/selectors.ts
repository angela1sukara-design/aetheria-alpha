import type { ActionDef, ActionOption, GameState, GameView } from '../core/types.ts';
import { clone, freeze } from '../core/types.ts';
import type { Registry } from '../content/registry.ts';
import { evaluate } from './conditions.ts';
import { transformationCheck } from './transformations.ts';
import { eventNode } from './events.ts';
import { npcPresent } from './npc.ts';
/** 所有可执行入口同一个选择器：UI 可见动作与引擎授权集合完全一致。 */
export function actionOptions(state: GameState, registry: Registry): ActionOption[] {
  const current = eventNode(state, registry);
  const actions: ActionDef[] = current ? current.node.actionIds.map(id => registry.action(id)).filter(x => x.context?.eventId === current.event.definitionId && x.context.nodeId === current.node.id) : registry.actionsAt(state.world.locationId).filter(x => !x.context);
  const topics = current ? [] : registry.npcs.filter(n => npcPresent(state, registry, n.id)).flatMap(n => registry.actionsForHook(n.topicHook));
  const allActions = [...new Map([...actions, ...topics, ...registry.globalActions()].map(a => [a.id, a])).values()];
  return allActions.map(definition => {
    const checks = definition.conditions.map(c => evaluate(c, state, registry));
    for (const e of definition.effects) if (e.op === 'tf.apply' || e.op === 'tf.enqueue' || e.op === 'tf.pause' || e.op === 'tf.resume' || e.op === 'tf.cancel') checks.push(transformationCheck(state, registry, e.id, e.op));
    for (const e of definition.effects) if (e.op === 'event.start') for (const npcId of registry.event(e.id).participantIds ?? []) checks.push({ pass: npcPresent(state, registry, npcId), reason: `${registry.npc(npcId).name}此刻不在这里。` });
    const failed = checks.find(x => !x.pass);
    return { definition, available: !failed, reason: failed?.reason ?? '' };
  });
}
export function selectGameView(state: GameState, registry: Registry): GameView {
  const current = eventNode(state, registry); const location = registry.location(state.world.locationId);
  return freeze({ location, state: clone(state), actions: actionOptions(state, registry),
    sceneText: current ? registry.text(current.event.textByNode[current.node.id]) : registry.text(location.textKey),
    ...(current ? { eventTitle: '正在发生' } : {}),
  });
}
