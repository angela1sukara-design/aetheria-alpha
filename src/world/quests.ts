import type { Registry } from '../content/registry.ts';
import type { ActionDef, Condition, ContentPack, Effect, Id } from '../core/types.ts';
import type { JournalEntry, PlayerRelation, QuestBinding, QuestChoice, QuestContent, QuestSnapshot } from '../core/quest-types.ts';
import type { WorldAgent, WorldDef } from './types.ts';
import { hash } from './schema.ts';
import { generateMainRelationships, linkSideToMain, sideRelationPriority } from './relationships.ts';

export const QUEST_PACK_IDS = ['generated/cyber-apex-side', 'generated/cyber-apex-main'];
const has = (id: Id, value = true): Condition => ({ op: 'flag.has', id, value });
/** Independent stable keys keep quest bindings independent of generation/runtime RNG streams. */
function rank(seed: number, key: string): number {
  let value = (2166136261 ^ seed) >>> 0;
  for (const char of key) value = Math.imul(value ^ char.charCodeAt(0), 16777619) >>> 0;
  return value;
}
function ordered<T>(values: T[], seed: number, key: string, id: (value: T) => string): T[] {
  return [...values].sort((a, b) => rank(seed, key + ':' + id(a)) - rank(seed, key + ':' + id(b)) || id(a).localeCompare(id(b), 'en'));
}

