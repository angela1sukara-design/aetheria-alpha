import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { game, packs, act, extension } from './helpers.ts';
import { clone, stableJson } from '../src/core/types.ts';
import type { ContentPack, Id } from '../src/core/types.ts';
import { loadPacks } from '../src/content/loader.ts';
import { ActionExecutor } from '../src/engine/executor.ts';
import { createGameState } from '../src/engine/state.ts';
import { npcLocation, npcState, hasMemory, adultNPCEligibility } from '../src/engine/npc.ts';
import { SaveCodec, validateState } from '../src/persistence/codec.ts';
import { MemorySaveStore, SaveRepository } from '../src/persistence/store.ts';
const id = (s: string) => `aetheria-social:${s}` as Id;
const velvet = id('npc.velvet');
const social = (engine: ActionExecutor, suffix: string, request: string = crypto.randomUUID()) => engine.performAction({ actionId: id(`action.${suffix}`) }, engine.snapshot().meta.revision, request);
function must(engine: ActionExecutor, suffix: string, request?: string) { const result = social(engine, suffix, request); assert.equal(result.ok, true, `${suffix}: ${result.message}`); return result; }
function salon(engine: ActionExecutor) { assert.equal(act(engine, 'travel.apartment_street').ok, true); must(engine, 'travel.street_salon'); must(engine, 'salon.wait'); must(engine, 'salon.wait'); }
function promise(engine: ActionExecutor) { must(engine, 'velvet.meet'); must(engine, 'talk.order'); must(engine, 'talk.order.accept'); }
function checkOrder(engine: ActionExecutor) { must(engine, 'travel.salon_street'); assert.equal(act(engine, 'travel.street_market').ok, true); must(engine, 'market.order'); }
function returnSaloon(engine: ActionExecutor) { assert.equal(act(engine, 'travel.market_street').ok, true); must(engine, 'travel.street_salon'); must(engine, 'velvet.return'); }
async function checksum(payload: unknown) { const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(stableJson(payload))); return [...new Uint8Array(hash)].map(x => x.toString(16).padStart(2, '0')).join(''); }

