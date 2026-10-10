import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { act, game, packs } from './helpers.ts';
import { loadPacks } from '../src/content/loader.ts';
import { ActionExecutor } from '../src/engine/executor.ts';
import { createGameState } from '../src/engine/state.ts';
import { bodyTraits, patchedBody, validateBody } from '../src/engine/body.ts';
import { clone, stableJson } from '../src/core/types.ts';
import type { ContentPack, Id } from '../src/core/types.ts';
import { SaveCodec, validateState } from '../src/persistence/codec.ts';
import { SaveRepository, MemorySaveStore } from '../src/persistence/store.ts';
const id = (s: string): Id => `aetheria-tf:${s}`;
function reshape(engine: ActionExecutor, s: string, request = crypto.randomUUID()) { return engine.performAction({ actionId: id(`action.${s}`) }, engine.snapshot().meta.revision, request); }
function clinic(engine: ActionExecutor) { assert.equal(act(engine, 'travel.apartment_street').ok, true); assert.equal(reshape(engine, 'travel.street_clinic').ok, true); }
function book(engine: ActionExecutor) { assert.equal(reshape(engine, 'clinic.consult').ok, true); assert.equal(reshape(engine, 'consult.offer.accept').ok, true); }
function fixtureAction(pack: ContentPack, suffix: string, effects: ContentPack['actions'][number]['effects']) {
  const actionId = id(`action.test.${suffix}`), textId = id(`text.test.${suffix}`);
  pack.texts[textId] = '测试动作已执行。';
  pack.actions.push({ id: actionId, label: suffix, hint: '测试内容', group: 'daily', surface: 'body', conditions: [], effects, resultText: textId });
  pack.contributions.find(x => x.hookId === id('hook.body'))!.actionIds.push(actionId);
  return actionId;
}
test('初始模板是连通身体；耳、手掌、足部能力从实际节点派生', async () => {
  const { registry, engine } = await game(); const body = engine.snapshot().player.body!;
  validateBody(body, registry); assert.equal(body.parts.length, 12); assert.equal(body.edges.length, 11);
  assert.deepEqual(bodyTraits(body, registry), { grasp: 2, walk: 2, hear: 2, balance: 0, tailGrip: 0 });
});
test('自由耳型双侧整体更换，时间/金钱/既有身份标记不变', async () => {
  const { registry, engine } = await game(); const before = engine.snapshot();
  assert.equal(reshape(engine, 'free.ears.wolf').ok, true); const after = engine.snapshot();
  assert.equal(after.player.body!.parts.filter(x => x.definitionId === id('part.ear.wolf')).length, 2);
  assert.deepEqual(after.player.variables, before.player.variables); assert.deepEqual(after.player.flags, before.player.flags); assert.deepEqual(after.clock, before.clock);
  assert.deepEqual(bodyTraits(after.player.body, registry), bodyTraits(before.player.body, registry));
  const snap = engine.snapshot(); assert.equal(reshape(engine, 'free.ears.wolf').ok, false); assert.deepEqual(engine.snapshot(), snap);
});
test('自由拓扑新增/移除尾部，连接数与平衡能力同步变化', async () => {
  const { registry, engine } = await game();
  assert.equal(reshape(engine, 'free.tail.organic').ok, true); const tail = engine.snapshot().player.body!;
  assert.equal(tail.parts.length, 13); assert.equal(bodyTraits(tail, registry).balance, 1);
  assert.ok(tail.edges.some(x => x.childPartId === 'tail' && x.anchorId === 'pelvis.back'));
  assert.equal(reshape(engine, 'free.tail.remove').ok, true); assert.equal(engine.snapshot().player.body!.parts.length, 12);
});
test('额外手掌内容无需 engine/UI 改动，资源预算增加为3', async () => {
  const input = await packs(), p = input[2];
  p.bodyPatches!.push({ id: id('patch.extra'), label: '额外手掌', summary: '多一个抓握部位', operations: [{ type: 'attach', partId: 'extra.hand', definitionId: id('part.hand'), parentPartId: 'torso', anchorId: 'aux' }] });
  p.transformations!.push({ id: id('tf.extra'), label: '额外手掌', source: 'free', stages: [{ id: 'done', atMinutes: 0, label: '完成', patchId: id('patch.extra') }] });
  const actionId = fixtureAction(p, 'extra', [{ op: 'tf.apply', id: id('tf.extra') }]);
  const registry = await loadPacks(input), engine = new ActionExecutor(registry, createGameState(registry, 1));
  assert.equal(engine.performAction({ actionId }, 0, 'extra').ok, true); assert.equal(bodyTraits(engine.snapshot().player.body, registry).grasp, 3);
});
test('无效锚点、容量超出、循环、孤立图和删除父节点均拒绝', async () => {
  const { registry, engine } = await game(); const body = engine.snapshot().player.body!;
  const disconnected = clone(body); disconnected.edges[0].parentPartId = 'missing'; assert.throws(() => validateBody(disconnected, registry));
  const cycle = clone(body); cycle.edges.find(e => e.childPartId === 'head')!.parentPartId = 'head'; assert.throws(() => validateBody(cycle, registry));
  const duplicate = clone(body); duplicate.parts[1].instanceId = duplicate.parts[0].instanceId; assert.throws(() => validateBody(duplicate, registry));
  assert.throws(() => patchedBody(body, { id: id('patch.bad'), label: 'bad', summary: 'bad', operations: [{ type: 'remove', partId: 'arm.left' }] }, registry));
  assert.throws(() => patchedBody(body, { id: id('patch.bad'), label: 'bad', summary: 'bad', operations: [0, 1, 2].map(i => ({ type: 'attach' as const, partId: `extra${i}`, definitionId: id('part.hand'), parentPartId: 'torso', anchorId: 'aux' })) }, registry));
  assert.throws(() => patchedBody(body, { id: id('patch.bad'), label: 'bad', summary: 'bad', operations: [{ type: 'attach', partId: 'extra', definitionId: id('part.hand'), parentPartId: 'head', anchorId: 'ear.left' }] }, registry));
});
test('图补丁任一操作失败，原身体不产生半次变化', async () => {
  const { registry, engine } = await game(); const body = engine.snapshot().player.body!, original = clone(body);
  assert.throws(() => patchedBody(body, { id: id('patch.bad'), label: 'bad', summary: 'bad', operations: [{ type: 'replace', partId: 'ear.left', definitionId: id('part.ear.cat') }, { type: 'remove', partId: 'missing' }] }, registry));
  assert.deepEqual(body, original);
});
test('第四地点路线与改造咨询的多节点/无条件出口真实可用', async () => {
  const { engine } = await game(); clinic(engine); assert.equal(engine.snapshot().world.locationId, id('location.clinic'));
  assert.equal(reshape(engine, 'clinic.consult').ok, true); assert.equal(reshape(engine, 'consult.details').ok, true);
  assert.equal(reshape(engine, 'consult.details.leave').ok, true); assert.equal(engine.snapshot().activeEventStack.length, 0);
  assert.equal(engine.snapshot().player.variables['core:money'], 60); assert.equal(engine.snapshot().tfQueues.length, 0);
});
test('同请求预约仅扣款一次，15分钟试装无抓握，45分钟才有能力', async () => {
  const { registry, engine } = await game(); clinic(engine); reshape(engine, 'clinic.consult');
  const intent = { actionId: id('action.consult.offer.accept') }; const revision = engine.snapshot().meta.revision;
  const first = engine.performAction(intent, revision, 'paid'); assert.equal(first.ok, true);
  assert.deepEqual(engine.performAction(intent, revision, 'paid'), first); assert.equal(engine.snapshot().player.variables['core:money'], 42); assert.equal(engine.snapshot().tfQueues.length, 1);
  reshape(engine, 'clinic.wait'); assert.equal(engine.snapshot().tfQueues[0].elapsedMinutes, 15);
  assert.ok(engine.snapshot().player.body!.parts.some(x => x.definitionId === id('part.tail.trial'))); assert.equal(bodyTraits(engine.snapshot().player.body, registry).tailGrip, 0);
  reshape(engine, 'clinic.wait'); reshape(engine, 'clinic.wait');
  assert.equal(engine.snapshot().tfQueues[0].status, 'completed'); assert.equal(bodyTraits(engine.snapshot().player.body, registry).tailGrip, 1);
  assert.equal(engine.snapshot().player.body!.parts.filter(x => x.instanceId === 'tail').length, 1);
});
test('尾部预约期间自由耳型成功；尾部塑形冲突给出原因且不结算', async () => {
  const { engine } = await game(); clinic(engine); book(engine);
  const before = engine.snapshot(); const failure = reshape(engine, 'free.tail.organic'); assert.equal(failure.ok, false); assert.match(failure.message, /预约|改造/); assert.deepEqual(engine.snapshot(), before);
  assert.equal(reshape(engine, 'free.ears.cat').ok, true); assert.equal(engine.snapshot().tfQueues[0].elapsedMinutes, 0);
});
test('暂停阻止世界时间增加TF进度并保留锁，继续从原阶段推进', async () => {
  const { engine } = await game(); clinic(engine); book(engine); reshape(engine, 'clinic.wait');
  assert.equal(reshape(engine, 'tf.pause').ok, true); reshape(engine, 'clinic.wait'); reshape(engine, 'clinic.wait');
  assert.equal(engine.snapshot().tfQueues[0].elapsedMinutes, 15); assert.equal(engine.snapshot().tfQueues[0].status, 'paused');
  assert.equal(reshape(engine, 'free.tail.remove').ok, false); assert.equal(reshape(engine, 'free.ears.wolf').ok, true);
  assert.equal(reshape(engine, 'tf.resume').ok, true); reshape(engine, 'clinic.wait'); reshape(engine, 'clinic.wait'); assert.equal(engine.snapshot().tfQueues[0].status, 'completed');
});
test('取消释放锁，不退费、不撤销试装；可移除试装后重新预约', async () => {
  const { engine } = await game(); clinic(engine); book(engine); reshape(engine, 'clinic.wait');
  assert.equal(reshape(engine, 'tf.cancel').ok, true); const s = engine.snapshot(); assert.equal(s.tfQueues[0].status, 'cancelled'); assert.equal(s.player.variables['core:money'], 42);
  assert.ok(s.player.body!.parts.some(x => x.definitionId === id('part.tail.trial')));
  reshape(engine, 'clinic.wait'); assert.equal(engine.snapshot().tfQueues[0].elapsedMinutes, 15);
  assert.equal(reshape(engine, 'free.tail.remove').ok, true); book(engine); assert.equal(engine.snapshot().tfQueues.at(-1)!.status, 'active'); assert.equal(engine.snapshot().player.variables['core:money'], 24);
});
test('已经有生物尾时拒绝机械尾预约，咨询仍可合法退出', async () => {
  const { engine } = await game(); reshape(engine, 'free.tail.organic'); clinic(engine); reshape(engine, 'clinic.consult'); const before = engine.snapshot();
  const denied = reshape(engine, 'consult.offer.accept'); assert.equal(denied.ok, false); assert.match(denied.message, /已有/); assert.deepEqual(engine.snapshot(), before);
  assert.equal(reshape(engine, 'consult.offer.leave').ok, true);
});
test('付款后发生其他效果失败：身体/进度/金钱/时间一起回滚', async () => {
  const input = await packs(); const action = input[2].actions.find(x => x.id === id('action.consult.offer.accept'))!;
  action.effects.splice(2, 0, { op: 'clock.advance', minutes: 45 }, { op: 'var.change', id: 'core:money', amount: -1000 });
  const registry = await loadPacks(input), engine = new ActionExecutor(registry, createGameState(registry, 1)); clinic(engine); reshape(engine, 'clinic.consult'); const before = engine.snapshot();
  assert.equal(reshape(engine, 'consult.offer.accept').code, 'INSUFFICIENT_RESOURCE'); assert.deepEqual(engine.snapshot(), before);
});
test('一次长行动跨越两个TF阶段和多个午夜，结构只改变一次', async () => {
  const input = await packs(); input[2].actions.find(x => x.id === id('action.clinic.wait'))!.effects = [{ op: 'clock.advance', minutes: 3000 }];
  const registry = await loadPacks(input), state = createGameState(registry, 1); state.clock.totalMinutes = 1435;
  const engine = new ActionExecutor(registry, state); clinic(engine); book(engine);
  const intent = { actionId: id('action.clinic.wait') }, revision = engine.snapshot().meta.revision;
  const result = engine.performAction(intent, revision, 'long'); assert.equal(result.ok, true); const s = engine.snapshot();
  assert.deepEqual(s.tfQueues[0].completedStageIds, ['fit', 'ready']); assert.equal(s.tfQueues[0].elapsedMinutes, 45); assert.equal(s.player.body!.parts.filter(x => x.instanceId === 'tail').length, 1); assert.deepEqual(s.clock.crossedDays, [1, 2, 3]);
  assert.deepEqual(engine.performAction(intent, revision, 'long'), result); assert.deepEqual(engine.snapshot(), s);
});
test('两个不同部位剧情队列并行，时间不会逐队列重复扣除', async () => {
  const input = await packs(), p = input[2];
  p.transformations!.push({ id: id('tf.ears.story'), label: '耳型试用', source: 'story', stages: [{ id: 'wolf', atMinutes: 10, label: '狼耳', patchId: id('patch.ears.wolf') }, { id: 'cat', atMinutes: 30, label: '猫耳', patchId: id('patch.ears.cat') }] });
  const actionId = fixtureAction(p, 'parallel', [{ op: 'tf.enqueue', id: id('tf.ears.story') }]);
  const registry = await loadPacks(input), engine = new ActionExecutor(registry, createGameState(registry, 1)); clinic(engine); book(engine);
  assert.equal(engine.performAction({ actionId }, engine.snapshot().meta.revision, 'parallel').ok, true); const time = engine.snapshot().clock.totalMinutes;
  reshape(engine, 'clinic.wait'); reshape(engine, 'clinic.wait'); const s = engine.snapshot();
  assert.equal(s.clock.totalMinutes - time, 30); assert.equal(s.tfQueues[0].elapsedMinutes, 30); assert.equal(s.tfQueues[1].elapsedMinutes, 30); assert.equal(s.tfQueues[1].status, 'completed');
  validateState(s, registry);
});
test('机械尾校准后解锁真实工作；试装或移除时工作不可执行', async () => {
  const { engine } = await game(); clinic(engine); book(engine); for (let i = 0; i < 3; i++) reshape(engine, 'clinic.wait');
  reshape(engine, 'travel.clinic_street'); act(engine, 'travel.street_market'); const before = engine.snapshot();
  assert.equal(reshape(engine, 'market.tail_work').ok, true); assert.equal(engine.snapshot().player.variables['core:money'], before.player.variables['core:money'] + 14); assert.equal(engine.snapshot().clock.totalMinutes, before.clock.totalMinutes + 20);
  reshape(engine, 'free.tail.remove'); const s = engine.snapshot(); assert.equal(reshape(engine, 'market.tail_work').ok, false); assert.deepEqual(engine.snapshot(), s);
});
test('临界点结构不兼容会阻塞；解除原因后原边界重试并可保存', async () => {
  const { registry, engine } = await game(); clinic(engine); book(engine); reshape(engine, 'clinic.wait');
  // 模拟后续模块改变了试装部件：本阶段 UI 本身不会绕过目标锁。
  const state = clone(engine.snapshot()); state.player.body = patchedBody(state.player.body!, registry.bodyPatch(id('patch.tail.remove')), registry);
  let changed = new ActionExecutor(registry, state); reshape(changed, 'clinic.wait'); reshape(changed, 'clinic.wait');
  const blocked = changed.snapshot(); assert.equal(blocked.tfQueues[0].status, 'blocked'); assert.equal(blocked.tfQueues[0].elapsedMinutes, 45); assert.deepEqual(blocked.tfQueues[0].completedStageIds, ['fit']); assert.ok(blocked.tfQueues[0].blocker);
  assert.equal(reshape(changed, 'tf.resume').ok, false); const codec = new SaveCodec(registry); assert.equal((await codec.decode(await codec.encode(blocked))).status, 'ready');
  const fixed = clone(blocked); fixed.player.body = patchedBody(fixed.player.body!, registry.bodyPatch(id('patch.tail.trial')), registry);
  changed = new ActionExecutor(registry, fixed); const before = changed.snapshot().clock.totalMinutes;
  assert.equal(reshape(changed, 'tf.resume').ok, true); assert.equal(changed.snapshot().clock.totalMinutes, before); assert.equal(changed.snapshot().tfQueues[0].status, 'completed');
  assert.equal((await codec.decode(await codec.encode(changed.snapshot()))).status, 'ready');
});
test('有队列时反复读取身体/行动预览，不改变任何图、进度、RNG', async () => {
  const { engine } = await game(); clinic(engine); book(engine); const before = engine.snapshot();
  for (let i = 0; i < 30; i++) engine.view(); assert.deepEqual(engine.snapshot(), before);
});
test('试装与暂停期间存读恢复图、队列、事件文字；恢复后不重扣费', async () => {
  const { registry, engine } = await game(); clinic(engine); book(engine); reshape(engine, 'clinic.wait'); reshape(engine, 'tf.pause'); reshape(engine, 'free.ears.cat');
  const codec = new SaveCodec(registry), text = await codec.encode(engine.snapshot()), restored = await codec.decode(text);
  if (restored.status !== 'ready') assert.fail(restored.reason);
  const resumed = new ActionExecutor(registry, restored.state); assert.deepEqual(resumed.view(), engine.view()); reshape(resumed, 'tf.resume'); reshape(resumed, 'clinic.wait'); reshape(resumed, 'clinic.wait');
  assert.equal(resumed.snapshot().player.variables['core:money'], 42); assert.equal(resumed.snapshot().tfQueues[0].status, 'completed');
  const reread = await codec.decode(await codec.encode(resumed.snapshot())); assert.equal(reread.status, 'ready');
});
test('存档拒绝伪造阶段、进度、来源事务、身体连接和冲突预约', async () => {
  const { registry, engine } = await game(); clinic(engine); book(engine); reshape(engine, 'clinic.wait');
  for (const mutate of [
    (s: ReturnType<ActionExecutor['snapshot']>) => { s.tfQueues[0].completedStageIds = ['ready']; },
    (s: ReturnType<ActionExecutor['snapshot']>) => { s.tfQueues[0].elapsedMinutes = 999; },
    (s: ReturnType<ActionExecutor['snapshot']>) => { s.tfQueues[0].sourceActionId = 'aetheria:action.rest'; },
    (s: ReturnType<ActionExecutor['snapshot']>) => { s.player.body!.edges[0].anchorId = 'missing'; },
    (s: ReturnType<ActionExecutor['snapshot']>) => { s.tfQueues.push(clone(s.tfQueues[0])); },
  ]) { const s = clone(engine.snapshot()); mutate(s); assert.throws(() => validateState(s, registry)); }
});
test('内容包缺失身体定义时隔离完整存档，原字符串保持', async () => {
  const { registry, engine } = await game(); reshape(engine, 'free.tail.organic'); const text = await new SaveCodec(registry).encode(engine.snapshot());
  const base = await loadPacks((await packs()).slice(0, 2)); const result = await new SaveCodec(base).decode(text);
  assert.equal(result.status, 'quarantined'); if (result.status === 'quarantined') { assert.equal(result.code, 'PACK_MISMATCH'); assert.equal(result.original, text); }
});
test('第一阶段真实存档精确升级；时间/金钱/事件/随机/账本原样保留', async () => {
  const { registry } = await game(); const text = await readFile(new URL('./fixtures/stage1-save.json', import.meta.url), 'utf8'); const old = JSON.parse(text).payload.state;
  const store = new MemorySaveStore(); await store.write('manual', text); const repository = new SaveRepository(new SaveCodec(registry), store), result = await repository.load();
  if (result.status !== 'ready') assert.fail('升级未成功'); assert.match(result.migration!, /升级/);
  for (const key of ['clock', 'world', 'eventInstances', 'activeEventStack', 'rng', 'ledger'] as const) assert.deepEqual(result.state[key], old[key]);
  assert.deepEqual(result.state.player.variables, old.player.variables); assert.deepEqual(result.state.player.flags, old.player.flags); assert.equal(result.state.player.body!.parts.length, 12); assert.deepEqual(result.state.tfQueues, []);
  assert.equal(await store.read('manual'), text); // 读取/迁移不会覆盖原存档。
  const engine = new ActionExecutor(registry, result.state); assert.equal(act(engine, 'notice.help').ok, true); await repository.save(engine.snapshot()); const next = await repository.load(); assert.equal(next.status, 'ready');
});
test('旧档checksum正确但状态无效/包未知仍隔离，不能靠迁移绕过校验', async () => {
  const { registry } = await game(); const source = JSON.parse(await readFile(new URL('./fixtures/stage1-save.json', import.meta.url), 'utf8'));
  for (const mutate of [(x: typeof source) => { x.payload.state.meta.packs[0].hash = 'unknown'; }, (x: typeof source) => { x.payload.state.player.variables['core:energy'] = -10; }, (x: typeof source) => { x.payload.state.player.body = {}; }]) {
    const envelope = clone(source); mutate(envelope);
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(stableJson(envelope.payload))); envelope.checksum = [...new Uint8Array(digest)].map(x => x.toString(16).padStart(2, '0')).join('');
    const text = JSON.stringify(envelope); const result = await new SaveCodec(registry).decode(text); assert.equal(result.status, 'quarantined'); if (result.status === 'quarantined') assert.equal(result.original, text);
  }
});
test('新增身体/TF schema、能力、引用、时间阶段与模板图的负例导入失败', async () => {
  for (const mutate of [
    (p: ContentPack) => { p.bodyParts![0].capabilities = ['fly' as never]; },
    (p: ContentPack) => { p.bodyTemplates![0].edges[0].parentPartId = 'missing'; },
    (p: ContentPack) => { p.bodyPatches!.find(x => x.id === id('patch.tail.trial'))!.operations[0] = { type: 'attach', partId: 'tail', definitionId: id('part.tail.trial'), parentPartId: 'torso', anchorId: 'missing' }; },
    (p: ContentPack) => { p.transformations!.at(-1)!.stages[1].atMinutes = 15; },
    (p: ContentPack) => { p.transformations![0].stages[0].patchId = id('patch.missing'); },
    (p: ContentPack) => { p.manifest.requiresCapabilities = p.manifest.requiresCapabilities.filter(x => x !== 'tf.pipeline.v1'); },
  ]) { const input = await packs(); mutate(input[2]); await assert.rejects(loadPacks(input)); }
});
