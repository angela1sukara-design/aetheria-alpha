import { projectV2 } from './foundation-schema.ts';
import { parseDistrict } from './district-schema.ts';
import { PART_KINDS, BODY_CAPABILITIES } from '../core/body-types.ts';
import { RELATION_FIELDS } from '../core/npc-types.ts';
import { PLAYER_RELATIONS } from '../core/quest-types.ts';
import { PackError } from '../core/errors.ts';
import type { PackIssue } from '../core/errors.ts';
import type { ContentPack } from '../core/types.ts';
export const CAPABILITIES = ['condition.v1', 'effect.v1', 'event.choice.v1', 'hook.action.v1', 'body.graph.v1', 'tf.pipeline.v1', 'hook.global.v1', 'npc.fixed.v1', 'district.v1', 'quest.binding.v1'] as const;
type Obj = Record<string, unknown>;
/** 只冻结本切片实际使用的契约；未实现操作符必须导入失败，不能静默跳过。 */
export function parsePack(input: unknown): ContentPack {
  if ((input as ContentPack)?.manifest?.schemaVersion === 2) return projectV2(input, parsePack);
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
  function id(value: unknown, path: string): void { if (typeof value !== 'string' || !/^[a-z][a-z0-9_-]*:[a-z][a-zA-Z0-9_.-]*$/.test(value)) fail(path, '需要 namespace:id。'); }
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
    else if (op === 'body.hasPart') { const x = obj(value, path, ['op', 'definitionId']); id(x.definitionId, `${path}/definitionId`); }
    else if (op === 'body.hasCapability') { const x = obj(value, path, ['op', 'capability', 'count']); choice(x.capability, `${path}/capability`, [...BODY_CAPABILITIES]); integer(x.count, `${path}/count`, 1, 128); }
    else if (op === 'tf.state') { const x = obj(value, path, ['op', 'id', 'state']); id(x.id, `${path}/id`); choice(x.state, `${path}/state`, ['idle', 'active', 'paused', 'blocked', 'completed', 'cancelled']); }
    else if (op === 'npc.present') { const x = obj(value, path, ['op', 'npcId']); id(x.npcId, `${path}/npcId`); }
    else if (op === 'npc.memory') { const x = obj(value, path, ['op', 'npcId', 'memoryId', 'value']); id(x.npcId, `${path}/npcId`); id(x.memoryId, `${path}/memoryId`); boolean(x.value, `${path}/value`); }
    else if (op === 'npc.relation') { const x = obj(value, path, ['op', 'npcId', 'field', 'comparison', 'value']); id(x.npcId, `${path}/npcId`); choice(x.field, `${path}/field`, [...RELATION_FIELDS]); choice(x.comparison, `${path}/comparison`, ['eq', 'gte', 'lte']); integer(x.value, `${path}/value`, -100, 100); }
    else if (op === 'day.after') { const x = obj(value,path,['op','flagId','days']); id(x.flagId,path); integer(x.days,path,1,30); }
    else if (op === 'scene.state') { const x = obj(value,path,['op','value']); choice(x.value,path,['active','paused','none']); }
    else if (op === 'resident.present') { const x = obj(value, path, ['op', 'residentId']); str(x.residentId, path); }
    else if (op === 'resident.relation') { const x = obj(value, path, ['op', 'residentId', 'relation']); str(x.residentId, path); choice(x.relation, path, [...PLAYER_RELATIONS]); }
    else if (op === 'resident.memory') { const x = obj(value, path, ['op', 'residentId', 'memoryId', 'value']); str(x.residentId, path); id(x.memoryId, path); boolean(x.value, path); }
    else if (op === 'resident.available') obj(value,path,['op']);
    else if (op === 'player.created') { const x = obj(value,path,['op','value']); boolean(x.value,path); }
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
    else if (['tf.apply', 'tf.enqueue', 'tf.pause', 'tf.resume', 'tf.cancel'].includes(String(op))) { const x = obj(value, path, ['op', 'id']); id(x.id, `${path}/id`); }
    else if (op === 'npc.remember') { const x = obj(value, path, ['op', 'npcId', 'memoryId', 'relationship']); id(x.npcId, `${path}/npcId`); id(x.memoryId, `${path}/memoryId`); const d = obj(x.relationship, `${path}/relationship`, [...RELATION_FIELDS]); for (const field of RELATION_FIELDS) integer(d[field], `${path}/relationship/${field}`, -100, 100); }
    else if (op === 'resident.remember') { const x = obj(value, path, ['op', 'residentId', 'memoryId']); str(x.residentId, path); id(x.memoryId, path); }
    else if (op === 'world.encounter') { const x = obj(value,path,['op','events']); if (x.events !== undefined) boolean(x.events,path); }
    else if (['resident.talk','resident.help','equipment.remove'].includes(String(op))) obj(value,path,['op']);
    else if (['combat.start','scene.start','equipment.wear'].includes(String(op))) { const x = obj(value,path,['op','id']); id(x.id,path); }
    else if (op === 'combat.turn') { const x = obj(value,path,['op','move']); choice(x.move,path,['attack','guard','recover','flee']); }
    else if (op === 'scene.act') { const x = obj(value,path,['op','move','poseId']); choice(x.move,path,['pose','contact','release','pause','resume','exit']); if(x.poseId !== undefined) str(x.poseId,path); }
    else if (op === 'player.create') { const x = obj(value,path,['op','name','ageYears']); str(x.name,path); integer(x.ageYears,path,18,120); }
    else if (op === 'preference.set') { const x = obj(value,path,['op','value']); boolean(x.value,path); }
    else fail(`${path}/op`, '未知或未实现的效果操作符。', 'UNSUPPORTED_OPCODE');
  }
  const root = obj(input, '', ['manifest', 'variables', 'flags', 'hooks', 'locations', 'routes', 'actions', 'events', 'texts', 'contributions', 'start', 'bodyParts', 'bodyTemplates', 'bodyPatches', 'transformations', 'globalActionHooks', 'species', 'npcs', 'npcMemories', 'storylets', 'residentTemplates', 'enemies', 'interactions', 'textSlots', 'sceneTexts', 'equipment']);
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
  list(root.routes, '/routes', (v, p) => {
    const x = obj(v, p, ['id', 'from', 'to', 'distanceTier', 'durationMinutes']);
    for (const k of ['id', 'from', 'to']) id(x[k], `${p}/${k}`);
    if (x.distanceTier !== undefined) choice(x.distanceTier, `${p}/distanceTier`, ['adjacent', 'far', 'cross']);
    if (x.durationMinutes !== undefined) integer(x.durationMinutes, `${p}/durationMinutes`, 1, 240);
  });
  list(root.actions, '/actions', (v, p) => { const x = obj(v, p, ['id', 'label', 'hint', 'group', 'conditions', 'effects', 'resultText', 'context', 'surface']); id(x.id, `${p}/id`); id(x.resultText, `${p}/resultText`); if (x.surface !== undefined) choice(x.surface, `${p}/surface`, ['scene', 'body']); str(x.label, `${p}/label`); str(x.hint, `${p}/hint`); choice(x.group, `${p}/group`, ['travel', 'daily', 'explore', 'event']); list(x.conditions, `${p}/conditions`, condition); list(x.effects, `${p}/effects`, effect); if (x.context) { const c = obj(x.context, `${p}/context`, ['eventId', 'nodeId']); id(c.eventId, `${p}/context/eventId`); str(c.nodeId, `${p}/context/nodeId`); } if (x.group === 'event' && !x.context) fail(`${p}/context`, '事件动作必须绑定事件及节点。'); if (!Array.isArray(x.effects) || !x.effects.length) fail(`${p}/effects`, '没有可执行效果的按钮不可注册。'); });
  list(root.events, '/events', (v, p) => { const x = obj(v, p, ['id', 'startNode', 'nodes', 'participantIds', 'residentIds', 'textMode', 'rating']); id(x.id, `${p}/id`); str(x.startNode, `${p}/startNode`); if (x.participantIds !== undefined) { list(x.participantIds, `${p}/participantIds`, id); if (Array.isArray(x.participantIds) && new Set(x.participantIds).size !== x.participantIds.length) fail(p, '事件参与者重复。'); } if (x.residentIds !== undefined) { list(x.residentIds, `${p}/residentIds`, str); if (Array.isArray(x.residentIds) && new Set(x.residentIds).size !== x.residentIds.length) fail(p, '居民参与者重复。'); } if (x.textMode !== undefined) choice(x.textMode, p, ['fixed']); if (x.rating !== undefined) choice(x.rating, `${p}/rating`, ['general', 'adult']); list(x.nodes, `${p}/nodes`, (v, p) => { const n = obj(v, p, ['id', 'type', 'textVariants', 'actionIds', 'onEnter']); str(n.id, `${p}/id`); choice(n.type, `${p}/type`, ['choice', 'exit']); list(n.textVariants, `${p}/textVariants`, id); list(n.actionIds, `${p}/actionIds`, id); list(n.onEnter, `${p}/onEnter`, effect); if (!Array.isArray(n.textVariants) || !n.textVariants.length) fail(`${p}/textVariants`, '必须有回退文字。'); }); });
  if (!root.texts || typeof root.texts !== 'object' || Array.isArray(root.texts)) fail('/texts', '需要文字字典。');
  else for (const [k, v] of Object.entries(root.texts)) { id(k, `/texts/${k}`); str(v, `/texts/${k}`); }
  list(root.contributions, '/contributions', (v, p) => { const x = obj(v, p, ['hookId', 'actionIds']); id(x.hookId, `${p}/hookId`); list(x.actionIds, `${p}/actionIds`, id); });
  if (root.start) { const x = obj(root.start, '/start', ['locationId', 'minutes']); id(x.locationId, '/start/locationId'); integer(x.minutes, '/start/minutes', 0); }
  function token(value: unknown, path: string): void { if (typeof value !== 'string' || !/^[a-z][a-z0-9_.-]{0,79}$/.test(value)) fail(path, '需要稳定的局部实例/锚点 ID。'); }
  list(root.species ?? [], '/species', (v, p) => { const x = obj(v, p, ['id', 'label', 'intelligent', 'adultAgeYears']); id(x.id, `${p}/id`); str(x.label, `${p}/label`); boolean(x.intelligent, `${p}/intelligent`); integer(x.adultAgeYears, `${p}/adultAgeYears`, 1, 10000); });
  list(root.npcs ?? [], '/npcs', (v, p) => {
    const x = obj(v, p, ['id', 'canonKey', 'name', 'role', 'descriptionText', 'speciesId', 'ageYears', 'topicHook', 'schedule']);
    for (const k of ['id', 'descriptionText', 'speciesId', 'topicHook']) id(x[k], `${p}/${k}`);
    token(x.canonKey, `${p}/canonKey`); for (const k of ['name', 'role']) str(x[k], `${p}/${k}`);
    if (x.ageYears !== null) integer(x.ageYears, `${p}/ageYears`, 0, 10000);
    list(x.schedule, `${p}/schedule`, (v, p) => { const s = obj(v, p, ['start', 'end', 'locationId', 'activityText']); integer(s.start, `${p}/start`, 0, 1439); integer(s.end, `${p}/end`, 0, 1439); if (s.start === s.end) fail(p, '日程时间窗口不可为空。'); if (s.locationId !== null) id(s.locationId, `${p}/locationId`); id(s.activityText, `${p}/activityText`); });
    if (!Array.isArray(x.schedule) || !x.schedule.length || x.schedule.length > 32) fail(p, '日程需有1–32个时段。');
  });
  list(root.npcMemories ?? [], '/npcMemories', (v, p) => { const x = obj(v, p, ['id', 'npcId', 'textKey', 'relationshipStage']); if(x.relationshipStage!==undefined)choice(x.relationshipStage,p,['introduced','familiar','trusted','private','closed']); id(x.id, `${p}/id`); id(x.npcId, `${p}/npcId`); id(x.textKey, `${p}/textKey`); });
  list(root.bodyParts ?? [], '/bodyParts', (v, p) => {
    const x = obj(v, p, ['id', 'label', 'kind', 'material', 'capabilities', 'anchors']); id(x.id, `${p}/id`); str(x.label, `${p}/label`);
    choice(x.kind, `${p}/kind`, [...PART_KINDS]); choice(x.material, `${p}/material`, ['organic', 'mechanical']);
    list(x.capabilities, `${p}/capabilities`, (v, p) => choice(v, p, [...BODY_CAPABILITIES]));
    if (Array.isArray(x.capabilities) && new Set(x.capabilities).size !== x.capabilities.length) fail(p, '能力不可重复。');
    list(x.anchors, `${p}/anchors`, (v, p) => { const a = obj(v, p, ['id', 'accepts', 'capacity']); token(a.id, `${p}/id`); integer(a.capacity, `${p}/capacity`, 1, 16); list(a.accepts, `${p}/accepts`, (v, p) => choice(v, p, [...PART_KINDS].filter(k => k !== 'root'))); if (!Array.isArray(a.accepts) || !a.accepts.length) fail(p, '锚点需要声明接收类别。'); });
    if (Array.isArray(x.anchors) && new Set(x.anchors.map(v => (v as Obj)?.id)).size !== x.anchors.length) fail(p, '锚点 ID 重复。');
  });
  list(root.bodyTemplates ?? [], '/bodyTemplates', (v, p) => {
    const x = obj(v, p, ['id', 'label', 'initial', 'rootPartId', 'parts', 'edges']); id(x.id, `${p}/id`); str(x.label, `${p}/label`); boolean(x.initial, `${p}/initial`); token(x.rootPartId, `${p}/rootPartId`);
    list(x.parts, `${p}/parts`, (v, p) => { const part = obj(v, p, ['instanceId', 'definitionId']); token(part.instanceId, `${p}/instanceId`); id(part.definitionId, `${p}/definitionId`); });
    list(x.edges, `${p}/edges`, (v, p) => { const e = obj(v, p, ['parentPartId', 'childPartId', 'anchorId']); for (const k of ['parentPartId', 'childPartId', 'anchorId']) token(e[k], `${p}/${k}`); });
  });
  list(root.bodyPatches ?? [], '/bodyPatches', (v, p) => {
    const x = obj(v, p, ['id', 'label', 'summary', 'operations']); id(x.id, `${p}/id`); str(x.label, `${p}/label`); str(x.summary, `${p}/summary`);
    list(x.operations, `${p}/operations`, (v, p) => { const op = (v as Obj)?.type; const o = obj(v, p, op === 'attach' ? ['type', 'partId', 'definitionId', 'parentPartId', 'anchorId'] : op === 'replace' ? ['type', 'partId', 'definitionId'] : ['type', 'partId']); choice(op, `${p}/type`, ['attach', 'replace', 'remove']); token(o.partId, `${p}/partId`); if (op !== 'remove') id(o.definitionId, `${p}/definitionId`); if (op === 'attach') { token(o.parentPartId, `${p}/parentPartId`); token(o.anchorId, `${p}/anchorId`); } });
    if (!Array.isArray(x.operations) || !x.operations.length || x.operations.length > 32) fail(p, '补丁需有1–32个实际图操作。');
  });
  list(root.transformations ?? [], '/transformations', (v, p) => {
    const x = obj(v, p, ['id', 'label', 'source', 'stages']); id(x.id, `${p}/id`); str(x.label, `${p}/label`); choice(x.source, `${p}/source`, ['free', 'story']);
    list(x.stages, `${p}/stages`, (v, p) => { const s = obj(v, p, ['id', 'atMinutes', 'label', 'patchId', 'textKey']); token(s.id, `${p}/id`); str(s.label, `${p}/label`); integer(s.atMinutes, `${p}/atMinutes`, 0, 10080); if (s.textKey !== undefined) id(s.textKey, p); if (s.patchId !== undefined) id(s.patchId, `${p}/patchId`); });
    const stages = Array.isArray(x.stages) ? x.stages as Obj[] : [];
    if (!stages.length || stages.length > 32 || !stages.some(s => s.patchId)) fail(p, '变化需有1–32个阶段，且实际改变身体。');
    if (new Set(stages.map(s => s.id)).size !== stages.length || stages.some((s, i) => i > 0 && Number(s.atMinutes) <= Number(stages[i - 1].atMinutes))) fail(p, '阶段 ID 重复或时间边界没有严格递增。');
    if (x.source === 'free' && (stages.length !== 1 || stages[0]?.atMinutes !== 0)) fail(p, '自由塑形只允许一个0分钟即时阶段。');
    if (x.source === 'story' && Number(stages[0]?.atMinutes) <= 0) fail(p, '剧情变化从正数分钟边界开始。');
  });
  list(root.globalActionHooks ?? [], '/globalActionHooks', id);
  parseDistrict(input, { obj, str, id, integer, boolean, list, choice, condition });
  if (issues.length) throw new PackError(issues);
  return input as ContentPack;
}
