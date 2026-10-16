import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { packs } from './helpers.ts';
import { loadPacks } from '../src/content/loader.ts';
import { WorldGenerator } from '../src/world/generator.ts';
import { parseReference, parseRules, hash } from '../src/world/schema.ts';
import { validateState, SaveCodec } from '../src/persistence/codec.ts';
import { ActionExecutor } from '../src/engine/executor.ts';
import { createGameState } from '../src/engine/state.ts';
import { advanceClock } from '../src/engine/clock.ts';
import { clone, stableJson } from '../src/core/types.ts';
import type { ActionDef, Id } from '../src/core/types.ts';
import type { ReferenceTemplate } from '../src/world/types.ts';
import { validateBody } from '../src/engine/body.ts';
const json = async (name: string) => JSON.parse(await readFile(new URL(`../content/${name}.json`, import.meta.url), 'utf8'));
const registry = await loadPacks([...await packs(), await json('district/pack'), await json('generation/neighborhood-content')]);
const rules = await json('generation/rules'), reference = await json('generation/reference');
const generator = new WorldGenerator();
const generate = (seed = 42, options = {}) => generator.generate({ seed, registry, rules, references: [reference], ...options });
const act = (engine: ActionExecutor, actionId: Id) => { const result = engine.performAction({ actionId }, engine.snapshot().meta.revision, crypto.randomUUID()); assert.equal(result.ok, true, `${actionId}: ${result.message}`); return result; };

