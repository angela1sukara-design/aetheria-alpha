import type { ActionOption, GameView, Id } from '../core/types.ts';
import type { Registry } from '../content/registry.ts';
import { npcLocation, npcPresent, nextNPCAppearance } from '../engine/npc.ts';
import { formatClock } from '../engine/clock.ts';
import { byId, element } from './render.ts';
function shortTime(n: number): string { return `${String(Math.floor(n / 60)).padStart(2, '0')}:${String(n % 60).padStart(2, '0')}`; }
function locationText(view: GameView, registry: Registry, id: Id): string {
  const location = npcLocation(view.state, registry, id);
  return location ? `此刻在${registry.location(location).name}` : '此刻不在公开场所';
}
function nextVisitText(view: GameView, registry: Registry, id: Id, here = false): string {
  const visit = nextNPCAppearance(view.state, registry, id, here ? view.location.id : undefined);
  return visit ? `${here ? '下次回到这里' : '下次公开会面'}：${formatClock(visit.totalMinutes)} · ${registry.location(visit.locationId).name}` : '目前没有公开的再会日程。';
}
function openButton(label: string, dialog: 'people' | 'map'): HTMLButtonElement {
  const button = element('button', 'npc-find', label); button.type = 'button'; button.dataset.dialogOpen = dialog; return button;
}
export function renderNPCPanel(view: GameView, registry: Registry, makeAction: (option: ActionOption) => HTMLButtonElement): void {
  const nearby = byId('people-nearby'); nearby.replaceChildren();
  const visible = registry.npcs.filter(n => npcPresent(view.state, registry, n.id) || (view.state.npcs.some(s => s.definitionId === n.id && s.discovered) && n.schedule.some(s => s.locationId === view.location.id)));
  for (const def of visible) {
    const present = npcPresent(view.state, registry, def.id);
    const card = element('div', `npc-presence${present ? '' : ' npc-absent'}`); card.dataset.npc = def.id; card.dataset.present = String(present);
    const description = element('div', 'npc-presence-text'); description.append(element('p', '', `${def.name} · ${def.role}`));
    description.append(element('p', 'muted', present ? (view.eventTitle ? '就在这里。当前事件正在进行。' : '就在这里，可以从行动区域交谈。') : locationText(view, registry, def.id)));
    if (!present) {
      description.append(element('p', 'npc-next-visit', nextVisitText(view, registry, def.id)));
      const next = nextNPCAppearance(view.state, registry, def.id);
      if (next && next.locationId !== view.location.id) description.append(element('p', 'muted', nextVisitText(view, registry, def.id, true)));
    }
    description.append(openButton(present ? '查看人物' : '查看去向与再会', 'people'));
    card.append(element('span', 'npc-avatar', def.name.slice(0, 1)), description); nearby.append(card);
  }
  nearby.hidden = !visible.length;
  const panel = byId('people-content'); panel.replaceChildren();
  const mapPeople = byId('map-people'); mapPeople.replaceChildren();
  const known = view.state.npcs.filter(n => n.discovered);
  if (!known.length) { panel.append(element('p', 'muted', '还没有正式结识的人物。在场景中与人物交谈后，经历与关系会记在这里。')); return; }
  for (const npc of known) {
    const def = registry.npc(npc.definitionId), card = element('article', 'npc-card'); card.dataset.npc = def.id;
    card.append(element('h3', '', def.name), element('p', 'muted', def.role), element('p', 'npc-location', locationText(view, registry, def.id)), element('p', 'muted', registry.text(def.descriptionText)));
    const present = npcPresent(view.state, registry, def.id);
    if (!present) {
      card.append(element('p', 'npc-next-visit', nextVisitText(view, registry, def.id)), openButton('打开地图', 'map'));
    } else if (view.eventTitle) card.append(element('p', 'muted', '当前事件进行中。结束事件后可重新交谈。'));
    else {
      // 使用同一动作集合与可用性；完成任务不封锁再访，不生成绕过规则的按钮。
      const topics = registry.actionsForHook(def.topicHook);
      const entrances = view.actions.filter(a => a.available && topics.some(t => t.id === a.definition.id));
      if (entrances.length) { const actions = element('div', 'npc-topic-actions'); actions.append(...entrances.map(makeAction)); card.append(actions); }
    }
    const relationship = element('div', 'npc-relationship');
    for (const [field, label] of [['familiarity', '熟悉'], ['trust', '信任']] as const) {
      const value = element('span', '', `${label} ${npc.relationship[field]}`); value.dataset.relation = field; relationship.append(value);
    }
    card.append(relationship, element('h4', '', '一起经历的事'));
    const memories = element('ol', 'npc-memories');
    for (const memory of npc.memories) {
      const item = element('li'); item.dataset.memory = memory.definitionId;
      item.append(element('p', '', registry.text(registry.npcMemory(memory.definitionId).textKey)), element('small', '', formatClock(memory.recordedAt))); memories.append(item);
    }
    card.append(memories);
    const schedule = element('details', 'npc-schedule'); schedule.append(element('summary', '', '日常行程'));
    for (const s of def.schedule) schedule.append(element('p', 'muted', `${shortTime(s.start)}–${shortTime(s.end)} · ${s.locationId ? registry.location(s.locationId).name : '离场'} · ${registry.text(s.activityText)}`));
    card.append(schedule); panel.append(card);
  }
  for (const npc of known) {
    const def = registry.npc(npc.definitionId), location = npcLocation(view.state, registry, def.id);
    mapPeople.append(element('p', 'muted', `${def.name} · ${locationText(view, registry, def.id)}${location === null ? ` · ${nextVisitText(view, registry, def.id)}` : ''}`));
  }
}
