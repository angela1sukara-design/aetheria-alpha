import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { loadPacks } from '../src/content/loader.ts';
import { parseQuestContent } from '../src/content/quest-schema.ts';
import { WorldGenerator } from '../src/world/generator.ts';
import { ActionExecutor } from '../src/engine/executor.ts';
import { SaveCodec, validateState } from '../src/persistence/codec.ts';
import { advanceClock } from '../src/engine/clock.ts';
import { evaluate } from '../src/engine/conditions.ts';
import type { Id } from '../src/core/types.ts';
import type { QuestBinding } from '../src/core/quest-types.ts';

const json = async (file: string) => JSON.parse(await readFile(new URL('../' + file, import.meta.url), 'utf8'));
const index = await json('content/index.json');
const registry = await loadPacks([...await Promise.all(index.packs.map((file: string) => json('content/' + file.replace('./', '')))), await json('content/generation/neighborhood-content.json'), await json('content/generation/lexicon-content.json')]);
const rules = await json('content/generation/rules.json');
const reference = await json('content/generation/lexicon-reference.json');
const content = parseQuestContent(await json('content/generation/cyber-apex.json'));
const generate = (seed = 42, parameters?: { locationCount?: number; npcCount?: number }) => new WorldGenerator().generate({ seed, registry, rules, references: [reference], questContent: content, parameters });
let request = 0;
function act(engine: ActionExecutor, actionId: Id) {
  const result = engine.performAction({ actionId }, engine.snapshot().meta.revision, 'quest-test-' + (++request));
  assert.equal(result.ok, true, `${actionId}: ${result.code}: ${result.message}`); return result;
}
function move(engine: ActionExecutor, destination: Id) {
  const routes = engine.registry.routes, visited = new Set<Id>(), queue = [{ locationId: engine.snapshot().world.locationId, path: [] as Id[] }];
  while (queue.length) {
    const next = queue.shift()!;
    if (next.locationId === destination) {
      for (const routeId of next.path) act(engine, engine.view().actions.find(a => a.definition.effects.some(e => e.op === 'location.move' && e.routeId === routeId))!.definition.id);
      return;
    }
    if (visited.has(next.locationId)) continue; visited.add(next.locationId);
    for (const route of routes.filter(r => r.from === next.locationId)) queue.push({ locationId: route.to, path: [...next.path, route.id] });
  }
  assert.fail('unreachable quest location');
}
function rendezvous(engine: ActionExecutor, binding: QuestBinding) {
  move(engine, binding.locationId);
  if (!binding.residentId) return;
  const state = engine.snapshot(), agent = state.worldInstance!.agents.find(a => a.residentId === binding.residentId)!;
  const time = state.clock.totalMinutes % 1440;
  if (agent.schedule.some(s => s.locationId === binding.locationId && time >= s.start && time < s.end)) return;
  const slot = agent.schedule.find(s => s.locationId === binding.locationId)!;
  let remaining = (slot.start - time + 1440) % 1440;
  const placeIndex = binding.locationId.split('.').at(-1);
  while (remaining >= 30) { act(engine, `worldgen:action.rest.${placeIndex}`); remaining -= 30; }
  while (remaining > 0) { act(engine, `worldgen:action.wait.short.${placeIndex}`); remaining -= 5; }
}
function choice(engine: ActionExecutor, binding: QuestBinding, key: string) {
  act(engine, binding.entryActionId);
  return act(engine, `${binding.eventId.split(':')[0]}:action.${binding.id}.${key}`);
}

