import type { GameState, Id } from '../core/types.ts';
import { stableJson } from '../core/types.ts';
import type { Registry } from '../content/registry.ts';
import { integer, list, object, parseRules, services, string, strings } from './schema.ts';
import { bodyTraits } from '../engine/body.ts';

/** 快照仍是不可信输入；恢复需先经过内容 loader，再检查实例和日程约束。 */
export function validateWorldInstance(state: GameState, registry: Registry): void {
  const w = state.worldInstance; if (!w) return;
  object(w, ['version', 'definition', 'generation', 'agents', 'simulation']);
  if (w.version !== 1) throw Error('世界实例版本不支持。');
  const g = w.generation;
  object(g, ['generatorVersion', 'seed', 'rules', 'rulesHash', 'references', 'contentPacks', 'parameters', 'selectedTemplateIds']);
  if (!['0.1.0', '0.2.0', '0.2.1'].includes(g.generatorVersion)) throw Error('生成器快照版本不支持。');
  integer(g.seed, 0, 0xffffffff); if (g.seed !== state.rng.seed) throw Error('世界种子不一致。');
  parseRules(g.rules); const hashString = (v: unknown) => { if (typeof v !== 'string' || !/^[a-f0-9]{64}$/.test(v)) throw Error('世界来源哈希无效。'); };
  hashString(g.rulesHash);
  const refs = (value: unknown) => { const ids = new Set(); list(value, v => { const r = object(v, ['id', 'version', 'hash']); string(r.id); string(r.version); hashString(r.hash); if (ids.has(r.id)) throw Error('世界来源包重复。'); ids.add(r.id); }, 1, 100); };
  refs(g.references); refs(g.contentPacks); strings(g.selectedTemplateIds, 1);
  object(g.parameters, ['locationCount', 'npcCount']); integer(g.parameters.locationCount, 5, 20); integer(g.parameters.npcCount, 3, 40);
  const installedSources = registry.packs.filter(p => p.id !== 'generated/neighborhood');
  const originalSources = installedSources.filter(p => g.contentPacks.some(ref => ref.id === p.id));
  if (stableJson(g.contentPacks) !== stableJson(originalSources) || installedSources.some(p => !g.contentPacks.some(ref => ref.id === p.id) && !registry.appendOnlyPackIds.includes(p.id))) throw Error('世界内容来源与快照不一致。');
  const d = w.definition;
  object(d, ['id', 'name', 'startLocationId', 'regions', 'locations', 'factions', 'eventPool', 'packs']); string(d.id); string(d.name); registry.location(d.startLocationId);
  if (stableJson(d.packs) !== stableJson(registry.contentPacks)) {
    // loader 会按依赖排序；输入数组顺序不具有语义。
    const byPack = (packs: typeof d.packs) => stableJson([...packs].sort((a, b) => a.manifest.id.localeCompare(b.manifest.id, 'en')));
    if (byPack(d.packs) !== byPack(registry.contentPacks)) throw Error('世界定义快照不一致。');
  }
  list(d.regions, r => { object(r, ['id', 'name', 'environmentTags', 'ecologyTags']); string((r as typeof d.regions[number]).id); string((r as typeof d.regions[number]).name); strings((r as typeof d.regions[number]).environmentTags, 1); strings((r as typeof d.regions[number]).ecologyTags); }, 1, 20);
  const locationIds = new Set<Id>();
  list(d.locations, raw => {
    const l = raw as typeof d.locations[number]; object(l, ['id', 'regionId', 'templateId', 'service', 'tags', 'economy', 'professions', 'factionId']);
    registry.location(l.id); if (locationIds.has(l.id) || !l.id.startsWith('worldgen:') || !d.regions.some(r => r.id === l.regionId) || !(services as readonly string[]).includes(l.service)) throw Error('生成地点元数据无效。');
    locationIds.add(l.id); string(l.templateId); string(l.factionId); strings(l.tags, 1); strings(l.economy, 1); strings(l.professions, 1);
    if (!registry.actionsAt(l.id).length) throw Error('生成地点没有用途。');
  }, g.parameters.locationCount, g.parameters.locationCount);
  if (!locationIds.has(d.startLocationId) || !locationIds.has(state.world.locationId)) throw Error('生成世界当前位置无效。');
  for (const s of g.rules.requiredServices) if (!d.locations.some(l => l.service === s)) throw Error('生成世界缺少必需服务。');
  const reached = new Set<Id>([d.startLocationId]);
  for (let size = -1; size !== reached.size;) { size = reached.size; for (const r of registry.routes) if (locationIds.has(r.from) && locationIds.has(r.to) && reached.has(r.from)) { reached.add(r.to); if (!registry.routes.some(back => back.from === r.to && back.to === r.from)) throw Error('生成路线必须可双向返回。'); } }
  if (reached.size !== locationIds.size) throw Error('生成地图有不可达地点。');
  const factions = new Set<string>();
  list(d.factions, raw => { const f = raw as typeof d.factions[number]; object(f, ['id', 'templateId', 'name', 'activities', 'locationIds']); string(f.id); string(f.templateId); string(f.name); strings(f.activities, 1); strings(f.locationIds, 1); if (factions.has(f.id) || f.locationIds.some(id => !locationIds.has(id))) throw Error('组织分布无效。'); factions.add(f.id); }, 1, 20);
  for (const l of d.locations) if (!d.factions.some(f => f.id === l.factionId && f.locationIds.includes(l.id))) throw Error('地点组织缺失。');
  strings(d.eventPool, 1); for (const id of d.eventPool) registry.event(id);
  if (!state.district || state.district.residents.length !== g.parameters.npcCount) throw Error('生成居民数量不符。');
  const residents = new Set<string>();
  list(w.agents, raw => {
    const a = raw as typeof w.agents[number]; object(a, ['residentId', 'originLocationId', 'factionId', 'schedule', ...('relationships' in a ? ['relationships'] : [])]); string(a.residentId);
    const resident = state.district!.residents.find(r => r.id === a.residentId);
    if (!resident || residents.has(a.residentId) || !locationIds.has(a.originLocationId) || !factions.has(a.factionId)) throw Error('世界居民身份不符。'); residents.add(a.residentId);
    if (d.locations.find(l => l.id === a.originLocationId)?.factionId !== a.factionId) throw Error('居民组织与工作地点不符。');
    const traits = bodyTraits(resident.body, registry); if (traits.grasp < 1 || traits.walk < 1) throw Error('居民身体与首版职业能力规则不符。');
    let end = 0;
    list(a.schedule, raw => { const slot = raw as typeof a.schedule[number]; object(slot, ['start', 'end', 'locationId', 'activity']); integer(slot.start, 0, 1439); integer(slot.end, 1, 1440); if (slot.start !== end || slot.end <= slot.start || !locationIds.has(slot.locationId) || !['home', 'work', 'leisure'].includes(slot.activity)) throw Error('居民日程必须连续覆盖全天。'); end = slot.end;
      const location = d.locations.find(l => l.id === slot.locationId)!;
      if (slot.activity === 'work' && !location.professions.includes(resident.profession)) throw Error('居民职业与地点不兼容。');
      if ((slot.activity === 'home' && location.service !== 'home') || (slot.activity === 'leisure' && location.service !== 'commons')) throw Error('居民休息与公共活动地点用途不符。');
    }, 1, 20);
    if (end !== 1440 || a.schedule.find(s => state.clock.totalMinutes % 1440 >= s.start && state.clock.totalMinutes % 1440 < s.end)?.locationId !== resident.locationId) throw Error('居民活动位置与时钟不符。');
  }, g.parameters.npcCount, g.parameters.npcCount);
  for (const a of w.agents) {
    const peers = new Set<string>();
    list(a.relationships ?? [], raw => {
      const edge = raw as NonNullable<typeof a.relationships>[number]; object(edge, ['otherResidentId', 'kind', 'strength']); integer(edge.strength, 0, 100);
      if (!['coworker', 'neighbor', 'acquaintance'].includes(edge.kind) || edge.otherResidentId === a.residentId || peers.has(edge.otherResidentId)) throw Error('居民关系无效。'); peers.add(edge.otherResidentId);
      const b = w.agents.find(b => b.residentId === edge.otherResidentId);
      if (!b?.relationships?.some(back => back.otherResidentId === a.residentId && back.kind === edge.kind && back.strength === edge.strength)) throw Error('居民关系必须指向已存在人物并双向一致。');
      if ((edge.kind === 'coworker' && a.originLocationId !== b.originLocationId) || (edge.kind === 'neighbor' && a.schedule[0].locationId !== b.schedule[0].locationId)) throw Error('居民共同经历关系与地点不符。');
    }, 0, 40);
  }
  object(w.simulation, ['version', 'lastMinute']); if (w.simulation.version !== 1 || w.simulation.lastMinute !== state.clock.totalMinutes) throw Error('世界模拟时钟不符。');
}
