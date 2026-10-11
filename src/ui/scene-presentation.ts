import type { ActionDef, ActionResult, GameView, Id } from '../core/types.ts';
import type { Registry } from '../content/registry.ts';
import { activeEvent } from '../engine/events.ts';

export type SceneMode = 'arrival' | 'hub' | 'conversation' | 'event' | 'combat' | 'interaction' | 'result' | 'residents';
export interface ScenePresentation {
  mode: SceneMode;
  title: string;
  subtitle: string;
  label: string;
  active: boolean;
  primaryResult: boolean;
}
export function resultAction(view: GameView, registry: Registry, result?: ActionResult): ActionDef | undefined {
  const transaction = view.state.ledger.transactions.find(tx => tx.requestId === result?.requestId);
  if (!transaction) return;
  try {
    const intent: unknown = JSON.parse(transaction.fingerprint);
    if (intent && typeof intent === 'object' && 'actionId' in intent && typeof intent.actionId === 'string')
      return registry.action(intent.actionId as Id);
  } catch { /* Older save records can still display their result without an action title. */ }
}
export function scenePresentation(view: GameView, registry: Registry, result?: ActionResult, browsing = false): ScenePresentation {
  const district = view.state.district;
  if (district?.combat) {
    const enemy = registry.enemies.find(enemy => enemy.id === district.combat!.enemyId);
    return { mode: 'combat', title: enemy?.name ?? '眼前的对手', subtitle: `第 ${district.combat.turn + 1} 回合 · 观察意图，再决定行动`, label: '正在交锋', active: true, primaryResult: false };
  }
  if (district?.scene) {
    const interaction = registry.interactions.find(item => item.id === district.scene!.definitionId);
    const npc = interaction && registry.npc(interaction.npcId);
    return { mode: 'interaction', title: npc ? `与${npc.name}相处` : '安静相处', subtitle: district.scene.phase === 'paused' ? '已暂停 · 可以继续或离开' : '可以随时暂停或离开', label: '私人相处', active: true, primaryResult: false };
  }
  const event = activeEvent(view.state);
  if (event) {
    const participants = (registry.event(event.definitionId).participantIds ?? []).map(id => registry.npc(id));
    const title = participants.length ? `与${participants.map(npc => npc.name).join('、')}交谈` : '眼前的遭遇';
    return { mode: participants.length ? 'conversation' : 'event', title, subtitle: participants.length ? participants.map(npc => npc.role).join(' · ') : '故事正在继续 · 做出你的选择', label: '正在发生', active: true, primaryResult: false };
  }
  if (browsing) return { mode: 'hub', title: '接下来做什么', subtitle: '与身边的人交谈，或继续探索街区。', label: '自由行动', active: false, primaryResult: false };
  const action = resultAction(view, registry, result);
  if (!result?.ok || action?.effects.some(effect => effect.op === 'location.move'))
    return { mode: 'arrival', title: view.location.name, subtitle: view.location.subtitle, label: '抵达地点', active: false, primaryResult: false };
  const residentAction = action?.effects.some(effect => effect.op === 'resident.talk' || effect.op === 'resident.help');
  const resident = district?.residents.find(npc => npc.id === district.currentResidentId);
  if (residentAction && resident)
    return { mode: 'conversation', title: `与${resident.name}交谈`, subtitle: resident.profession, label: '人物互动', active: false, primaryResult: true };
  const meeting = action?.effects.some(effect => effect.op === 'world.encounter' && effect.events === false);
  return { mode: meeting ? 'residents' : 'result', title: meeting ? '在场的居民' : action?.label ?? '刚刚的行动', subtitle: meeting ? '选中一位居民，开始交谈或帮忙。' : '你的行动留下了新的进展。', label: meeting ? '认识彼此' : '行动结果', active: false, primaryResult: true };
}