test('same seed reproduces bindings, relations and packs; authoring prose is never evaluated', async () => {
  const a = await generate(), b = await generate();
  assert.deepEqual(a.world, b.world); assert.deepEqual(a.state, b.state);
  assert.equal(a.world.definition.quests!.stages.length, 8);
  assert.equal(a.world.definition.quests!.sides.length, 7);
  for (const agent of a.world.agents) assert.ok(agent.playerRelations!.length >= 1 && agent.playerRelations!.length <= 2);
  const relations = new Set(a.world.agents.flatMap(a => a.playerRelations!));
  for (const relation of content.source.relationRules.types) assert.ok(relations.has(relation));
  for (const binding of a.world.definition.quests!.stages) {
    const stage = content.source.mainQuest.paths.flatMap(p => p.stages).find(s => s.id === binding.id)!;
    assert.equal(a.world.definition.locations.find(l => l.id === binding.locationId)!.service, stage.locationType);
    assert.ok(!a.registry.action(binding.entryActionId).conditions.some(c => c.op === 'flag.has' && c.id.startsWith('side:')));
  }
  assert.equal(a.world.definition.quests!.stages.find(s => s.id === 'warlord_s4')!.locationId, a.world.definition.startLocationId);
  validateState(a.state, a.registry);
});

for (const [pathId, choices] of [['path.capital', ['small_order', 'standard', 'alliance', 'charter']], ['path.warlord', ['handover', 'limited', 'drill', 'alliance']]] as const) {
  test(`${pathId} reaches the common apex without any side quest or resources`, async () => {
    const generated = await generate(), state = structuredClone(generated.state);
    state.player.variables['core:energy'] = 0; state.player.variables['core:money'] = 0;
    let engine = new ActionExecutor(generated.registry, state);
    const beforeRng = engine.snapshot().rng;
    const path = content.source.mainQuest.paths.find(p => p.id === pathId)!;
    for (const [index, stage] of path.stages.entries()) {
      const binding = generated.world.definition.quests!.stages.find(s => s.id === stage.id)!;
      move(engine, binding.locationId); choice(engine, binding, choices[index]!);
      assert.equal(engine.snapshot().player.flags[stage.flag], true);
      const codec = new SaveCodec(engine.registry), restored = await codec.decode(await codec.encode(engine.snapshot()));
      assert.equal(restored.status, 'ready'); if (restored.status !== 'ready') return;
      engine = new ActionExecutor(restored.registry!, restored.state);
    }
    assert.deepEqual(engine.snapshot().rng, beforeRng);
    assert.equal(engine.snapshot().player.flags[`main:flag.ending.${pathId}`], true);
    for (const side of content.source.sideQuests) assert.equal(engine.snapshot().player.flags[side.flag], false);
    for (const binding of generated.world.definition.quests!.stages) {
      move(engine, binding.locationId);
      assert.equal(engine.performAction({ actionId: binding.entryActionId }, engine.snapshot().meta.revision, 'post-apex-' + binding.id).ok, false);
    }
  });
}

test('free exit resumes from the same location; exhausted paid choice rolls back atomically', async () => {
  const g = await generate(), state = structuredClone(g.state); state.player.variables['core:energy'] = 0;
  const engine = new ActionExecutor(g.registry, state), b = g.world.definition.quests!.stages.find(s => s.id === 'capital_s1')!;
  move(engine, b.locationId); act(engine, b.entryActionId);
  const before = engine.snapshot();
  const failed = engine.performAction({ actionId: 'main:action.capital_s1.sample' }, before.meta.revision, 'unaffordable');
  assert.equal(failed.ok, false); assert.deepEqual(engine.snapshot(), before);
  act(engine, 'main:action.capital_s1.leave'); assert.equal(engine.snapshot().player.flags[b.flag], false);
  const codec = new SaveCodec(g.registry), restored = await codec.decode(await codec.encode(engine.snapshot()));
  assert.equal(restored.status, 'ready');
  choice(engine, b, 'consignment'); assert.equal(engine.snapshot().player.flags[b.flag], true);
  const completed = engine.snapshot();
  assert.equal(engine.performAction({ actionId: 'main:action.capital_s1.consignment' }, completed.meta.revision, 'repeat-completion').ok, false);
  assert.deepEqual(engine.snapshot(), completed);
});

