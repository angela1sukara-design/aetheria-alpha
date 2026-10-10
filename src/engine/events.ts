import type { EventInstance, GameState } from '../core/types.ts';
import { RuleError } from '../core/errors.ts';
import type { Registry } from '../content/registry.ts';
export function activeEvent(state: GameState): EventInstance | undefined {
  const id = state.activeEventStack.at(-1);
  return id ? state.eventInstances.find(x => x.instanceId === id) : undefined;
}
export function eventNode(state: GameState, registry: Registry) {
  const event = activeEvent(state);
  if (!event) return undefined;
  const node = registry.event(event.definitionId).nodes.find(x => x.id === event.nodeId);
  if (!node) throw new RuleError('INVALID_EVENT_NODE', '事件节点已不存在。');
  return { event, node };
}