export async function compileWorldQuests(content: QuestContent, seed: number, source: Registry, generated: ContentPack, definition: WorldDef, agents: WorldAgent[]): Promise<ContentPack[]> {
  if (await hash(content.source) !== content.sourceHash) throw Error('任务作者源文件哈希不一致。');
  const baseDependencies = [...source.packs.map(p => ({ id: p.id, version: p.version, optional: false })), { id: generated.manifest.id, version: generated.manifest.version, optional: false }];
  const makePack = (namespace: 'main' | 'side', packId: string): ContentPack => ({
    manifest: { id: packId, namespace, version: content.version, schemaVersion: 1, engineApiVersion: '0.1', author: 'Aetheria · 离线任务制作', status: 'draft', dependencies: [...baseDependencies], requiresCapabilities: ['condition.v1', 'effect.v1', 'event.choice.v1', 'hook.action.v1', 'quest.binding.v1'], migrations: [] },
    variables: [], flags: [], hooks: [], locations: [], routes: [], actions: [], events: [], texts: {}, contributions: []
  });
  const sidePack = makePack('side', QUEST_PACK_IDS[0]!), mainPack = makePack('main', QUEST_PACK_IDS[1]!);
  mainPack.manifest.dependencies.push({ id: sidePack.manifest.id, version: sidePack.manifest.version, optional: false });
  const flags = (pack: ContentPack, id: Id, initial = false) => { if (!pack.flags.some(f => f.id === id)) pack.flags.push({ id, initial }); };
  flags(mainPack, 'main:flag.started', true); flags(mainPack, 'main:flag.top_reached');
  for (const side of content.source.sideQuests) flags(sidePack, side.flag);
  const snapshot: QuestSnapshot = { id: content.id, version: content.version, sourceHash: content.sourceHash, contentHash: await hash(content), stages: [], sides: [], journal: [] };
  const location = (locationId: Id) => generated.locations.find(l => l.id === locationId)!;
  const residentName = (residentId: string) => generated.residentTemplates!.find(t => residentId.endsWith(':' + t.id))!.names[0]!;
  const byService = new Map<string, Id>();
  for (const service of ['home', 'market', 'workshop', 'clinic', 'commons']) {
    const candidates = definition.locations.filter(l => l.service === service);
    const chosen = service === 'home' ? candidates.find(l => l.id === definition.startLocationId) : ordered(candidates, seed, 'main-location.' + service, l => l.id)[0];
    if (!chosen) throw Error('主线绑定缺少必需地点服务。'); byService.set(service, chosen.id);
  }
  // These are player/resident background tags, separate from resident/resident social edges.
  for (const agent of agents) {
    const workplace = definition.locations.find(l => l.id === agent.originLocationId)!;
    agent.playerRelations = [workplace.service === 'workshop' ? 'colleague' : agent.schedule.some(s => s.activity === 'home' && s.locationId === definition.startLocationId) ? 'neighbor' : 'acquaintance'];
  }

  function event(pack: ContentPack, binding: QuestBinding, title: string, prompt: string, prerequisites: Condition[], choices: QuestChoice[], endingFlag?: Id): void {
    const ns = pack.manifest.namespace;
    const promptKey: Id = `${ns}:text.${binding.id}.prompt`, doneKey: Id = `${ns}:text.${binding.id}.done`, leaveKey: Id = `${ns}:text.${binding.id}.leave`;
    pack.texts[promptKey] = `${title}\n\n${prompt}`;
    pack.texts[doneKey] = `${title}：本阶段已完成。`;
    pack.texts[leaveKey] = '你暂时离开，现有进度保留。以后可以从原入口继续。';
    const context = { eventId: binding.eventId, nodeId: 'choice' };
    const actionIds: Id[] = [];
    for (const choice of choices) {
      const actionId: Id = `${ns}:action.${binding.id}.${choice.id}`, textKey: Id = `${ns}:text.${binding.id}.${choice.id}`;
      pack.texts[textKey] = choice.result;
      const effects: Effect[] = [];
      if (choice.energy) effects.push({ op: 'var.change', id: 'core:energy', amount: -choice.energy });
      if (choice.complete) {
        if (binding.residentId && choice.memory) {
          const memoryId: Id = `${ns}:memory.${binding.id}.${choice.id}`;
          pack.texts[memoryId] = choice.memory;
          effects.push({ op: 'resident.remember', residentId: binding.residentId, memoryId });
        }
        flags(pack, binding.flag);
        const choiceFlag: Id = `${ns}:flag.choice.${binding.id}.${choice.id}`; flags(pack, choiceFlag);
        effects.push({ op: 'flag.set', id: binding.flag, value: true }, { op: 'flag.set', id: choiceFlag, value: true });
        if (endingFlag) effects.push({ op: 'flag.set', id: endingFlag, value: true });
      }
      if (choice.minutes) effects.push({ op: 'clock.advance', minutes: choice.minutes });
      effects.push({ op: 'event.advance', nodeId: choice.complete ? 'done' : 'leave' });
      const conditions = choice.complete ? [...prerequisites, ...choice.requires.map(f => has(f))] : [];
      pack.actions.push({ id: actionId, label: choice.label, hint: choice.complete ? `${choice.minutes}分钟${choice.energy ? ` · 精力−${choice.energy}` : ' · 无资源费用'}${choice.requires.length ? ' · 需要已完成的可选支线' : ''}` : '免费退出，保留进度', group: 'event', context, conditions, effects, resultText: textKey });
      actionIds.push(actionId);
    }
    const exitId: Id = `${ns}:action.${binding.id}.leave`;
    pack.actions.push({ id: exitId, label: '暂时离开，之后再来', hint: '免费退出，保留进度', group: 'event', context, conditions: [], effects: [{ op: 'event.advance', nodeId: 'leave' }], resultText: leaveKey }); actionIds.push(exitId);
    pack.events.push({ id: binding.eventId, startNode: 'choice', textMode: 'fixed', rating: 'general', ...(binding.residentId ? { residentIds: [binding.residentId] } : {}), nodes: [
      { id: 'choice', type: 'choice', textVariants: [promptKey], actionIds, onEnter: [] },
      { id: 'done', type: 'exit', textVariants: [doneKey], actionIds: [], onEnter: [{ op: 'event.exit' }] },
      { id: 'leave', type: 'exit', textVariants: [leaveKey], actionIds: [], onEnter: [{ op: 'event.exit' }] }
    ] });
    const entryText: Id = `${ns}:text.${binding.id}.entry`; pack.texts[entryText] = `你开始处理「${title}」。`;
    const entryEffects: Effect[] = [];
    if (ns === 'side') { const accepted: Id = `side:flag.accepted.${binding.id}`; flags(pack, accepted); entryEffects.push({ op: 'flag.set', id: accepted, value: true }); }
    entryEffects.push({ op: 'event.start', id: binding.eventId });
    const entry: ActionDef = { id: binding.entryActionId, label: `${ns === 'main' ? '主线' : '当地事务'} · ${title}${binding.residentId ? ' · ' + residentName(binding.residentId) : ''}`, hint: '查看方案；可以免费暂缓', group: 'explore', conditions: prerequisites, effects: entryEffects, resultText: entryText };
    pack.actions.push(entry); pack.contributions.push({ hookId: location(binding.locationId).actionHook, actionIds: [entry.id] });
  }

  for (const path of content.source.mainQuest.paths) {
    const ending: Id = `main:flag.ending.${path.id}`; flags(mainPack, ending);
    for (const stage of path.stages) {
      const locationId = byService.get(stage.locationType)!;
      const binding: QuestBinding = { id: stage.id, locationId, residentId: null, flag: stage.flag, eventId: `main:event.${stage.id}`, entryActionId: `main:action.${stage.id}.enter` };
      flags(mainPack, stage.flag);
      const prerequisites: Condition[] = [...stage.requires.map(f => has(f)), has(stage.flag, false), ...(stage.flag === 'main:flag.top_reached' ? [] : [has('main:flag.top_reached', false)]), { op: 'location.is', id: locationId }];
      event(mainPack, binding, stage.name, stage.objective, prerequisites, content.execution.stages[stage.id]!, stage.next.length ? undefined : ending);
      snapshot.stages.push(binding);
    }
    const first = path.stages[0]!, firstBinding = snapshot.stages.find(b => b.id === first.id)!;
    const steps: JournalEntry['steps'] = [{ conditions: [], text: `${location(firstBinding.locationId).name}：${first.objective} 可从场景中的「主线 · ${first.name}」进入。` }];
    for (const [index, stage] of path.stages.entries()) {
      if (!stage.next.length) continue;
      const next = path.stages[index + 1]!, bound = snapshot.stages.find(b => b.id === next.id)!;
      const authored = content.source.mainQuest.journal.find(j => j.unlockFlag === stage.flag)!.text;
      steps.push({ conditions: [has(stage.flag)], text: `${location(bound.locationId).name} · ${next.name}：${authored}` });
    }
    steps.push({ conditions: [has('main:flag.top_reached')], text: '顶点已由另一条路线达成，这条主线路线已结束；当地支线仍可继续。' });
    const finalStage = path.stages.at(-1)!;
    for (const choice of content.execution.stages[finalStage.id]!.filter(c => c.complete)) {
      steps.push({ conditions: [has(ending), has(`main:flag.choice.${finalStage.id}.${choice.id}`)], text: `已完成：${choice.result}` });
    }
    snapshot.journal.push({ id: path.id, title: path.style, unlock: [has('main:flag.started')], steps });
  }

  definition.relationshipTree = generateMainRelationships(content, seed, definition, agents, snapshot.stages);
  for (const side of content.source.sideQuests) {
    let residentId: string | null = null, locationId: Id;
    if (side.requiresRelation) {
      const relation: PlayerRelation = side.requiresRelation;
      const candidates = agents.flatMap(agent => agent.schedule.filter(slot => definition.locations.find(l => l.id === slot.locationId)?.service === side.locationType && (relation !== 'neighbor' || slot.locationId === definition.startLocationId)).map(slot => ({ agent, locationId: slot.locationId })));
      const existing = candidates.filter(c => c.agent.playerRelations!.includes(relation));
      const pool = existing.length ? existing : candidates.filter(c => c.agent.playerRelations!.length < 2);
      const chosen = ordered(pool, seed, 'side-binding.' + side.id, c => c.agent.residentId + ':' + c.locationId).sort((a, b) =>
        sideRelationPriority(definition.relationshipTree!, seed, side, b.agent.residentId) - sideRelationPriority(definition.relationshipTree!, seed, side, a.agent.residentId))[0];
      if (!chosen) continue;
      if (!chosen.agent.playerRelations!.includes(relation)) chosen.agent.playerRelations!.push(relation);
      residentId = chosen.agent.residentId; locationId = chosen.locationId;
    } else locationId = ordered(definition.locations.filter(l => l.service === side.locationType), seed, 'side-location.' + side.id, l => l.id)[0]!.id;
    const execution = content.execution.sides[side.id]!;
    const binding: QuestBinding = { id: side.id, locationId, residentId, flag: side.flag, eventId: `side:event.${side.id}`, entryActionId: `side:action.${side.id}.enter` };
    const prerequisites: Condition[] = [has(side.flag, false), { op: 'location.is', id: locationId }];
    if (residentId) prerequisites.push({ op: 'resident.present', residentId }, { op: 'resident.relation', residentId, relation: side.requiresRelation! });
    event(sidePack, binding, execution.title, `${residentId ? `与你一同处理此事的人：${residentName(residentId)}。\n\n` : ''}${execution.prompt}`, prerequisites, execution.choices);
    snapshot.sides.push(binding);
    linkSideToMain(definition.relationshipTree, content, side, binding, definition);
    if (side.journalText) {
      const person = residentId ? `${residentName(residentId)} · ` : '';
      const steps: JournalEntry['steps'] = [{ conditions: [], text: `${person}${location(locationId).name}：${side.journalText}${residentId ? ' 如果对方不在，请按人物册日程再来。' : ''}` }];
      for (const choice of execution.choices.filter(c => c.complete)) steps.push({ conditions: [has(`side:flag.choice.${side.id}.${choice.id}`)], text: `已完成：${choice.result}` });
      snapshot.journal.push({ id: side.id, title: execution.title, unlock: [has(`side:flag.accepted.${side.id}`)], steps });
    }
  }
  snapshot.journal.unshift({ id: content.source.mainQuest.id, title: '站上顶点', unlock: [has('main:flag.started')], steps: [
    { conditions: [], text: `${content.source.mainQuest.goal} 两条路线可以同时准备，支线均非必做。具体地点见下方路线提示。` },
    { conditions: [has('main:flag.top_reached')], text: '你已站上顶点。未完成的当地事务仍可继续。' }
  ] });
  definition.quests = snapshot;
  return [sidePack, mainPack];
}
