import type { ActionOption, GameState } from '../core/types.ts';
import type { Registry } from '../content/registry.ts';
import { actionPreview } from './action-preview.ts';
import { element } from './render-dom.ts';

export function actionButton(option: ActionOption, registry: Registry, compact = false, state?: GameState): HTMLButtonElement {
  const button = element('button', compact ? 'map-label' : 'action-button'); button.type = 'button';
  button.dataset.action = option.definition.id; button.dataset.group = option.definition.group;
  button.disabled = !option.available;
  button.append(element('span', 'action-label', option.definition.label));
  const preview = actionPreview(option.definition, registry, state);
  const rawHint = option.available ? option.definition.hint : option.reason;
  const normalize = (text: string) => text.replace(/\s/g, '');
  const hint = option.available ? rawHint.split(' · ').filter(part => {
    if (part === '选择会推进经历 · 查看行动反馈' || part === '选择会推进经历' || part === '查看行动反馈') return false;
    if (preview.some(tag => normalize(tag) === normalize(part))) return false;
    return !(preview.length && option.definition.effects.some(effect => effect.op === 'clock.advance' || effect.op === 'location.move') && /^(?:步行\s*)?\d+\s*(?:分钟|小时)$/.test(part));
  }).join(' · ') : rawHint;
  if (hint) button.append(element('span', 'action-hint', hint));
  if (preview.length) {
    const costs = element('span', 'action-costs');
    costs.append(...preview.map(text => element('span', '', text))); button.append(costs);
  }
  if (!option.available) button.title = option.reason;
  return button;
}

/** 主列表密度：购买/装备/使用只留在背包面板，不占「下一步」。 */
export function isInventoryOnlyAction(option: ActionOption): boolean {
  if(option.definition.conditions.some(c=>c.op==='service.available'&&c.subject==='resident'))return false;
  const id = option.definition.id;
  if (/\.buy\.|:buy\./.test(id)) return true;
  if (option.definition.effects.some(e => e.op === 'equipment.wear' || e.op === 'item.use')) return true;
  // 战内消耗品按钮仍留在事件/战斗选择里
  if (option.definition.effects.some(e => e.op === 'combat.turn' && (e as { move?: string }).move === 'item')) return false;
  return false;
}
/** 训练 + 经营/订单/巡查/协作/调解 → 「更多日常」折叠。 */
export function isMoreDailyAction(option: ActionOption): boolean {
  if(option.definition.conditions.some(c=>c.op==='service.available'&&c.subject==='resident'))return false;
  const id = option.definition.id;
  if (/\.train\.|:train\./.test(id)) return true;
  if (/:action\.(order|invest|patrol|aid|reconcile)$/.test(id)) return true;
  if (option.definition.effects.some(e => e.op === 'progression.act' && ['train', 'order', 'invest', 'patrol', 'aid', 'reconcile'].includes((e as { move?: string }).move ?? ''))) return true;
  return false;
}
/** 主列表优先排序：休息/伤势 → 出行 → 挑战/环境 → 短叙事 → NSFW试跑 → 战败8玩法。 */
export function mainActionPriority(option: ActionOption): number {
  const id = option.definition.id;
  const ops = option.definition.effects.map(e => e.op);
  if (/:action\.(rest|sleep|care)$/.test(id) || ops.includes('var.change') && /rest|sleep|care/.test(id)) return 10;
  if (ops.includes('location.move') || option.definition.group === 'travel') return 20;
  if (ops.includes('combat.start') || ops.includes('combat.encounter') || /challenge\.|encounter\.env/.test(id)) return 30;
  if (/nsfwcombo/.test(id)) return 50;
  if (/defeat\.play/.test(id)) return 60;
  if (ops.includes('narrative.start') || ops.includes('narrative.choose') || /narrative\./.test(id)) return 40;
  return 80;
}
