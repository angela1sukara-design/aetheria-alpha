import { PackError } from '../core/errors.ts';
import type { PackIssue } from '../core/errors.ts';
import { clone, stableJson } from '../core/types.ts';
import type { Condition, ContentPack, Effect, Id, PackRef } from '../core/types.ts';
import { parsePack } from './schema.ts';
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
    for (const type of ['variables', 'flags', 'hooks', 'locations', 'routes', 'actions', 'events'] as const) {
      for (const value of p[type]) add(p, value.id, type, value);
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
    else if (c.op === 'flag.has') ref(p, c.id, 'flags', path);
    else if (c.op === 'location.is') ref(p, c.id, 'locations', path);
    else if (c.op === 'event.state') ref(p, c.id, 'events', path);
  }
  function checkEffect(p: ContentPack, e: Effect, path: string, context?: { eventId: Id; nodeId: string }): void {
    if (e.op === 'var.change') ref(p, e.id, 'variables', path);
    else if (e.op === 'flag.set') ref(p, e.id, 'flags', path);
    else if (e.op === 'location.move') ref(p, e.routeId, 'routes', path);
    else if (e.op === 'event.start') ref(p, e.id, 'events', path);
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
  if (issues.length) throw new PackError(issues);
  const references: PackRef[] = [];
  for (const p of sorted) {
    const bytes = new TextEncoder().encode(stableJson(p));
    const digest = await crypto.subtle.digest('SHA-256', bytes);
    references.push({ id: p.manifest.id, version: p.manifest.version, hash: [...new Uint8Array(digest)].map(x => x.toString(16).padStart(2, '0')).join('') });
  }
  return new Registry(sorted, references);
}
