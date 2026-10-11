import { validateDistrictDefinitions } from './district-schema.ts';
import { PackError } from '../core/errors.ts';
import type { PackIssue } from '../core/errors.ts';
import { clone, stableJson } from '../core/types.ts';
import type { Condition, ContentPack, Effect, Id, PackRef } from '../core/types.ts';
import { parsePack } from './schema.ts';
import { instantiateBody, validateBody } from '../engine/body.ts';
import { Registry } from './registry.ts';
export async function loadPacks(input: unknown[]): Promise<Registry> {
  const packs = input.map(x => parsePack(clone(x)));
  const issues: PackIssue[] = [];
  function fail(pack: ContentPack, code: string, pointer: string, reason: string, definitionId = ''): void {
    issues.push({ severity: 'ERROR', code, packId: pack.manifest.id, pointer, definitionId, reason, suggestion: '修正内容包定义或显式依赖；不修改别的包。' });
  }
  const byId = new Map<string, ContentPack>(); const ns = new Set<string>();
  for (const p of packs) {
    if (byId.has(p.manifest.id) || ns.has(p.manifest.namespace)) fail(p, 'DUPLICATE_PACK', '/manifest', '包 ID 或命名空间重复。');
    byId.set(p.manifest.id, p); ns.add(p.manifest.namespace);
  }
  const sorted: ContentPack[] = []; const visiting = new Set<string>(); const visited = new Set<string>();
  function visit(p: ContentPack): void {
    if (visited.has(p.manifest.id)) return;
    if (visiting.has(p.manifest.id)) { fail(p, 'DEPENDENCY_CYCLE', '/manifest/dependencies', '存在依赖循环。'); return; }
    visiting.add(p.manifest.id);
    for (const d of [...p.manifest.dependencies].sort((a, b) => a.id.localeCompare(b.id, 'en'))) {
      const target = byId.get(d.id);
      if (!target && !d.optional) fail(p, 'MISSING_DEPENDENCY', '/manifest/dependencies', `缺少 ${d.id}。`);
      if (target) { if (target.manifest.version !== d.version) fail(p, 'DEPENDENCY_VERSION', '/manifest/dependencies', `${d.id} 需要版本 ${d.version}。`); visit(target); }
    }
    visiting.delete(p.manifest.id); visited.add(p.manifest.id); sorted.push(p);
  }
  for (const p of [...packs].sort((a, b) => a.manifest.id.localeCompare(b.manifest.id, 'en'))) visit(p);
  const definitions = new Map<string, { type: string; pack: ContentPack; value: unknown }>();
  for (const p of sorted) {
    for (const type of ['variables', 'flags', 'hooks', 'locations', 'routes', 'actions', 'events', 'bodyParts', 'bodyTemplates', 'bodyPatches', 'transformations', 'species', 'npcs', 'npcMemories', 'storylets', 'residentTemplates', 'enemies', 'interactions', 'textSlots', 'sceneTexts', 'equipment'] as const) {
      for (const value of p[type] ?? []) add(p, value.id, type, value);
    }
    for (const [id, value] of Object.entries(p.texts)) add(p, id, 'texts', value);
  }
  function add(p: ContentPack, id: string, type: string, value: unknown): void {
    if (id.split(':')[0] !== p.manifest.namespace) fail(p, 'NAMESPACE_OWNERSHIP', `/${type}/${id}`, '不能定义其他包的 ID。', id);
    if (definitions.has(id)) fail(p, 'DUPLICATE_ID', `/${type}/${id}`, '定义 ID 重复。', id);
    definitions.set(id, { type, pack: p, value });
  }
  function ref(p: ContentPack, id: Id, type: string, path: string): void {
    const d = definitions.get(id);
    if (!d || d.type !== type) { fail(p, 'INVALID_REFERENCE', path, `${id} 不是已注册的 ${type}。`, id); return; }
    if (d.pack !== p && !p.manifest.dependencies.some(x => x.id === d.pack.manifest.id)) fail(p, 'UNDECLARED_DEPENDENCY', path, `引用 ${id} 需要显式依赖其包。`, id);
  }
  function checkCondition(p: ContentPack, c: Condition, path: string): void {
    if (c.op === 'all' || c.op === 'any') c.conditions.forEach((x, i) => checkCondition(p, x, `${path}/${i}`));
    else if (c.op === 'not') checkCondition(p, c.condition, `${path}/condition`);
    else if (c.op === 'var.compare') ref(p, c.id, 'variables', path);
    else if (c.op === 'day.after') ref(p,c.flagId,'flags',path);
    else if (c.op === 'flag.has') ref(p, c.id, 'flags', path);
    else if (c.op === 'location.is') ref(p, c.id, 'locations', path);
    else if (c.op === 'event.state') ref(p, c.id, 'events', path);
    else if (c.op === 'body.hasPart') ref(p, c.definitionId, 'bodyParts', path);
    else if (c.op === 'tf.state') ref(p, c.id, 'transformations', path);
    else if (c.op === 'npc.present' || c.op === 'npc.memory' || c.op === 'npc.relation') {
      ref(p, c.npcId, 'npcs', path);
      if (c.op === 'npc.memory') { ref(p, c.memoryId, 'npcMemories', path); const memory = definitions.get(c.memoryId)?.value as NonNullable<ContentPack['npcMemories']>[number] | undefined; if (memory && memory.npcId !== c.npcId) fail(p, 'NPC_MEMORY_OWNER', path, '记忆与人物不匹配。'); }
      if (!p.manifest.requiresCapabilities.includes('npc.fixed.v1')) fail(p, 'CAPABILITY_UNDECLARED', path, 'NPC 条件需声明 npc.fixed.v1。');
    }
  }
  function checkEffect(p: ContentPack, e: Effect, path: string, context?: { eventId: Id; nodeId: string }): void {
    if (e.op === 'var.change') ref(p, e.id, 'variables', path);
    else if (e.op === 'combat.start') ref(p,e.id,'enemies',path);
    else if (e.op === 'scene.start') ref(p,e.id,'interactions',path);
    else if (e.op === 'equipment.wear') ref(p,e.id,'equipment',path);
    else if (e.op === 'flag.set') ref(p, e.id, 'flags', path);
    else if (e.op === 'location.move') ref(p, e.routeId, 'routes', path);
    else if (e.op === 'event.start') ref(p, e.id, 'events', path);
    else if (e.op === 'npc.remember') {
      ref(p, e.npcId, 'npcs', path); ref(p, e.memoryId, 'npcMemories', path);
      const memory = definitions.get(e.memoryId)?.value as NonNullable<ContentPack['npcMemories']>[number] | undefined;
      const event = context ? definitions.get(context.eventId)?.value as ContentPack['events'][number] | undefined : undefined;
      if (memory && memory.npcId !== e.npcId) fail(p, 'NPC_MEMORY_OWNER', path, '记忆与人物不匹配。');
      if (!event?.participantIds?.includes(e.npcId)) fail(p, 'NPC_MEMORY_CONTEXT', path, 'NPC 记忆只能由有该参与者的事件写入。');
      if (!p.manifest.requiresCapabilities.includes('npc.fixed.v1')) fail(p, 'CAPABILITY_UNDECLARED', path, 'NPC 效果需声明 npc.fixed.v1。');
    }
    else if (e.op === 'tf.apply' || e.op === 'tf.enqueue' || e.op === 'tf.pause' || e.op === 'tf.resume' || e.op === 'tf.cancel') {
      ref(p, e.id, 'transformations', path);
      const def = definitions.get(e.id)?.value as NonNullable<ContentPack['transformations']>[number] | undefined;
      const source = def?.source;
      if ((e.op === 'tf.apply' && source !== 'free') || (e.op === 'tf.enqueue' && source !== 'story')) fail(p, 'TF_SOURCE', path, '变化入口与定义来源不一致。');
      if (!p.manifest.requiresCapabilities.includes('tf.pipeline.v1')) fail(p, 'CAPABILITY_UNDECLARED', path, 'TF 效果需要声明 tf.pipeline.v1。');
    }
    else if (e.op === 'event.advance' || e.op === 'event.exit') {
      if (!context) fail(p, 'MISSING_EVENT_CONTEXT', path, '事件转换必须绑定事件节点。');
      else if (e.op === 'event.advance') {
        const def = definitions.get(context.eventId)?.value as ContentPack['events'][number] | undefined;
        if (!def?.nodes.some(x => x.id === e.nodeId)) fail(p, 'INVALID_NODE', path, `不存在节点 ${e.nodeId}。`);
      }
    }
  }
  const starts = sorted.filter(x => x.start);
  if (starts.length !== 1) fail(sorted[0] ?? parsePack(input[0]), 'INVALID_ENTRYPOINT', '/start', '必须且只能有一个世界开局入口。');
  for (const p of sorted) {
    if (p.start) ref(p, p.start.locationId, 'locations', '/start/locationId');
    for (const l of p.locations) { ref(p, l.textKey, 'texts', `/locations/${l.id}/textKey`); ref(p, l.actionHook, 'hooks', `/locations/${l.id}/actionHook`); }
    for (const r of p.routes) { ref(p, r.from, 'locations', `/routes/${r.id}/from`); ref(p, r.to, 'locations', `/routes/${r.id}/to`); if (r.from === r.to) fail(p, 'INVALID_ROUTE', `/routes/${r.id}`, '路线两端相同。'); }
    for (const c of p.contributions) { ref(p, c.hookId, 'hooks', '/contributions/hookId'); for (const id of c.actionIds) { ref(p, id, 'actions', '/contributions/actionIds'); if (id.split(':')[0] !== p.manifest.namespace) fail(p, 'CONTRIBUTION_OWNERSHIP', '/contributions/actionIds', '只可贡献自己的动作。'); const action = definitions.get(id)?.value as ContentPack['actions'][number] | undefined; if (action?.context) fail(p, 'EVENT_ACTION_IN_HOOK', '/contributions/actionIds', '事件专用动作不能暴露到地点 Hook。'); } }
    for (const a of p.actions) {
      ref(p, a.resultText, 'texts', `/actions/${a.id}/resultText`);
      if (a.context) { ref(p, a.context.eventId, 'events', `/actions/${a.id}/context`); const event = definitions.get(a.context.eventId)?.value as ContentPack['events'][number] | undefined; if (!event?.nodes.some(x => x.id === a.context!.nodeId && x.actionIds.includes(a.id))) fail(p, 'INVALID_EVENT_ACTION', `/actions/${a.id}/context`, '事件节点没有登记该动作。'); }
      a.conditions.forEach((x, i) => checkCondition(p, x, `/actions/${a.id}/conditions/${i}`));
      a.effects.forEach((x, i) => checkEffect(p, x, `/actions/${a.id}/effects/${i}`, a.context));
    }
    for (const e of p.events) {
      for (const npcId of e.participantIds ?? []) ref(p, npcId, 'npcs', `/events/${e.id}/participantIds`);
      // 玩家年龄协议尚未实现；不能因为 NPC 有年龄就开放成人事件。
      if (e.rating === 'adult') fail(p, 'ADULT_PLAYER_UNVERIFIED', `/events/${e.id}/rating`, '本阶段尚无玩家成年资格协议，成人事件不可加载。');
      const nodes = new Map(e.nodes.map(x => [x.id, x]));
      if (nodes.size !== e.nodes.length || !nodes.has(e.startNode)) fail(p, 'INVALID_EVENT_NODES', `/events/${e.id}`, '节点重复或缺开局节点。');
      for (const n of e.nodes) {
        n.textVariants.forEach(id => ref(p, id, 'texts', `/events/${e.id}/${n.id}/textVariants`));
        n.actionIds.forEach(id => { ref(p, id, 'actions', `/events/${e.id}/${n.id}/actionIds`); const action = definitions.get(id)?.value as ContentPack['actions'][number] | undefined; if (action && (action.context?.eventId !== e.id || action.context?.nodeId !== n.id)) fail(p, 'INVALID_EVENT_ACTION', `/events/${e.id}/${n.id}/actionIds`, '动作的事件上下文与节点不匹配。'); });
        n.onEnter.forEach((x, i) => { checkEffect(p, x, `/events/${e.id}/${n.id}/onEnter/${i}`, { eventId: e.id, nodeId: n.id }); if (x.op === 'event.start' || x.op === 'event.advance') fail(p, 'EVENT_RECURSION', `/events/${e.id}/${n.id}`, '本切片不允许进入节点时递归启动/推进事件。'); });
        if (n.type === 'exit' && !n.onEnter.some(x => x.op === 'event.exit')) fail(p, 'MISSING_EXIT', `/events/${e.id}/${n.id}`, '退出节点必须清理事件。');
        if (n.type === 'choice' && (!n.actionIds.length || n.onEnter.some(x => x.op === 'event.exit'))) fail(p, 'INVALID_CHOICE', `/events/${e.id}/${n.id}`, '选择节点需要真实行动且不能进入后即退出。');
      }
      const seen = new Set<string>();
      function reachable(id: string): void { if (seen.has(id)) return; seen.add(id); const n = nodes.get(id); for (const a of n?.actionIds ?? []) { const action = definitions.get(a)?.value as ContentPack['actions'][number] | undefined; for (const fx of action?.effects ?? []) if (fx.op === 'event.advance') reachable(fx.nodeId); } }
      reachable(e.startNode);
      if (seen.size !== nodes.size || !e.nodes.some(x => seen.has(x.id) && x.type === 'exit')) fail(p, 'EVENT_UNREACHABLE', `/events/${e.id}`, '存在不可达节点或没有退出路径。');
      // 每一个选择节点都需要无条件出口；条件分支可存在，但不能把玩家锁死。
      for (const n of e.nodes.filter(x => x.type === 'choice')) {
        const actions = n.actionIds.map(x => definitions.get(x)?.value as ContentPack['actions'][number] | undefined);
        if (!actions.some(a => a && !a.conditions.length && a.effects.some(fx => fx.op === 'event.exit' || (fx.op === 'event.advance' && nodes.get(fx.nodeId)?.type === 'exit')))) fail(p, 'NO_SAFE_EXIT', `/events/${e.id}/${n.id}`, '选择节点缺无条件合法退出。');
      }
    }
  }
  const templates = sorted.flatMap(p => p.bodyTemplates ?? []);
  const canonKeys = new Set<string>();
  for (const p of sorted) {
    if ((p.npcs?.length || p.npcMemories?.length || p.species?.length) && !p.manifest.requiresCapabilities.includes('npc.fixed.v1')) fail(p, 'CAPABILITY_UNDECLARED', '/npcs', '人物定义需声明 npc.fixed.v1。');
    for (const npc of p.npcs ?? []) {
      if (canonKeys.has(npc.canonKey)) fail(p, 'NPC_CANON_DUPLICATE', `/npcs/${npc.id}`, '固定人物身份键重复。'); canonKeys.add(npc.canonKey);
      ref(p, npc.speciesId, 'species', `/npcs/${npc.id}/speciesId`); ref(p, npc.descriptionText, 'texts', `/npcs/${npc.id}/descriptionText`); ref(p, npc.topicHook, 'hooks', `/npcs/${npc.id}/topicHook`);
      if (npc.topicHook.split(':')[0] !== p.manifest.namespace) fail(p, 'NPC_HOOK_OWNERSHIP', `/npcs/${npc.id}/topicHook`, '人物话题 Hook 必须由人物包拥有。');
      for (const s of npc.schedule) { if (s.locationId) ref(p, s.locationId, 'locations', `/npcs/${npc.id}/schedule`); ref(p, s.activityText, 'texts', `/npcs/${npc.id}/schedule`); }
      // 每分钟恰好一个日程；locationId:null 明确表示不公开的离场，缺省不是瞬移。
      for (let now = 0; now < 1440; now++) if (npc.schedule.filter(s => s.start < s.end ? now >= s.start && now < s.end : now >= s.start || now < s.end).length !== 1) { fail(p, 'NPC_SCHEDULE_COVERAGE', `/npcs/${npc.id}/schedule`, '日程存在重叠或未覆盖的分钟。'); break; }
    }
    for (const memory of p.npcMemories ?? []) { ref(p, memory.npcId, 'npcs', `/npcMemories/${memory.id}/npcId`); ref(p, memory.textKey, 'texts', `/npcMemories/${memory.id}/textKey`); }
    for (const e of p.events) if (e.participantIds?.length && !p.manifest.requiresCapabilities.includes('npc.fixed.v1')) fail(p, 'CAPABILITY_UNDECLARED', `/events/${e.id}/participantIds`, '事件参与者需声明 npc.fixed.v1。');
  }
  if (templates.length && templates.filter(x => x.initial).length !== 1) fail(sorted[0], 'BODY_ENTRYPOINT', '/bodyTemplates', '身体模板需有且只有一个默认入口。');
  for (const p of sorted) {
    if ((p.bodyParts?.length || p.bodyTemplates?.length || p.bodyPatches?.length) && !p.manifest.requiresCapabilities.includes('body.graph.v1')) fail(p, 'CAPABILITY_UNDECLARED', '/manifest/requiresCapabilities', '身体定义需要声明 body.graph.v1。');
    if (p.transformations?.length && !p.manifest.requiresCapabilities.includes('tf.pipeline.v1')) fail(p, 'CAPABILITY_UNDECLARED', '/manifest/requiresCapabilities', 'TF 定义需要声明 tf.pipeline.v1。');
    for (const t of p.bodyTemplates ?? []) for (const part of t.parts) ref(p, part.definitionId, 'bodyParts', `/bodyTemplates/${t.id}/parts`);
    for (const patch of p.bodyPatches ?? []) for (const op of patch.operations) {
      if (op.type !== 'remove') ref(p, op.definitionId, 'bodyParts', `/bodyPatches/${patch.id}/operations`);
      if (op.type === 'attach') {
        const part = definitions.get(op.definitionId)?.value as NonNullable<ContentPack['bodyParts']>[number] | undefined;
        const parents = sorted.flatMap(pack => pack.bodyParts ?? []);
        if (part && !parents.some(parent => parent.anchors.some(a => a.id === op.anchorId && a.accepts.includes(part.kind)))) fail(p, 'BODY_ANCHOR', `/bodyPatches/${patch.id}/operations`, '没有注册接收该部件的对应锚点。', patch.id);
      }
    }
    for (const t of p.transformations ?? []) for (const stage of t.stages) if (stage.patchId) ref(p, stage.patchId, 'bodyPatches', `/transformations/${t.id}/stages`);
    for (const hook of p.globalActionHooks ?? []) {
      ref(p, hook, 'hooks', '/globalActionHooks');
      if (hook.split(':')[0] !== p.manifest.namespace) fail(p, 'GLOBAL_HOOK_OWNERSHIP', '/globalActionHooks', '只能登记自己拥有的全局 Hook。');
      if (!p.manifest.requiresCapabilities.includes('hook.global.v1')) fail(p, 'CAPABILITY_UNDECLARED', '/globalActionHooks', '需声明 hook.global.v1。');
    }
    for (const c of p.contributions) if (sorted.some(owner => owner.globalActionHooks?.includes(c.hookId))) for (const id of c.actionIds) {
      const action = definitions.get(id)?.value as ContentPack['actions'][number] | undefined;
      if (action?.surface !== 'body' || action.context) fail(p, 'GLOBAL_ACTION_SURFACE', '/contributions', '当前全局 Hook 仅接受身体面板行动。');
    }
  }
  if (issues.length) throw new PackError(issues);
  const references: PackRef[] = [];
  for (const p of sorted) {
    const bytes = new TextEncoder().encode(stableJson(p));
    const digest = await crypto.subtle.digest('SHA-256', bytes);
    references.push({ id: p.manifest.id, version: p.manifest.version, hash: [...new Uint8Array(digest)].map(x => x.toString(16).padStart(2, '0')).join('') });
  }
  const registry = new Registry(sorted, references);
  validateDistrictDefinitions(sorted, registry, fail, checkCondition);
  for (const p of sorted) for (const template of p.bodyTemplates ?? []) {
    try { validateBody(instantiateBody(template), registry); }
    catch (error) { fail(p, 'BODY_TOPOLOGY', `/bodyTemplates/${template.id}`, error instanceof Error ? error.message : '身体模板无效。', template.id); }
  }
  if (issues.length) throw new PackError(issues);
  return registry;
}
