import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { gunzipSync } from 'node:zlib';
import { packs } from './helpers.ts';
import { loadPacks } from '../src/content/loader.ts';
import { WorldGenerator } from '../src/world/generator.ts';
import { worldActivityAt } from '../src/world/simulation.ts';
import { parseReference, parseRules } from '../src/world/schema.ts';
import { advanceClock } from '../src/engine/clock.ts';
import { ActionExecutor } from '../src/engine/executor.ts';
import { SaveCodec, validateState } from '../src/persistence/codec.ts';
import type { Id } from '../src/core/types.ts';
const json = async (name: string) => JSON.parse(await readFile(new URL(`../content/${name}.json`, import.meta.url), 'utf8'));
const registry = await loadPacks([...await packs(), await json('district/pack')]);
const rules = await json('generation/rules'), reference = await json('generation/reference');
const generate = (overrides = {}) => new WorldGenerator().generate({ seed: 42, registry, rules, references: [reference], ...overrides });
function act(engine: ActionExecutor, actionId: Id) {
  const result = engine.performAction({ actionId }, engine.snapshot().meta.revision, crypto.randomUUID());
  assert.equal(result.ok, true, `${actionId}: ${result.message}`); return result;
}
test('v0.2 reads an actual published v0.1 snapshot without regenerating its world', async () => {
  const text = gunzipSync(await readFile(new URL('fixtures/worldgen-v0.1.json.gz', import.meta.url))).toString('utf8');
  const original = JSON.parse(text).payload.state;
  const decoded = await new SaveCodec(registry).decode(text);
  assert.equal(decoded.status, 'ready');
  if (decoded.status !== 'ready') return;
  assert.equal(decoded.state.worldInstance!.generation.generatorVersion, '0.1.0');
  assert.deepEqual(decoded.state, original);
  const engine = new ActionExecutor(decoded.registry!, decoded.state);
  act(engine, 'worldgen:action.rest.0');
  assert.equal((await new SaveCodec(decoded.registry!).decode(await new SaveCodec(decoded.registry!).encode(engine.snapshot()))).status, 'ready');
});
test('eligible workplaces get residents before any second assignment; map points stay separated', async () => {
  const g = await generate({ parameters: { locationCount: 20, npcCount: 40 } });
  assert.equal(new Set(g.world.agents.map(a => a.originLocationId)).size, 20);
  for (const [i, a] of g.world.definition.locations.entries()) for (const b of g.world.definition.locations.slice(i + 1)) {
    const pa = g.registry.location(a.id).map, pb = g.registry.location(b.id).map;
    assert.ok(Math.hypot(pa.x - pb.x, pa.y - pb.y) >= 14);
  }
  validateState(g.state, g.registry);
});
test('resident browsing cycles only present identities and never consumes storylets or RNG', async () => {
  const g = await generate({ parameters: { npcCount: 40 } }), state = structuredClone(g.state);
  const place = state.district!.residents[0].locationId;
  state.world.locationId = place; state.world.knownLocationIds = [...new Set([...state.world.knownLocationIds, place])];
  const present = state.district!.residents.filter(n => n.locationId === place);
  assert.ok(present.length > 1);
  const engine = new ActionExecutor(g.registry, state), index = place.split('.').at(-1);
  act(engine, `worldgen:action.meet.${index}`); const first = engine.snapshot().district!.currentResidentId;
  act(engine, `worldgen:action.meet.${index}`); const second = engine.snapshot().district!.currentResidentId;
  assert.notEqual(first, second); assert.ok(present.some(n => n.id === second));
  assert.deepEqual(engine.snapshot().rng, state.rng);
  assert.deepEqual(engine.snapshot().district!.storyletHistory, state.district!.storyletHistory);
  assert.deepEqual(engine.snapshot().clock, state.clock);
  assert.equal(engine.snapshot().activeEventStack.length, 0);
});
test('generated residents remain selectable at 23:59 and through midnight', async () => {
  const g = await generate(), state = structuredClone(g.state);
  advanceClock(state, 1439 - state.clock.totalMinutes);
  const place = state.district!.residents[0].locationId, index = place.split('.').at(-1);
  state.world.locationId = place; state.world.knownLocationIds = [...new Set([...state.world.knownLocationIds, place])];
  const engine = new ActionExecutor(g.registry, state);
  act(engine, `worldgen:action.meet.${index}`);
  const selected = engine.snapshot().district!.currentResidentId; assert.ok(selected);
  act(engine, `worldgen:action.wait.short.${index}`);
  assert.equal(engine.snapshot().district!.currentResidentId, selected);
  validateState(engine.snapshot(), g.registry);
});
test('public arrival information follows saved schedules and remains read-only', async () => {
  const g = await generate(), state = structuredClone(g.state);
  const agent = state.worldInstance!.agents.find(a => a.schedule[0].locationId !== a.originLocationId)!;
  advanceClock(state, 1440 - state.clock.totalMinutes);
  const before = structuredClone(state), info = worldActivityAt(state, agent.originLocationId)!;
  assert.equal(info.nextArrival!.minutes, rules.workStart);
  assert.ok(info.nextArrival!.count > 0);
  assert.deepEqual(state, before);
});
test('activity rules compile to existing effects; costs fail atomically and recovery still works', async () => {
  const ref = structuredClone(reference), source = structuredClone(ref.templates.find(t => t.kind === 'event'));
  source.id = 'test.activity.home'; source.kind = 'activity'; source.environmentTags = [];
  source.requiresTags = ['service.home'];
  source.data = { label: '整理公用工作台', description: '你完成了约定的整理，收到报酬。', minutes: 20, energyChange: -6, moneyChange: 4, healthChange: 0, capabilities: ['grasp'] };
  ref.templates.push(source);
  const g = await generate({ rules: { ...rules, activitiesPerLocation: 1 }, references: [ref] });
  const state = structuredClone(g.state); state.player.variables['core:energy'] = 0;
  const engine = new ActionExecutor(g.registry, state), before = engine.snapshot();
  assert.equal(engine.performAction({ actionId: 'worldgen:action.activity.0.0' }, 0, 'exhausted-activity').ok, false);
  assert.deepEqual(engine.snapshot(), before);
  act(engine, 'worldgen:action.rest.0'); act(engine, 'worldgen:action.activity.0.0');
  assert.equal(engine.snapshot().player.variables['core:money'], state.player.variables['core:money'] + 4);
  assert.equal(engine.snapshot().clock.totalMinutes, state.clock.totalMinutes + 50);
});
test('multiple local storylets are distinct and keep their real free exits', async () => {
  const ref = structuredClone(reference);
  for (const t of reference.templates.filter(t => t.kind === 'event')) { const extra = structuredClone(t); extra.id += '.extra'; ref.templates.push(extra); }
  const g = await generate({ rules: { ...rules, eventsPerLocation: 2 }, references: [ref] });
  const local = g.registry.storylets.filter(s => s.locationId === 'worldgen:location.0'); assert.equal(local.length, 2);
  const engine = new ActionExecutor(g.registry, g.state), seen = new Set<string>();
  for (let i = 0; i < 2; i++) {
    act(engine, 'worldgen:action.look.0');
    const active = engine.snapshot().eventInstances.at(-1)!; seen.add(active.definitionId);
    const exit = engine.view().actions.find(a => a.definition.id.startsWith('worldgen:action.event.leave.'))!;
    assert.equal(exit.available, true); act(engine, exit.definition.id);
    act(engine, 'worldgen:action.wait.0');
  }
  assert.equal(seen.size, 2);
});
test('new author fields reject unknown body capabilities, invalid costs and unbounded counts', () => {
  assert.throws(() => parseRules({ ...rules, activitiesPerLocation: 100 }));
  const ref = structuredClone(reference), activity = structuredClone(ref.templates.find(t => t.kind === 'event'));
  activity.kind = 'activity'; activity.id = 'test.activity.invalid';
  activity.data = { label: '测试', description: '中性接口测试。', minutes: 20, energyChange: -1000, moneyChange: 0, healthChange: 0, capabilities: ['unknown'] };
  ref.templates.push(activity); assert.throws(() => parseReference(ref, registry));
  activity.data.energyChange = -6; assert.throws(() => parseReference(ref, registry));
});
