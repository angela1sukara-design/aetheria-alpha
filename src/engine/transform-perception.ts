import type { GameState } from '../core/types.ts';
import type { Registry } from '../content/registry.ts';
import { clamp } from './numerics.ts';

/**
 * BodyGraph 可 TF 槽：非 root 部位。
 * 已填槽：带 provenance（经历过 TF patch）的部位。
 * 无身体或无线索时返回 0；不写 player.variables。
 */
export function transformProgress(state: GameState, registry?: Registry): number {
  const body = state.player.body;
  if (!body?.parts.length) return 0;
  const slots = body.parts.filter(p => {
    if (p.instanceId === body.rootPartId) return false;
    if (!registry) return !p.instanceId.startsWith('root');
    try {
      return registry.bodyPart(p.definitionId).kind !== 'root';
    } catch {
      return true;
    }
  });
  const relevantCount = slots.length;
  if (relevantCount === 0) return 0;
  const filled = slots.filter(p => !!p.provenance).length;
  return clamp(Math.round((100 * filled) / relevantCount), 0, 100);
}

/**
 * transformPerception：文风用观感分；当前与 transformProgress 同值。
 * 只读派生，勿存标量 Variable。
 */
export function transformPerception(state: GameState, registry: Registry): number {
  return transformProgress(state, registry);
}
