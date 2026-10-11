import type { GameView, Id } from '../core/types.ts';
import type { Registry } from '../content/registry.ts';
import { npcLocation, npcPresent } from '../engine/npc.ts';
import { formatClock } from '../engine/clock.ts';
import { byId, element } from './render.ts';
function shortTime(n: number): string { return `${String(Math.floor(n / 60)).padStart(2, '0')}:${String(n % 60).padStart(2, '0')}`; }
function locationText(view: GameView, registry: Registry, id: Id): string {
  const location = npcLocation(view.state, registry, id);
  return location ? `此刻在${registry.location(location).name}` : '此刻不在公开场所';
}
export function renderNPCPanel(view: GameView, registry: Registry): void {
  const nearby = byId('people-nearby'); nearby.replaceChildren();
  const present = registry.npcs.filter(n => npcPresent(view.state, registry, n.id));
  for (const def of present) {
    const card = element('div', 'npc-presence'); card.dataset.npc = def.id;
    card.append(element('span', 'npc-avatar', def.name.slice(0, 1)), element('div', '', `${def.name} · ${def.role}`)); nearby.append(card);
  }
  nearby.hidden = !present.length;
  const panel = byId('people-content'); panel.replaceChildren();
  const known = view.state.npcs.filter(n => n.discovered);
  if (!known.length) { panel.append(element('p', 'muted', '还没有正式结识的人物。在场景中与人物交谈后，经历与关系会记在这里。')); return; }
  for (const npc of known) {
    const def = registry.npc(npc.definitionId), card = element('article', 'npc-card'); card.dataset.npc = def.id;
    card.append(element('h3', '', def.name), element('p', 'muted', def.role), element('p', 'npc-location', locationText(view, registry, def.id)), element('p', 'muted', registry.text(def.descriptionText)));
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
}
