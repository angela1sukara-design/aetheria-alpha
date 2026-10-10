import { PackError } from '../core/errors.ts';
import type { PackIssue } from '../core/errors.ts';
import type { ContentPack } from '../core/types.ts';
export const CAPABILITIES = ['condition.v1', 'effect.v1', 'event.choice.v1', 'hook.action.v1'] as const;
type Obj = Record<string, unknown>;
/** 只冻结本切片实际使用的契约；未实现操作符必须导入失败，不能静默跳过。 */
export function parsePack(input: unknown): ContentPack {
  const issues: PackIssue[] = [];
  let packId = 'unknown';
  function fail(pointer: string, reason: string, code = 'SCHEMA_INVALID'): void {
    issues.push({ severity: 'ERROR', code, packId, definitionId: pointer, pointer, reason, suggestion: '按 docs/protocol.md 修正字段与已支持的操作符。' });
  }
  function obj(value: unknown, path: string, keys: string[]): Obj {
    if (!value || typeof value !== 'object' || Array.isArray(value)) { fail(path, '必须是对象。'); return {}; }
    const result = value as Obj;
    for (const key of Object.keys(result)) if (!keys.includes(key)) fail(`${path}/${key}`, '未登记字段。');
    return result;
  }
  function str(value: unknown, path: string): void { if (typeof value !== 'string' || !value.trim() || value.length > 10000) fail(path, '必须是非空字符串（最多10000字符）。'); }
  function id(value: unknown, path: string): void { if (typeof value !== 'string' || !/^[a-z][a-z0-9_-]*:[a-z][a-z0-9_.-]*$/.test(value)) fail(path, '需要 namespace:id。'); }
  function integer(value: unknown, path: string, min = -1000000, max = 1000000): void { if (!Number.isSafeInteger(value) || (value as number) < min || (value as number) > max) fail(path, `必须是 ${min}–${max} 整数。`); }
  function boolean(value: unknown, path: string): void { if (typeof value !== 'boolean') fail(path, '必须是布尔值。'); }
  function list(value: unknown, path: string, visit: (x: unknown, p: string) => void): void {
    if (!Array.isArray(value) || value.length > 5000) { fail(path, '必须是数组，最多5000条。'); return; }
    value.forEach((x, i) => visit(x, `${path}/${i}`));
  }
  function choice(value: unknown, path: string, allowed: unknown[]): void { if (!allowed.includes(value)) fail(path, `仅支持 ${allowed.join(', ')}。`, 'UNSUPPORTED_VALUE'); }
  function condition(value: unknown, path: string, depth = 0): void {
    if (depth > 20) { fail(path, '条件嵌套超过20层。'); return; }
    const op = (value as Obj | null)?.op;
    if (op === 'all' || op === 'any') { const x = obj(value, path, ['op', 'conditions']); list(x.conditions, `${path}/conditions`, (c, p) => condition(c, p, depth + 1)); }
    else if (op === 'not') { const x = obj(value, path, ['op', 'condition']); condition(x.condition, `${path}/condition`, depth + 1); }
    else if (op === 'var.compare') { const x = obj(value, path, ['op', 'id', 'comparison', 'value']); id(x.id, `${path}/id`); choice(x.comparison, `${path}/comparison`, ['eq', 'gte', 'lte']); integer(x.value, `${path}/value`); }
    else if (op === 'flag.has') { const x = obj(value, path, ['op', 'id', 'value']); id(x.id, `${path}/id`); boolean(x.value, `${path}/value`); }
    else if (op === 'location.is') { const x = obj(value, path, ['op', 'id']); id(x.id, `${path}/id`); }
    else if (op === 'time.window') { const x = obj(value, path, ['op', 'start', 'end']); integer(x.start, `${path}/start`, 0, 1439); integer(x.end, `${path}/end`, 0, 1439); if (x.start === x.end) fail(path, '时间窗口不可为空。'); }
    else if (op === 'event.state') { const x = obj(value, path, ['op', 'id', 'state']); id(x.id, `${path}/id`); choice(x.state, `${path}/state`, ['unseen', 'active', 'completed']); }
    else fail(`${path}/op`, '未知或未实现的条件操作符。', 'UNSUPPORTED_OPCODE');
  }
  function effect(value: unknown, path: string): void {
    const op = (value as Obj | null)?.op;
    if (op === 'var.change') { const x = obj(value, path, ['op', 'id', 'amount']); id(x.id, `${path}/id`); integer(x.amount, `${path}/amount`); }
    else if (op === 'flag.set') { const x = obj(value, path, ['op', 'id', 'value']); id(x.id, `${path}/id`); boolean(x.value, `${path}/value`); }
    else if (op === 'clock.advance') { const x = obj(value, path, ['op', 'minutes']); integer(x.minutes, `${path}/minutes`, 0, 10080); }
    else if (op === 'location.move') { const x = obj(value, path, ['op', 'routeId']); id(x.routeId, `${path}/routeId`); }
    else if (op === 'event.start') { const x = obj(value, path, ['op', 'id']); id(x.id, `${path}/id`); }
    else if (op === 'event.advance') { const x = obj(value, path, ['op', 'nodeId']); str(x.nodeId, `${path}/nodeId`); }
    else if (op === 'event.exit') obj(value, path, ['op']);
    else fail(`${path}/op`, '未知或未实现的效果操作符。', 'UNSUPPORTED_OPCODE');
  }
  const root = obj(input, '', ['manifest', 'variables', 'flags', 'hooks', 'locations', 'routes', 'actions', 'events', 'texts', 'contributions', 'start']);
  const m = obj(root.manifest, '/manifest', ['id', 'namespace', 'version', 'schemaVersion', 'engineApiVersion', 'author', 'status', 'dependencies', 'requiresCapabilities', 'migrations']);
  if (typeof m.id === 'string') packId = m.id;
  str(m.id, '/manifest/id'); str(m.author, '/manifest/author');
  if (typeof m.namespace !== 'string' || !/^[a-z][a-z0-9_-]*$/.test(m.namespace)) fail('/manifest/namespace', '命名空间无效。');
  if (typeof m.version !== 'string' || !/^\d+\.\d+\.\d+$/.test(m.version)) fail('/manifest/version', '需要明确的三段版本。');
  choice(m.schemaVersion, '/manifest/schemaVersion', [1]); choice(m.engineApiVersion, '/manifest/engineApiVersion', ['0.1']);
  choice(m.status, '/manifest/status', ['draft', 'reviewed', 'approved']);
  list(m.dependencies, '/manifest/dependencies', (v, p) => { const x = obj(v, p, ['id', 'version', 'optional']); str(x.id, `${p}/id`); str(x.version, `${p}/version`); boolean(x.optional, `${p}/optional`); });
  list(m.requiresCapabilities, '/manifest/requiresCapabilities', (v, p) => choice(v, p, [...CAPABILITIES]));
  if (!Array.isArray(m.migrations) || m.migrations.length) fail('/manifest/migrations', '本版本尚未实现包迁移，必须为空。', 'UNSUPPORTED_MIGRATION');
  list(root.variables, '/variables', (v, p) => { const x = obj(v, p, ['id', 'label', 'initial', 'min', 'max', 'unit']); id(x.id, `${p}/id`); str(x.label, `${p}/label`); for (const k of ['initial', 'min', 'max']) integer(x[k], `${p}/${k}`); if (typeof x.unit !== 'string') fail(`${p}/unit`, '必须是字符串。'); if ((x.min as number) > (x.max as number) || (x.initial as number) < (x.min as number) || (x.initial as number) > (x.max as number)) fail(p, '初值或上下限不一致。'); });
  list(root.flags, '/flags', (v, p) => { const x = obj(v, p, ['id', 'initial']); id(x.id, `${p}/id`); boolean(x.initial, `${p}/initial`); });
  list(root.hooks, '/hooks', (v, p) => { const x = obj(v, p, ['id', 'accepts', 'visibility']); id(x.id, `${p}/id`); choice(x.accepts, `${p}/accepts`, ['action']); choice(x.visibility, `${p}/visibility`, ['public']); });
  list(root.locations, '/locations', (v, p) => { const x = obj(v, p, ['id', 'name', 'subtitle', 'textKey', 'actionHook', 'map']); for (const k of ['id', 'textKey', 'actionHook']) id(x[k], `${p}/${k}`); str(x.name, `${p}/name`); str(x.subtitle, `${p}/subtitle`); const map = obj(x.map, `${p}/map`, ['x', 'y']); integer(map.x, `${p}/map/x`, 0, 100); integer(map.y, `${p}/map/y`, 0, 100); });
  list(root.routes, '/routes', (v, p) => { const x = obj(v, p, ['id', 'from', 'to']); for (const k of ['id', 'from', 'to']) id(x[k], `${p}/${k}`); });
  list(root.actions, '/actions', (v, p) => { const x = obj(v, p, ['id', 'label', 'hint', 'group', 'conditions', 'effects', 'resultText', 'context']); id(x.id, `${p}/id`); id(x.resultText, `${p}/resultText`); str(x.label, `${p}/label`); str(x.hint, `${p}/hint`); choice(x.group, `${p}/group`, ['travel', 'daily', 'explore', 'event']); list(x.conditions, `${p}/conditions`, condition); list(x.effects, `${p}/effects`, effect); if (x.context) { const c = obj(x.context, `${p}/context`, ['eventId', 'nodeId']); id(c.eventId, `${p}/context/eventId`); str(c.nodeId, `${p}/context/nodeId`); } if (x.group === 'event' && !x.context) fail(`${p}/context`, '事件动作必须绑定事件及节点。'); if (!Array.isArray(x.effects) || !x.effects.length) fail(`${p}/effects`, '没有可执行效果的按钮不可注册。'); });
  list(root.events, '/events', (v, p) => { const x = obj(v, p, ['id', 'startNode', 'nodes']); id(x.id, `${p}/id`); str(x.startNode, `${p}/startNode`); list(x.nodes, `${p}/nodes`, (v, p) => { const n = obj(v, p, ['id', 'type', 'textVariants', 'actionIds', 'onEnter']); str(n.id, `${p}/id`); choice(n.type, `${p}/type`, ['choice', 'exit']); list(n.textVariants, `${p}/textVariants`, id); list(n.actionIds, `${p}/actionIds`, id); list(n.onEnter, `${p}/onEnter`, effect); if (!Array.isArray(n.textVariants) || !n.textVariants.length) fail(`${p}/textVariants`, '必须有回退文字。'); }); });
  if (!root.texts || typeof root.texts !== 'object' || Array.isArray(root.texts)) fail('/texts', '需要文字字典。');
  else for (const [k, v] of Object.entries(root.texts)) { id(k, `/texts/${k}`); str(v, `/texts/${k}`); }
  list(root.contributions, '/contributions', (v, p) => { const x = obj(v, p, ['hookId', 'actionIds']); id(x.hookId, `${p}/hookId`); list(x.actionIds, `${p}/actionIds`, id); });
  if (root.start) { const x = obj(root.start, '/start', ['locationId', 'minutes']); id(x.locationId, '/start/locationId'); integer(x.minutes, '/start/minutes', 0); }
  if (issues.length) throw new PackError(issues);
  return input as ContentPack;
}
