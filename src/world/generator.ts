import { resolveTag } from '../content/tags.ts';
import { residentAdaptation, activityEligibility } from './adaptation.ts';
import { validateReferenceOrder } from './reference-validation.ts';
import { loadPacks } from '../content/loader.ts';
import type { Registry } from '../content/registry.ts';
import type { ActionDef, ContentPack, Effect, Id } from '../core/types.ts';
import { clone } from '../core/types.ts';
import { createGameState } from '../engine/state.ts';
import { instantiateBody, patchedBody } from '../engine/body.ts';
import { effectivePart } from '../engine/query.ts';
import { draw } from '../engine/rng.ts';
import { initialDistrict } from '../engine/district.ts';
import { facilitiesForService } from '../engine/entity-functions.ts';
import { advanceWorldSimulation } from './simulation.ts';
import { hash, integer, parseReference, parseRules } from './schema.ts';
import { selectQuestContent } from '../content/quest-schema.ts';
import { compileWorldQuests } from './quests.ts';
import { compileWorldScenes } from './scenes.ts';
import { compileResidentServices } from './resident-services.ts';
import { compileCombatEncounters } from './combat-encounters.ts';
import { proseProblem } from '../content/player-prose.ts';
import { generatePersonalName, formatName } from './names.ts';
import { applyWorldProfile, chooseWorldProfile, parseWorldProfiles, professionName, worldProfileSelectionTag } from './profiles.ts';
import type { GeneratedWorld, GenerationRulePack, ReferenceTemplate, WorldDef, WorldInstance } from './types.ts';

export const GENERATOR_VERSION = '0.11.0';
const id = (key: string): Id => `worldgen:${key}`;

