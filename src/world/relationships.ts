import type { QuestBinding, QuestContent, QuestSide } from '../core/quest-types.ts';
import type { Id } from '../core/types.ts';
import type { MainRelationshipTree, ResidentRelationKind, WorldAgent, WorldDef } from './types.ts';

export const RESIDENT_RELATION_LABELS: Record<ResidentRelationKind, string> = {
  coworker: '同事', neighbor: '邻居', acquaintance: '熟人', ally: '主线协作', rival: '路线竞争'
};
function rank(seed: number, key: string): number {
  let value = (2166136261 ^ seed) >>> 0;
  for (const char of key) value = Math.imul(value ^ char.charCodeAt(0), 16777619) >>> 0;
  return value;
}
const compare = (seed: number, key: string, a: string, b: string) => rank(seed, key + ':' + a) - rank(seed, key + ':' + b) || a.localeCompare(b, 'en');

/** The quest hierarchy determines circles first; geography determines the small local network within them. */
export function generateMainRelationships(content: QuestContent, seed: number, definition: WorldDef, agents: WorldAgent[], stages: QuestBinding[]): MainRelationshipTree {
  const source = content.source.mainQuest;
  const orderedAgents = [...agents].sort((a, b) => a.residentId.localeCompare(b.residentId, 'en'));
  const sourcePaths = [...source.paths].sort((a, b) => a.id.localeCompare(b.id, 'en'));
  const tree: MainRelationshipTree = {
    version: 1, mainQuestId: source.id, goal: source.goal,
    paths: sourcePaths.map(p => ({ id: p.id, label: p.style, coordinatorId: '', memberIds: [], stageIds: p.stages.map(s => s.id) })),
    roles: [], sideLinks: []
  };
  const serviceAt = (id: Id) => definition.locations.find(l => l.id === id)!.service;
  const affinity = (agent: WorldAgent, pathId: string) => sourcePaths.find(p => p.id === pathId)!.stages.reduce((score, stage, i) =>
    score + (serviceAt(agent.originLocationId) === stage.locationType ? 40 + 4 - i : 0), 0);
  const remaining = new Set(orderedAgents.map(a => a.residentId));
  // Reserve a real, distinct coordinator for each path even in a three-resident world.
  for (const path of tree.paths) {
    const lead = orderedAgents.filter(a => remaining.has(a.residentId)).sort((a, b) => affinity(b, path.id) - affinity(a, path.id) || compare(seed, 'coordinator.' + path.id, a.residentId, b.residentId))[0]!;
    path.coordinatorId = lead.residentId; path.memberIds.push(lead.residentId); remaining.delete(lead.residentId);
  }
  const capacity = Math.ceil(agents.length / tree.paths.length);
  const minimum = Math.floor(agents.length / tree.paths.length);
  for (const agent of orderedAgents.filter(a => remaining.has(a.residentId)).sort((a, b) => compare(seed, 'membership', a.residentId, b.residentId))) {
    const underfilled = tree.paths.filter(p => p.memberIds.length < minimum);
    const path = (underfilled.length ? underfilled : tree.paths.filter(p => p.memberIds.length < capacity)).sort((a, b) =>
      (affinity(agent, b.id) - b.memberIds.length * 8) - (affinity(agent, a.id) - a.memberIds.length * 8) || compare(seed, 'path.' + agent.residentId, a.id, b.id))[0]!;
    path.memberIds.push(agent.residentId);
  }
  for (const path of tree.paths) path.memberIds.sort((a, b) => a.localeCompare(b, 'en'));
  const membership = (residentId: string) => tree.paths.find(p => p.memberIds.includes(residentId))!;
  const loads = new Map<string, number>();
  // Interleave paths so an early path cannot consume all of the best contacts.
  for (let index = 0; index < Math.max(...sourcePaths.map(p => p.stages.length)); index++) for (const path of sourcePaths) {
    const stage = path.stages[index]; if (!stage) continue;
    const binding = stages.find(s => s.id === stage.id)!;
    const candidates = orderedAgents.filter(a => a.schedule.some(s => serviceAt(s.locationId) === stage.locationType));
    const contact = candidates.sort((a, b) =>
      Number(membership(b.residentId).id === path.id) - Number(membership(a.residentId).id === path.id)
      || (loads.get(a.residentId) ?? 0) - (loads.get(b.residentId) ?? 0)
      || Number(b.schedule.some(s => s.locationId === binding.locationId)) - Number(a.schedule.some(s => s.locationId === binding.locationId))
      || compare(seed, 'contact.' + stage.id, a.residentId, b.residentId))[0];
    const visit = contact?.schedule.filter(s => serviceAt(s.locationId) === stage.locationType).sort((a, b) =>
      Number(b.locationId === binding.locationId) - Number(a.locationId === binding.locationId) || a.start - b.start)[0];
    tree.roles.push({ stageId: stage.id, pathId: path.id, label: stage.name, locationId: visit?.locationId ?? binding.locationId, residentId: contact?.residentId ?? null });
    if (contact) loads.set(contact.residentId, (loads.get(contact.residentId) ?? 0) + 1);
  }

  const byId = (id: string) => orderedAgents.find(a => a.residentId === id)!;
  for (const agent of agents) agent.relationships = [];
  const degree = (id: string) => byId(id).relationships!.length;
  const localKind = (a: WorldAgent, b: WorldAgent): ResidentRelationKind | undefined =>
    a.originLocationId === b.originLocationId ? 'coworker' : a.schedule.some(s => s.activity === 'home' && b.schedule.some(t => t.activity === 'home' && t.locationId === s.locationId)) ? 'neighbor' : undefined;
  const sharedRoles = (a: string, b: string) => tree.roles.filter(r => r.residentId === a).some(r => tree.roles.some(s => s.residentId === b && s.pathId === r.pathId));
  const score = (a: string, b: string) => {
    const kind = localKind(byId(a), byId(b));
    return (kind === 'coworker' ? 100 : kind === 'neighbor' ? 70 : 0) + (sharedRoles(a, b) ? 30 : 0) + (byId(a).factionId === byId(b).factionId ? 10 : 0);
  };
  const connect = (a: string, b: string, kind: ResidentRelationKind) => {
    if (a === b || byId(a).relationships!.some(e => e.otherResidentId === b)) return;
    byId(a).relationships!.push({ otherResidentId: b, kind, strength: 10 });
    byId(b).relationships!.push({ otherResidentId: a, kind, strength: 10 });
  };
  // Each path has a connected, bounded-degree collaboration tree, rooted at its coordinator.
  for (const path of tree.paths) {
    const connected = new Set([path.coordinatorId]);
    while (connected.size < path.memberIds.length) {
      const pairs = [...connected].filter(a => degree(a) < 3).flatMap(a => path.memberIds.filter(b => !connected.has(b)).map(b => ({ a, b })));
      pairs.sort((a, b) => score(b.a, b.b) - score(a.a, a.b) || compare(seed, 'within.' + path.id, a.a + ':' + a.b, b.a + ':' + b.b));
      const pair = pairs[0]!; connect(pair.a, pair.b, localKind(byId(pair.a), byId(pair.b)) ?? 'ally'); connected.add(pair.b);
    }
  }
  // Rival circles share the apex goal; one bridge per adjacent path keeps the whole graph connected.
  for (let i = 1; i < tree.paths.length; i++) {
    const pairs = tree.paths[i - 1]!.memberIds.flatMap(a => tree.paths[i]!.memberIds.map(b => ({ a, b })));
    pairs.sort((a, b) => degree(a.a) + degree(a.b) - degree(b.a) - degree(b.b) || score(b.a, b.b) - score(a.a, a.b) || compare(seed, 'bridge.' + i, a.a + ':' + a.b, b.a + ':' + b.b));
    connect(pairs[0]!.a, pairs[0]!.b, 'rival');
  }
  // A few real home/work ties can cross the circles; no invented friendships or social simulation.
  const localPairs = orderedAgents.flatMap((a, i) => orderedAgents.slice(i + 1).filter(b => localKind(a, b)).map(b => ({ a, b })));
  localPairs.sort((a, b) => score(b.a.residentId, b.b.residentId) - score(a.a.residentId, a.b.residentId) || compare(seed, 'local', a.a.residentId + ':' + a.b.residentId, b.a.residentId + ':' + b.b.residentId));
  for (const { a, b } of localPairs) if (degree(a.residentId) < 4 && degree(b.residentId) < 4) connect(a.residentId, b.residentId, localKind(a, b)!);
  for (const agent of agents) agent.relationships!.sort((a, b) => a.otherResidentId.localeCompare(b.otherResidentId, 'en'));
  return tree;
}

