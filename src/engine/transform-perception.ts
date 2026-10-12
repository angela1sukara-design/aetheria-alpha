import type { GameState } from '../core/types.ts';
import type { Registry } from '../content/registry.ts';

/**
 * transformPerception：只读派生，不写独立标量 Variable。
 * TODO: 从 BodyGraph / TF 状态汇总观感分值，供文风与条件查询；勿存 player.variables。
 */
export function transformPerception(_state: GameState, _registry: Registry): number {
  return 0;
}
