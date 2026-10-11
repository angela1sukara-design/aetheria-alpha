import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { game, packs, act } from './helpers.ts';
import { clone, stableJson } from '../src/core/types.ts';
import type { Id, Effect } from '../src/core/types.ts';
import { loadPacks } from '../src/content/loader.ts';
import { createGameState } from '../src/engine/state.ts';
import { ActionExecutor } from '../src/engine/executor.ts';
import { npcLocation, nextNPCAppearance, npcPresenceTransitions } from '../src/engine/npc.ts';
import { directResourceCheck } from '../src/engine/resource-check.ts';
import { SaveCodec, validateState } from '../src/persistence/codec.ts';
import { SaveRepository, MemorySaveStore } from '../src/persistence/store.ts';
import { STAGE3_PACKS, STAGE3_FIX1_PACKS } from '../src/persistence/stage3-packs.ts';
const velvet: Id = 'aetheria-social:npc.velvet';
const salon: Id = 'aetheria-social:location.salon';
function social(engine: ActionExecutor, suffix: string, request = crypto.randomUUID()) {
  const r = engine.performAction({ actionId: `aetheria-social:action.${suffix}` }, engine.snapshot().meta.revision, request);
  assert.equal(r.ok, true, `${suffix}: ${r.message}`); return r;
}
async function completedQuest(start = 480) {
  const { registry } = await game(), state = createGameState(registry, 42); state.clock.totalMinutes = start;
  const engine = new ActionExecutor(registry, state);
  assert.equal(act(engine, 'travel.apartment_street').ok, true); social(engine, 'travel.street_salon');
  social(engine, 'salon.wait'); social(engine, 'salon.wait'); social(engine, 'velvet.meet');
  social(engine, 'talk.order'); social(engine, 'talk.order.accept'); social(engine, 'travel.salon_street');
  assert.equal(act(engine, 'travel.street_market').ok, true); social(engine, 'market.order');
  assert.equal(act(engine, 'travel.market_street').ok, true); social(engine, 'travel.street_salon');
  social(engine, 'velvet.return'); social(engine, 'talk.report'); social(engine, 'talk.report.back');
  return { registry, engine };
}
const fixture = (name: string) => readFile(new URL(`./fixtures/${name}.json`, import.meta.url), 'utf8');
async function resumed(name: string) {
  const { registry } = await game(), text = await fixture(name), decoded = await new SaveCodec(registry).decode(text);
  if (decoded.status !== 'ready') assert.fail(decoded.reason);
  return { registry, text, decoded, engine: new ActionExecutor(registry, decoded.state) };
}
async function checksum(value: unknown) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(stableJson(value)));
  return [...new Uint8Array(digest)].map(n => n.toString(16).padStart(2, '0')).join('');
}

