import test from 'node:test';
import assert from 'node:assert/strict';
import { act, game, packs, extension } from './helpers.ts';
import { loadPacks } from '../src/content/loader.ts';
import { PackError } from '../src/core/errors.ts';
import { ActionExecutor } from '../src/engine/executor.ts';
import { createGameState } from '../src/engine/state.ts';
import { advanceClock, formatClock } from '../src/engine/clock.ts';
import { draw } from '../src/engine/rng.ts';
import { evaluate } from '../src/engine/conditions.ts';
import { clone } from '../src/core/types.ts';

test('完整日常循环：三个地点、谋生、买热食、回家恢复', async () => {
  const { engine } = await game();
  for (const action of ['travel.apartment_street', 'travel.street_market', 'market.work', 'market.meal', 'travel.market_street', 'travel.street_apartment', 'rest']) assert.equal(act(engine, action).ok, true);
  const s = engine.snapshot();
  assert.equal(s.world.locationId, 'aetheria:location.apartment'); assert.equal(s.clock.totalMinutes, 625);
  assert.equal(s.player.variables['core:money'], 64); assert.equal(s.player.variables['core:energy'], 100);
  assert.equal(s.meta.revision, 7); assert.equal(s.world.knownLocationIds.length, 3);
});
test('同 requestId 重放只提交一次，即使 revision 过期', async () => {
  const { engine } = await game(); const intent = { actionId: 'aetheria:action.rest' as const };
  const first = engine.performAction(intent, 0, 'same'); const saved = engine.snapshot();
  assert.deepEqual(engine.performAction(intent, 0, 'same'), first); assert.deepEqual(engine.snapshot(), saved);
});
test('请求 ID 不能冒用于另一行动', async () => {
  const { engine } = await game(); act(engine, 'rest', 'same'); const before = engine.snapshot();
  assert.equal(engine.performAction({ actionId: 'aetheria:action.travel.apartment_street' }, 1, 'same').code, 'REQUEST_ID_REUSED'); assert.deepEqual(engine.snapshot(), before);
});
test('旧 revision 的新请求被拒绝，不消耗状态', async () => {
  const { engine } = await game(); act(engine, 'rest'); const before = engine.snapshot();
  assert.equal(engine.performAction({ actionId: 'aetheria:action.rest' }, 0, 'stale').code, 'STALE_REVISION'); assert.deepEqual(engine.snapshot(), before);
});
test('不能从当前地点执行隐藏或事件专用动作', async () => {
  const { engine } = await game(); const before = engine.snapshot();
  assert.equal(act(engine, 'market.work').code, 'ACTION_NOT_AVAILABLE'); assert.equal(act(engine, 'notice.help').code, 'ACTION_NOT_AVAILABLE'); assert.deepEqual(engine.snapshot(), before);
});
test('未登记 intent 参数明确拒绝', async () => {
  const { engine } = await game();
  assert.equal(engine.performAction({ actionId: 'aetheria:action.rest', params: { money: 500 } as never }, 0, 'hack').code, 'INVALID_INTENT'); assert.equal(engine.snapshot().meta.revision, 0);
});
test('重复读取视图/选择器不能改时间、revision、RNG、金钱', async () => {
  const { engine } = await game(); act(engine, 'travel.apartment_street'); act(engine, 'street.notice');
  const before = engine.snapshot(); const first = engine.view();
  for (let i = 0; i < 20; i++) assert.deepEqual(engine.view(), first);
  assert.deepEqual(engine.snapshot(), before);
});
test('快照与 Registry 深冻结，外部不能写状态或定义', async () => {
  const { engine, registry } = await game();
  assert.throws(() => { engine.snapshot().clock.totalMinutes = 0; }, TypeError);
  assert.throws(() => { registry.action('aetheria:action.rest').effects[0] = { op: 'clock.advance', minutes: 1 }; }, TypeError);
});
test('预检资源不足：有具体原因且没有扣费/推进时间', async () => {
  const { registry } = await game(); const state = createGameState(registry, 1); state.world.locationId = 'aetheria:location.market'; state.world.knownLocationIds.push(state.world.locationId); state.player.variables['core:money'] = 0;
  const engine = new ActionExecutor(registry, state); const before = engine.snapshot(); const failed = act(engine, 'market.meal');
  assert.equal(failed.code, 'CONDITION_FAILED'); assert.match(failed.message, /零钱/); assert.deepEqual(engine.snapshot(), before);
});
test('效果中途失败：时间、金钱、事件、RNG 原子回滚', async () => {
  const input = await packs(); const a = input[1].actions.find(x => x.id === 'aetheria:action.rest')!;
  a.effects = [{ op: 'clock.advance', minutes: 1440 }, { op: 'event.start', id: 'aetheria:event.notice' }, { op: 'var.change', id: 'core:money', amount: -1000 }];
  const registry = await loadPacks(input); const engine = new ActionExecutor(registry, createGameState(registry, 1)); const before = engine.snapshot();
  assert.equal(act(engine, 'rest').code, 'INSUFFICIENT_RESOURCE'); assert.deepEqual(engine.snapshot(), before);
});
test('事件分支有真实代价与奖励，结束后回到行动列表', async () => {
  const { engine } = await game(); act(engine, 'travel.apartment_street'); act(engine, 'street.notice');
  assert.equal(engine.view().actions.filter(x => x.definition.surface !== 'body').length, 2); assert.ok(engine.view().eventTitle);
  const result = act(engine, 'notice.help'); assert.equal(result.ok, true); assert.match(result.text, /收好报酬/);
  const s = engine.snapshot(); assert.equal(s.player.variables['core:money'], 66); assert.equal(s.player.variables['core:energy'], 65); assert.equal(s.clock.totalMinutes, 505);
  assert.equal(s.activeEventStack.length, 0); assert.equal(s.eventInstances[0].status, 'completed');
  assert.equal(act(engine, 'street.notice').code, 'CONDITION_FAILED'); assert.equal(act(engine, 'notice.help').code, 'ACTION_NOT_AVAILABLE');
});
test('不帮忙出口真实结束，不获得未走分支的奖励', async () => {
  const { engine } = await game(); act(engine, 'travel.apartment_street'); act(engine, 'street.notice'); act(engine, 'notice.leave');
  assert.equal(engine.snapshot().player.variables['core:money'], 60); assert.equal(engine.snapshot().player.flags['aetheria:flag.notice_helped'], false); assert.equal(engine.snapshot().activeEventStack.length, 0);
});
test('连续多个午夜仅记录一次，重放不会重复推进边界', async () => {
  const { registry } = await game(); const state = createGameState(registry, 1); state.clock.totalMinutes = 1435;
  advanceClock(state, 2890); assert.equal(state.clock.totalMinutes, 4325); assert.deepEqual(state.clock.crossedDays, [1, 2, 3]);
  advanceClock(state, 0); assert.deepEqual(state.clock.crossedDays, [1, 2, 3]); assert.equal(formatClock(4325), '第 4 天 · 00:05');
});
test('精力为零仍可回到公寓恢复，不形成软锁', async () => {
  const { registry } = await game(); const state = createGameState(registry, 1); state.player.variables['core:energy'] = 0; state.world.locationId = 'aetheria:location.market'; state.world.knownLocationIds.push(state.world.locationId);
  const engine = new ActionExecutor(registry, state);
  assert.equal(act(engine, 'market.work').ok, false); for (const a of ['travel.market_street', 'travel.street_apartment', 'rest']) assert.equal(act(engine, a).ok, true);
  assert.equal(engine.snapshot().player.variables['core:energy'], 25);
});
test('夜间时间窗与布尔组合求值为纯读取', async () => {
  const { registry, engine } = await game(); const state = clone(engine.snapshot()); state.clock.totalMinutes = 23 * 60;
  assert.equal(evaluate({ op: 'time.window', start: 22 * 60, end: 6 * 60 }, state, registry).pass, true);
  assert.equal(evaluate({ op: 'all', conditions: [{ op: 'location.is', id: 'aetheria:location.apartment' }, { op: 'not', condition: { op: 'flag.has', id: 'aetheria:flag.notice_helped', value: true } }] }, state, registry).pass, true);
});
test('独立随机流可复现，其他流不会改变事件流', async () => {
  const { registry } = await game(); const a = createGameState(registry, 100); const b = clone(a);
  draw(a, 'weather'); assert.equal(draw(a, 'event:test'), draw(b, 'event:test')); assert.equal(draw(a, 'event:test'), draw(b, 'event:test'));
});
test('加载同一包集合的顺序不同，Registry 索引与 hash 一致', async () => {
  const input = [...await packs(), extension()]; const a = await loadPacks(input); const b = await loadPacks([...input].reverse());
  assert.deepEqual(a.packs, b.packs); assert.deepEqual(a.actionsAt('aetheria:location.street'), b.actionsAt('aetheria:location.street'));
});
test('第三方内容包通过公开 Hook 增加真实行动，无需改 engine/UI', async () => {
  const registry = await loadPacks([...await packs(), extension()]); const engine = new ActionExecutor(registry, createGameState(registry, 1)); act(engine, 'travel.apartment_street');
  assert.ok(engine.view().actions.some(x => x.definition.id === 'test-author:action.watch'));
  const before = engine.snapshot().clock.totalMinutes; const result = engine.performAction({ actionId: 'test-author:action.watch' }, 1, 'extension');
  assert.equal(result.ok, true); assert.equal(engine.snapshot().clock.totalMinutes, before + 7);
});
test('未知高级 Effect/Condition 操作符导入失败，附 JSON pointer', async () => {
  for (const field of ['effects', 'conditions'] as const) {
    const input = await packs(); input[1].actions[0][field] = [{ op: 'body.patch' }] as never;
    await assert.rejects(loadPacks(input), (e: unknown) => e instanceof PackError && e.issues.some(x => x.code === 'UNSUPPORTED_OPCODE' && x.pointer.includes(field)));
  }
});
test('缺少依赖、循环依赖、版本错误导入失败', async () => {
  const input = await packs(); await assert.rejects(loadPacks([input[1]]), PackError);
  input[0].manifest.dependencies.push({ id: 'aetheria/world', version: '0.1.0', optional: false }); await assert.rejects(loadPacks(input), /DEPENDENCY_CYCLE/);
  const mismatch = await packs(); mismatch[1].manifest.dependencies[0].version = '99.0.0'; await assert.rejects(loadPacks(mismatch), /DEPENDENCY_VERSION/);
});
test('引用、命名空间和重复 ID 都会阻止启用', async () => {
  const broken = await packs(); broken[1].locations[0].textKey = 'aetheria:text.missing'; await assert.rejects(loadPacks(broken), /INVALID_REFERENCE/);
  const wrong = await packs(); wrong[1].actions[0].id = 'core:action.overwrite'; await assert.rejects(loadPacks(wrong), /NAMESPACE_OWNERSHIP/);
  const duplicate = await packs(); duplicate[1].locations.push(duplicate[1].locations[0]); await assert.rejects(loadPacks(duplicate), /DUPLICATE_ID/);
});
test('事件缺少资源耗尽时可执行的推进或结算路径时导入失败', async () => {
  const input = await packs(); input[1].actions.find(x => x.id === 'aetheria:action.notice.leave')!.conditions.push({ op: 'var.compare', id: 'core:money', comparison: 'gte', value: 999 });
  await assert.rejects(loadPacks(input), /NO_FALLBACK_PATH/);
});