test('bound residents must be present; side options and memories persist across days and restore', async () => {
  const g = await generate(), engine = new ActionExecutor(g.registry, g.state);
  const b = g.world.definition.quests!.sides.find(s => s.id === 'side.batch_verification')!;
  assert.ok(b?.residentId);
  const absent = structuredClone(g.state);
  absent.world.locationId = b.locationId; absent.world.knownLocationIds.push(b.locationId);
  const agent = absent.worldInstance!.agents.find(a => a.residentId === b.residentId)!;
  const away = agent.schedule.find(s => s.locationId !== b.locationId)!;
  advanceClock(absent, (away.start - absent.clock.totalMinutes % 1440 + 1440) % 1440);
  const blocked = new ActionExecutor(g.registry, absent), blockedBefore = blocked.snapshot();
  assert.equal(blocked.performAction({ actionId: b.entryActionId }, blockedBefore.meta.revision, 'npc-away').ok, false);
  assert.deepEqual(blocked.snapshot(), blockedBefore);
  rendezvous(engine, b); choice(engine, b, 'sort');
  const resident = engine.snapshot().district!.residents.find(r => r.id === b.residentId)!;
  assert.ok(resident.memories.includes('side:memory.side.batch_verification.sort'));
  assert.ok(!resident.memories.includes('side:memory.side.batch_verification.label'));
  assert.equal(engine.snapshot().player.flags['side:flag.batch_verified'], true);
  const first = g.world.definition.quests!.stages.find(s => s.id === 'capital_s1')!;
  move(engine, first.locationId); choice(engine, first, 'small_order');
  const second = g.world.definition.quests!.stages.find(s => s.id === 'capital_s2')!;
  move(engine, second.locationId); act(engine, second.entryActionId);
  assert.ok(engine.view().actions.find(a => a.definition.id === 'main:action.capital_s2.verified')!.available);
  act(engine, 'main:action.capital_s2.verified');
  const codec = new SaveCodec(g.registry), saved = await codec.encode(engine.snapshot());
  const freshOtherSeed = await generate(7), restored = await new SaveCodec(freshOtherSeed.registry).decode(saved);
  assert.equal(restored.status, 'ready'); if (restored.status !== 'ready') return;
  assert.deepEqual(restored.state, engine.snapshot());
  assert.deepEqual(restored.state.worldInstance!.definition.quests, g.world.definition.quests);
  assert.throws(() => { const bad = structuredClone(restored.state); bad.district!.residents.find(r => r.id !== b.residentId)!.memories.push('side:memory.side.batch_verification.sort'); validateState(bad, restored.registry!); });
});

test('parallel routes show independent next steps; optional flags cannot bypass a stage', async () => {
  const g = await generate(), engine = new ActionExecutor(g.registry, g.state), quests = g.world.definition.quests!;
  for (const [id, key] of [['capital_s1', 'small_order'], ['warlord_s1', 'handover']]) {
    const binding = quests.stages.find(s => s.id === id)!; move(engine, binding.locationId); choice(engine, binding, key);
  }
  const messages = quests.journal.filter(j => j.id.startsWith('path.')).map(j => [...j.steps].reverse().find(s => s.conditions.every(c => evaluate(c, engine.snapshot(), g.registry).pass))!.text);
  assert.ok(messages[0]!.includes('工坊')); assert.ok(messages[1]!.includes('诊所'));
  const second = quests.stages.find(s => s.id === 'capital_s2')!; move(engine, second.locationId); act(engine, second.entryActionId);
  assert.equal(engine.view().actions.find(a => a.definition.id === 'main:action.capital_s2.verified')!.available, false);
  assert.equal(engine.view().actions.find(a => a.definition.id === 'main:action.capital_s2.standard')!.available, true);
});

test('small worlds may omit unmatched relationship quests and always retain both main routes', async () => {
  const g = await generate(23, { locationCount: 5, npcCount: 3 });
  assert.equal(g.world.definition.quests!.stages.length, 8);
  assert.ok(g.world.agents.every(a => a.playerRelations!.length <= 2));
  validateState(g.state, g.registry);
  const decoded = await new SaveCodec(g.registry).decode(await new SaveCodec(g.registry).encode(g.state)); assert.equal(decoded.status, 'ready');
});

