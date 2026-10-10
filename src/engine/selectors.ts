import type { ActionDef, ActionOption, GameState, GameView } from '../core/types.ts';
import { clone, freeze } from '../core/types.ts';
import type { Registry } from '../content/registry.ts';
import { evaluate } from './conditions.ts';
import { eventNode } from './events.ts';
/** 所有可执行入口同一个选择器：UI 可见动作与引擎授权集合完全一致。 */
export function actionOptions(state: GameState, registry: Registry): ActionOption[] {
  const current = eventNode(state, registry);
  const actions: ActionDef[] = current ? current.node.actionIds.map(id => registry.action(id)).filter(x => x.context?.eventId === current.event.definitionId && x.context.nodeId === current.node.id) : registry.actionsAt(state.world.locationId).filter(x => !x.context);
  return actions.map(definition => {
    const failed = definition.conditions.map(c => evaluate(c, state, registry)).find(x => !x.pass);
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
