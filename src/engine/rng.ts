import type { GameState } from '../core/types.ts';
/** 每个事件实例独立流；只允许在事务草稿上抽样，失败的事务不会消耗随机状态。 */
export function draw(state: GameState, streamId: string): number {
  let stream = state.rng.streams[streamId];
  if (!stream) {
    let hash = state.rng.seed >>> 0;
    for (const char of streamId) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619) >>> 0;
    stream = state.rng.streams[streamId] = { state: hash || 0x9e3779b9, draws: 0 };
  }
  let x = stream.state;
  x ^= x << 13; x ^= x >>> 17; x ^= x << 5;
  stream.state = x >>> 0; stream.draws++;
  return stream.state / 4294967296;
}