test('固定身份不随 seed 改变；反复读人物/场景不改时钟、RNG和实例', async () => {
  const a = await game(1), b = await game(123); assert.deepEqual(a.engine.snapshot().npcs, b.engine.snapshot().npcs);
  const before = a.engine.snapshot(); for (let n = 0; n < 30; n++) { a.engine.view(); npcLocation(before, a.registry, velvet); } assert.deepEqual(a.engine.snapshot(), before);
  assert.equal(npcState(before, velvet).instanceId, `fixed:${velvet}`); assert.equal(before.npcs[0].discovered, false);
});
test('日程按半开时段解析，柜台/集市/离场和跨午夜边界准确', async () => {
  const { registry, engine } = await game(); const s = clone(engine.snapshot());
  for (const [minute, expected] of [[0, null], [539, null], [540, id('location.salon')], [1079, id('location.salon')], [1080, 'aetheria:location.market'], [1139, 'aetheria:location.market'], [1140, null], [1439, null], [1440, null], [1980, id('location.salon')]] as const) {
    s.clock.totalMinutes = minute; assert.equal(npcLocation(s, registry, velvet), expected, `minute ${minute}`);
  }
});
test('不在场不能执行人物话题；真正等候后可见，不能远程冒用', async () => {
  const { engine } = await game(); const before = engine.snapshot(); assert.equal(social(engine, 'velvet.meet').ok, false); assert.deepEqual(engine.snapshot(), before);
  act(engine, 'travel.apartment_street'); must(engine, 'travel.street_salon'); assert.ok(!engine.view().actions.some(a => a.definition.id === id('action.velvet.meet')));
  must(engine, 'salon.wait'); must(engine, 'salon.wait'); assert.equal(engine.view().actions.find(a => a.definition.id === id('action.velvet.meet'))!.available, true);
});
test('过关店时间的谈话保留参与者，结束立即恢复日程', async () => {
  const { registry, engine: initial } = await game(); const s = clone(initial.snapshot()); s.clock.totalMinutes = 1078; s.world.locationId = id('location.salon'); s.world.knownLocationIds.push(id('location.salon'));
  const engine = new ActionExecutor(registry, s); must(engine, 'velvet.meet'); assert.equal(engine.snapshot().clock.totalMinutes, 1083); assert.equal(npcLocation(engine.snapshot(), registry, velvet), id('location.salon'));
  must(engine, 'talk.services'); must(engine, 'talk.services.back'); must(engine, 'talk.leave'); assert.equal(npcLocation(engine.snapshot(), registry, velvet), 'aetheria:location.market'); assert.ok(!engine.view().actions.some(a => a.definition.id === id('action.velvet.return')));
});
test('活动NPC事件不能转入旅行或另一事件，随时都有合法出口', async () => {
  const { engine } = await game(); salon(engine); must(engine, 'velvet.meet'); const before = engine.snapshot();
  assert.equal(social(engine, 'travel.salon_street').ok, false); assert.equal(social(engine, 'velvet.return').ok, false); assert.deepEqual(engine.snapshot(), before);
  must(engine, 'talk.services'); must(engine, 'talk.services.leave'); assert.deepEqual(engine.snapshot().activeEventStack, []); must(engine, 'travel.salon_street');
});
test('重复见面与话题只结算一次里程碑，不用新请求刷熟悉', async () => {
  const { registry, engine } = await game(); salon(engine); must(engine, 'velvet.meet'); must(engine, 'talk.services'); must(engine, 'talk.services.back'); must(engine, 'talk.services'); must(engine, 'talk.services.leave');
  must(engine, 'velvet.return'); must(engine, 'talk.services'); must(engine, 'talk.services.leave');
  const npc = npcState(engine.snapshot(), velvet); assert.equal(npc.relationship.familiarity, 2); assert.equal(npc.memories.length, 2); validateState(engine.snapshot(), registry);
});
test('拒绝委托写真实记忆但不扣钱/封锁；后来仍可接受', async () => {
  const { engine } = await game(); salon(engine); must(engine, 'velvet.meet'); must(engine, 'talk.order'); const money = engine.snapshot().player.variables['core:money']; must(engine, 'talk.order.decline');
  assert.equal(engine.snapshot().player.variables['core:money'], money); assert.equal(hasMemory(engine.snapshot(), velvet, id('memory.velvet.declined')), true);
  must(engine, 'velvet.return'); must(engine, 'talk.order'); must(engine, 'talk.order.accept'); assert.equal(hasMemory(engine.snapshot(), velvet, id('memory.velvet.accepted')), true);
});
test('跨地点委托：集市实际核对，NPC回来听报告才知道，报酬只领一次', async () => {
  const { registry, engine } = await game(); salon(engine); promise(engine); const promised = npcState(engine.snapshot(), velvet);
  checkOrder(engine); assert.deepEqual(npcState(engine.snapshot(), velvet), promised); assert.equal(engine.snapshot().player.flags[id('flag.order_checked')], true);
  const before = engine.snapshot(); assert.equal(social(engine, 'market.order').ok, false); assert.deepEqual(engine.snapshot(), before);
  returnSaloon(engine); const money = engine.snapshot().player.variables['core:money']; must(engine, 'talk.report', 'report-once'); assert.equal(engine.snapshot().player.variables['core:money'], money + 8); assert.equal(npcState(engine.snapshot(), velvet).relationship.trust, 7);
  must(engine, 'talk.report.back'); const paid = engine.snapshot(); assert.equal(social(engine, 'talk.report').ok, false); assert.deepEqual(engine.snapshot(), paid);
  const replay = engine.performAction({ actionId: id('action.talk.report') }, 0, 'report-once'); assert.equal(replay.ok, true); assert.deepEqual(engine.snapshot(), paid); validateState(engine.snapshot(), registry);
});
test('未完成核对不能交差，进度话题没有奖励', async () => {
  const { engine } = await game(); salon(engine); promise(engine); must(engine, 'velvet.return'); const before = engine.snapshot(); assert.equal(social(engine, 'talk.report').ok, false); assert.deepEqual(engine.snapshot(), before);
  must(engine, 'talk.progress'); assert.equal(engine.snapshot().player.variables['core:money'], before.player.variables['core:money']); assert.equal(hasMemory(engine.snapshot(), velvet, id('memory.velvet.reported')), false); must(engine, 'talk.progress.leave');
});
test('完成委托后真实解锁近况话题，反复聊不反复增加关系', async () => {
  const { engine } = await game(); salon(engine); promise(engine); checkOrder(engine); returnSaloon(engine); assert.equal(social(engine, 'talk.familiar').ok, false);
  must(engine, 'talk.report'); must(engine, 'talk.report.back'); must(engine, 'talk.familiar'); const rel = npcState(engine.snapshot(), velvet).relationship; must(engine, 'talk.familiar.back'); must(engine, 'talk.familiar'); assert.deepEqual(npcState(engine.snapshot(), velvet).relationship, rel);
});
test('人物不会自动读取TF变化；展示校准机械尾后才增加观察记忆', async () => {
  const { registry } = await game(); const old = await new SaveCodec(registry).decode(await readFile(new URL('./fixtures/stage2-save.json', import.meta.url), 'utf8')); if (old.status !== 'ready') assert.fail(old.reason);
  const engine = new ActionExecutor(registry, old.state); const tf = (suffix: string) => { const r = engine.performAction({ actionId: `aetheria-tf:action.${suffix}` }, engine.snapshot().meta.revision, crypto.randomUUID()); assert.equal(r.ok, true, r.message); };
  tf('tf.resume'); tf('clinic.wait'); tf('clinic.wait'); assert.equal(engine.snapshot().npcs[0].memories.length, 0); tf('travel.clinic_street'); must(engine, 'travel.street_salon'); must(engine, 'velvet.meet'); must(engine, 'talk.tail'); assert.equal(hasMemory(engine.snapshot(), velvet, id('memory.velvet.tail_seen')), true); validateState(engine.snapshot(), registry);
});
test('事件记忆/关系/时间/RNG在后续扣费失败时全部回滚', async () => {
  const input = await packs(); input[3].events[0].nodes[0].onEnter.push({ op: 'var.change', id: 'core:money', amount: -999 }); const registry = await loadPacks(input), engine = new ActionExecutor(registry, createGameState(registry, 4)); salon(engine); const before = engine.snapshot(); assert.equal(social(engine, 'velvet.meet').ok, false); assert.deepEqual(engine.snapshot(), before);
});
test('多节点NPC事件存读还原同一位置覆盖、记忆、关系与锁定文案', async () => {
  const { registry, engine } = await game(); salon(engine); must(engine, 'velvet.meet'); must(engine, 'talk.services'); const codec = new SaveCodec(registry), loaded = await codec.decode(await codec.encode(engine.snapshot())); if (loaded.status !== 'ready') assert.fail(loaded.reason);
  const resumed = new ActionExecutor(registry, loaded.state); assert.deepEqual(resumed.view(), engine.view()); const before = resumed.snapshot(); resumed.view(); assert.deepEqual(resumed.snapshot(), before); must(resumed, 'talk.services.back'); must(resumed, 'talk.leave');
});
test('伪造NPC身份、关系、记忆来源、重复记忆和未来时间都拒绝', async () => {
  const { registry, engine } = await game(); salon(engine); must(engine, 'velvet.meet');
  for (const mutate of [
    (s: ReturnType<ActionExecutor['snapshot']>) => { s.npcs[0].instanceId = 'random-id'; },
    (s: ReturnType<ActionExecutor['snapshot']>) => { s.npcs[0].relationship.trust = 50; },
    (s: ReturnType<ActionExecutor['snapshot']>) => { s.npcs[0].memories[0].sourceRequestId = 'fake'; },
    (s: ReturnType<ActionExecutor['snapshot']>) => { s.npcs[0].memories[0].sourceActionId = 'aetheria:action.rest'; },
    (s: ReturnType<ActionExecutor['snapshot']>) => { s.npcs[0].memories.push(clone(s.npcs[0].memories[0])); },
    (s: ReturnType<ActionExecutor['snapshot']>) => { s.npcs[0].memories[0].recordedAt = s.clock.totalMinutes + 1; },
    (s: ReturnType<ActionExecutor['snapshot']>) => { s.npcs[0].memories[0].recordedAt = -1; },
    (s: ReturnType<ActionExecutor['snapshot']>) => { s.npcs[0].discovered = false; },
    (s: ReturnType<ActionExecutor['snapshot']>) => { s.npcs = []; },
  ]) { const state = clone(engine.snapshot()); mutate(state); assert.throws(() => validateState(state, registry)); }
});
test('第二阶段真实暂停TF存档精确升级，原身体/队列/账本不重结算也不覆盖槽', async () => {
  const { registry } = await game(), text = await readFile(new URL('./fixtures/stage2-save.json', import.meta.url), 'utf8'), old = JSON.parse(text).payload.state; const store = new MemorySaveStore(); await store.write('manual', text); const repo = new SaveRepository(new SaveCodec(registry), store), loaded = await repo.load(); if (loaded.status !== 'ready') assert.fail('升级失败');
  assert.match(loaded.migration!, /第二/); for (const key of ['clock', 'world', 'tfQueues', 'eventInstances', 'activeEventStack', 'rng', 'ledger'] as const) assert.deepEqual(loaded.state[key], old[key]); assert.deepEqual(loaded.state.player.body, old.player.body); for (const [k,v] of Object.entries(old.player.variables)) assert.equal(loaded.state.player.variables[k as keyof typeof loaded.state.player.variables], v); assert.equal(loaded.state.player.variables['core:stamina'], 100); assert.equal(loaded.state.player.flags['core:flag.sanity_break'], false); assert.equal(loaded.state.npcs[0].discovered, false); assert.equal(await store.read('manual'), text); await repo.save(loaded.state); const newer = JSON.parse((await store.read('manual'))!); assert.equal(newer.payload.schemaVersion, 3);
});
test('第二阶段未知包/伪造旧标记/坏TF即使重算checksum仍隔离', async () => {
  const { registry } = await game(), source = JSON.parse(await readFile(new URL('./fixtures/stage2-save.json', import.meta.url), 'utf8'));
  for (const mutate of [(e: typeof source) => { e.payload.state.meta.packs[2].hash = 'fake'; }, (e: typeof source) => { e.payload.state.player.flags[id('flag.order_checked')] = true; }, (e: typeof source) => { e.payload.state.tfQueues[0].elapsedMinutes = 999; }, (e: typeof source) => { e.payload.state.npcs = []; }, (e: typeof source) => { delete e.payload.state.player.flags['aetheria:flag.notice_helped']; }]) {
    const e = clone(source); mutate(e); e.checksum = await checksum(e.payload); const text = JSON.stringify(e), rejected = await new SaveCodec(registry).decode(text); assert.equal(rejected.status, 'quarantined'); if (rejected.status === 'quarantined') assert.equal(rejected.original, text);
  }
});
test('第三阶段缺人物包或包内容改变时隔离，不删除完整进度', async () => {
  const { registry, engine } = await game(); salon(engine); must(engine, 'velvet.meet'); const text = await new SaveCodec(registry).encode(engine.snapshot()), input = await packs();
  const missing = await new SaveCodec(await loadPacks(input.slice(0, 3))).decode(text); assert.equal(missing.status, 'quarantined'); input[3].npcs![0].name += ' changed'; const changed = await new SaveCodec(await loadPacks(input)).decode(text); assert.equal(changed.status, 'quarantined');
});
test('公开人物话题Hook可被独立作者追加，同组包乱序加载一致', async () => {
  const ext = extension(); ext.manifest.dependencies.push({ id: 'aetheria/social', version: '0.1.0', optional: false }); ext.contributions = [{ hookId: id('hook.velvet.topics'), actionIds: [ext.actions[0].id] }]; const input = [...await packs(), ext], a = await loadPacks(input), b = await loadPacks([...input].reverse());
  assert.deepEqual(a.packs, b.packs); const engine = new ActionExecutor(a, createGameState(a, 7)); assert.equal(engine.performAction({ actionId: ext.actions[0].id }, 0, 'absent').ok, false); salon(engine); const before = engine.snapshot().clock.totalMinutes; assert.equal(engine.performAction({ actionId: ext.actions[0].id }, engine.snapshot().meta.revision, 'topic').ok, true); assert.equal(engine.snapshot().clock.totalMinutes, before + 7);
});
test('第二位固定人物作为内容追加，无需人物专用引擎分支', async () => {
  const input = await packs(), p = input[3], def = clone(p.npcs![0]); def.id = id('npc.fixture'); def.canonKey = 'fixture'; def.name = '测试人物'; p.npcs!.push(def); const registry = await loadPacks(input), state = createGameState(registry, 1); assert.equal(state.npcs.length, 2); assert.equal(npcLocation(state, registry, def.id), null); validateState(state, registry);
});
test('NPC日程缺口/重叠、错引用/记忆所有者、未知关系字段和未声明能力均失败', async () => {
  for (const mutate of [
    (p: ContentPack) => { p.npcs![0].schedule[0].end = 500; },
    (p: ContentPack) => { p.npcs![0].schedule[1].start = 500; },
    (p: ContentPack) => { p.npcs![0].schedule[1].locationId = 'core:money'; },
    (p: ContentPack) => { p.npcs![0].ageYears = undefined as never; },
    (p: ContentPack) => { p.npcMemories![0].npcId = id('npc.missing'); },
    (p: ContentPack) => { p.events[0].nodes[0].onEnter[0] = { op: 'npc.remember', npcId: velvet, memoryId: id('memory.velvet.met'), relationship: { familiarity: 1, trust: 0, secret: 1 } as never }; },
    (p: ContentPack) => { p.events[0].participantIds = []; },
    (p: ContentPack) => { p.manifest.requiresCapabilities = p.manifest.requiresCapabilities.filter(c => c !== 'npc.fixed.v1'); },
  ]) { const input = await packs(); mutate(input[3]); await assert.rejects(loadPacks(input)); }
});
test('缺年龄/未成年/非智慧人物不能通过成人资格，成人事件在本阶段不可加载', async () => {
  const { registry } = await game(); assert.equal(adultNPCEligibility(registry, velvet).pass, false);
  for (const [age, intelligent, expected] of [[17, true, false], [30, false, false], [30, true, true]] as const) { const input = await packs(); input[3].npcs![0].ageYears = age; input[3].species![0].intelligent = intelligent; const r = await loadPacks(input); assert.equal(adultNPCEligibility(r, velvet).pass, expected); }
  const input = await packs(); input[3].events[0].rating = 'adult'; await assert.rejects(loadPacks(input), /ADULT_PLAYER_UNVERIFIED/);
});
