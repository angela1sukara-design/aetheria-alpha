import type { GameView } from '../core/types.ts';
import type { Registry } from '../content/registry.ts';
import { RESIDENT_RELATION_LABELS } from '../world/relationships.ts';
import { element } from './render.ts';

/** Public quest structure is visible, but unencountered residents remain anonymous. Rendering is read-only. */
export function renderRelationshipTree(view: GameView, registry: Registry, panel: HTMLElement): void {
  const world = view.state.worldInstance, residents = view.state.district?.residents, tree = world?.definition.relationshipTree;
  if (!tree || !residents) return;
  const known = residents.filter(n => n.persistent || n.visits > 0 || n.id === view.state.district?.currentResidentId);
  const person = (id: string | null) => known.find(n => n.id === id);
  const profile = (id: string, label: string) => {
    const button = element('button', 'relation-person', label); button.type = 'button'; button.dataset.npcOpen = `resident:${id}`; return button;
  };
  const section = element('section', 'relationship-tree'); section.setAttribute('aria-label', '主线人物关系树');
  section.append(element('h3', '', '主线人物关系树'), element('p', 'relation-root', tree.goal), element('p', 'muted', '人物围绕主线路线形成协作圈，圈间争夺同一个顶点。尚未结识的人暂不显示姓名；主线不要求等待联络人到场。'));
  for (const path of tree.paths) {
    const branch = element('details', 'relation-branch'); branch.open = true; branch.dataset.relationPath = path.id;
    branch.append(element('summary', '', path.label));
    const lead = person(path.coordinatorId), revealed = path.memberIds.filter(id => person(id)).length;
    const coordinator = element('p', 'muted', `人物圈：已结识 ${revealed}/${path.memberIds.length} 位 · 核心联络人：`);
    coordinator.append(lead ? profile(lead.id, lead.name) : document.createTextNode('尚未结识')); branch.append(coordinator);
    const list = element('ol', 'relation-stages');
    for (const id of path.stageIds) {
      const role = tree.roles.find(r => r.stageId === id)!, contact = person(role.residentId);
      const item = element('li'); item.dataset.relationStage = id;
      item.append(element('strong', '', role.label), element('p', 'muted', `联络地点：${registry.location(role.locationId).name}`));
      if (contact) item.append(profile(contact.id, `${contact.name} · 阶段协作人`));
      else item.append(element('p', 'muted', role.residentId ? '阶段协作人：尚未结识' : '公共联络点：此阶段没有合适的居民协作人'));
      const linked = tree.sideLinks.filter(s => s.stageIds.includes(id));
      if (linked.length) item.append(element('p', 'muted', `${linked.length} 条支线与此阶段关联；额外方案均可跳过。`));
      list.append(item);
    }
    branch.append(list); section.append(branch);
  }
  panel.prepend(section);
  for (const resident of known) {
    const card = [...panel.querySelectorAll<HTMLElement>('[data-npc]')].find(c => c.dataset.npc === `resident:${resident.id}`);
    if (!card) continue;
    const path = tree.paths.find(p => p.memberIds.includes(resident.id))!;
    const context = element('div', 'npc-main-relations');
    context.append(element('h4', '', '主线位置'), element('p', '', path.label));
    const roles = tree.roles.filter(r => r.residentId === resident.id);
    if (roles.length) context.append(element('p', 'muted', '协作阶段：' + roles.map(r => r.label).join('、')));
    const links = tree.sideLinks.filter(s => world!.definition.quests!.sides.find(b => b.id === s.sideId)?.residentId === resident.id);
    if (links.length) context.append(element('p', 'muted', `参与 ${links.length} 条人物支线。`));
    context.append(element('h4', '', '关联人物'));
    let hidden = 0;
    const edges = world!.agents.find(a => a.residentId === resident.id)!.relationships!;
    for (const edge of edges) {
      const peer = person(edge.otherResidentId);
      if (peer) context.append(profile(peer.id, `${peer.name} · ${RESIDENT_RELATION_LABELS[edge.kind]}`)); else hidden++;
    }
    if (hidden) context.append(element('p', 'muted', `另有 ${hidden} 位尚未结识的关联人物。`));
    card.append(context);
  }
}
