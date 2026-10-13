import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { loadPacks } from '../src/content/loader.ts';
import { selectQuestContent } from '../src/content/quest-schema.ts';
import { WorldGenerator } from '../src/world/generator.ts';
import { ActionExecutor } from '../src/engine/executor.ts';
import { SaveCodec, validateState } from '../src/persistence/codec.ts';
import { advanceClock } from '../src/engine/clock.ts';
import { evaluate } from '../src/engine/conditions.ts';
import type { Id } from '../src/core/types.ts';
import type { QuestBinding, QuestContent } from '../src/core/quest-types.ts';

const json = async (path: string) => JSON.parse(await readFile(new URL('../' + path, import.meta.url), 'utf8'));
const index = await json('content/index.json');
const registry = await loadPacks([...await Promise.all(index.packs.map((p: string) => json('content/' + p))), await json('content/generation/neighborhood-content.json'), await json('content/generation/lexicon-content.json')]);
const rules = await json('content/generation/rules.json'), reference = await json('content/generation/lexicon-reference.json');
const catalog = await json('content/generation/neighborhood-quests.json');
const entries = catalog.entries as { environmentTag: string; content: QuestContent }[];
const generate = (key: string, seed = 42, small = false) => new WorldGenerator().generate({ seed, registry, rules, references: [{ ...reference, templates: reference.templates.filter((t: { kind: string; id: string }) => t.kind !== 'environment' || t.id.endsWith('.' + key)) }], questContent: catalog, ...(small ? { parameters: { locationCount: 5, npcCount: 3 } } : {}) });
let serial = 0;
function act(engine: ActionExecutor, actionId: Id) {
  const result = engine.performAction({ actionId }, engine.snapshot().meta.revision, 'neighborhood-quest-' + ++serial);
  assert.equal(result.ok, true, `${actionId}: ${result.message}`); return result;
}
function atBinding(g: Awaited<ReturnType<typeof generate>>, binding: QuestBinding) {
  const state = structuredClone(g.state);
  state.world.locationId = binding.locationId;
  if (!state.world.knownLocationIds.includes(binding.locationId)) state.world.knownLocationIds.push(binding.locationId);
  if (binding.residentId) {
    const agent = state.worldInstance!.agents.find(a => a.residentId === binding.residentId)!;
    const slot = agent.schedule.find(s => s.locationId === binding.locationId)!;
    advanceClock(state, (slot.start - state.clock.totalMinutes % 1440 + 1440) % 1440);
  }
  return new ActionExecutor(g.registry, state);
}

test('catalog rejects missing/ambiguous environment matches instead of assigning cyber quests', () => {
  assert.throws(() => selectQuestContent(catalog, ['climate.unknown'], x => x));
  assert.throws(() => selectQuestContent(catalog, ['climate.wet', 'climate.dry'], x => x));
  const duplicate = structuredClone(catalog); duplicate.entries.push(duplicate.entries[0]);
  assert.throws(() => selectQuestContent(duplicate, ['climate.wet'], x => x));
  assert.equal(new Set(entries.map(e => e.content.source.mainQuest.goal)).size, 6);
  const uniqueStories = new Set(entries.flatMap(e => Object.values(e.content.execution.sides).map(s => s.prompt)));
  assert.equal(uniqueStories.size, 68);
});

