import type { Effect, GameState } from '../core/types.ts';
import type { Registry } from '../content/registry.ts';
/** 预检可确定的直接扣费，按执行顺序计算并遵循上限。
 * 节点进入/TF付款会改变资源；遇到这些边界即停止推断，余下仍由事务原子校验。
 * 不执行效果，不消费随机数，不修改权威状态。
 */
export function directResourceCheck(effects: Effect[], state: GameState, registry: Registry): { pass: boolean; reason: string } {
  const balances = { ...state.player.variables };
  for (const effect of effects) {
    if (effect.op === 'event.start' || effect.op === 'event.advance' || effect.op === 'tf.enqueue') break;
    if (effect.op !== 'var.change') continue;
    const def = registry.variable(effect.id), before = balances[effect.id];
    const after = Math.min(def.max, before + effect.amount);
    if (after < def.min) return { pass: false, reason: `${def.label}不足：当前 ${before}，本次需要 ${-effect.amount}。` };
    balances[effect.id] = after;
  }
  return { pass: true, reason: '' };
}
