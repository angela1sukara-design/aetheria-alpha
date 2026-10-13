import type { GameState, Id } from '../core/types.ts';
import type { Registry } from '../content/registry.ts';
import type { PlayerRelation } from '../core/quest-types.ts';
import { activeEvent } from './events.ts';
import { RuleError } from '../core/errors.ts';

export function residentPresent(state: GameState, residentId: string): boolean {
  return !!state.district?.residents.some(r => r.id === residentId && r.locationId === state.world.locationId);
}
export function residentRelation(state: GameState, residentId: string, relation: PlayerRelation): boolean {
  return !!state.worldInstance?.agents.find(a => a.residentId === residentId)?.playerRelations?.includes(relation);
}
export function rememberResident(state: GameState, registry: Registry, residentId: string, memoryId: Id): void {
  const event = activeEvent(state);
  if (!event || !registry.event(event.definitionId).residentIds?.includes(residentId) || !residentPresent(state, residentId)) {
    throw new RuleError('RESIDENT_ABSENT', '只有正在参与此事且在场的居民才能记录共同经历。');
  }
  registry.text(memoryId);
  const resident = state.district!.residents.find(r => r.id === residentId)!;
  if (!resident.memories.includes(memoryId)) resident.memories.push(memoryId);
  resident.persistent = true;
}
export function residentMemoryText(memoryId: string, registry: Registry): string {
  if (memoryId.startsWith('talk:')) return '交换过当天近况';
  if (memoryId.startsWith('help:')) return '一起处理过实际事务';
  return registry.text(memoryId as Id);
}
export function validResidentQuestMemory(registry: Registry, residentId: string, memoryId: string): boolean {
  return registry.contentPacks.some(p => p.actions.some(a => a.context && registry.event(a.context.eventId).residentIds?.includes(residentId) && a.effects.some(e => e.op === 'resident.remember' && e.residentId === residentId && e.memoryId === memoryId)));
}
