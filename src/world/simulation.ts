import type { GameState, Id } from '../core/types.ts';

/** Public, read-only schedule information; no unseen names or event pool leaks. */
export function worldActivityAt(state: GameState, locationId: Id): { present: number; nextArrival?: { minutes: number; count: number } } | undefined {
  const world = state.worldInstance; if (!world || !state.district) return undefined;
  const minute = state.clock.totalMinutes % 1440;
  let earliest = Infinity; const arrivals = new Set<string>();
  for (const agent of world.agents) for (const [index, slot] of agent.schedule.entries()) {
    const previous = agent.schedule[(index + agent.schedule.length - 1) % agent.schedule.length]!;
    if (slot.locationId !== locationId || previous.locationId === locationId) continue;
    const delta = (slot.start - minute + 1440) % 1440 || 1440;
    if (delta < earliest) { earliest = delta; arrivals.clear(); }
    if (delta === earliest) arrivals.add(agent.residentId);
  }
  return { present: state.district.residents.filter(r => r.locationId === locationId).length, ...(arrivals.size ? { nextArrival: { minutes: earliest, count: arrivals.size } } : {}) };
}

/** 模拟器只推进已存在的人，不抽生成随机数，不创建定义，不由渲染调用。
 * v0.1 日程在时间边界原子迁移；未来逐段路程、职业/关系变化在此扩展。
 */
export function advanceWorldSimulation(state: GameState): void {
  const w = state.worldInstance;
  if (!w || !state.district) return;
  const minute = state.clock.totalMinutes % 1440;
  for (const agent of w.agents) {
    const resident = state.district.residents.find(r => r.id === agent.residentId);
    const slot = agent.schedule.find(s => minute >= s.start && minute < s.end);
    if (resident && slot) resident.locationId = slot.locationId;
  }
  const current = state.district.residents.find(r => r.id === state.district!.currentResidentId);
  if (current && current.locationId !== state.world.locationId) state.district.currentResidentId = null;
  w.simulation.lastMinute = state.clock.totalMinutes;
}
