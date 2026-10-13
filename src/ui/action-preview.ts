import type { ActionDef, GameState } from '../core/types.ts';
import type { Registry } from '../content/registry.ts';
import { routeDurationMinutes, routeStaminaCost } from '../engine/numerics.ts';
import { publicActionEffects } from '../engine/narrative.ts';

/** Display only explicit, public costs; never execute an action or inspect future prose. */
export function actionPreview(action: ActionDef, registry: Registry, state?: GameState): string[] {
  const effects=state?publicActionEffects(action,state,registry):action.effects;
  const hasMove = effects.some(effect => effect.op === 'location.move');
  let minutes = 0;
  for (const effect of effects) {
    if (effect.op === 'location.move') minutes += routeDurationMinutes(registry.route(effect.routeId));
    else if (effect.op === 'clock.advance' && !hasMove) minutes += effect.minutes;
  }
  const tags: string[] = [];
  if (minutes) tags.push(minutes >= 60 ? `${Math.floor(minutes / 60)}小时${minutes % 60 ? `${minutes % 60}分钟` : ''}` : `${minutes}分钟`);
  const amounts = new Map<string, number>();
  for (const effect of effects) if (effect.op === 'location.move') amounts.set('core:stamina', (amounts.get('core:stamina') ?? 0) - routeStaminaCost(registry.route(effect.routeId)));
  for (const effect of effects) if (effect.op === 'var.change') amounts.set(effect.id, (amounts.get(effect.id) ?? 0) + effect.amount);
  if(action.id==='aetheria:action.rest'&&!amounts.has('core:stamina'))amounts.set('core:stamina',Math.floor(minutes/30)*12);
  for (const [id, amount] of amounts) {
    if (!amount) continue;
    const variable = registry.variables.find(variable => variable.id === id);
    if (variable) tags.push(`${variable.label} ${amount > 0 ? '+' : '−'}${Math.abs(amount)}${variable.unit}`);
  }
  return tags;
}
