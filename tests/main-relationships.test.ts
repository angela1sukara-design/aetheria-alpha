import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { gunzipSync } from 'node:zlib';
import { loadPacks } from '../src/content/loader.ts';
import { WorldGenerator } from '../src/world/generator.ts';
import { generateMainRelationships } from '../src/world/relationships.ts';
import { SaveCodec, validateState } from '../src/persistence/codec.ts';
import { ActionExecutor } from '../src/engine/executor.ts';
import { advanceClock } from '../src/engine/clock.ts';
import type { MainRelationshipTree } from '../src/world/types.ts';

const json = async (p: string) => JSON.parse(await readFile(new URL('../' + p, import.meta.url), 'utf8'));
const index = await json('content/index.json');
const registry = await loadPacks([...await Promise.all(index.packs.map((p: string) => json('content/' + p))),
  ...await Promise.all(['neighborhood-content','lexicon-content','world-profile-content'].map(p => json('content/generation/' + p + '.json')))]);
const rules = await json('content/generation/rules.json'), reference = await json('content/generation/lexicon-reference.json'), catalog = await json('content/generation/world-profiles.json');
const generate = (seed = 42, npcCount = 9, locationCount = 7) => new WorldGenerator().generate({ seed, registry, rules, references: [reference], worldProfiles: catalog, worldTag: 'worlds:setting.cyberpunk', parameters: { npcCount, locationCount } });

test('main goal is the root; paths cover all residents and real stages, regardless of input order', async () => {
  const g = await generate(), again = await generate();
  assert.deepEqual(g.state, again.state);
  const def = g.world.definition, tree = def.relationshipTree!, content = catalog.profiles.find((p: { tag: string }) => p.tag === def.setting!.tag).quests;
  assert.equal(tree.mainQuestId, content.source.mainQuest.id); assert.equal(tree.goal, content.source.mainQuest.goal);
  assert.equal(tree.paths.length, 2); assert.equal(tree.roles.length, 8); assert.equal(tree.sideLinks.length, 18);
  assert.equal(new Set(tree.paths.flatMap(p => p.memberIds)).size, 9);
  assert.equal(tree.sideLinks.filter(s => s.stageIds.length && !def.quests!.sides.find(b => b.id === s.sideId)!.residentId).length, 6);
  const reversedAgents = structuredClone(g.world.agents).reverse(), reversedContent = structuredClone(content);
  reversedContent.source.mainQuest.paths.reverse();
  const rebuilt = generateMainRelationships(reversedContent, 42, def, reversedAgents, def.quests!.stages);
  assert.deepEqual({ ...tree, sideLinks: [] }, rebuilt);
  for (const agent of g.world.agents) assert.deepEqual(agent.relationships, reversedAgents.find(a => a.residentId === agent.residentId)!.relationships);
  const before = structuredClone(g.state); advanceClock(g.state, 1440 * 2);
  assert.deepEqual(g.state.worldInstance!.definition.relationshipTree, before.worldInstance!.definition.relationshipTree);
  assert.deepEqual(g.state.worldInstance!.agents.map(a => a.relationships), before.worldInstance!.agents.map(a => a.relationships));
  assert.deepEqual(g.state.rng, before.rng);
});

test('seed changes regenerate contacts and edges from the same NPC pool; names are never hard-coded', async () => {
  const g = await generate(), def = g.world.definition;
  const content = catalog.profiles.find((p: { tag: string }) => p.tag === def.setting!.tag).quests;
  const variations = [7,42,100,500].map(seed => {
    const agents = structuredClone(g.world.agents);
    const tree = generateMainRelationships(content, seed, def, agents, def.quests!.stages);
    return { tree, edges: agents.map(a => a.relationships) };
  });
  assert.equal(new Set(variations.map(v => JSON.stringify(v))).size, variations.length);
  for (const variation of variations) for (const path of variation.tree.paths) assert.ok(path.memberIds.every(id => g.world.agents.some(a => a.residentId === id)));
  // Renaming every generated person has no effect on the relationship selection rules.
  assert.ok(variations.every(v => !JSON.stringify(v).includes('莱娜') && !JSON.stringify(v).includes('凯恩')));
  const otherMain = structuredClone(content); otherMain.source.mainQuest.id = 'main.other_world';
  const themed = generateMainRelationships(otherMain, 42, def, structuredClone(g.world.agents), def.quests!.stages);
  assert.notDeepEqual(themed.paths.map(p => p.memberIds), variations[1]!.tree.paths.map(p => p.memberIds));
});

