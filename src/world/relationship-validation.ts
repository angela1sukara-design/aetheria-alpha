import type { GameState } from '../core/types.ts';
import { stableJson } from '../core/types.ts';
import type { Registry } from '../content/registry.ts';
import { integer, list, object, string, strings } from './schema.ts';

/** Validate the saved hierarchy against saved quests and people; never regenerate during load. */
export function validateMainRelationships(state: GameState, registry: Registry): void {
  const world = state.worldInstance!, tree = world.definition.relationshipTree, quests = world.definition.quests;
  if (!tree) {
    if (quests && ['0.6.0','0.7.0','0.8.0','0.9.0','0.10.0'].includes(world.generation.generatorVersion)) throw Error('缺少主线人物关系树。');
    return;
  }
  if (!quests || !['0.6.0','0.7.0','0.8.0','0.9.0','0.10.0'].includes(world.generation.generatorVersion)) throw Error('主线关系树版本或任务来源无效。');
  object(tree, ['version', 'mainQuestId', 'goal', 'paths', 'roles', 'sideLinks']);
  string(tree.mainQuestId); string(tree.goal);
  if (tree.version !== 1 || tree.mainQuestId !== quests.journal[0]?.id || !quests.journal[0]?.steps[0]?.text.startsWith(tree.goal + ' ')) throw Error('关系树根节点与主线目标不一致。');
  const pathIds = new Set<string>(), memberIds = new Set<string>(), stageIds = new Set<string>();
  list(tree.paths, raw => {
    const p = raw as typeof tree.paths[number]; object(p, ['id', 'label', 'coordinatorId', 'memberIds', 'stageIds']);
    [p.id, p.label, p.coordinatorId].forEach(string); strings(p.memberIds, 1); strings(p.stageIds, 3);
    if (p.stageIds.length > 4 || pathIds.has(p.id) || !p.memberIds.includes(p.coordinatorId) || quests.journal.find(j => j.id === p.id)?.title !== p.label) throw Error('主线路线人物圈无效。');
    pathIds.add(p.id);
    for (const id of p.memberIds) {
      if (memberIds.has(id) || !world.agents.some(a => a.residentId === id)) throw Error('人物圈成员缺失或重复归属。'); memberIds.add(id);
    }
    for (const [i, id] of p.stageIds.entries()) {
      const binding = quests.stages.find(s => s.id === id);
      if (!binding || stageIds.has(id)) throw Error('人物圈阶段缺失或重复。'); stageIds.add(id);
      const previous = i ? quests.stages.find(s => s.id === p.stageIds[i - 1])!.flag : 'main:flag.started';
      if (!registry.action(binding.entryActionId).conditions.some(c => c.op === 'flag.has' && c.id === previous && c.value)) throw Error('关系树阶段顺序与主线前置不一致。');
    }
  }, 2, 3);
  if (memberIds.size !== world.agents.length || stageIds.size !== quests.stages.length || Math.max(...tree.paths.map(p => p.memberIds.length)) - Math.min(...tree.paths.map(p => p.memberIds.length)) > 1) throw Error('主线人物圈覆盖不完整或分布失衡。');
  const roleStages = new Set<string>();
  list(tree.roles, raw => {
    const r = raw as typeof tree.roles[number]; object(r, ['stageId', 'pathId', 'label', 'locationId', 'residentId']);
    [r.stageId, r.pathId, r.label, r.locationId].forEach(string);
    const path = tree.paths.find(p => p.id === r.pathId), stage = quests.stages.find(s => s.id === r.stageId);
    const location = world.definition.locations.find(l => l.id === r.locationId), stageLocation = world.definition.locations.find(l => l.id === stage?.locationId);
    if (!path?.stageIds.includes(r.stageId) || roleStages.has(r.stageId) || !stage || !location || location.service !== stageLocation?.service || !registry.text(registry.event(stage.eventId).nodes[0]!.textVariants[0]!).startsWith(r.label + '\n\n')) throw Error('主线阶段联络角色不一致。');
    roleStages.add(r.stageId);
    if (r.residentId === null) { if (r.locationId !== stage.locationId) throw Error('公共联络点必须使用实际主线地点。'); }
    else if (!world.agents.find(a => a.residentId === r.residentId)?.schedule.some(s => s.locationId === r.locationId)) throw Error('主线联络人不能到达标注地点。');
  }, quests.stages.length, quests.stages.length);
  const sideIds = new Set<string>();
  const sameIds = (a: string[], b: string[]) => stableJson([...a].sort()) === stableJson([...b].sort());
  list(tree.sideLinks, raw => {
    const link = raw as typeof tree.sideLinks[number]; object(link, ['sideId', 'pathIds', 'stageIds']); string(link.sideId); strings(link.pathIds); strings(link.stageIds);
    const side = quests.sides.find(s => s.id === link.sideId);
    if (!side || sideIds.has(link.sideId) || link.pathIds.some(id => !pathIds.has(id)) || link.stageIds.some(id => !tree.paths.some(p => link.pathIds.includes(p.id) && p.stageIds.includes(id)))) throw Error('支线与主线关系无效。'); sideIds.add(link.sideId);
    const supported = quests.stages.filter(stage => registry.event(stage.eventId).nodes.flatMap(n => n.actionIds).map(id => registry.action(id)).some(a => a.conditions.some(c => c.op === 'flag.has' && c.id === side.flag && c.value))).map(s => s.id);
    if (supported.length) {
      if (!sameIds(link.stageIds, supported) || !sameIds(link.pathIds, tree.paths.filter(p => p.stageIds.some(id => supported.includes(id))).map(p => p.id))) throw Error('相关支线必须关联实际旗标支持的主线阶段。');
    } else if (side.residentId) {
      const primary = tree.paths.find(p => p.memberIds.includes(side.residentId!))!;
      if (!sameIds(link.pathIds, [primary.id]) || link.stageIds.length > 1 || link.stageIds.some(id => !tree.roles.some(r => r.pathId === primary.id && r.stageId === id && r.residentId === side.residentId && world.definition.locations.find(l => l.id === r.locationId)!.service === world.definition.locations.find(l => l.id === side.locationId)!.service))) throw Error('人物支线与所属人物圈不一致。');
    } else if (link.pathIds.length || link.stageIds.length) throw Error('当地短篇不能伪造主线作用。');
  }, quests.sides.length, quests.sides.length);
  const primary = (id: string) => tree.paths.find(p => p.memberIds.includes(id))!;
  for (const agent of world.agents) {
    const edges = agent.relationships!; integer(edges.length, 1, 4);
    for (const edge of edges) {
      if (edge.kind === 'ally' && primary(agent.residentId).id !== primary(edge.otherResidentId).id || edge.kind === 'rival' && primary(agent.residentId).id === primary(edge.otherResidentId).id) throw Error('协作或竞争关系与主线人物圈不一致。');
    }
  }
  // Every circle is independently connected, and the rival bridges connect the circles.
  const reaches = (members: string[]) => {
    const reached = new Set([members[0]!]);
    for (let size = -1; size !== reached.size;) { size = reached.size; for (const agent of world.agents.filter(a => reached.has(a.residentId))) for (const edge of agent.relationships!) if (members.includes(edge.otherResidentId)) reached.add(edge.otherResidentId); }
    return reached.size === members.length;
  };
  if (tree.paths.some(p => !reaches(p.memberIds)) || !reaches([...memberIds])) throw Error('主线人物关系网存在孤立圈或孤立人物。');
  for (let i = 1; i < tree.paths.length; i++) if (!world.agents.some(a => tree.paths[i - 1]!.memberIds.includes(a.residentId) && a.relationships!.some(e => e.kind === 'rival' && tree.paths[i]!.memberIds.includes(e.otherResidentId)))) throw Error('主线路线之间缺少竞争联络关系。');
}