test('every local side branch records its actual choice; atmosphere stays out of Journal', async () => {
  const g = await generate();
  for (const binding of g.world.definition.quests!.sides) {
    for (const selected of content.execution.sides[binding.id]!.choices) {
      const engine = new ActionExecutor(g.registry, g.state);
      rendezvous(engine, binding); const rng = engine.snapshot().rng;
      const result = choice(engine, binding, selected.id);
      assert.equal(engine.snapshot().player.flags[binding.flag], true);
      assert.deepEqual(engine.snapshot().rng, rng);
      assert.ok(result.text.includes(selected.result));
      if (binding.residentId) assert.ok(engine.snapshot().district!.residents.find(r => r.id === binding.residentId)!.memories.includes(`side:memory.${binding.id}.${selected.id}`));
      else assert.ok(!g.world.definition.quests!.journal.some(j => j.id === binding.id));
      const codec = new SaveCodec(g.registry), restored = await codec.decode(await codec.encode(engine.snapshot()));
      assert.equal(restored.status, 'ready');
      const before = engine.snapshot();
      assert.equal(engine.performAction({ actionId: binding.entryActionId }, before.meta.revision, 'repeat-' + binding.id + '-' + selected.id).ok, false);
      assert.deepEqual(engine.snapshot(), before);
    }
  }
});

test('a resident can leave at the schedule boundary after recording the shared action', async () => {
  const g = await generate(), binding = g.world.definition.quests!.sides.find(b => b.id === 'side.batch_verification')!;
  const state = structuredClone(g.state), agent = state.worldInstance!.agents.find(a => a.residentId === binding.residentId)!;
  state.world.locationId = binding.locationId; state.world.knownLocationIds.push(binding.locationId);
  const shift = agent.schedule.find(s => s.locationId === binding.locationId)!;
  advanceClock(state, (shift.end - 1 - state.clock.totalMinutes % 1440 + 1440) % 1440);
  const engine = new ActionExecutor(g.registry, state); choice(engine, binding, 'sort');
  assert.notEqual(engine.snapshot().district!.residents.find(r => r.id === binding.residentId)!.locationId, binding.locationId);
  validateState(engine.snapshot(), g.registry);
});

test('imported rules can reorder services while keeping the final command stage at the starting home', async () => {
  const g = await new WorldGenerator().generate({ seed: 42, registry, rules: { ...rules, requiredServices: ['market', 'clinic', 'commons', 'home', 'workshop'] }, references: [reference], questContent: content });
  assert.equal(g.world.definition.locations.find(l => l.id === g.state.world.locationId)!.service, 'home');
  assert.equal(g.world.definition.quests!.stages.find(b => b.id === 'warlord_s4')!.locationId, g.state.world.locationId);
  validateState(g.state, g.registry);
});

test('invalid author data, missing participant context and forged saved bindings are rejected', async () => {
  const bad = structuredClone(content); bad.source.mainQuest.paths[0]!.stages[1]!.requires.push('side:flag.batch_verified');
  assert.throws(() => parseQuestContent(bad));
  const unknown = structuredClone(content); unknown.execution.stages.capital_s2![2]!.requires = ['side:flag.missing'];
  assert.throws(() => parseQuestContent(unknown));
  const g = await generate(), saved = structuredClone(g.state);
  saved.worldInstance!.definition.quests!.stages[0]!.locationId = 'worldgen:location.0';
  assert.throws(() => validateState(saved, g.registry));
  const packs = structuredClone(g.world.definition.packs), side = packs.find(p => p.manifest.namespace === 'side')!;
  side.events.find(e => e.residentIds?.length)!.residentIds = [];
  await assert.rejects(() => loadPacks(packs));
});
