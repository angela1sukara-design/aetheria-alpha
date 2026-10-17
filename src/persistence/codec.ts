import { upgradeFoundation, foundationAddition } from './foundation-migration.ts';
import { isCoreExpandUpgradeTarget, normalizePlayerFlags, normalizePlayerVariables, normalizeSceneTemps } from './vars-migration.ts';
import { shape } from '../content/foundation-schema.ts';
import { clone, stableJson } from '../core/types.ts';
import type { GameState, Id } from '../core/types.ts';
import { validateBody, instantiateBody } from '../engine/body.ts';
import { STAGE1_PACKS } from './stage1-packs.ts';
import { STAGE2_PACKS } from './stage2-packs.ts';
import { STAGE3_PACKS, STAGE3_FIX1_PACKS, STAGE3_PACKS_LEGACY, STAGE3_FIX1_PACKS_LEGACY } from './stage3-packs.ts';
import { validateTFState } from './tf-validation.ts';
import { validateNPCState } from './npc-validation.ts';
import { createNPCStates } from '../engine/npc.ts';
import { validateDistrictState } from './district-validation.ts';
import { initialDistrict } from '../engine/district.ts';
import type { Registry } from '../content/registry.ts';
import { loadPacks } from '../content/loader.ts';
import { hash, parseRules } from '../world/schema.ts';
import { validateWorldInstance } from '../world/validation.ts';
import { validRequestFilter } from '../engine/history.ts';
import { validateAdventure } from './adventure-validation.ts';
import { adventure } from '../engine/narrative.ts';
import { upgradeUXContent } from './ux-content-migration.ts';
/** World snapshots embed pack definitions; adventure growth needs headroom above 4 MiB. */
export const MAX_SAVE_BYTES = 5 * 1024 * 1024;
export type DecodeResult = { status: 'ready'; state: GameState; registry?: Registry; migration?: string } | { status: 'quarantined'; code: string; reason: string; original: string };
interface SavePayload { format: 'aetheria-alpha'; schemaVersion: 3 | 4; savedAt: string; state: GameState }
async function checksum(value: unknown): Promise<string> {
  const bytes = new TextEncoder().encode(stableJson(JSON.parse(JSON.stringify(value))));
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
  const state = object(value, ['meta', 'clock', 'world', 'player', 'eventInstances', 'activeEventStack', 'rng', 'ledger', 'tfQueues', 'npcs', ...((value as GameState)?.district ? ['district'] : []), ...((value as GameState)?.worldInstance ? ['worldInstance'] : []), ...((value as GameState)?.adventure ? ['adventure'] : []), ...((value as GameState)?.meta?.schemaVersion===4?['environment']:[])]);
  const meta = object(state.meta, ['schemaVersion', 'engineVersion', 'revision', 'packs']);
  if (!(meta.schemaVersion===3&&meta.engineVersion==='0.1-stage3'||meta.schemaVersion===4&&meta.engineVersion==='0.2-foundation')) bad('存档版本尚不支持；没有自动降级或迁移。');
  if(meta.schemaVersion===4){const env=object(state.environment);for(const [id,raw]of Object.entries(env)){registry.location(id as Id);const p=shape(raw,[],['light']);if(p.light!==undefined&&!['lit','dark'].includes(p.light))bad('光照覆盖无效。');}}
  else {const reject=(v:unknown):void=>{if(v&&typeof v==='object'){for(const [k,x]of Object.entries(v)){if(['overrides','provenance','target','environment','entity'].includes(k))bad('v3 不接受 v4 新字段。');reject(x);}}};reject(state.player);reject(state.tfQueues);if((state as unknown as GameState).district?.scene)reject((state as unknown as GameState).district!.scene!.actors);}
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
  const clock = object(state.clock, ['totalMinutes', 'crossedDays', ...((state.clock as GameState['clock'])?.recovery ? ['recovery'] : [])]); const total = int(clock.totalMinutes);
  if (clock.recovery !== undefined) { const rawRec = clock.recovery as Record<string, unknown>; const recKeys = ['aftertasteMinutes', 'skillMinutes', ...('sanityHostileMinutes' in rawRec ? ['sanityHostileMinutes'] : [])]; const recovery = object(rawRec, recKeys); int(recovery.aftertasteMinutes, 0, 59); int(recovery.skillMinutes, 0, 29); if (recovery.sanityHostileMinutes !== undefined) int(recovery.sanityHostileMinutes, 0, 89); }
  const days = array(clock.crossedDays); unique(days);
  for (const day of days) int(day, 1, Math.floor(total / 1440));
  const world = object(state.world, ['locationId', 'knownLocationIds']);
  registry.location(string(world.locationId) as Id); const known = array(world.knownLocationIds); unique(known);
  for (const id of known) registry.location(string(id) as Id);
  if (!known.includes(world.locationId)) bad('当前地点必须已发现。');
  const player = object(state.player, ['variables', 'flags', 'body']);
  const variables = object(player.variables, registry.variables.map(x => x.id));
  for (const v of registry.variables) int(variables[v.id], v.min, v.max);
  const flags = object(player.flags);
  for (const k of Object.keys(flags)) if (!registry.flags.some(f => f.id === k)) bad('状态中存在未知标记。');
  for (const v of registry.flags) {
    if (v.id.startsWith('progression:') && !(v.id in flags)) continue;
    if (typeof flags[v.id] !== 'boolean') bad('标记状态无效。');
  }
  if (player.body !== null) validateBody(player.body, registry);
  else if (registry.bodyTemplates.some(x => x.initial)) bad('存档缺少身体图。');
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
    unique(drawnIds); if (draws.length !== (def.textMode === 'fixed' ? 0 : Object.keys(texts).length)) bad('事件抽样次数不一致。');
    for (const v of Object.values(object(event.locals))) if (!['string', 'number', 'boolean'].includes(typeof v) || (typeof v === 'number' && !Number.isFinite(v))) bad('事件局部变量无效。');
  }
  unique(eventIds); const stack = array(state.activeEventStack); unique(stack);
  if (stack.length > 1 || stableJson([...stack].sort()) !== stableJson([...activeIds].sort())) bad('事件栈与活动事件不一致。');
  const rng = object(state.rng, ['seed', 'streams']); int(rng.seed, 0, 4294967295);
  const streams = object(rng.streams);
  for (const [key, raw] of Object.entries(streams)) { string(key); const s = object(raw, ['state', 'draws']); int(s.state, 1, 4294967295); int(s.draws, 1); }
  for (const raw of array(state.eventInstances)) { const e = raw as GameState['eventInstances'][number]; const stream = streams[`event:${e.instanceId}`] as { draws: number } | undefined; if (registry.event(e.definitionId).textMode === 'fixed' ? !!stream : !stream || stream.draws !== e.draws.length) bad('事件独立随机流丢失或次数不符。'); }
  const ledger = object(state.ledger, ['transactions', ...((state.ledger as GameState['ledger'])?.checkpoint ? ['checkpoint'] : [])]); const transactions = array(ledger.transactions); const requests: string[] = [];
  const checkpoint = ledger.checkpoint === undefined ? undefined : object(ledger.checkpoint, ['revision', 'requests', 'evidence', 'completedEvents']);
  const baseRevision = checkpoint ? int(checkpoint.revision, 1, revision) : 0;
  if (checkpoint) { if (!validRequestFilter(checkpoint.requests)) bad('归档请求过滤器无效。'); const completed = array(checkpoint.completedEvents); unique(completed); for (const id of completed) registry.event(string(id) as Id); }
  if (transactions.length + baseRevision !== revision) bad('事务账本与 revision 不一致。');
  const checkTransaction = (raw: unknown, expectedRevision: number) => {
    const tx = object(raw, ['requestId', 'fingerprint', 'result', ...((raw as GameState['ledger']['transactions'][number])?.narrativeChoice?['narrativeChoice']:[])]); const requestId = string(tx.requestId); if (requestId.length > 128) bad('事务 ID 过长。'); requests.push(requestId);
    const intent = JSON.parse(string(tx.fingerprint)); const intentObj = object(intent);
    if (Object.keys(intentObj).some(k => k !== 'actionId' && k !== 'params')) bad('事务 intent 包含未知字段。');
    if (intentObj.params && Object.keys(object(intentObj.params)).length) { const p=object(intentObj.params);if(Object.keys(p).some(k=>k!=='name'&&k!=='ageYears')||intentObj.actionId!=='district:action.create'||typeof p.name!=='string'||!p.name.trim()||p.name.length>40)bad('事务参数未登记。');if(p.ageYears!==undefined)int(p.ageYears,18,120); }
    registry.action(string(intentObj.actionId) as Id);
    if(tx.narrativeChoice){const context=object(tx.narrativeChoice,['nodeId','index']);const index=int(context.index,0,3),node=registry.narrativeNodes.find(n=>n.id===context.nodeId);const hasChoice=!!node?.choices[index]||(node?.kind==='defeat'&&index===node.choices.length&&(registry.defeatReactionRules?.length??0)>0);if(!hasChoice||!registry.action(intentObj.actionId as Id).effects.some(e=>e.op==='narrative.choose'&&e.index===index))bad('故事事务来源错配。');}
    if (stableJson(intent) !== tx.fingerprint) bad('事务指纹无效。');
    const result = object(tx.result, ['ok', 'code', 'message', 'revision', 'requestId', 'text', 'changes']);
    if (result.ok !== true || result.code !== 'COMMITTED' || result.revision !== expectedRevision || result.requestId !== requestId) bad('事务结果无效。');
    string(result.message); string(result.text);
    for (const rawChange of array(result.changes)) { const c = object(rawChange, ['label', 'before', 'after']); string(c.label); for (const v of [c.before, c.after]) if (!['number', 'string', 'boolean'].includes(typeof v) || (typeof v === 'number' && !Number.isFinite(v))) bad('事务变化摘要无效。'); }
  };
  transactions.forEach((raw, index) => checkTransaction(raw, baseRevision + index + 1));
  if (checkpoint) for (const raw of array(checkpoint.evidence)) { const tx = raw as GameState['ledger']['transactions'][number]; checkTransaction(raw, int(tx?.result?.revision, 1, baseRevision)); }
  unique(requests);
  validateTFState(value as GameState, registry);
  validateNPCState(value as GameState, registry);
  validateDistrictState(value as GameState, registry);
  validateWorldInstance(value as GameState, registry);
  validateAdventure(value as GameState, registry);
}
function sortedRefs(refs: unknown): string {
  if (!Array.isArray(refs)) throw new Error('PACK_MISMATCH：存档内容包记录无效。');
  return stableJson([...refs].sort((a, b) => String(a?.id).localeCompare(String(b?.id), 'en')));
}
/** 只允许已发布官方指纹精确升级，不能借补丁接纳改过内容的存档。 */
function officialRepairInstalled(registry: Registry): boolean {
  return sortedRefs(registry.packs) === sortedRefs(STAGE3_FIX1_PACKS)
    || isCoreExpandUpgradeTarget(registry.packs, STAGE3_FIX1_PACKS)
    || isCoreExpandUpgradeTarget(registry.packs, STAGE3_FIX1_PACKS_LEGACY);
}
function applyVarExpand(state: GameState, registry: Registry): GameState {
  state.meta.packs = clone(registry.packs);
  normalizePlayerVariables(state, registry);
  normalizePlayerFlags(state, registry);
  normalizeSceneTemps(state);
  return state;
}
function upgradeStage3(raw: unknown, registry: Registry): { state: unknown; upgraded: boolean } {
  const meta = (raw as GameState | null)?.meta;
  if (meta && Array.isArray(meta.packs) && sortedRefs(meta.packs) === sortedRefs(registry.packs)) return { state: raw, upgraded: false };
  if ((raw as GameState)?.district && meta?.packs?.every(ref=>registry.packs.some(p=>p.id===ref.id&&p.version===ref.version&&p.hash===ref.hash)) && registry.packs.filter(p=>!meta.packs.some(ref=>ref.id===p.id)).every(p=>registry.appendOnlyPackIds.includes(p.id))) { const state=clone(raw) as GameState;return {state:applyVarExpand(state,registry),upgraded:true}; }
  // 官方第三阶段 / 修复包（含扩表前 legacy 指纹）→ 当前安装
  if (meta && Array.isArray(meta.packs) && officialRepairInstalled(registry)
    && (sortedRefs(meta.packs) === sortedRefs(STAGE3_PACKS)
      || sortedRefs(meta.packs) === sortedRefs(STAGE3_PACKS_LEGACY)
      || sortedRefs(meta.packs) === sortedRefs(STAGE3_FIX1_PACKS)
      || sortedRefs(meta.packs) === sortedRefs(STAGE3_FIX1_PACKS_LEGACY)
      || isCoreExpandUpgradeTarget(registry.packs, meta.packs as {id:string;version:string;hash:string}[]))) {
    return { state: applyVarExpand(clone(raw) as GameState, registry), upgraded: true };
  }
  return { state: raw, upgraded: false };
}
/** 精确迁移只增加新模块；旧状态仍需通过完整校验，存储 IO 不在此函数。 */
function migrateLegacy(raw: unknown, registry: Registry, version: 1 | 2): GameState {
  const old = clone(raw) as Record<string, unknown>;
  const keys = ['meta', 'clock', 'world', 'player', 'eventInstances', 'activeEventStack', 'rng', 'ledger', ...(version === 2 ? ['tfQueues'] : [])];
  if (!old || typeof old !== 'object' || Array.isArray(old) || Object.keys(old).sort().join('|') !== keys.sort().join('|')) throw new Error('旧存档字段不符合迁移协议。');
  const meta = old.meta as GameState['meta'];
  const player = old.player as GameState['player'];
  if (!meta || Object.keys(meta).sort().join('|') !== ['schemaVersion', 'engineVersion', 'revision', 'packs'].sort().join('|') || (meta.schemaVersion as number) !== version || (meta.engineVersion as string) !== (version === 1 ? '0.1' : '0.1-stage2') || !player || Object.keys(player).sort().join('|') !== (version === 1 ? 'flags|variables' : 'body|flags|variables')) throw new Error('旧存档版本或玩家字段不合法。');
  const expectedRefs = version === 1 ? STAGE1_PACKS : STAGE2_PACKS;
  if (sortedRefs(meta.packs) !== sortedRefs(expectedRefs) || !officialRepairInstalled(registry)) throw new Error('PACK_MISMATCH：只支持官方已发布原始包的精确升级，其他存档保留并隔离。');
  const oldFlags = registry.flags.filter(f => !f.id.startsWith('aetheria-social:') && !f.id.startsWith('core:'));
  if (!player.flags || typeof player.flags !== 'object' || Array.isArray(player.flags) || Object.keys(player.flags).sort().join('|') !== oldFlags.map(f => f.id).sort().join('|')) throw new Error('旧标记集合不符合迁移协议。');
  const flags = { ...player.flags, ...Object.fromEntries(registry.flags.filter(f => f.id.startsWith('aetheria-social:')).map(f => [f.id, f.initial])) };
  const template = registry.bodyTemplates.find(x => x.initial);
  if (!template) throw new Error('升级所需身体模板缺失。');
  const migrated = { ...old, meta: { ...meta, schemaVersion: 3, engineVersion: '0.1-stage3', packs: clone(registry.packs) }, player: { ...player, flags, body: version === 1 ? instantiateBody(template) : player.body }, tfQueues: version === 1 ? [] : old.tfQueues, npcs: createNPCStates(registry) } as unknown as GameState;
  normalizePlayerVariables(migrated, registry);
  normalizePlayerFlags(migrated, registry);
  return migrated;
}
export class SaveCodec {
  readonly registry: Registry;
  readonly fixedRegistry?: Registry;
  constructor(registry: Registry, fixedRegistry?: Registry) { this.registry = registry; this.fixedRegistry = fixedRegistry; }
  async encode(state: GameState): Promise<string> {
    validateState(state, this.registry);
    if (state.worldInstance && await hash(state.worldInstance.generation.rules) !== state.worldInstance.generation.rulesHash) throw Error('世界规则哈希不符。');
    const payload: SavePayload = { format: 'aetheria-alpha', schemaVersion: state.meta.schemaVersion, savedAt: new Date().toISOString(), state: clone(state) };
    const text = JSON.stringify({ payload, checksum: await checksum(payload) });
    if (new TextEncoder().encode(text).byteLength > MAX_SAVE_BYTES) throw new Error(`存档超过 ${MAX_SAVE_BYTES / 1024 / 1024} MiB；本版本不会截断账本或删除进度。`);
    return text;
  }
  async decode(text: string): Promise<DecodeResult> {
    try {
      if (new TextEncoder().encode(text).byteLength > MAX_SAVE_BYTES) throw new Error(`存档超过 ${MAX_SAVE_BYTES / 1024 / 1024} MiB。`);
      const envelope = JSON.parse(text);
      if (envelope?.payload?.format !== 'aetheria-alpha' || ![1, 2, 3, 4].includes(envelope.payload.schemaVersion)) throw new Error('文件不是受支持的 Alpha 0.1 存档。');
      if (await checksum(envelope.payload) !== envelope.checksum) {
        // The previous writer hashed an optional undefined fills property, then JSON
        // omitted it. Reconstruct only this known bug and still verify the exact hash.
        const legacy=clone(envelope.payload),story=legacy.state?.adventure?.story;
        if(!story||Object.hasOwn(story,'fills'))throw new Error('存档校验和不符，可能损坏。');
        story.fills=undefined;
        const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(stableJson(legacy)));
        const expected=[...new Uint8Array(digest)].map(v=>v.toString(16).padStart(2,'0')).join('');
        if(expected!==envelope.checksum)throw new Error('存档校验和不符，可能损坏。');
      }
      if (!Number.isFinite(Date.parse(envelope.payload.savedAt))) throw new Error('存档日期格式不合法。');
      const version = envelope.payload.schemaVersion;
      if (envelope.payload.state?.meta?.schemaVersion !== version) throw new Error('存档封装与状态版本不一致。');
      if (envelope.payload.state?.worldInstance) {
        if (![3,4].includes(version)) throw Error('生成世界存档版本无效。');
        const state = envelope.payload.state as GameState;
        const world = state.worldInstance!;
        const packs = world.definition?.packs;
        if (!Array.isArray(packs) || packs.length > 100) throw Error('世界包快照无效。');
        const restored = await loadPacks(packs);
        parseRules(world.generation.rules);
        if (await hash(world.generation.rules) !== world.generation.rulesHash) throw Error('世界规则哈希不符。');
        validateState(state, restored);
        const migrated=version===3&&!!state.district?.scene;const loaded=migrated?upgradeFoundation(state,restored):clone(state);validateState(loaded,restored);
        const ux=await upgradeUXContent(loaded,this.fixedRegistry??this.registry);
        if(ux){validateState(ux.state,ux.registry);return {status:'ready',...ux,migration:'已更新本地场景与内容显示，地图、人物和原进度保留。'};}
        return { status: 'ready', state: loaded, registry: restored,...(migrated?{migration:'旧场景已升级：身体副本已移除，未知参与者暂停，原进度保留。'}:{}) };
      }
      if (this.registry.packs.some(p => p.id === 'generated/neighborhood')) {
        // 生成参考库可能额外装了种族/原型包；它们不能成为读取原固定世界的必需包。
        return new SaveCodec(this.fixedRegistry ?? await loadPacks(this.registry.contentPacks.filter(p => !['generated/neighborhood', 'generated/cyber-apex-main', 'generated/cyber-apex-side'].includes(p.manifest.id)))).decode(text);
      }
      if(this.registry.packs.some(p=>p.id==='aetheria/adventure')&&!envelope.payload.state.meta.packs.some((p:{id:string})=>p.id==='aetheria/adventure')){
        const base=await loadPacks(this.registry.contentPacks.filter(p=>p.manifest.id!=='aetheria/adventure'));
        const previous=await new SaveCodec(base).decode(text);if(previous.status!=='ready')return previous;
        const state=clone(previous.state);state.meta.packs=clone(this.registry.packs);normalizePlayerVariables(state,this.registry);normalizePlayerFlags(state,this.registry);adventure(state);validateState(state,this.registry);
        return {status:'ready',state,registry:this.registry,migration:`${previous.migration??''} 已追加故事与成长内容，原有身体、记忆与事件保持。`};
      }
      const ux=await upgradeUXContent(envelope.payload.state,this.registry);
      if(ux){validateState(ux.state,ux.registry);return {status:'ready',...ux,migration:'已更新内容显示，身体、人物和原进度保留。'};}
      if (this.registry.legacyRegistry && !envelope.payload.state.district) {
        const old = await new SaveCodec(this.registry.legacyRegistry).decode(text);
        if (old.status !== 'ready') return old;
        let state = clone(old.state);
        state.meta.packs = clone(this.registry.packs);
        normalizePlayerVariables(state, this.registry);
        normalizePlayerFlags(state, this.registry);
        state.npcs.push(...createNPCStates(this.registry).filter(n => !state.npcs.some(x => x.definitionId === n.definitionId)));
        state.district = initialDistrict();
        if(this.registry.npcBodies.length)state=upgradeFoundation(state,this.registry);
        normalizeSceneTemps(state);
        validateState(state,this.registry);
        return {status:'ready',state,registry:this.registry,migration:'旧版存档已升级：追加街区模块，原有经历、身体与事务保持。点击保存后写入 Alpha 0.2。'};
      }
      if(version>=3&&this.registry.contentPacks.some(p=>p.manifest.id==='aetheria/foundation')&&foundationAddition(envelope.payload.state,this.registry)){
        const before=envelope.payload.state as GameState;const oldRegistry=await loadPacks(this.registry.contentPacks.filter(p=>before.meta.packs.some(ref=>ref.id===p.manifest.id)));
        validateState(before,oldRegistry);const upgraded=upgradeFoundation(before,this.registry);upgraded.meta.packs=clone(this.registry.packs);normalizePlayerVariables(upgraded,this.registry);normalizePlayerFlags(upgraded,this.registry);normalizeSceneTemps(upgraded);validateState(upgraded,this.registry);
        return {status:'ready',state:upgraded,registry:this.registry,...(version===3||oldRegistry.packs.length!==this.registry.packs.length?{migration:'旧版存档已升级：新增底层参数接口；原身体、记忆、阶段、账本和事件进度保留。旧场景副本不作为 NPC 身体。'}:{})};
      }
      const migrated = version < 3;
      const repair = migrated ? undefined : upgradeStage3(envelope.payload.state, this.registry);
      let state = migrated ? migrateLegacy(envelope.payload.state, this.registry, version) : repair!.state;
      normalizePlayerVariables(state as GameState, this.registry);
      normalizePlayerFlags(state as GameState, this.registry);
      normalizeSceneTemps(state as GameState);
      validateState(state, this.registry);
      const sceneUpgrade=(state as GameState).meta.schemaVersion===3&&!!(state as GameState).district?.scene;
      if(sceneUpgrade){state=upgradeFoundation(state as GameState,this.registry);validateState(state,this.registry);}
      return { status: 'ready', state: clone(state), registry: this.registry, ...(sceneUpgrade?{migration:'旧场景已升级：身体副本已移除；身体未知时暂停，事件和进度完整保留。'}:migrated ? { migration: `${version === 1 ? '第一' : '第二'}阶段存档已升级：保留原进度${version === 1 ? '并新增初始身体' : '、身体与改造进度'}，新增人物记录。点击保存后写入新版存档。` } : repair?.upgraded ? { migration: '第三阶段存档已修复升级：原人物、任务、身体与改造进度完整保留。点击保存后写入修复版存档。' } : {}) };
    } catch (error) {
      const reason = error instanceof Error ? error.message : '存档格式无效。';
      return { status: 'quarantined', code: reason.includes('PACK_MISMATCH') ? 'PACK_MISMATCH' : 'SAVE_INVALID', reason, original: text };
    }
  }
}