/** 生成器只创建初始快照。所有玩法编译成已有内容 DSL，并经过同一个 loader。 */
export class WorldGenerator {
  async generate(input: { seed: number; registry: Registry; rules: unknown; references: unknown[]; questContent?: unknown; worldProfiles?: unknown; worldTag?: string; parameters?: { locationCount?: number; npcCount?: number } }): Promise<GeneratedWorld> {
    integer(input.seed, 0, 0xffffffff);
    if (!Array.isArray(input.references) || input.references.length < 1 || input.references.length > 20) throw Error('参考包数量必须为1–20。');
    if (input.parameters && Object.keys(input.parameters).some(k => !['locationCount', 'npcCount'].includes(k))) throw Error('未知生成参数。');
    if (input.registry.packs.some(p => p.id === 'generated/neighborhood')) throw Error('请用源内容库创建新世界。');
    if (input.worldTag !== undefined && input.worldProfiles === undefined) throw Error('指定世界 Tag 需要世界配置目录。');
    if (input.worldProfiles !== undefined && input.questContent !== undefined) throw Error('世界配置已包含任务，不能同时指定另一套任务。');
    const profile = input.worldProfiles === undefined ? undefined : chooseWorldProfile(parseWorldProfiles(input.worldProfiles, input.registry), input.seed, input.worldTag === undefined ? undefined : resolveTag(input.registry, worldProfileSelectionTag(input.worldTag), 'generation.v1'));
    const rules = parseRules(input.rules), references = input.references.map(p => parseReference(p, input.registry)).sort((a, b) => a.id.localeCompare(b.id, 'en'));
    if (!references.length || new Set(references.map(p => p.id)).size !== references.length) throw Error('参考包集合为空或重复。');
    const templates = references.flatMap(p => clone(p.templates)).sort((a, b) => a.id.localeCompare(b.id, 'en'));
    if (templates.length > 2000) throw Error('参考模板总量超过首版限制。');
    if (new Set(templates.map(t => t.id)).size !== templates.length) throw Error('跨包模板 ID 必须唯一。');
    for (const t of templates) for (const ref of [...t.combination.requiresTemplates, ...t.combination.excludesTemplates]) if (!templates.some(x => x.id === ref)) throw Error('组合规则引用未知模板。');
    const canonical=(tag:string)=>input.registry.tags.length?resolveTag(input.registry,tag,'generation.v1'):tag;
    for(const t of templates){for(const key of ['environmentTags','requiresTags','excludesTags','compatibleTags']as const)t[key]=t[key].map(canonical);t.contributes.tags=t.contributes.tags.map(canonical);for(const b of t.combination.boosts)b.tag=canonical(b.tag);if(t.kind==='environment')t.data.tags=t.data.tags.map(canonical);if(t.kind==='place')t.contributes.tags=t.contributes.tags.filter(tag=>!tag.startsWith('foundation:service.')&&!tag.startsWith('service.'));}
    if (profile) applyWorldProfile(templates, profile);
    validateReferenceOrder(templates);
    // 模板贡献的原型同样遵守父模板条件；只有父模板实际被选中后才能参与抽样。
    if (templates.length + templates.reduce((count, t) => count + t.contributes.npcTemplateIds.length, 0) > 2000) throw Error('贡献原型展开后超过2000个模板限制。');
    const contributedNPCs: ReferenceTemplate[] = templates.flatMap(t => t.contributes.npcTemplateIds.map((npcId, i) => ({ ...clone(t), id: `${t.id}.contributed-npc.${i}`, kind: 'npc' as const, data: { residentTemplateId: npcId }, combination: { ...clone(t.combination), requiresTemplates: [...new Set([...t.combination.requiresTemplates, t.id])] }, contributes: { tags: [], npcTemplateIds: [], eventIds: [], tfIds: [] } })));
    templates.push(...contributedNPCs); templates.sort((a, b) => a.id.localeCompare(b.id, 'en'));
    if (new Set(templates.map(t => t.id)).size !== templates.length) throw Error('自动贡献模板 ID 与参考库冲突。');
    const parameters = { locationCount: input.parameters?.locationCount ?? rules.locationCount, npcCount: input.parameters?.npcCount ?? rules.npcCount };
    integer(parameters.locationCount, 5, 20); integer(parameters.npcCount, 3, 40);
    const randomState = createGameState(input.registry, input.seed), selected: ReferenceTemplate[] = [], tags = new Set<string>(profile ? [profile.tag] : []);
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
      manifest: { id: 'generated/neighborhood', namespace: 'worldgen', version: GENERATOR_VERSION, schemaVersion: input.registry.tags.length?2:1, engineApiVersion: '0.1', author: 'WorldGenerator · PROPOSED', status: 'draft', dependencies: input.registry.packs.map(p => ({ id: p.id, version: p.version, optional: false })), requiresCapabilities: [...(input.registry.tags.length?['foundation.v2']:[]),'condition.v1', 'effect.v1', 'event.choice.v1', 'hook.action.v1', 'district.v1', 'body.graph.v1', 'tf.pipeline.v1'], migrations: [] },
      variables: [], flags: [], hooks: [], locations: [], routes: [], actions: [], events: [], texts: {}, contributions: [], residentTemplates: [], storylets: [],
    };
    const contributionsAt = new Map<Id, ReferenceTemplate[]>();
    const definition: WorldDef = { id: `neighborhood-${input.seed}`, name: environment.data.name, startLocationId: id('location.0'), regions: [{ id: 'region-0', name: environment.data.name, environmentTags: [...tags], ecologyTags: [...tags].filter(t => t.startsWith('ecology.')||t.startsWith('foundation:ecology.')) }], locations: [], factions: [], eventPool: [], packs: [] };
    if (profile) {
      const ecologyTag = environment.data.tags.find(t => t.startsWith('foundation:setting.') || t.startsWith('climate.'));
      if (!ecologyTag) throw Error('世界题材需要一个明确的生态环境标签。');
      definition.name = profile.name;
      definition.setting = { id: profile.id, tag: profile.tag, name: profile.name, version: profile.version, hash: await hash(profile), ecologyTag: ecologyTag as Id, questId: profile.quests.id };
    }
    for (let i = 0; i < 2; i++) {
      const t = choose('faction', `faction.${i}`, t => !selected.some(s => s.kind === 'faction' && s.id === t.id)); if (t.kind !== 'faction') throw Error();
      t.contributes.tags.forEach(tag => tags.add(tag));
      definition.factions.push({ id: `faction-${i}`, templateId: t.id, name: t.data.name, activities: clone(t.data.activities), locationIds: [] });
    }
    function action(key: string, label: string, hook: Id, effects: Effect[], conditions: ActionDef['conditions'] = [], group: ActionDef['group'] = 'daily', text = '你完成了眼前的事情。'): Id {
      const aid = id(`action.${key}`), textKey = id(`text.${key}`);
      pack.texts[textKey] = text;
      const hints = effects.flatMap(effect => {
        if (effect.op === 'clock.advance') return [`${effect.minutes}分钟`];
        if (effect.op === 'var.change') { const variable = input.registry.variable(effect.id); return [`${variable.label}${effect.amount >= 0 ? '+' : '−'}${Math.abs(effect.amount)}${variable.unit}`]; }
        if (effect.op === 'resident.help') return ['体力−8', '精力最多−2', '零钱+3', '每天一次'];
        if (effect.op === 'world.encounter') return effect.events === false ? ['切换在场居民', '不会触发事件'] : ['留意当天的事'];
        if (effect.op === 'tf.enqueue') return ['确认后开始渐进变化'];
        if (effect.op === 'tf.apply') return ['立即改变当前形态'];
        return [];
      });
      pack.actions.push({ id: aid, label, hint: hints.join(' · ') || '继续当地生活', group, conditions, effects, resultText: textKey });
      if (group !== 'event') pack.contributions.push({ hookId: hook, actionIds: [aid] }); return aid;
    }
    // Draw distinct cells, then jitter inside each cell. Even at the 20-place
    // limit dots remain apart; sampling coordinates independently can overlap.
    const mapCells = Array.from({ length: 20 }, (_, cell) => cell);
    for (let i = 0; i < parameters.locationCount; i++) {
      const service = rules.requiredServices[i];
      const t = choose('place', `place.${i}`, t => t.kind === 'place' && (!service || t.data.service === service)); if (t.kind !== 'place') throw Error();
      const lid = id(`location.${i}`), hook = id(`hook.${i}`), textKey = id(`text.location.${i}`), faction = definition.factions[i % 2]!;
      const name = pick(t.data.names, `name.${i}`) + (i >= 5 ? `·${i + 1}` : '');
      const localTags = [...new Set([...tags, canonical(`service.${t.data.service}`), ...t.contributes.tags])];
      pack.hooks.push({ id: hook, accepts: 'action', visibility: 'public' });
      pack.texts[textKey] = `${environment.data.description}\n\n${t.data.description}\n\n这里以${t.data.economy.join('、')}维持生计，由${faction.name}协调。你可以休息、找工作或留意附近的人。`;
      const cell = pick(mapCells, `map.cell.${i}`); mapCells.splice(mapCells.indexOf(cell), 1);
      pack.locations.push({ id: lid, name, subtitle: `${t.data.economy.join(' / ')} · ${environment.data.name}`, textKey, actionHook: hook, map: { x: 12 + cell % 5 * 18 + Math.floor(draw(randomState, `generation:map.x.${i}`) * 5) - 2, y: 12 + Math.floor(cell / 5) * 24 + Math.floor(draw(randomState, `generation:map.y.${i}`) * 5) - 2 } });
      if(pack.manifest.schemaVersion===2){(pack.locationProfiles??=[]).push({id:id('location-profile.'+i),locationId:lid,light:'lit'});action('light.off.'+i,'关闭工作灯',hook,[{op:'environment.setLight',locationId:lid,value:'dark'}],[{op:'environment.light',locationId:lid,value:'lit'}]);action('light.on.'+i,'打开工作灯',hook,[{op:'environment.setLight',locationId:lid,value:'lit'}],[{op:'environment.light',locationId:lid,value:'dark'}]);}
      const facilities=t.data.facilities??(profile?.tag==='worlds:setting.fantasy'&&input.registry.residentTemplates.some(t=>t.services!==undefined)?facilitiesForService[t.data.service]:undefined);
      if(facilities)pack.locations.at(-1)!.facilities=[...facilities];
      if(facilities)pack.texts[textKey]=`${environment.data.description}\n\n${t.data.description}`;
      definition.locations.push({ id: lid, regionId: 'region-0', templateId: t.id, service: t.data.service, tags: localTags, economy: clone(t.data.economy), professions: clone(t.data.professions), factionId: faction.id }); faction.locationIds.push(lid);
      if (t.data.ambience) for (const [key, start, end] of [['morning', 360, 600], ['day', 600, 1080], ['evening', 1080, 1320], ['night', 1320, 360]] as const) {
        const textKey = id(`text.ambience.${i}.${key}`); pack.texts[textKey] = t.data.ambience[key];
        (pack.sceneTexts ??= []).push({ id: id(`ambience.${i}.${key}`), locationId: lid, conditions: [{ op: 'time.window', start, end }], priority: 1, textKey });
      }
      // 所有地点免费恢复，旅行不扣精力，保证贫穷/耗尽时仍可继续游玩。
      const seated=!facilities||facilities.includes('seat')||facilities.includes('bed');
      action(`rest.${i}`, seated?'找个座位休息':'停下来缓口气', hook, [{ op: 'clock.advance', minutes: 30 }, { op: 'var.change', id: 'core:energy', amount: 12 }, {op:'var.change',id:'core:stamina',amount:12}], [], 'daily', seated?'你坐下来休息，等呼吸平稳、身上的疲惫减轻，再继续自己的安排。':'你停下脚步，放慢动作调整呼吸。等体力恢复一些，再继续赶路。');
      if (t.data.service === 'clinic') action(`care.${i}`, '使用免费体况恢复座位', hook, [{ op: 'clock.advance', minutes: 45 }, { op: 'var.change', id: 'core:energy', amount: 6 }, { op: 'var.change', id: 'core:health', amount: 8 }], [], 'daily', '你在开放的护理座位补充饮水并休息，体况逐渐恢复。');
      action(`wait.${i}`, '等候一小时', hook, [{ op: 'clock.advance', minutes: 60 }]);
      action(`wait.short.${i}`, '在附近等候一刻钟', hook, [{ op: 'clock.advance', minutes: 15 }], [], 'daily', '你等候了一刻钟，居民按原来的日程活动。');
      action(`work.${i}`, `参与${t.data.economy[0]}`, hook, [{ op: 'var.change', id: 'core:energy', amount: -5 }, {op:'var.change',id:'core:stamina',amount:-8}, { op: 'clock.advance', minutes: 30 }, { op: 'var.change', id: 'core:money', amount: 5 }], [{ op: 'body.hasCapability', capability: 'grasp', count: 1 }], 'daily', '你按现场约定完成了一段工作，收到报酬。');
      action(`look.${i}`, '留意环境与附近的人', hook, [{ op: 'world.encounter' }], [], 'explore', '你留意周围的人与路况。');
      action(`meet.${i}`, '看看在场居民', hook, [{ op: 'world.encounter', events: false }], [], 'explore', '你向身边的人打了个招呼。');
      action(`talk.${i}`, '与眼前的居民交谈', hook, [{ op: 'resident.talk' }, { op: 'clock.advance', minutes: 5 }], [{ op: 'resident.available' }], 'daily', '你们聊了聊今天的生活。');
      action(`help.${i}`, '帮居民处理手边的事', hook, [{ op: 'resident.help' }, { op: 'clock.advance', minutes: 15 }], [{ op: 'resident.available' }, { op: 'body.hasCapability', capability: 'grasp', count: 1 }], 'daily', '你先问清楚需要什么，再伸手帮忙。');
      if(facilities){
        for(const [key,subject,service] of [['rest','location','rest'],['care','location','care'],['wait','location','wait'],['wait.short','location','wait'],['work','resident','work'],['talk','resident','talk'],['help','resident','work']] as const){const a=pack.actions.find(a=>a.id===id(`action.${key}.${i}`));if(a)a.conditions.push({op:'service.available',subject,service} as import('../core/types.ts').Condition);}
        const workAction=pack.actions.find(a=>a.id===id(`action.work.${i}`))!;workAction.conditions.push({op:'service.available',subject:'location',service:'work'});
      }
      const localContributors: ReferenceTemplate[] = [t]; contributionsAt.set(lid, localContributors);
      const context = new Set(localTags), activities: ReferenceTemplate[] = [];
      for (let j = 0; j < (rules.activitiesPerLocation ?? 0); j++) {
        const filter = (candidate: ReferenceTemplate) => !activities.some(a => a.id === candidate.id)&&(!facilities||candidate.kind==='activity'&&(!(candidate.data.moneyChange>0||candidate.data.energyChange<0)||facilities.includes('workplace'))&&(!candidate.data.healthChange||facilities.includes('care')));
        if (!templates.some(candidate => candidate.kind === 'activity' && eligible(candidate, context) && filter(candidate))) break;
        const a = choose('activity', `activity.${i}.${j}`, filter, context); if (a.kind !== 'activity') throw Error();
        activities.push(a); localContributors.push(a);
        for (const tag of a.contributes.tags) { context.add(tag); if (!localTags.includes(tag)) localTags.push(tag); }
        const resources = [{ id: 'core:energy' as Id, amount: a.data.energyChange }, { id: 'core:money' as Id, amount: a.data.moneyChange }, { id: 'core:health' as Id, amount: a.data.healthChange }];
        const changes = (positive: boolean): Effect[] => resources.filter(r => positive ? r.amount > 0 : r.amount < 0).map(r => ({ op: 'var.change', ...r }));
        action(`activity.${i}.${j}`, a.data.label, hook, [...changes(false), { op: 'clock.advance', minutes: a.data.minutes }, ...changes(true)], [...a.data.capabilities.map(capability => ({ op: 'body.hasCapability' as const, capability, count: 1 })),...(pack.manifest.schemaVersion===2?[{op:'environment.light' as const,locationId:lid,value:'lit' as const}]:[])], 'daily', a.data.description);
      }
      if(facilities)for(const a of pack.actions.filter(a=>a.id.startsWith(id(`action.activity.${i}.`)))){
        const changes=a.effects.filter(e=>e.op==='var.change');
        const paid=changes.some(e=>e.op==='var.change'&&(e.id==='core:money'&&e.amount>0||e.id==='core:energy'&&e.amount<0));
        const care=changes.some(e=>e.op==='var.change'&&e.id==='core:health'&&e.amount>0);
        const resting=changes.some(e=>e.op==='var.change'&&e.id==='core:energy'&&e.amount>0);
        if(paid)a.conditions.push({op:'service.available',subject:'resident',service:'work'});
        else if(care)a.conditions.push({op:'service.available',subject:'location',service:'care'});
        else if(resting)a.conditions.push({op:'service.available',subject:'location',service:'rest'});
      }
      const events: ReferenceTemplate[] = [];
      for (let j = 0; j < (rules.eventsPerLocation ?? 1); j++) {
      const filter = (candidate: ReferenceTemplate) => !events.some(e => e.id === candidate.id);
      if (j > 0 && !templates.some(candidate => candidate.kind === 'event' && eligible(candidate, context) && filter(candidate))) break;
      const e = choose('event', `event.${i}.${j}`, filter, context); if (e.kind !== 'event') throw Error();
      events.push(e); localContributors.push(e);
      for (const tag of e.contributes.tags) { context.add(tag); if (!localTags.includes(tag)) localTags.push(tag); }
      const suffix = j ? `${i}.${j}` : `${i}`;
      const eid = id(`event.${suffix}`), endText = id(`text.event.end.${suffix}`), prompt = id(`text.event.prompt.${suffix}`);
      const finish = action(`event.finish.${suffix}`, e.data.label, hook, [{ op: 'clock.advance', minutes: e.data.minutes }, { op: 'var.change', id: 'core:money', amount: e.data.reward }, { op: 'event.advance', nodeId: 'end' }], [], 'event', e.data.completeText);
      const leave = action(`event.leave.${suffix}`, '先继续自己的安排', hook, [{ op: 'event.advance', nodeId: 'end' }], [], 'event', '你向值班人说明稍后再说，走回公共通道。');
      for (const aid of [finish, leave]) pack.actions.find(a => a.id === aid)!.context = { eventId: eid, nodeId: 'start' };
      pack.texts[prompt] = e.data.prompt; pack.texts[endText] = '交接已记录。你可以继续探索周围。';
      pack.events.push({ id: eid, startNode: 'start', rating: 'general', nodes: [{ id: 'start', type: 'choice', textVariants: [prompt], actionIds: [finish, leave], onEnter: [] }, { id: 'end', type: 'exit', textVariants: [endText], actionIds: [], onEnter: [{ op: 'event.exit' }] }] });
      pack.storylets!.push({ id: id(`storylet.${i}.${j}`), locationId: lid, conditions: [], eventId: eid, weight: 1, priority: 1, cooldownMinutes: 60, cooldownGroup: `generated-${i}`, repeat: 'daily', hidden: true, tags: [input.registry.tags.length?'foundation:theme.gen-neighbor':'neighborhood'] }); definition.eventPool.push(eid);
      }
    }
    const pairs = new Set<string>();
    const connect = (a: number, b: number) => {
      const key = [a, b].sort((a, b) => a - b).join('.'); if (a === b || pairs.has(key)) return; pairs.add(key);
      for (const [from, to] of [[a, b], [b, a]]) {
        const routeId = id(`route.${from}.${to}`), place = pack.locations[from]!, target = pack.locations[to]!;
        pack.routes.push({ id: routeId, from: place.id, to: target.id, distanceTier: 'adjacent' });
        action(`travel.${from}.${to}`, `前往${target.name}`, place.actionHook, [{ op: 'location.move', routeId }], [], 'travel', `你沿公共通道来到${target.name}。`);
      }
    };
    // 先生成双向生成树，再加随机捷径：所有必需服务可达，方向也可返回。
    for (let i = 1; i < pack.locations.length; i++) connect(i, pick(Array.from({ length: i }, (_, n) => n), `tree.${i}`));
    const extras: [number, number][] = [];
    for (let a = 0; a < pack.locations.length; a++) for (let b = a + 1; b < pack.locations.length; b++) if (!pairs.has(`${a}.${b}`)) extras.push([a, b]);
    for (let i = 0; i < rules.extraConnections && extras.length; i++) { const chosen = pick(extras, `extra.${i}`); connect(...chosen); extras.splice(extras.indexOf(chosen), 1); }
    const agents: WorldInstance['agents'] = [];
    const residences = definition.locations.filter(l => l.service === 'home'), leisure = definition.locations.filter(l => l.service === 'commons');
    const workplaces = definition.locations.filter(l => templates.some(t => t.kind === 'npc' && eligible(t, new Set(l.tags)) && l.professions.includes(input.registry.residentTemplates.find(n => n.id === t.data.residentTemplateId)!.profession)));
    if (!workplaces.length) throw Error('街区没有适合已加载居民职业的工作地点。');
    const unstaffed = [...workplaces];
    for (let i = 0; i < parameters.npcCount; i++) {
      // Cover eligible workplaces before assigning a second worker. Clinics and
      // homes are legitimate workplaces when their profession rules allow it.
      const work = pick(unstaffed.length ? unstaffed : workplaces, `workplace.${i}`);
      if (unstaffed.includes(work)) unstaffed.splice(unstaffed.indexOf(work), 1);
      const localTags = new Set(work.tags);
      const matchesWork=(t:ReferenceTemplate)=>t.kind==='npc'&&work.professions.includes(input.registry.residentTemplates.find(n=>n.id===t.data.residentTemplateId)!.profession);
      const configured=(t:ReferenceTemplate)=>t.kind==='npc'&&!!input.registry.residentTemplates.find(n=>n.id===t.data.residentTemplateId)?.services?.work;
      const needsProvider=i<workplaces.length&&!!pack.locations.find(l=>l.id===work.id)?.facilities&&templates.some(t=>matchesWork(t)&&configured(t)&&eligible(t,localTags));
      const t = choose('npc', `npc.${i}`, t => matchesWork(t)&&(!needsProvider||configured(t)), localTags); if (t.kind !== 'npc') throw Error();
      contributionsAt.get(work.id)!.push(t);
      const source = input.registry.residentTemplates.find(n => n.id === t.data.residentTemplateId)!;
      const template = clone(source); template.id = id(`resident.${i}`); template.locationIds = pack.locations.map(l => l.id); template.start = 0; template.end = 1439;
      if (profile) template.profession = professionName(profile, work.service, source.profession);
      if(source.roleName)template.profession=source.roleName;
      // 抽样只在生成时完成；单值实例模板继续受原居民存档校验保护。
      const namePool=source.roleName||source.nameCulture?source.names:profile?.residentNames??source.names;
      const culture = source.nameCulture ?? (!source.roleName ? profile?.nameCulture : undefined);
      template.personalName = generatePersonalName({seed: input.seed, entityId: template.id, givenNames: namePool, culture: culture ?? {id:'legacy-single',familyNames:[],order:'single',separator:'',defaultInheritance:'none'}, usedNames:pack.residentTemplates!.flatMap(t=>t.names)});
      if(culture)template.nameCulture=clone(culture);
      template.names = [formatName(template.personalName)]; template.personality = [pick(source.personality, `npc.personality.${i}`)];
      const traitVariant=source.traitVariants?.length?pick(source.traitVariants,`npc.personality.${i}`):undefined;
      if(traitVariant)template.personality=[traitVariant.personality];template.traitTags=[...(traitVariant?.traitTags??source.traitTags??[])];delete template.traitVariants;
      template.patchIds = source.patchIds.length ? [pick(source.patchIds, `npc.patch.${i}`)] : [];
      let initialBody = instantiateBody(input.registry.bodyTemplate(template.bodyTemplateId));
      for (const patch of template.patchIds) initialBody = patchedBody(initialBody, input.registry.bodyPatch(patch), input.registry);
      const adaptation=residentAdaptation(source,input.registry);
      if(!activityEligibility(initialBody,source,input.registry).pass)throw Error('居民身体不满足明确的职业或活动适配。');
      if(pack.manifest.schemaVersion===2)(pack.residentAdaptations??=[]).push({id:id('adaptation.'+i),templateId:template.id,workCapabilities:[...adaptation.workCapabilities],mobility:adaptation.mobility});
      // 旧模板外观可能包含与补丁无关的肢体描写；生成外观从真实图读取（支持耳/尾/翼及覆盖材质），避免虚构部件。
      const notableParts = [...new Set(initialBody.parts.flatMap(part => {
        const def = input.registry.bodyPart(part.definitionId);
        const eff = effectivePart(part, input.registry);
        const matLabel = part.overrides?.materialId ? input.registry.material(eff.materialId!).label : '';
        if (def.kind === 'ear' || def.kind === 'tail') return [matLabel ? `${def.label}（${matLabel}）` : def.label];
        if (matLabel) return [`${def.label}（${matLabel}）`];
        return [];
      }))];
      template.appearance = [`${notableParts.join('、') || input.registry.bodyTemplate(template.bodyTemplateId).label}，带着${template.profession}的工作用品`];
      if (source.attire) {
        // 服装与真实身体描述分开：不把外观词条误当成已安装的器官或 TF。
        template.attire = [pick(source.attire, `npc.attire.${i}`)];
        template.appearance[0] += `。衣着：${template.attire[0]}`;
      }
      pack.residentTemplates!.push(template);
      const home = pick(residences, `home.${i}`), rest = pick(leisure, `leisure.${i}`);
      agents.push({ residentId: `resident:${work.id}:${template.id}`, originLocationId: work.id, factionId: work.factionId, relationships: [], schedule: schedule(rules, home.id, work.id, rest.id) });
    }
    if (profile) for (const place of definition.locations) place.professions = [...new Set(place.professions.map(p => professionName(profile, place.service, p)))];
    for(const agent of agents){const t=pack.residentTemplates!.find(t=>agent.residentId.endsWith(':'+t.id))!;const place=definition.locations.find(l=>l.id===agent.originLocationId)!;if(t.roleName&&!place.professions.includes(t.profession))place.professions.push(t.profession);}
    // 最小社交网络只记录真实共同住处/工作关系；后续变化属于模拟器。
    for (let i = 0; i < agents.length; i++) {
      const a = agents[i]!, b = agents[(i + 1) % agents.length]!;
      const kind = a.originLocationId === b.originLocationId ? 'coworker' : a.schedule[0]!.locationId === b.schedule[0]!.locationId ? 'neighbor' : 'acquaintance';
      a.relationships!.push({ otherResidentId: b.residentId, kind, strength: 10 });
      b.relationships!.push({ otherResidentId: a.residentId, kind, strength: 10 });
    }
    const globalContributors = selected.filter(t => t.kind === 'environment' || t.kind === 'faction');
    for (const [i, l] of definition.locations.entries()) {
      const contributions = [...globalContributors, ...contributionsAt.get(l.id)!].map(t => t.contributes);
      l.tags = [...new Set([...l.tags, ...contributions.flatMap(c => c.tags)])];
      for (const [j, eventId] of [...new Set(contributions.flatMap(c => c.eventIds))].entries()) {
        pack.storylets!.push({ id: id(`storylet.contributed.${i}.${j}`), locationId: l.id, conditions: [], eventId, weight: 1, priority: 1, cooldownMinutes: 60, cooldownGroup: `generated-${i}`, repeat: 'daily', hidden: true, tags: [input.registry.tags.length?'foundation:theme.gen-neighbor':'neighborhood'] }); definition.eventPool.push(eventId);
      }
      for (const [j, tfId] of [...new Set(contributions.flatMap(c => c.tfIds))].entries()) {
        const tf = input.registry.transformation(tfId);
        action(`tf.${i}.${j}`, `体验${tf.label}`, pack.locations[i]!.actionHook, [{ op: tf.source === 'free' ? 'tf.apply' : 'tf.enqueue', id: tfId }], [], 'daily', '你按公开流程确认了这次身体变化。');
      }
    }
    definition.eventPool = [...new Set(definition.eventPool)];
    // Imported rules may list services in a different order; quest worlds still start at a home.
    const questContent = profile?.quests ?? input.questContent;
    if (questContent !== undefined) definition.startLocationId = definition.locations.find(l => l.service === 'home')!.id;
    const questPacks = questContent === undefined ? [] : await compileWorldQuests(selectQuestContent(questContent, definition.regions[0]!.environmentTags, canonical), input.seed, input.registry, pack, definition, agents);
    compileCombatEncounters(pack, definition, input.registry);
    definition.eventPool=[...new Set([...definition.eventPool,...pack.events.filter(e=>e.id.startsWith('worldgen:event.danger.')).map(e=>e.id)])];
    compileResidentServices(pack,input.registry);
    compileWorldScenes(pack, definition, input.registry);
    const sceneKeys=new Set((pack.narrativeNodes??[]).flatMap(n=>[n.textKey,...n.choices.map(c=>c.resultText)]));
    for(const [key,text]of Object.entries(pack.texts)){
      const problem=proseProblem(text,sceneKeys.has(key as Id));if(problem)throw Error(`生成正文未完成：${key}，${problem}。`);
    }
    for(const action of pack.actions){const problem=proseProblem(action.label);if(problem)throw Error(`生成选项未完成：${action.id}，${problem}。`);}
    definition.packs = [...clone(input.registry.contentPacks), pack, ...questPacks];
    const registry = await loadPacks(definition.packs), state = createGameState(registry, input.seed);
    if(pack.locations.some(l=>l.facilities!==undefined)){const center=definition.locations.find(l=>l.service==='commons');if(center)definition.regions[0]!.name=`${registry.location(center.id).name}一带`;}
    state.world = { locationId: definition.startLocationId, knownLocationIds: [definition.startLocationId] };
    state.clock.totalMinutes = rules.startMinutes; state.rng = clone(randomState.rng); state.district = initialDistrict();
    // 不在生成时静默 created：异世界无公寓，需由一键入口 auto-create 或出生点 character-intro 完成签到。
    for (const [i, agent] of agents.entries()) {
      const t = pack.residentTemplates![i]!;
      let body = instantiateBody(registry.bodyTemplate(t.bodyTemplateId));
      for (const patch of t.patchIds) body = patchedBody(body, registry.bodyPatch(patch), registry);
      state.district.residents.push({ id: agent.residentId, templateId: t.id, name: t.names[0]!, locationId: agent.originLocationId, profession: t.profession, appearance: t.appearance[0]!, personality: t.personality[0]!, speciesId: t.speciesId, ageYears: t.ageYears, traitTags:[...(t.traitTags??[])], body, persistent: false, visits: 0, trust: 0, lastTalkDay: -1, memories: [] });
      if(t.personalName)state.district.residents.at(-1)!.personalName=clone(t.personalName);
    }
    const world: WorldInstance = { version: 1, definition, generation: { generatorVersion: GENERATOR_VERSION, seed: input.seed, rules, rulesHash: await hash(rules), references: await Promise.all(references.map(async p => ({ id: p.id, version: p.version, hash: await hash(p) }))), contentPacks: clone(input.registry.packs), parameters, selectedTemplateIds: [...new Set(selected.map(t => t.id))] }, agents, simulation: { version: 1, lastMinute: rules.startMinutes } };
    state.worldInstance = world; advanceWorldSimulation(state);
    return { world: clone(state.worldInstance), state, registry };
  }
}
function schedule(r: GenerationRulePack, home: Id, work: Id, leisure: Id): WorldInstance['agents'][number]['schedule'] {
  return [{ start: 0, end: r.workStart, locationId: home, activity: 'home' }, { start: r.workStart, end: r.workEnd, locationId: work, activity: 'work' }, { start: r.workEnd, end: r.leisureEnd, locationId: leisure, activity: 'leisure' }, { start: r.leisureEnd, end: 1440, locationId: home, activity: 'home' }];
}
