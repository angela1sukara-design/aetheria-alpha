import type { NPCState } from '../core/npc-types.ts';
import type { Change, GameState, Id } from '../core/types.ts';
import type { Registry } from '../content/registry.ts';
import { RuleError } from '../core/errors.ts';
import { activeEvent } from './events.ts';
import { formatClock } from './clock.ts';
export function createNPCStates(registry: Registry): NPCState[] {
  return registry.npcs.map(def => ({ instanceId: `fixed:${def.id}`, definitionId: def.id, discovered: false, relationship: { familiarity: 0, trust: 0 }, memories: [] }));
}
export function npcState(state: GameState, npcId: Id): NPCState {
  const npc = state.npcs.find(x => x.definitionId === npcId);
  if (!npc) throw new RuleError('NPC_MISSING', '人物实例缺失。');
  return npc;
}
/** 位置按时钟派生，不在渲染时推进 NPC。活动事件只覆盖参与者；退出即恢复日程。 */
export function npcLocation(state: GameState, registry: Registry, npcId: Id): Id | null {
  const def = registry.npc(npcId), event = activeEvent(state);
  if (event && registry.event(event.definitionId).participantIds?.includes(npcId)) return state.world.locationId;
  const now = state.clock.totalMinutes % 1440;
  return def.schedule.find(s => s.start < s.end ? now >= s.start && now < s.end : now >= s.start || now < s.end)!.locationId;
}
export function npcPresent(state: GameState, registry: Registry, npcId: Id): boolean {
  return npcLocation(state, registry, npcId) === state.world.locationId;
}
export interface NPCAppearance { locationId: Id; totalMinutes: number; activityText: Id }
/** 只查询下一次公开日程，不快进时间、不写实例，也不把离场地点虚构成地图节点。 */
export function nextNPCAppearance(state: GameState, registry: Registry, npcId: Id, locationId?: Id): NPCAppearance | undefined {
  const now = state.clock.totalMinutes, dayStart = Math.floor(now / 1440) * 1440;
  const visits = registry.npc(npcId).schedule.filter(s => s.locationId !== null && (!locationId || s.locationId === locationId)).map(s => {
    const today = dayStart + s.start;
    return { locationId: s.locationId!, totalMinutes: today > now ? today : today + 1440, activityText: s.activityText };
  });
  return visits.filter(v => Number.isSafeInteger(v.totalMinutes)).sort((a, b) => a.totalMinutes - b.totalMinutes)[0];
}
/** 行动的最终状态与原状态比较。玩家自己离开不算NPC离场；回滚/重绘没有通知。 */
export function npcPresenceTransitions(before: GameState, after: GameState, registry: Registry): { changes: Change[]; texts: string[] } {
  const changes: Change[] = [], texts: string[] = [];
  if (before.world.locationId !== after.world.locationId) return { changes, texts };
  for (const def of registry.npcs) {
    const from = npcLocation(before, registry, def.id), to = npcLocation(after, registry, def.id), here = after.world.locationId;
    if (from === to) continue;
    if (from === here) {
      const destination = to ? registry.location(to).name : '暂不在公开场所';
      changes.push({ label: `${def.name}·去向`, before: registry.location(here).name, after: destination });
      texts.push(`${def.name}结束在这里的停留，${to ? `现在在${destination}。` : '暂时离开了公开场所。'}`);
      const next = nextNPCAppearance(after, registry, def.id);
      if (next) texts.push(`下次可在${registry.location(next.locationId).name}遇见${def.name}：${formatClock(next.totalMinutes)}。`);
    } else if (to === here) {
      changes.push({ label: `${def.name}·去向`, before: from ? registry.location(from).name : '暂不在公开场所', after: registry.location(here).name });
      texts.push(`${def.name}来到${registry.location(here).name}，现在可以在这里遇见。`);
    }
  }
  return { changes, texts };
}
export function hasMemory(state: GameState, npcId: Id, memoryId: Id): boolean {
  return npcState(state, npcId).memories.some(x => x.definitionId === memoryId);
}
/** 一个事实对应一次关系结算。换 requestId、重新见面或回读节点不能刷同一里程碑。 */
export function rememberNPC(state: GameState, registry: Registry, npcId: Id, memoryId: Id, delta: NPCState['relationship'], actionId: Id, requestId: string, changes: Change[]): void {
  const def = registry.npc(npcId), memoryDef = registry.npcMemory(memoryId), npc = npcState(state, npcId);
  if (memoryDef.npcId !== npcId) throw new RuleError('NPC_MEMORY_OWNER', '记忆不属于这位人物。');
  if (!npcPresent(state, registry, npcId)) throw new RuleError('NPC_ABSENT', `${def.name}不在这里，不能凭空写入她的记忆。`);
  if (hasMemory(state, npcId, memoryId)) return;
  npc.discovered = true;
  npc.memories.push({ definitionId: memoryId, recordedAt: state.clock.totalMinutes, sourceActionId: actionId, sourceRequestId: requestId });
  changes.push({ label: `${def.name}的记忆`, before: '尚未发生', after: registry.text(memoryDef.textKey) });
  for (const field of ['familiarity', 'trust'] as const) {
    const before = npc.relationship[field], after = Math.max(-100, Math.min(100, before + delta[field]));
    npc.relationship[field] = after;
    if (before !== after) changes.push({ label: `${def.name}·${field === 'trust' ? '信任' : '熟悉'}`, before, after });
  }
}
/** 未知年龄不猜测；此接口给后续分级内容校验使用。 */
export function adultNPCEligibility(registry: Registry, npcId: Id): { pass: boolean; reason: string } {
  const def = registry.npc(npcId), species = registry.species(def.speciesId);
  if (def.ageYears === null) return { pass: false, reason: '人物年龄尚未确认。' };
  if (!species.intelligent || def.ageYears < species.adultAgeYears) return { pass: false, reason: '未通过成年智慧人物资格。' };
  return { pass: true, reason: '' };
}
