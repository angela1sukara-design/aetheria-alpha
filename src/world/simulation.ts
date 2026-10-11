import type { GameState } from '../core/types.ts';

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