test('生成结果可由原 Registry、身体与存档校验器验证', async () => {
  const g = await generate(); validateState(g.state, g.registry);
  assert.equal(g.world.definition.locations.length, rules.locationCount); assert.equal(g.state.district!.residents.length, rules.npcCount);
  assert.ok(g.world.agents.every(a => a.relationships?.length === 2));
  for (const n of g.state.district!.residents) { validateBody(n.body, g.registry); assert.ok(n.profession); assert.ok(n.personality); }
  assert.equal(g.world.generation.rulesHash, await hash(rules)); assert.equal(g.world.generation.references[0].hash, await hash(reference));
});
test('同种子、规则、内容可复现整个初始状态，包/模板输入顺序不影响结果', async () => {
  const a = await generate(123), b = await generate(123);
  assert.deepEqual(a.state, b.state);
  const reversed = clone(reference); reversed.templates.reverse();
  // 参考包文件哈希如实记录输入顺序；抽样定义和玩法状态不受迭代顺序影响。
  const c = await generate(123, { references: [reversed] });
  assert.deepEqual(a.world.definition, c.world.definition); assert.deepEqual(a.state.district, c.state.district);
});
test('两个测试种子在环境、地图与居民分布均有差异', async () => {
  const a = await generate(7), b = await generate(42);
  assert.notDeepEqual(a.world.definition.regions, b.world.definition.regions);
  assert.notDeepEqual(a.registry.routes.filter(r => r.id.startsWith('worldgen:')), b.registry.routes.filter(r => r.id.startsWith('worldgen:')));
  assert.notDeepEqual(a.state.district!.residents, b.state.district!.residents);
});
test('32个种子及规模边界全部可达、可返回、职业与全天日程有效', async () => {
  for (let seed = 0; seed < 32; seed++) { const g = await generate(seed, { parameters: { locationCount: seed % 2 ? 5 : 20, npcCount: seed % 2 ? 3 : 40 } }); validateState(g.state, g.registry); }
});
test('现有居民行动创建记忆并跨日/跨地点保持同一个身份', async () => {
  const g = await generate(); const e = new ActionExecutor(g.registry, g.state);
  // 无需探索生成身份；直接走到一个已存在居民的工作地点。
  const resident = g.state.district!.residents[0];
  const s = clone(g.state); s.world.locationId = resident.locationId; s.world.knownLocationIds.push(resident.locationId);
  s.world.knownLocationIds = [...new Set(s.world.knownLocationIds)];
  const engine = new ActionExecutor(g.registry, s), index = Number(resident.locationId.split('.').at(-1));
  act(engine, `worldgen:action.look.${index}`); // 事件与居民共用原遭遇逻辑。
  const exit = engine.view().actions.find(a => a.definition.id.startsWith('worldgen:action.event.leave'));
  if (exit) act(engine, exit.definition.id);
  const rid = engine.snapshot().district!.currentResidentId!;
  act(engine, `worldgen:action.talk.${index}`); act(engine, `worldgen:action.help.${index}`);
  const before = engine.snapshot().district!.residents.find(r => r.id === rid)!; assert.ok(before.persistent); assert.ok(before.memories.length >= 2);
  const state = clone(engine.snapshot()); advanceClock(state, 1440); validateState(state, g.registry);
  const after = state.district!.residents.find(r => r.id === rid)!; assert.equal(after.name, before.name); assert.deepEqual(after.memories, before.memories);
  assert.equal(e.snapshot().meta.revision, 0);
});
test('模拟跨多个边界只更新活动位置，读取和重绘不推进时间或随机流', async () => {
  const g = await generate(), s = clone(g.state); const a = s.worldInstance!.agents[0];
  advanceClock(s, 600); assert.equal(s.district!.residents[0].locationId, a.schedule[2].locationId);
  advanceClock(s, 240); assert.equal(s.district!.residents[0].locationId, a.schedule[3].locationId);
  advanceClock(s, 900); validateState(s, g.registry);
  const engine = new ActionExecutor(g.registry, s); const before = engine.snapshot(); for (let i = 0; i < 5; i++) engine.view(); assert.deepEqual(engine.snapshot(), before);
  assert.deepEqual(s.rng, g.state.rng);
});
test('存档快照恢复不调用生成器，新增/修改参考库不改变旧档；固定/生成存档可互读', async () => {
  const g = await generate(), codec = new SaveCodec(g.registry), saved = await codec.encode(g.state);
  const sourceCodec = new SaveCodec(registry), restored = await sourceCodec.decode(saved);
  assert.equal(restored.status, 'ready'); if (restored.status !== 'ready') return;
  assert.deepEqual(restored.state, g.state); assert.deepEqual(restored.registry!.packs, g.registry.packs);
  const added = await loadPacks([...registry.contentPacks, await json('generation/addon-content')]);
  const underNewContent = await new SaveCodec(added).decode(saved); assert.equal(underNewContent.status, 'ready');
  if (underNewContent.status === 'ready') assert.deepEqual(underNewContent.state, g.state);
  const fixed = createGameState(registry, 19); const old = await codec.decode(await sourceCodec.encode(fixed)); assert.equal(old.status, 'ready');
});
test('不同已加载内容包与参考扩展实际参与地点和NPC生成', async () => {
  const addon = await json('generation/addon-reference');
  const added = await loadPacks([...registry.contentPacks, await json('generation/addon-content')]);
  const g = await generator.generate({ seed: 42, registry: added, rules, references: [reference, addon] }); validateState(g.state, g.registry);
  assert.ok(g.world.definition.locations.some(l => l.templateId === 'addon.place.lamps'));
  assert.ok(g.state.district!.residents.some(n => n.profession === '灯匠'));
  const fixedSave = await new SaveCodec(registry).encode(createGameState(registry, 12));
  assert.equal((await new SaveCodec(g.registry, registry).decode(fixedSave)).status, 'ready');
  const absent = await generate(42, { references: [reference, addon] }); assert.ok(absent.state.district!.residents.every(n => n.profession !== '灯匠'));
});
test('运行中追加事件包可存读，但不篡改生成时内容包来源记录', async () => {
  const g = await generate(), source = clone(g.world.generation.contentPacks);
  const next = await loadPacks([...g.registry.contentPacks, await json('extension-event/pack')]);
  const state = clone(g.state);state.meta.packs = clone(next.packs);state.worldInstance!.definition.packs = clone(next.contentPacks);
  const codec = new SaveCodec(next), restored = await codec.decode(await codec.encode(state));assert.equal(restored.status,'ready');
  if(restored.status==='ready')assert.deepEqual(restored.state.worldInstance!.generation.contentPacks, source);
});
test('原TF、事件选择、工作与免费恢复可在生成街区结算，零资源仍能旅行', async () => {
  const g = await generate(), engine = new ActionExecutor(g.registry, g.state);
  act(engine, 'worldgen:action.work.0'); act(engine, 'worldgen:action.rest.0'); act(engine, 'worldgen:action.look.0');
  act(engine, engine.view().actions.find(a => a.definition.id.startsWith('worldgen:action.event.finish.'))!.definition.id);
  const body = engine.view().actions.find(a => a.definition.id === 'aetheria-tf:action.free.ears.cat'); assert.ok(body); act(engine, body.definition.id);
  const s = clone(engine.snapshot()); s.world.locationId = 'worldgen:location.3'; s.world.knownLocationIds.push('worldgen:location.3');
  const clinic = new ActionExecutor(g.registry, s); act(clinic, 'worldgen:action.tf.3.0'); act(clinic, 'worldgen:action.wait.3');
  assert.equal(clinic.snapshot().tfQueues.at(-1)!.status, 'completed');
  const exhausted = clone(g.state); exhausted.player.variables['core:energy'] = 0; exhausted.player.variables['core:money'] = 0;
  const free = new ActionExecutor(g.registry, exhausted); act(free, free.view().actions.find(a => a.definition.group === 'travel')!.definition.id); validateState(free.snapshot(), g.registry);
});
test('无效规则、自由文本、未知字段、不兼容模板与超限输入被拒绝', async () => {
  assert.throws(() => parseRules({ ...rules, locationCount: 1 })); assert.throws(() => parseReference('随便修改世界', registry));
  assert.throws(() => parseReference({ ...reference, executable: 'anything' }, registry));
  const impossible = clone(reference); impossible.templates.filter((t: ReferenceTemplate) => t.kind === 'place').forEach((t: ReferenceTemplate) => { t.requiresTags = ['missing']; });
  await assert.rejects(generate(42, { references: [impossible] })); await assert.rejects(generate(-1));
  const duplicate = clone(reference); duplicate.id = 'another'; await assert.rejects(generate(42, { references: [reference, duplicate] }));
});
test('父模板贡献NPC、TF、已有事件与世界标签实际参与生成', async () => {
  const added = await loadPacks([...registry.contentPacks, await json('generation/addon-content'), await json('extension-event/pack')]);
  const addon = await json('generation/addon-reference'); addon.templates = addon.templates.filter((t: ReferenceTemplate) => t.kind === 'place');
  addon.templates[0].contributes.npcTemplateIds = ['lamplighter:resident.artisan'];
  const ref = clone(reference);
  for (const t of ref.templates.filter((t: ReferenceTemplate) => t.kind === 'environment')) { t.contributes.tags.push('public.lighting'); t.contributes.tfIds.push('aetheria-tf:tf.ears.cat'); t.contributes.eventIds.push('lamp-author:event.lamp'); }
  const g = await generator.generate({ seed: 42, registry: added, rules, references: [ref, addon] }); validateState(g.state, g.registry);
  assert.ok(g.state.district!.residents.some(n => n.profession === '灯匠'));
  assert.ok(g.world.definition.eventPool.includes('lamp-author:event.lamp'));
  for (const l of g.world.definition.locations) { assert.ok(l.tags.includes('public.lighting')); assert.ok(g.registry.actionsAt(l.id).some(a => a.effects.some(e => e.op === 'tf.apply' && e.id === 'aetheria-tf:tf.ears.cat'))); }
});
test('依赖固定地图或缺少免费退出的参考事件不能进入生成池', async () => {
  const bad = await json('extension-event/pack');
  bad.actions.find((a: ActionDef) =>a.id==='lamp-author:action.finish').effects.unshift({op:'location.move',routeId:registry.routes[0].id});
  const loaded = await loadPacks([...registry.contentPacks,bad]);
  const ref = clone(reference);for(const t of ref.templates.filter((t: ReferenceTemplate) =>t.kind==='environment'))t.contributes.eventIds=['lamp-author:event.lamp'];
  assert.throws(()=>parseReference(ref,loaded),/固定地图/);
  const locked = await json('extension-event/pack');locked.actions.find((a: ActionDef) =>a.id==='lamp-author:action.leave').conditions=[{op:'var.compare',id:'core:money',comparison:'gte',value:1}];
  const lockedRegistry = await loadPacks([...registry.contentPacks,locked]);
  assert.throws(()=>parseReference(ref,lockedRegistry),/免费退出/);
});
test('排斥条件、组合要求与环境兼容控制候选池，失败事务不推进模拟', async () => {
  const ref = clone(reference);
  for (const t of ref.templates.filter((t: ReferenceTemplate) => t.kind === 'environment')) if (t.id.endsWith('wet')) t.excludesTags = ['impossible']; else t.requiresTags = ['missing'];
  const g = await generate(7, { references: [ref] }); assert.equal(g.world.definition.name, '雾潮街区');
  const failed = clone(g.state); failed.player.variables['core:energy'] = 0;
  const e = new ActionExecutor(g.registry, failed), before = e.snapshot();
  assert.equal(e.performAction({actionId:'worldgen:action.work.0'},0,'exhausted').ok,false); assert.deepEqual(e.snapshot(),before);
  const impossible = clone(reference); for(const t of impossible.templates.filter((t: ReferenceTemplate) =>t.kind==='place'))t.combination.requiresTemplates=['base.environment.dry'];
  await assert.rejects(generate(42,{references:[impossible]}));
});
test('即使重算存档校验和，断路、错日程、坏身体及来源篡改仍被隔离并保留原文', async () => {
  const g = await generate(), codec = new SaveCodec(g.registry), text = await codec.encode(g.state);
  for (const tamper of [
    (s: typeof g.state) => { s.worldInstance!.agents[0].schedule[0].end = 10; },
    (s: typeof g.state) => { s.district!.residents[0].body.edges.pop(); },
    (s: typeof g.state) => { s.worldInstance!.generation.contentPacks[0].hash = '0'.repeat(64); },
    (s: typeof g.state) => { s.worldInstance!.definition.packs.find(p => p.manifest.id === 'generated/neighborhood')!.routes = []; },
  ]) { const envelope = JSON.parse(text); tamper(envelope.payload.state); envelope.checksum = await hash(envelope.payload); const raw = JSON.stringify(envelope), result = await codec.decode(raw); assert.equal(result.status, 'quarantined'); if (result.status === 'quarantined') assert.equal(result.original, raw); }
  assert.ok(stableJson(g.state).length > 0);
});
