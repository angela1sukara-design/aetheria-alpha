import { clone, stableJson } from '../core/types.ts';
import type { GameState, Id } from '../core/types.ts';
import type { Registry } from '../content/registry.ts';
export const MAX_SAVE_BYTES = 4 * 1024 * 1024;
export type DecodeResult = { status: 'ready'; state: GameState } | { status: 'quarantined'; code: string; reason: string; original: string };
interface SavePayload { format: 'aetheria-alpha'; schemaVersion: 1; savedAt: string; state: GameState }
async function checksum(value: unknown): Promise<string> {
  const bytes = new TextEncoder().encode(stableJson(value));
  const hash = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(hash)].map(x => x.toString(16).padStart(2, '0')).join('');
}
/** 校验不能修改/修补导入状态；缺包、版本变化、未实现模块均保留原文件并隔离。 */
export function validateState(value: unknown, registry: Registry): asserts value is GameState {
  const bad = (message: string): never => { throw new Error(message); };
  const object = (v: unknown, keys?: string[]): Record<string, unknown> => {
    if (!v || typeof v !== 'object' || Array.isArray(v)) bad('状态结构不是对象。');
    const x = v as Record<string, unknown>;
    if (keys && (Object.keys(x).length !== keys.length || Object.keys(x).some(k => !keys.includes(k)))) bad('状态中存在未知字段或缺少字段。');
    return x;
  };
  const int = (x: unknown, min = 0, max = Number.MAX_SAFE_INTEGER): number => { if (!Number.isSafeInteger(x) || (x as number) < min || (x as number) > max) bad('数值超出合法范围。'); return x as number; };
  const array = (x: unknown): unknown[] => { if (!Array.isArray(x)) bad('状态数组无效。'); return x as unknown[]; };
  const string = (x: unknown): string => { if (typeof x !== 'string' || !x.length) bad('状态字符串无效。'); return x as string; };
  const unique = (x: unknown[]): void => { if (new Set(x).size !== x.length) bad('状态中存在重复条目。'); };
  const state = object(value, ['meta', 'clock', 'world', 'player', 'eventInstances', 'activeEventStack', 'rng', 'ledger']);
  const meta = object(state.meta, ['schemaVersion', 'engineVersion', 'revision', 'packs']);
  if (meta.schemaVersion !== 1 || meta.engineVersion !== '0.1') bad('存档版本尚不支持；没有自动降级或迁移。');
  const revision = int(meta.revision);
  const refs = array(meta.packs);
  if (refs.length !== registry.packs.length) bad('PACK_MISMATCH：存档与已安装内容包集合不一致。');
  const refIds: string[] = [];
  for (const raw of refs) {
    const ref = object(raw, ['id', 'version', 'hash']); refIds.push(string(ref.id));
    const installed = registry.packs.find(x => x.id === ref.id);
    if (!installed || installed.version !== ref.version || installed.hash !== ref.hash) bad(`PACK_MISMATCH：缺少或已变更的内容包 ${ref.id}。原存档不会被删改。`);
  }
  unique(refIds);
  const clock = object(state.clock, ['totalMinutes', 'crossedDays']); const total = int(clock.totalMinutes);
  const days = array(clock.crossedDays); unique(days);
  for (const day of days) int(day, 1, Math.floor(total / 1440));
  const world = object(state.world, ['locationId', 'knownLocationIds']);
  registry.location(string(world.locationId) as Id); const known = array(world.knownLocationIds); unique(known);
  for (const id of known) registry.location(string(id) as Id);
  if (!known.includes(world.locationId)) bad('当前地点必须已发现。');
  const player = object(state.player, ['variables', 'flags']);
  const variables = object(player.variables, registry.variables.map(x => x.id));
  for (const v of registry.variables) int(variables[v.id], v.min, v.max);
  const flags = object(player.flags, registry.flags.map(x => x.id));
  for (const v of registry.flags) if (typeof flags[v.id] !== 'boolean') bad('标记状态无效。');
  const eventIds: string[] = []; const activeIds: string[] = [];
  for (const raw of array(state.eventInstances)) {
    const event = object(raw, ['instanceId', 'definitionId', 'nodeId', 'status', 'textByNode', 'draws', 'locals']);
    const instanceId = string(event.instanceId); eventIds.push(instanceId);
    const def = registry.event(string(event.definitionId) as Id);
    if (!def.nodes.some(x => x.id === event.nodeId)) bad('事件节点不存在。');
    if (event.status !== 'active' && event.status !== 'completed') bad('事件状态无效。');
    if (event.status === 'active') activeIds.push(instanceId);
    const texts = object(event.textByNode);
    if (!texts[string(event.nodeId)]) bad('当前事件没有已经锁定的文字。');
    for (const [nodeId, textId] of Object.entries(texts)) if (!def.nodes.find(x => x.id === nodeId)?.textVariants.includes(string(textId) as Id)) bad('事件抽样结果与定义不一致。');
    const draws = array(event.draws); const drawnIds: string[] = [];
    for (const rawDraw of draws) { const d = object(rawDraw, ['nodeId', 'value']); drawnIds.push(string(d.nodeId)); if (!texts[string(d.nodeId)] || typeof d.value !== 'number' || d.value < 0 || d.value >= 1) bad('事件随机记录无效。'); const n = def.nodes.find(x => x.id === d.nodeId)!; if (n.textVariants[Math.floor((d.value as number) * n.textVariants.length)] !== texts[string(d.nodeId)]) bad('随机结果与文字索引不一致。'); }
    unique(drawnIds); if (draws.length !== Object.keys(texts).length) bad('事件抽样次数不一致。');
    for (const v of Object.values(object(event.locals))) if (!['string', 'number', 'boolean'].includes(typeof v) || (typeof v === 'number' && !Number.isFinite(v))) bad('事件局部变量无效。');
  }
  unique(eventIds); const stack = array(state.activeEventStack); unique(stack);
  if (stack.length > 1 || stableJson([...stack].sort()) !== stableJson([...activeIds].sort())) bad('事件栈与活动事件不一致。');
  const rng = object(state.rng, ['seed', 'streams']); int(rng.seed, 0, 4294967295);
  const streams = object(rng.streams);
  for (const [key, raw] of Object.entries(streams)) { string(key); const s = object(raw, ['state', 'draws']); int(s.state, 1, 4294967295); int(s.draws, 1); }
  for (const raw of array(state.eventInstances)) { const e = raw as GameState['eventInstances'][number]; const stream = streams[`event:${e.instanceId}`] as { draws: number } | undefined; if (!stream || stream.draws !== e.draws.length) bad('事件独立随机流丢失或次数不符。'); }
  const ledger = object(state.ledger, ['transactions']); const transactions = array(ledger.transactions); const requests: string[] = [];
  if (transactions.length !== revision) bad('事务账本与 revision 不一致。');
  transactions.forEach((raw, index) => {
    const tx = object(raw, ['requestId', 'fingerprint', 'result']); const requestId = string(tx.requestId); if (requestId.length > 128) bad('事务 ID 过长。'); requests.push(requestId);
    const intent = JSON.parse(string(tx.fingerprint)); const intentObj = object(intent);
    if (Object.keys(intentObj).some(k => k !== 'actionId' && k !== 'params')) bad('事务 intent 包含未知字段。');
    if (intentObj.params && Object.keys(object(intentObj.params)).length) bad('事务参数未登记。');
    registry.action(string(intentObj.actionId) as Id);
    if (stableJson(intent) !== tx.fingerprint) bad('事务指纹无效。');
    const result = object(tx.result, ['ok', 'code', 'message', 'revision', 'requestId', 'text', 'changes']);
    if (result.ok !== true || result.code !== 'COMMITTED' || result.revision !== index + 1 || result.requestId !== requestId) bad('事务结果无效。');
    string(result.message); string(result.text);
    for (const rawChange of array(result.changes)) { const c = object(rawChange, ['label', 'before', 'after']); string(c.label); for (const v of [c.before, c.after]) if (!['number', 'string', 'boolean'].includes(typeof v) || (typeof v === 'number' && !Number.isFinite(v))) bad('事务变化摘要无效。'); }
  });
  unique(requests);
}
export class SaveCodec {
  readonly registry: Registry;
  constructor(registry: Registry) { this.registry = registry; }
  async encode(state: GameState): Promise<string> {
    validateState(state, this.registry);
    const payload: SavePayload = { format: 'aetheria-alpha', schemaVersion: 1, savedAt: new Date().toISOString(), state: clone(state) };
    const text = JSON.stringify({ payload, checksum: await checksum(payload) }, null, 2);
    if (new TextEncoder().encode(text).byteLength > MAX_SAVE_BYTES) throw new Error('存档超过 4 MiB；本版本不会截断账本或删除进度。');
    return text;
  }
  async decode(text: string): Promise<DecodeResult> {
    try {
      if (new TextEncoder().encode(text).byteLength > MAX_SAVE_BYTES) throw new Error('存档超过 4 MiB。');
      const envelope = JSON.parse(text);
      if (envelope?.payload?.format !== 'aetheria-alpha' || envelope.payload.schemaVersion !== 1) throw new Error('文件不是受支持的 Alpha 0.1 存档。');
      if (await checksum(envelope.payload) !== envelope.checksum) throw new Error('存档校验和不符，可能损坏。');
      if (!Number.isFinite(Date.parse(envelope.payload.savedAt))) throw new Error('存档日期格式不合法。');
      validateState(envelope.payload.state, this.registry);
      return { status: 'ready', state: clone(envelope.payload.state) };
    } catch (error) {
      const reason = error instanceof Error ? error.message : '存档格式无效。';
      return { status: 'quarantined', code: reason.includes('PACK_MISMATCH') ? 'PACK_MISMATCH' : 'SAVE_INVALID', reason, original: text };
    }
  }
}
