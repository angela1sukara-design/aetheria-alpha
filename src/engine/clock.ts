import { RuleError } from '../core/errors.ts';
import type { GameState } from '../core/types.ts';
import { advanceWorldSimulation } from '../world/simulation.ts';
export const MINUTES_PER_DAY = 1440;
export function formatClock(totalMinutes: number): string {
  const minute = totalMinutes % MINUTES_PER_DAY;
  return `第 ${Math.floor(totalMinutes / MINUTES_PER_DAY) + 1} 天 · ${String(Math.floor(minute / 60)).padStart(2, '0')}:${String(minute % 60).padStart(2, '0')}`;
}
/** 逐个午夜发出边界；以后账单/TF 订阅这些边界，不能从 UI 或重绘结算。 */
export function advanceClock(state: GameState, minutes: number): void {
  if (!Number.isSafeInteger(minutes) || minutes < 0 || minutes > 10080) throw new RuleError('INVALID_DURATION', '一次行动时间必须为 0–10080 分钟整数。');
  const before = state.clock.totalMinutes;
  const after = before + minutes;
  if (!Number.isSafeInteger(after)) throw new RuleError('CLOCK_OVERFLOW', '时间超过可存储范围。');
  for (let day = Math.floor(before / MINUTES_PER_DAY) + 1; day <= Math.floor(after / MINUTES_PER_DAY); day++) {
    if (!state.clock.crossedDays.includes(day)) state.clock.crossedDays.push(day);
  }
  state.clock.totalMinutes = after;
  advanceWorldSimulation(state);
}