export function mainStagesSupportedBy(content: QuestContent, side: QuestSide): string[] {
  return content.source.mainQuest.paths.flatMap(p => p.stages).filter(s => content.execution.stages[s.id]!.some(c => c.complete && c.requires.includes(side.flag))).map(s => s.id);
}
/** Priority only: existing relation capacity, physical schedules and free main choices remain authoritative. */
export function sideRelationPriority(tree: MainRelationshipTree, seed: number, side: QuestSide, residentId: string): number {
  const paths = [...tree.paths].sort((a, b) => a.id.localeCompare(b.id, 'en'));
  const focus = paths[rank(seed, 'side-circle:' + side.id) % paths.length]!;
  return (focus.memberIds.includes(residentId) ? 4 : 0) + (tree.roles.some(r => r.pathId === focus.id && r.residentId === residentId) ? 2 : 0);
}
export function linkSideToMain(tree: MainRelationshipTree, content: QuestContent, side: QuestSide, binding: QuestBinding, definition: WorldDef): void {
  let stageIds = side.type === 'main-related' ? mainStagesSupportedBy(content, side) : [];
  let pathIds = tree.paths.filter(p => p.stageIds.some(id => stageIds.includes(id))).map(p => p.id);
  if (side.type === 'character' && binding.residentId) {
    const primary = tree.paths.find(p => p.memberIds.includes(binding.residentId!))!;
    pathIds = [primary.id];
    const direct = tree.roles.find(r => r.pathId === primary.id && r.residentId === binding.residentId && definition.locations.find(l => l.id === r.locationId)!.service === side.locationType);
    stageIds = direct ? [direct.stageId] : [];
  }
  tree.sideLinks.push({ sideId: side.id, pathIds, stageIds });
}