test('修复包独立追加；原第三阶段四包指纹保持精确不变', async () => {
  const { registry } = await game(); assert.deepEqual(registry.packs, STAGE3_FIX1_PACKS);
  assert.deepEqual(registry.packs.slice(0, 4), STAGE3_PACKS);
  assert.equal(registry.actionsAt(salon).filter(a => a.id === 'aetheria-recovery:action.salon.rest').length, 1);
});
test('白天完成任务后NPC仍在，退出后可继续交谈且奖励不重领', async () => {
  const { registry, engine } = await completedQuest(); const npc = engine.snapshot().npcs[0];
  const exit = social(engine, 'talk.leave'); assert.equal(npcLocation(engine.snapshot(), registry, velvet), salon);
  assert.ok(!exit.changes.some(c => c.label.endsWith('·去向'))); social(engine, 'velvet.return');
  const before = engine.snapshot(); assert.equal(engine.performAction({ actionId: 'aetheria-social:action.talk.report' }, before.meta.revision, 'again').ok, false);
  assert.deepEqual(engine.snapshot(), before); assert.deepEqual(before.npcs[0], npc);
});
test('真实任务谈话跨18点，退出提示去集市和次日再会；集市仍能继续', async () => {
  const { registry, engine } = await completedQuest(930); const before = engine.snapshot();
  assert.equal(before.clock.totalMinutes, 1085); assert.equal(npcLocation(before, registry, velvet), salon);
  const result = social(engine, 'talk.leave', 'close-exit'); assert.match(result.text, /现在在集市/); assert.match(result.text, /第 2 天 · 09:00/);
  assert.deepEqual(engine.snapshot().npcs, before.npcs); assert.equal(npcLocation(engine.snapshot(), registry, velvet), 'aetheria:location.market');
  const committed = engine.snapshot(); assert.deepEqual(engine.performAction({ actionId: 'aetheria-social:action.talk.leave' }, 0, 'close-exit'), result); assert.deepEqual(engine.snapshot(), committed);
  const move = social(engine, 'travel.salon_street'); assert.ok(!move.changes.some(c => c.label.endsWith('·去向')));
  act(engine, 'travel.street_market'); social(engine, 'velvet.return'); assert.equal(engine.snapshot().npcs[0].relationship.trust, 7); validateState(engine.snapshot(), registry);
});
test('过19点退出只离开公开场所；保存读取、真实等到次日后同一NPC回来', async () => {
  const { registry, engine } = await completedQuest(930);
  while (engine.snapshot().clock.totalMinutes < 1145) { social(engine, 'talk.services'); social(engine, 'talk.services.back'); }
  const npc = engine.snapshot().npcs[0], result = social(engine, 'talk.leave'); assert.match(result.text, /离开了公开场所/); assert.match(result.text, /第 2 天 · 09:00/);
  assert.equal(npcLocation(engine.snapshot(), registry, velvet), null);
  const codec = new SaveCodec(registry), decoded = await codec.decode(await codec.encode(engine.snapshot())); if (decoded.status !== 'ready') assert.fail(decoded.reason);
  const loaded = new ActionExecutor(registry, decoded.state); assert.deepEqual(loaded.snapshot().npcs[0], npc);
  let arrival; while (loaded.snapshot().clock.totalMinutes < 1980) arrival = social(loaded, 'salon.wait');
  assert.equal(npcLocation(loaded.snapshot(), registry, velvet), salon); assert.match(arrival!.text, /来到薇尔维特沙龙/); assert.deepEqual(loaded.snapshot().npcs[0], npc);
  social(loaded, 'velvet.return'); assert.equal(loaded.snapshot().npcs[0].instanceId, npc.instanceId); validateState(loaded.snapshot(), registry);
});
test('公开再会查询跨午夜/地点过滤/极大时间，重复查询无写入', async () => {
  const { registry, engine } = await game(), state = clone(engine.snapshot());
  for (const [now, next, location] of [[539, 540, salon], [1079, 1080, 'aetheria:location.market'], [1140, 1980, salon], [1439, 1980, salon], [1440, 1980, salon]] as const) {
    state.clock.totalMinutes = now; const before = clone(state), visit = nextNPCAppearance(state, registry, velvet)!;
    assert.equal(visit.totalMinutes, next); assert.equal(visit.locationId, location); assert.deepEqual(state, before);
  }
  state.clock.totalMinutes = 1085; assert.equal(nextNPCAppearance(state, registry, velvet, salon)!.totalMinutes, 1980);
  assert.equal(nextNPCAppearance(state, registry, velvet, 'aetheria:location.apartment'), undefined);
  state.clock.totalMinutes = Number.MAX_SAFE_INTEGER; assert.equal(nextNPCAppearance(state, registry, velvet), undefined);
});
test('NPC事件位置覆盖和纯重绘不伪造离场；动作失败无通知或状态变化', async () => {
  const { registry, engine } = await completedQuest(930), before = engine.snapshot();
  for (let n = 0; n < 20; n++) engine.view(); assert.deepEqual(engine.snapshot(), before);
  assert.deepEqual(npcPresenceTransitions(before, before, registry), { changes: [], texts: [] });
  const failed = engine.performAction({ actionId: 'aetheria-social:action.travel.salon_street' }, before.meta.revision, 'blocked');
  assert.equal(failed.ok, false); assert.deepEqual(failed.changes, []); assert.equal(failed.text, ''); assert.deepEqual(engine.snapshot(), before);
});
test('原第三阶段任务存档只追加包引用，保留全部事实；读取不覆盖原槽', async () => {
  const { registry, text, decoded } = await resumed('stage3-npc-save'), old = JSON.parse(text).payload.state;
  assert.match(decoded.migration!, /第三阶段/); assert.deepEqual(decoded.state.meta.packs, STAGE3_FIX1_PACKS);
  const restored = clone(decoded.state); restored.meta.packs = old.meta.packs; assert.deepEqual(restored, old);
  const store = new MemorySaveStore(); await store.write('manual', text); const repo = new SaveRepository(new SaveCodec(registry), store);
  assert.equal((await repo.load()).status, 'ready'); assert.equal(await store.read('manual'), text);
  await repo.save(decoded.state); const newer = await new SaveCodec(registry).decode((await store.read('manual'))!);
  if (newer.status !== 'ready') assert.fail(newer.reason); assert.equal(newer.migration, undefined); assert.deepEqual(newer.state, decoded.state);
});
test('第三阶段伪造包/记忆/未知字段即使重算checksum仍隔离并保留', async () => {
  const { registry } = await game(), source = JSON.parse(await fixture('stage3-npc-save'));
  for (const mutation of [
    (s: typeof source) => { s.payload.state.meta.packs[3].hash = 'changed'; },
    (s: typeof source) => { s.payload.state.npcs[0].instanceId = 'deleted-and-recreated'; },
    (s: typeof source) => { s.payload.state.player.extra = true; },
    (s: typeof source) => { s.payload.state.npcs[0].memories[0].sourceRequestId = 'fake'; },
  ]) {
    const changed = clone(source); mutation(changed); changed.checksum = await checksum(changed.payload); const raw = JSON.stringify(changed);
    const rejected = await new SaveCodec(registry).decode(raw); assert.equal(rejected.status, 'quarantined'); if (rejected.status === 'quarantined') assert.equal(rejected.original, raw);
  }
});
test('第三阶段精确升级不接纳改变过的修复包；新版缺恢复包仍隔离', async () => {
  const { registry, engine } = await game(), original = await fixture('stage3-npc-save'), input = await packs(); input[4].texts['aetheria-recovery:text.salon.rest'] += ' changed';
  assert.equal((await new SaveCodec(await loadPacks(input)).decode(original)).status, 'quarantined');
  const current = await new SaveCodec(registry).encode(engine.snapshot()); assert.equal((await new SaveCodec(await loadPacks((await packs()).slice(0, 4))).decode(current)).status, 'quarantined');
});
test('四包Registry正常读取其匹配的四包档，不触发不必要迁移', async () => {
  const registry = await loadPacks((await packs()).slice(0, 4)), original = await fixture('stage3-npc-save');
  const loaded = await new SaveCodec(registry).decode(original); if (loaded.status !== 'ready') assert.fail(loaded.reason);
  assert.equal(loaded.migration, undefined); assert.deepEqual(loaded.state, JSON.parse(original).payload.state);
});
test('原版实际操作耗尽精力的沙龙存档，可免费休息再回公寓，不清进度', async () => {
  const { registry, engine } = await resumed('stage3-exhausted-save'); assert.equal(engine.snapshot().player.variables['core:energy'], 0);
  const before = engine.snapshot(), back = engine.view().actions.find(a => a.definition.id === 'aetheria-social:action.travel.salon_street')!;
  assert.equal(back.available, false); assert.match(back.reason, /精力不足/);
  assert.equal(engine.performAction({ actionId: back.definition.id }, before.meta.revision, 'no-energy').code, 'CONDITION_FAILED'); assert.deepEqual(engine.snapshot(), before);
  const rest = engine.performAction({ actionId: 'aetheria-recovery:action.salon.rest' }, before.meta.revision, 'recover'); assert.equal(rest.ok, true);
  assert.equal(engine.snapshot().player.variables['core:energy'], 10); assert.equal(engine.snapshot().player.variables['core:money'], before.player.variables['core:money']); assert.equal(engine.snapshot().clock.totalMinutes, before.clock.totalMinutes + 30);
  social(engine, 'travel.salon_street'); assert.equal(act(engine, 'travel.street_apartment').ok, true); assert.equal(act(engine, 'rest').ok, true); validateState(engine.snapshot(), registry);
});
test('直接资源预检累计多次扣费并遵循上限；节点/TF边界后不错误推断', async () => {
  const { registry, engine } = await game(), state = clone(engine.snapshot()); state.player.variables['core:energy'] = 3; const before = clone(state);
  const cost = (amount: number): Effect => ({ op: 'var.change', id: 'core:energy', amount });
  assert.equal(directResourceCheck([cost(-2), cost(-2)], state, registry).pass, false);
  assert.equal(directResourceCheck([cost(100), cost(-101)], state, registry).pass, false);
  assert.equal(directResourceCheck([cost(-2), cost(10), cost(-2)], state, registry).pass, true);
  assert.equal(directResourceCheck([{ op: 'event.start', id: 'aetheria:event.notice' }, cost(-1000)], state, registry).pass, true);
  assert.deepEqual(state, before);
});
test('恢复行动只属于沙龙常态；事件内不能远程休息，诊室零精力仍能离开', async () => {
  const { registry, engine } = await completedQuest(); assert.ok(!engine.view().actions.some(a => a.definition.id === 'aetheria-recovery:action.salon.rest'));
  const state = createGameState(registry, 1); state.player.variables['core:energy'] = 0; state.world.locationId = 'aetheria-tf:location.clinic'; state.world.knownLocationIds.push(state.world.locationId);
  const clinic = new ActionExecutor(registry, state); const r = clinic.performAction({ actionId: 'aetheria-tf:action.travel.clinic_street' }, 0, 'leave'); assert.equal(r.ok, true); assert.equal(clinic.snapshot().world.locationId, 'aetheria:location.street');
});