test('changing main service demands changes circle membership, rather than merely renaming a ring', async () => {
  const g = await generate(7, 40, 20), def = g.world.definition;
  const content = structuredClone(catalog.profiles.find((p: { tag: string }) => p.tag === def.setting!.tag).quests);
  const agents = structuredClone(g.world.agents), sourceTree = def.relationshipTree!;
  // Swap the two complete route demands while retaining their IDs. Their relevant workers must follow.
  const left = content.source.mainQuest.paths[0], right = content.source.mainQuest.paths[1];
  const leftServices = left.stages.map((s: { locationType: string }) => s.locationType);
  left.stages.forEach((s: { locationType: string }, i: number) => s.locationType = right.stages[i].locationType);
  right.stages.forEach((s: { locationType: string }, i: number) => s.locationType = leftServices[i]);
  const changed = generateMainRelationships(content, 7, def, agents, def.quests!.stages);
  assert.notDeepEqual(changed.paths.map(p => p.memberIds), sourceTree.paths.map(p => p.memberIds));
  assert.ok(agents.some(a => (a.relationships?.length ?? 0) !== 2));
});

for (const [population, size] of [[3,5],[9,7],[40,20]]) test(`${population} residents: bounded, connected circles; no absent contact blocks the main quest`, async () => {
  for (const seed of [7,42,100]) {
    const g = await generate(seed, population, size), tree = g.world.definition.relationshipTree!;
    validateState(g.state, g.registry);
    assert.ok(tree.paths.every(p => p.memberIds.includes(p.coordinatorId)));
    for (const agent of g.world.agents) {
      assert.ok(agent.relationships!.length >= 1 && agent.relationships!.length <= 4);
      assert.ok(agent.playerRelations!.length >= 1 && agent.playerRelations!.length <= 2);
    }
    assert.ok(g.world.definition.quests!.sides.length >= 12);
    for (const binding of g.world.definition.quests!.stages) {
      assert.equal(binding.residentId, null);
      assert.ok(!g.registry.action(binding.entryActionId).conditions.some(c => c.op === 'resident.present'));
    }
    for (const role of tree.roles.filter(r => r.residentId)) assert.ok(g.world.agents.find(a => a.residentId === role.residentId)!.schedule.some(s => s.locationId === role.locationId));
    const state = structuredClone(g.state), first = g.world.definition.quests!.stages.find(s => s.id === 'resource_s1')!;
    state.world.locationId = first.locationId; state.world.knownLocationIds = [...new Set([...state.world.knownLocationIds, first.locationId])];
    state.player.variables['core:energy'] = 0; state.player.variables['core:money'] = 0;
    const engine = new ActionExecutor(g.registry, state);
    assert.equal(engine.performAction({ actionId: first.entryActionId }, 0, 'enter-' + seed).ok, true);
    assert.equal(engine.performAction({ actionId: 'main:action.resource_s1.b' }, 1, 'finish-' + seed).ok, true);
    assert.equal(engine.snapshot().player.flags[first.flag], true);
  }
});

