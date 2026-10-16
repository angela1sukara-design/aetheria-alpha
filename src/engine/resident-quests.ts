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
/** Uses the existing validated trust field; arbitrary UI targets cannot change it. */
export function changeResidentTrust(state:GameState,registry:Registry,residentId:string,amount:number){
 const event=activeEvent(state);
 if(!Number.isSafeInteger(amount)||Math.abs(amount)>100||!event||!registry.event(event.definitionId).residentIds?.includes(residentId)||!residentPresent(state,residentId))throw new RuleError('RESIDENT_TRUST_CONTEXT','信任只能在约定居民在场的事件中更新。');
 const resident=state.district!.residents.find(n=>n.id===residentId)!,before=resident.trust;
 resident.trust=Math.max(0,Math.min(1000000,before+amount));resident.persistent=true;
 return {name:resident.name,before,after:resident.trust};
}
export function residentMemoryText(memoryId: string, registry: Registry): string {
  const conversation=memoryId.match(/^conversation:(welcomed|declined|gift):\d+$/);
  if(conversation)return ({welcomed:'曾明确愿意继续交谈',declined:'曾结束一次不愉快的交谈',gift:'接受过实际赠送的心意'} as Record<string,string>)[conversation[1]!]!;
  if (memoryId.startsWith('talk:')) return '交换过当天近况';
  if (memoryId.startsWith('help:')) return '一起处理过实际事务';
  return registry.text(memoryId as Id);
}
export function validResidentQuestMemory(registry: Registry, residentId: string, memoryId: string): boolean {
  return registry.contentPacks.some(p => p.actions.some(a => a.context && registry.event(a.context.eventId).residentIds?.includes(residentId) && a.effects.some(e => e.op === 'resident.remember' && e.residentId === residentId && e.memoryId === memoryId)));
}