for (const { environmentTag, content } of entries) {
  const key = environmentTag.split('.').at(-1)!;
  test(`${key}: correct tree, 18 sides, stable bindings and small-world fallback`, async () => {
    const g = await generate(key), repeat = await generate(key);
    assert.deepEqual(g.world, repeat.world); assert.deepEqual(g.state, repeat.state);
    const quests = g.world.definition.quests!;
    assert.equal(quests.id, content.id); assert.equal(quests.stages.length, 8); assert.equal(quests.sides.length, 18);
    for (const type of ['main-related', 'character', 'atmosphere']) assert.equal(content.source.sideQuests.filter(s => s.type === type).length, 6);
    assert.ok(g.world.agents.every(a => a.playerRelations!.length >= 1 && a.playerRelations!.length <= 2));
    assert.doesNotMatch(JSON.stringify(quests.journal), /首富|军阀|芯片|财团|霓虹/);
    const small = await generate(key, 23, true);
    assert.equal(small.world.definition.quests!.stages.length, 8);
    for (const side of content.source.sideQuests.filter(s => s.requiresRelation === null)) assert.ok(small.world.definition.quests!.sides.some(b => b.id === side.id));
    validateState(small.state, small.registry);
  });
  test(`${key}: both routes finish without side flags; saved ending uses actual chosen title`, async () => {
    const g = await generate(key);
    for (const path of content.source.mainQuest.paths) {
      let state = structuredClone(g.state);
      state.player.variables['core:energy'] = 0; state.player.variables['core:money'] = 0;
      for (const stage of path.stages) {
        const binding = g.world.definition.quests!.stages.find(b => b.id === stage.id)!;
        state.world.locationId = binding.locationId;
        if (!state.world.knownLocationIds.includes(binding.locationId)) state.world.knownLocationIds.push(binding.locationId);
        const engine = new ActionExecutor(g.registry, state);
        assert.ok(!g.registry.action(binding.entryActionId).conditions.some(c => c.op === 'flag.has' && c.id.startsWith('side:')));
        act(engine, binding.entryActionId);
        const optional = engine.view().actions.find(a => a.definition.id.endsWith('.supported'));
        if (optional) assert.equal(optional.available, false);
        act(engine, `main:action.${stage.id}.b`);
        state = structuredClone(engine.snapshot()); assert.equal(state.player.flags[stage.flag], true);
        const codec = new SaveCodec(g.registry), restored = await codec.decode(await codec.encode(state));
        assert.equal(restored.status, 'ready');
      }
      const entry = state.worldInstance!.definition.quests!.journal.find(j => j.id === path.id)!;
      const active = entry.steps.filter(s => s.conditions.every(c => evaluate(c, state, g.registry).pass)).at(-1)!;
      assert.equal(active.text, '已完成：' + content.execution.stages[path.stages.at(-1)!.id]![1]!.result);
      assert.equal(state.player.flags[`main:flag.ending.${path.id}`], true);
      for (const binding of g.world.definition.quests!.stages) assert.ok(!g.registry.action(binding.entryActionId).conditions.every(c => evaluate(c, state, g.registry).pass));
      assert.deepEqual(state.rng, g.state.rng);
    }
  });
  test(`${key}: all 36 side outcomes work locally, persist memories, and unlock optional solutions`, async () => {
    const g = await generate(key);
    for (const binding of g.world.definition.quests!.sides) {
      const side = content.source.sideQuests.find(s => s.id === binding.id)!;
      for (const option of content.execution.sides[binding.id]!.choices) {
        const engine = atBinding(g, binding), before = engine.snapshot();
        act(engine, binding.entryActionId); const result = act(engine, `side:action.${binding.id}.${option.id}`);
        const state = structuredClone(engine.snapshot()); assert.equal(state.player.flags[side.flag], true); assert.ok(result.text.includes(option.result));
        assert.deepEqual(state.rng, before.rng);
        if (binding.residentId) assert.ok(state.district!.residents.find(r => r.id === binding.residentId)!.memories.includes(`side:memory.${binding.id}.${option.id}`));
        if (side.type === 'atmosphere') { assert.ok(!g.world.definition.quests!.journal.some(j => j.id === side.id)); assert.equal(state.clock.totalMinutes - before.clock.totalMinutes, 1); }
        if (side.type === 'main-related') {
          const stage = content.source.mainQuest.paths.flatMap(p => p.stages).find(s => content.execution.stages[s.id]!.some(c => c.requires.includes(side.flag)))!;
          assert.ok(stage);
          const stageBinding = g.world.definition.quests!.stages.find(b => b.id === stage.id)!;
          state.world.locationId = stageBinding.locationId;
          if (!state.world.knownLocationIds.includes(stageBinding.locationId)) state.world.knownLocationIds.push(stageBinding.locationId);
          for (const required of stage.requires) state.player.flags[required] = true;
          const supported = new ActionExecutor(g.registry, state);
          act(supported, stageBinding.entryActionId); act(supported, `main:action.${stage.id}.supported`);
          assert.equal(supported.snapshot().player.flags[stage.flag], true);
        }
        const codec = new SaveCodec(g.registry); assert.equal((await codec.decode(await codec.encode(engine.snapshot()))).status, 'ready');
      }
    }
  });
}