test('three route roots work with three residents; unavailable workplace contacts remain public desks', async () => {
  const g = await generate(42, 3, 5), def = g.world.definition;
  const content = structuredClone(catalog.profiles[0].quests), bindings = structuredClone(def.quests!.stages);
  const extra = structuredClone(content.source.mainQuest.paths[0]); extra.id = 'path.third'; extra.style = '第三条路线';
  for (const stage of extra.stages) {
    const oldId = stage.id; stage.id = 'third_' + oldId; stage.locationType = 'home';
    bindings.push({ ...bindings.find(b => b.id === oldId)!, id: stage.id });
  }
  content.source.mainQuest.paths.push(extra);
  const agents = structuredClone(g.world.agents), tree = generateMainRelationships(content, 42, def, agents, bindings);
  assert.equal(tree.paths.length, 3); assert.equal(new Set(tree.paths.map(p => p.coordinatorId)).size, 3);
  assert.equal(tree.roles.length, 12); assert.ok(agents.every(a => a.relationships!.length >= 1));
  // With all work schedules placed at home, clinic/workshop contacts are explicitly unfilled.
  const home = def.locations.find(l => l.service === 'home')!.id;
  for (const agent of agents) { agent.originLocationId = home; for (const slot of agent.schedule) slot.locationId = home; }
  const sparse = generateMainRelationships(content, 42, def, agents, bindings);
  assert.ok(sparse.roles.some(r => r.residentId === null));
  for (const role of sparse.roles.filter(r => r.residentId === null)) assert.equal(role.locationId, bindings.find(b => b.id === role.stageId)!.locationId);
});

test('invalid hierarchy, role, side links and rival edges are rejected without repairing or rerolling', async () => {
  const g = await generate();
  const invalid = (mutate: (tree: MainRelationshipTree, state: typeof g.state) => void) => {
    const state = structuredClone(g.state); mutate(state.worldInstance!.definition.relationshipTree!, state);
    const unchanged = structuredClone(state); assert.throws(() => validateState(state, g.registry)); assert.deepEqual(state, unchanged);
  };
  invalid(t => t.mainQuestId = 'main.unrelated');
  invalid(t => t.goal = '伪造主线');
  invalid(t => t.paths[0]!.memberIds.push(t.paths[1]!.memberIds[0]!));
  invalid(t => t.paths[0]!.coordinatorId = t.paths[1]!.coordinatorId);
  invalid(t => t.paths[0]!.stageIds.reverse());
  invalid(t => t.roles[0]!.residentId = 'missing');
  invalid(t => t.roles[0]!.locationId = g.world.definition.locations.find(l => l.service === 'clinic')!.id);
  invalid(t => t.sideLinks.find(s => s.sideId === 'side.support_1')!.stageIds = ['resource_s3']);
  invalid((_, state) => { delete state.worldInstance!.definition.relationshipTree; });
  invalid((t, state) => {
    const agent = state.worldInstance!.agents.find(a => a.relationships!.some(e => e.kind === 'rival'))!;
    const edge = agent.relationships!.find(e => e.kind === 'rival')!; edge.kind = 'ally';
    state.worldInstance!.agents.find(a => a.residentId === edge.otherResidentId)!.relationships!.find(e => e.otherResidentId === agent.residentId)!.kind = 'ally';
  });
  invalid((_, state) => {
    const agent = state.worldInstance!.agents[0]!; agent.relationships = [];
    for (const peer of state.worldInstance!.agents) peer.relationships = peer.relationships!.filter(e => e.otherResidentId !== agent.residentId);
  });
  const codec = new SaveCodec(g.registry), loaded = await codec.decode(await codec.encode(g.state));
  assert.equal(loaded.status, 'ready'); if (loaded.status === 'ready') assert.deepEqual(loaded.state, g.state);
});

test('real v0.5 world saves restore exactly; no new relationship tree is retroactively generated', async () => {
  const text = gunzipSync(await readFile(new URL('fixtures/worldgen-v0.5-quests.json.gz', import.meta.url))).toString('utf8');
  const original = JSON.parse(text).payload.state, decoded = await new SaveCodec(registry).decode(text);
  assert.equal(original.worldInstance.generation.generatorVersion, '0.5.0');
  assert.equal(decoded.status, 'ready'); if (decoded.status !== 'ready') return;
  assert.deepEqual(decoded.state, original); assert.equal(decoded.state.worldInstance!.definition.relationshipTree, undefined);
  const engine = new ActionExecutor(decoded.registry!, decoded.state);
  assert.equal(engine.performAction({ actionId: 'worldgen:action.rest.0' }, 0, 'old-world-rest').ok, true);
  const codec = new SaveCodec(decoded.registry!); assert.equal((await codec.decode(await codec.encode(engine.snapshot()))).status, 'ready');
});
