import test from 'node:test';
import assert from 'node:assert/strict';
import { act, game, packs } from './helpers.ts';
import { SaveCodec, validateState } from '../src/persistence/codec.ts';
import { MemorySaveStore, SaveRepository } from '../src/persistence/store.ts';
import { ActionExecutor } from '../src/engine/executor.ts';
import { loadPacks } from '../src/content/loader.ts';
import { clone } from '../src/core/types.ts';
test('存档/JSON 导出/导入完整恢复所有游戏事实', async () => {
  const { registry, engine } = await game(); act(engine, 'travel.apartment_street'); act(engine, 'travel.street_market'); act(engine, 'market.work');
  const codec = new SaveCodec(registry); const encoded = await codec.encode(engine.snapshot()); const decoded = await codec.decode(encoded);
  assert.equal(decoded.status, 'ready'); if (decoded.status === 'ready') assert.deepEqual(decoded.state, engine.snapshot());
});
test('事件中途保存再读档：节点、文字、RNG 稳定', async () => {
  const { registry, engine } = await game(); act(engine, 'travel.apartment_street'); act(engine, 'street.notice', 'locked-entry');
  const codec = new SaveCodec(registry); const decoded = await codec.decode(await codec.encode(engine.snapshot())); assert.equal(decoded.status, 'ready');
  if (decoded.status !== 'ready') return;
  const resumed = new ActionExecutor(registry, decoded.state); assert.deepEqual(resumed.view(), engine.view());
  for (let i = 0; i < 5; i++) resumed.view(); assert.deepEqual(resumed.snapshot().rng, engine.snapshot().rng);
  assert.deepEqual(act(resumed, 'notice.help', 'help'), act(engine, 'notice.help', 'help')); assert.deepEqual(resumed.snapshot(), engine.snapshot());
});
test('读档后重放已领取奖励的 requestId 不会再次支付', async () => {
  const { registry, engine } = await game(); act(engine, 'travel.apartment_street'); act(engine, 'street.notice'); const reward = act(engine, 'notice.help', 'reward');
  const codec = new SaveCodec(registry); const loaded = await codec.decode(await codec.encode(engine.snapshot())); if (loaded.status !== 'ready') assert.fail(loaded.reason);
  const resumed = new ActionExecutor(registry, loaded.state); const before = resumed.snapshot();
  assert.deepEqual(resumed.performAction({ actionId: 'aetheria:action.notice.help' }, 0, 'reward'), reward); assert.deepEqual(resumed.snapshot(), before);
});
test('Repository 真正保存/读取，空槽不伪造存档', async () => {
  const { registry, engine } = await game(); const store = new MemorySaveStore(); const saves = new SaveRepository(new SaveCodec(registry), store);
  assert.deepEqual(await saves.load(), { status: 'empty' }); act(engine, 'rest'); await saves.save(engine.snapshot());
  const loaded = await saves.load(); assert.equal(loaded.status, 'ready'); if (loaded.status === 'ready') assert.deepEqual(loaded.state, engine.snapshot());
});
test('损坏 JSON/篡改数据都隔离并保留原字符串', async () => {
  const { registry, engine } = await game(); const codec = new SaveCodec(registry);
  for (const text of ['{broken', (await codec.encode(engine.snapshot())).replace('"totalMinutes": 480', '"totalMinutes": 999')]) {
    const result = await codec.decode(text); assert.equal(result.status, 'quarantined'); if (result.status === 'quarantined') assert.equal(result.original, text);
  }
});
test('内容包缺失或 hash 改变时隔离，不静默丢进度', async () => {
  const { registry, engine } = await game(); const text = await new SaveCodec(registry).encode(engine.snapshot());
  const changed = await packs(); changed[1].texts['aetheria:text.apartment'] += ' changed';
  const alteredRegistry = await loadPacks(changed); const rejected = await new SaveCodec(alteredRegistry).decode(text);
  assert.equal(rejected.status, 'quarantined'); if (rejected.status === 'quarantined') assert.equal(rejected.code, 'PACK_MISMATCH');
  const missingRefs = { packs: [registry.packs[0]] } as never;
  const missing = await new SaveCodec(missingRefs).decode(text); assert.equal(missing.status, 'quarantined');
});
test('未知字段与任意写状态被存档边界拒绝', async () => {
  const { registry, engine } = await game(); const state = clone(engine.snapshot()); (state as unknown as Record<string, unknown>).body = { fake: true };
  assert.throws(() => validateState(state, registry), /未知字段/);
  const s = clone(engine.snapshot()); s.player.variables['core:energy'] = -1; assert.throws(() => validateState(s, registry));
});
test('不合法事件栈/随机记录/重复事务不能导入', async () => {
  const { registry, engine } = await game(); act(engine, 'travel.apartment_street'); act(engine, 'street.notice');
  const badStack = clone(engine.snapshot()); badStack.activeEventStack = []; assert.throws(() => validateState(badStack, registry));
  const badDraw = clone(engine.snapshot()); badDraw.eventInstances[0].draws[0].value = 5; assert.throws(() => validateState(badDraw, registry));
  const badLedger = clone(engine.snapshot()); badLedger.ledger.transactions[1].requestId = badLedger.ledger.transactions[0].requestId; assert.throws(() => validateState(badLedger, registry));
});
test('存储失败被传回 UI，不假报保存成功', async () => {
  const { registry, engine } = await game(); const store = { read: async () => undefined, write: async () => { throw new Error('quota'); } };
  await assert.rejects(new SaveRepository(new SaveCodec(registry), store).save(engine.snapshot()), /quota/);
});
test('存档中的引用必须是正确类型，不能用变量 ID 伪装地点', async () => {
  const { registry, engine } = await game(); const state = clone(engine.snapshot()); state.world.locationId = 'core:money'; state.world.knownLocationIds.push('core:money');
  assert.throws(() => validateState(state, registry), /locations/);
});
