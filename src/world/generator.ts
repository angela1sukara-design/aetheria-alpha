import { loadPacks } from '../content/loader.ts';
import type { Registry } from '../content/registry.ts';
import type { ActionDef, ContentPack, Effect, Id } from '../core/types.ts';
import { clone } from '../core/types.ts';
import { createGameState } from '../engine/state.ts';
import { instantiateBody, patchedBody } from '../engine/body.ts';
import { draw } from '../engine/rng.ts';
import { initialDistrict } from '../engine/district.ts';
import { advanceWorldSimulation } from './simulation.ts';
import { hash, integer, parseReference, parseRules } from './schema.ts';
import type { GeneratedWorld, GenerationRulePack, ReferenceTemplate, WorldDef, WorldInstance } from './types.ts';

export const GENERATOR_VERSION = '0.1.0';
const id = (key: string): Id => `worldgen:${key}`;

/** 生成器只创建初始快照。所有玩法编译成已有内容 DSL，并经过同一个 loader。 */
export class WorldGenerator {
  async generate(input: { seed: number; registry: Registry; rules: unknown; references: unknown[]; parameters?: { locationCount?: number; npcCount?: number } }): Promise<GeneratedWorld> {
    integer(input.seed, 0, 0xffffffff);
    if (input.registry.packs.some(p => p.id === 'generated/neighborhood')) throw Error('请用源内容库创建新世界。');
    const rules = parseRules(input.rules), references = input.references.map(p => parseReference(p, input.registry)).sort((a, b) => a.id.localeCompare(b.id, 'en'));
    if (!references.length || new Set(references.map(p => p.id)).size !== references.length) throw Error('参考包集合为空或重复。');
    const templates = references.flatMap(p => p.templates).sort((a, b) => a.id.localeCompare(b.id, 'en'));
    if (new Set(templates.map(t => t.id)).size !== templates.length) throw Error('跨包模板 ID 必须唯一。');
    for (const t of templates) for (const ref of [...t.combination.requiresTemplates, ...t.combination.excludesTemplates]) if (!templates.some(x => x.id === ref)) throw Error('组合规则引用未知模板。');
    const parameters = { locationCount: input.parameters?.locationCount ?? rules.locationCount, npcCount: input.parameters?.npcCount ?? rules.npcCount };
    integer(parameters.locationCount, 5, 20); integer(parameters.npcCount, 3, 40);
    const randomState = createGameState(input.registry, input.seed), selected: ReferenceTemplate[] = [], tags = new Set<string>();
    const pick = <T>(items: T[], stream: string): T => { if (!items.length) throw Error('没有兼容的生成候选。'); return items[Math.floor(draw(randomState, `generation:${stream}`) * items.length)]!; };
    const eligible = (t: ReferenceTemplate, localTags = tags) => t.requiresPacks.every(p => input.registry.packs.some(x => x.id === p))
      && (!t.environmentTags.length || t.environmentTags.some(tag => tags.has(tag)))
      && t.requiresTags.every(tag => localTags.has(tag)) && !t.excludesTags.some(tag => localTags.has(tag))
      && (!t.compatibleTags.length || t.compatibleTags.some(tag => localTags.has(tag)))
      && t.combination.requiresTemplates.every(id => selected.some(s => s.id === id))
      && !selected.some(s => t.combination.excludesTemplates.includes(s.id) || s.combination.excludesTemplates.includes(t.id));
    const choose = (kind: ReferenceTemplate['kind'], stream: string, filter: (t: ReferenceTemplate) => boolean = () => true, localTags = tags): ReferenceTemplate => {
      const candidates = templates.filter(t => t.kind === kind && eligible(t, localTags) && filter(t));
      const weight = (t: ReferenceTemplate) => t.combination.boosts.reduce((n, b) => localTags.has(b.tag) ? n * b.multiplier : n, t.weight);
      let roll = draw(randomState, `generation:${stream}`) * candidates.reduce((n, t) => n + weight(t), 0);
      const chosen = candidates.find(t => (roll -= weight(t)) < 0);
      if (!chosen) throw Error(`无法生成 ${kind}：参考库缺少满足环境、依赖与组合条件的模板。`);
      selected.push(chosen); return chosen;
    };
    const environment = choose('environment', 'environment'); if (environment.kind !== 'environment') throw Error();
    [...environment.data.tags, ...environment.contributes.tags].forEach(t => tags.add(t));
    const pack: ContentPack = {
      manifest: { id: 'generated/neighborhood', namespace: 'worldgen', version: GENERATOR_VERSION, schemaVersion: 1, engineApiVersion: '0.1', author: 'WorldGenerator · PROPOSED', status: 'draft', dependencies: input.registry.packs.map(p => ({ id: p.id, version: p.version, optional: false })), requiresCapabilities: ['condition.v1', 'effect.v1', 'event.choice.v1', 'hook.action.v1', 'district.v1', 'body.graph.v1', 'tf.pipeline.v1'], migrations: [] },
      variables: [], flags: [], hooks: [], locations: [], routes: [], actions: [], events: [], texts: {}, contributions: [], residentTemplates: [], storylets: [],
    };
    const definition: WorldDef = { id: `neighborhood-${input.seed}`, name: environment.data.name, startLocationId: id('location.0'), regions: [{ id: 'region-0', name: environment.data.name, environmentTags: [...tags], ecologyTags: [...tags].filter(t => t.startsWith('ecology.')) }], locations: [], factions: [], eventPool: [], packs: [] };
    for (let i = 0; i < 2; i++) {
      const t = choose('faction', `faction.${i}`, t => !selected.some(s => s.kind === 'faction' && s.id === t.id)); if (t.kind !== 'faction') throw Error();
      definition.factions.push({ id: `faction-${i}`, templateId: t.id, name: t.data.name, activities: clone(t.data.activities), locationIds: [] });
    }
    function action(key: string, label: string, hook: Id, effects: Effect[], conditions: ActionDef['conditions'] = [], group: ActionDef['group'] = 'daily', text = '你完成了眼前的事情。'): Id {
      const aid = id(`action.${key}`), textKey = id(`text.${key}`);
      pack.texts[textKey] = text;
      pack.actions.push({ id: aid, label, hint: '按本地时间结算 · 可保存进度', group, conditions, effects, resultText: textKey });
      if (group !== 'event') pack.contributions.push({ hookId: hook, actionIds: [aid] }); return aid;
    }
    for (let i = 0; i < parameters.locationCount; i++) {
      const service = rules.requiredServices[i];
      const t = choose('place', `place.${i}`, t => t.kind === 'place' && (!service || t.data.service === service)); if (t.kind !== 'place') throw Error();
      const lid = id(`location.${i}`), hook = id(`hook.${i}`), textKey = id(`text.location.${i}`), faction = definition.factions[i % 2]!;
      const name = pick(t.data.names, `name.${i}`) + (i >= 5 ? `·${i + 1}` : '');
      const localTags = [...new Set([...tags, ...t.contributes.tags])];
      pack.hooks.push({ id: hook, accepts: 'action', visibility: 'public' });
      pack.texts[textKey] = `${environment.data.description}\n\n${t.data.description}\n\n这里以${t.data.economy.join('、')}维持生计，由${faction.name}协调。你可以休息、找工作或留意附近的人。`;
      pack.locations.push({ id: lid, name, subtitle: `${t.data.economy.join(' / ')} · ${environment.data.name}`, textKey, actionHook: hook, map: { x: 12 + Math.floor(draw(randomState, `generation:map.x.${i}`) * 77), y: 10 + Math.floor(draw(randomState, `generation:map.y.${i}`) * 80) } });
      definition.locations.push({ id: lid, regionId: 'region-0', templateId: t.id, service: t.data.service, tags: localTags, economy: clone(t.data.economy), professions: clone(t.data.professions), factionId: faction.id }); faction.locationIds.push(lid);
      // 所有地点免费恢复，旅行不扣精力，保证贫穷/耗尽时仍可继续游玩。
      action(`rest.${i}`, '找个座位休息', hook, [{ op: 'clock.advance', minutes: 30 }, { op: 'var.change', id: 'core:energy', amount: 12 }], [], 'daily', '你在公共座位休息。精力逐渐恢复，街区的日程仍在推进。');
      action(`wait.${i}`, '等候一小时', hook, [{ op: 'clock.advance', minutes: 60 }]);
      action(`work.${i}`, `参与${t.data.economy[0]}`, hook, [{ op: 'var.change', id: 'core:energy', amount: -5 }, { op: 'clock.advance', minutes: 30 }, { op: 'var.change', id: 'core:money', amount: 5 }], [{ op: 'body.hasCapability', capability: 'grasp', count: 1 }], 'daily', '你按现场约定完成了一段工作，收到报酬。');
      action(`look.${i}`, '留意街区与附近的人', hook, [{ op: 'world.encounter' }], [], 'explore', '你留意周围的人与路况。');
      action(`talk.${i}`, '与眼前的居民交谈', hook, [{ op: 'resident.talk' }, { op: 'clock.advance', minutes: 5 }], [{ op: 'resident.available' }], 'daily', '你们聊了聊今天的生活。');
      action(`help.${i}`, '帮居民处理手边的事', hook, [{ op: 'resident.help' }, { op: 'clock.advance', minutes: 15 }], [{ op: 'resident.available' }, { op: 'body.hasCapability', capability: 'grasp', count: 1 }], 'daily', '你先问清楚需要什么，再伸手帮忙。');
      const e = choose('event', `event.${i}`, () => true, new Set(localTags)); if (e.kind !== 'event') throw Error();
      const eid = id(`event.${i}`), endText = id(`text.event.end.${i}`), prompt = id(`text.event.prompt.${i}`);
      const finish = action(`event.finish.${i}`, e.data.label, hook, [{ op: 'clock.advance', minutes: e.data.minutes }, { op: 'var.change', id: 'core:money', amount: e.data.reward }, { op: 'event.advance', nodeId: 'end' }], [], 'event', e.data.completeText);
      const leave = action(`event.leave.${i}`, '先继续自己的安排', hook, [{ op: 'event.advance', nodeId: 'end' }], [], 'event', '你向值班人说明稍后再说，走回公共通道。');
      for (const aid of [finish, leave]) pack.actions.find(a => a.id === aid)!.context = { eventId: eid, nodeId: 'start' };
      pack.texts[prompt] = e.data.prompt; pack.texts[endText] = '交接已记录。你可以继续探索街区。';
      pack.events.push({ id: eid, startNode: 'start', rating: 'general', nodes: [{ id: 'start', type: 'choice', textVariants: [prompt], actionIds: [finish, leave], onEnter: [] }, { id: 'end', type: 'exit', textVariants: [endText], actionIds: [], onEnter: [{ op: 'event.exit' }] }] });
      const eventIds = [...new Set([eid, ...t.contributes.eventIds, ...e.contributes.eventIds])];
      for (const [j, eventId] of eventIds.entries()) { pack.storylets!.push({ id: id(`storylet.${i}.${j}`), locationId: lid, conditions: [], eventId, weight: 1, priority: 1, cooldownMinutes: 60, cooldownGroup: `generated-${i}`, repeat: 'daily', hidden: true, tags: ['neighborhood'] }); definition.eventPool.push(eventId); }
      const tfIds = [...new Set([...t.contributes.tfIds, ...e.contributes.tfIds])];
      for (const [j, tfId] of tfIds.entries()) { const tf = input.registry.transformation(tfId); action(`tf.${i}.${j}`, `体验${tf.label}`, hook, [{ op: tf.source === 'free' ? 'tf.apply' : 'tf.enqueue', id: tfId }], [], 'daily', '你按公开流程确认了这次身体变化。'); }
    }
    const pairs = new Set<string>();
    const connect = (a: number, b: number) => {
      const key = [a, b].sort((a, b) => a - b).join('.'); if (a === b || pairs.has(key)) return; pairs.add(key);
      for (const [from, to] of [[a, b], [b, a]]) {
        const routeId = id(`route.${from}.${to}`), place = pack.locations[from]!, target = pack.locations[to]!;
        pack.routes.push({ id: routeId, from: place.id, to: target.id });
        action(`travel.${from}.${to}`, `前往${target.name}`, place.actionHook, [{ op: 'location.move', routeId }, { op: 'clock.advance', minutes: 10 }], [], 'travel', `你沿公共通道来到${target.name}。`);
      }
    };
    // 先生成双向生成树，再加随机捷径：所有必需服务可达，方向也可返回。
    for (let i = 1; i < pack.locations.length; i++) connect(i, pick(Array.from({ length: i }, (_, n) => n), `tree.${i}`));
    const extras: [number, number][] = [];
    for (let a = 0; a < pack.locations.length; a++) for (let b = a + 1; b < pack.locations.length; b++) if (!pairs.has(`${a}.${b}`)) extras.push([a, b]);
    for (let i = 0; i < rules.extraConnections && extras.length; i++) { const chosen = pick(extras, `extra.${i}`); connect(...chosen); extras.splice(extras.indexOf(chosen), 1); }
    const agents: WorldInstance['agents'] = [];
    const residences = definition.locations.filter(l => l.service === 'home'), leisure = definition.locations.filter(l => l.service === 'commons');
    for (let i = 0; i < parameters.npcCount; i++) {
      const work = pick(definition.locations.filter(l => ['market', 'workshop', 'commons'].includes(l.service)), `workplace.${i}`);
      const localTags = new Set(work.tags);
      const t = choose('npc', `npc.${i}`, t => t.kind === 'npc' && work.professions.includes(input.registry.residentTemplates.find(n => n.id === t.data.residentTemplateId)!.profession), localTags); if (t.kind !== 'npc') throw Error();
      const source = input.registry.residentTemplates.find(n => n.id === t.data.residentTemplateId)!;
      const template = clone(source); template.id = id(`resident.${i}`); template.locationIds = pack.locations.map(l => l.id); template.start = 0; template.end = 1439;
      // 抽样只在生成时完成；单值实例模板继续受原居民存档校验保护。
      template.names = [`${pick(source.names, `npc.name.${i}`)}·${i + 1}`]; template.appearance = [pick(source.appearance, `npc.appearance.${i}`)]; template.personality = [pick(source.personality, `npc.personality.${i}`)];
      template.patchIds = source.patchIds.length ? [pick(source.patchIds, `npc.patch.${i}`)] : [];
      pack.residentTemplates!.push(template);
      const home = pick(residences, `home.${i}`), rest = pick(leisure, `leisure.${i}`);
      agents.push({ residentId: `resident:${work.id}:${template.id}`, originLocationId: work.id, factionId: work.factionId, schedule: schedule(rules, home.id, work.id, rest.id) });
    }
    definition.eventPool = [...new Set(definition.eventPool)];
    definition.packs = [...clone(input.registry.contentPacks), pack];
    const registry = await loadPacks(definition.packs), state = createGameState(registry, input.seed);
    state.world = { locationId: definition.startLocationId, knownLocationIds: [definition.startLocationId] };
    state.clock.totalMinutes = rules.startMinutes; state.rng = clone(randomState.rng); state.district = initialDistrict(); state.district.profile.created = true;
    for (const [i, agent] of agents.entries()) {
      const t = pack.residentTemplates![i]!;
      let body = instantiateBody(registry.bodyTemplate(t.bodyTemplateId));
      for (const patch of t.patchIds) body = patchedBody(body, registry.bodyPatch(patch), registry);
      state.district.residents.push({ id: agent.residentId, templateId: t.id, name: t.names[0]!, locationId: agent.originLocationId, profession: t.profession, appearance: t.appearance[0]!, personality: t.personality[0]!, speciesId: t.speciesId, ageYears: t.ageYears, body, persistent: false, visits: 0, trust: 0, lastTalkDay: -1, memories: [] });
    }
    const world: WorldInstance = { version: 1, definition, generation: { generatorVersion: GENERATOR_VERSION, seed: input.seed, rules, rulesHash: await hash(rules), references: await Promise.all(references.map(async p => ({ id: p.id, version: p.version, hash: await hash(p) }))), contentPacks: clone(input.registry.packs), parameters, selectedTemplateIds: [...new Set(selected.map(t => t.id))] }, agents, simulation: { version: 1, lastMinute: rules.startMinutes } };
    state.worldInstance = world; advanceWorldSimulation(state);
    return { world: clone(state.worldInstance), state, registry };
  }
}
function schedule(r: GenerationRulePack, home: Id, work: Id, leisure: Id): WorldInstance['agents'][number]['schedule'] {
  return [{ start: 0, end: r.workStart, locationId: home, activity: 'home' }, { start: r.workStart, end: r.workEnd, locationId: work, activity: 'work' }, { start: r.workEnd, end: r.leisureEnd, locationId: leisure, activity: 'leisure' }, { start: r.leisureEnd, end: 1440, locationId: home, activity: 'home' }];
}
