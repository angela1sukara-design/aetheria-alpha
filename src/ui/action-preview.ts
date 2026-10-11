import type { ActionDef } from '../core/types.ts';
import type { Registry } from '../content/registry.ts';

/** Display only explicit, public costs; never execute an action or inspect future prose. */
export function actionPreview(action: ActionDef, registry: Registry): string[] {
  const minutes = action.effects.reduce((sum, effect) => sum + (effect.op === 'clock.advance' ? effect.minutes : 0), 0);
  const tags: string[] = [];
  if (minutes) tags.push(minutes >= 60 ? `${Math.floor(minutes / 60)}小时${minutes % 60 ? `${minutes % 60}分钟` : ''}` : `${minutes}分钟`);
  const amounts = new Map<string, number>();
  for (const effect of action.effects) if (effect.op === 'var.change') amounts.set(effect.id, (amounts.get(effect.id) ?? 0) + effect.amount);
  for (const [id, amount] of amounts) {
    if (!amount) continue;
    const variable = registry.variables.find(variable => variable.id === id);
    if (variable) tags.push(`${variable.label} ${amount > 0 ? '+' : '−'}${Math.abs(amount)}${variable.unit}`);
  }
  return tags;
}
