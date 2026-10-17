import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { loadPacks } from '../src/content/loader.ts';
import { parsePack } from '../src/content/schema.ts';
import { ActionExecutor } from '../src/engine/executor.ts';
import { createGameState } from '../src/engine/state.ts';
import { encounter } from '../src/engine/district.ts';
import { effectivePart } from '../src/engine/query.ts';
import { SaveCodec, validateState } from '../src/persistence/codec.ts';
import { WorldGenerator } from '../src/world/generator.ts';
import { validateBody } from '../src/engine/body.ts';
import type { ContentPack, GameState, Id } from '../src/core/types.ts';

const json = async (path: string) => JSON.parse(await readFile(new URL('../' + path, import.meta.url), 'utf8'));
const index = await json('content/index.json');
const inputs: ContentPack[] = await Promise.all(index.packs.map((p: string) => json('content/' + p)));
const originalStory = inputs.find(p => p.manifest.id === 'aetheria/story-replay')!;
let serial = 0;
function act(e: ActionExecutor, id: Id, request = 'story-test-' + ++serial) {
  const result = e.performAction({ actionId: id }, e.snapshot().meta.revision, request);
  assert.equal(result.ok, true, `${id}: ${result.message}`); return result;
}
const run = (e: ActionExecutor, name: string, action: string) => act(e, `stories:action.${name}.${action}`);
const current = (e: ActionExecutor) => e.snapshot().eventInstances.find(n => n.status === 'active')!;

async function fixture(materialKey: 'M1' | 'M5' = 'M1', seed = 42, location: Id = 'district:location.canal') {
  const packs = structuredClone(inputs);
  const profile = packs.flatMap(p => p.locationProfiles ?? []).find(p => p.locationId === 'district:location.canal')!;
  profile.tags = [...new Set([...(profile.tags ?? []), 'foundation:setting.wet' as Id])];
  const story = packs.find(p => p.manifest.id === 'aetheria/story-replay')!;
  story.environmentEnemyRules = [{ id: 'stories:env.fixture', enemyId: 'district:enemy.gel', requiresTags: ['foundation:setting.wet'], weight: 1, priority: 100, name: materialKey === 'M1' ? '渠中黏液生物' : '渠中黑胶生物', speciesKind: 'slime', defeatCombo: { autoCombo: true, materials: [materialKey], parts: ['小腿'], plays: ['G2'], tfs: materialKey === 'M5' ? ['黑胶化'] : ['黏液化'] } }];
  const registry = await loadPacks(packs);
  const state = createGameState(registry, seed);
  state.world.locationId = location; state.world.knownLocationIds.push(location);
  return { registry, state, packs };
}
function legMaterial(s: GameState, r: Awaited<ReturnType<typeof loadPacks>>) {
  return effectivePart(s.player.body!.parts.find(p => p.instanceId === 'leg.left')!, r).materialId;
}

test('same story reads real material and resource attributes; rendering and save never redraw bindings', async () => {
  const results: string[] = [];
  for (const materialKey of ['M1', 'M5'] as const) {
    const { registry, state } = await fixture(materialKey);
    state.player.variables['core:stamina'] = materialKey === 'M1' ? 70 : 0;
    const e = new ActionExecutor(registry, state);
    run(e, 'mire-trap', 'start');
    const first = e.view().sceneText;
    assert.match(first, materialKey === 'M1' ? /渠中黏液生物/ : /疲乏的双腿/);
    assert.equal(current(e).context!.enemyRuleId, 'stories:env.fixture');
    assert.equal(current(e).context!.fills.materialKey, materialKey);
    const before = e.snapshot(); for (let i = 0; i < 10; i++) e.view(); assert.deepEqual(e.snapshot(), before);
    assert.equal(e.view().actions.find(a => a.definition.id === 'stories:action.mire-trap.pull')!.available, materialKey === 'M1');
    run(e, 'mire-trap', 'sink'); run(e, 'mire-trap', 'endure');
    assert.equal(current(e).nodeId, 'defeat');
    assert.equal(legMaterial(e.snapshot(), registry), materialKey === 'M1' ? 'progression:material.slime-mucus' : 'progression:material.living-latex');
    assert.equal(e.snapshot().player.flags['progression:flag.aftermath.mark'], true);
    assert.equal(e.snapshot().district!.profile.adultOptional, false);
    assert.doesNotMatch(e.view().sceneText, /\{[a-zA-Z]+\}/);
    validateState(e.snapshot(), registry);
    const codec = new SaveCodec(registry), loaded = await codec.decode(await codec.encode(e.snapshot()));
    assert.equal(loaded.status, 'ready'); if (loaded.status !== 'ready') return;
    const resumed = new ActionExecutor(registry, loaded.state);
    assert.deepEqual(resumed.view(), e.view()); assert.deepEqual(resumed.snapshot().rng, e.snapshot().rng);
    results.push(e.view().sceneText);
  }
  assert.notEqual(results[0], results[1]);
});

test('skipping withdrawal preserves exactly the same time, coating, flags and next decision as reading it', async () => {
  const { registry, state } = await fixture('M5');
  state.player.variables['core:stamina'] = 0; state.player.variables['core:energy'] = 0;
  const e = new ActionExecutor(registry, state); run(e, 'mire-trap', 'start'); run(e, 'mire-trap', 'sink'); run(e, 'mire-trap', 'endure');
  const ordinary = new ActionExecutor(registry, e.snapshot()), skipped = new ActionExecutor(registry, e.snapshot());
  run(ordinary, 'mire-trap', 'withdraw'); run(skipped, 'mire-trap', 'skip');
  for (const key of ['clock', 'player', 'rng', 'tfQueues', 'eventInstances'] as const) assert.deepEqual(skipped.snapshot()[key], ordinary.snapshot()[key]);
  assert.equal(current(skipped).nodeId, 'edge');
  assert.equal(skipped.snapshot().player.flags['progression:flag.aftermath.mark'], true);
  assert.ok(skipped.view().actions.some(a => a.available && a.definition.id === 'stories:action.mire-trap.leave'));
  assert.equal(skipped.view().actions.some(a => a.definition.id === 'stories:action.mire-trap.skip'), false);
  run(skipped, 'mire-trap', 'leave'); assert.equal(skipped.snapshot().activeEventStack.length, 0);
  assert.equal(legMaterial(skipped.snapshot(), registry), 'progression:material.living-latex');
  validateState(skipped.snapshot(), registry);
});

test('zero-resource failure remains playable; cleaning changes the real body and survives history archiving', async () => {
  const { registry, state } = await fixture(); state.player.variables['core:stamina'] = 0; state.player.variables['core:energy'] = 0;
  const e = new ActionExecutor(registry, state); run(e, 'mire-trap', 'start'); run(e, 'mire-trap', 'sink'); run(e, 'mire-trap', 'endure'); run(e, 'mire-trap', 'skip');
  assert.equal(legMaterial(e.snapshot(),registry),'progression:material.slime-mucus');
  assert.equal(e.view().actions.find(a => a.definition.id === 'stories:action.mire-trap.clean')!.available, true);
  run(e, 'mire-trap', 'clean');
  assert.notEqual(legMaterial(e.snapshot(), registry), 'progression:material.slime-mucus');
  assert.equal(e.snapshot().player.flags['progression:flag.aftermath.mark'], false);
  for (let i = 0; i < 520; i++) act(e, 'district:action.preference.off');
  validateState(e.snapshot(), registry);
  const codec = new SaveCodec(registry); assert.equal((await codec.decode(await codec.encode(e.snapshot()))).status, 'ready');
});

test('real combat returns victory, defeat and escape to the authored graph without reselecting the enemy', async () => {
  for (const outcome of ['victory', 'defeat', 'escape'] as const) {
    const { registry, state } = await fixture();
    state.player.variables['core:attack'] = 100;
    const e = new ActionExecutor(registry, state); run(e, 'mire-trap', 'start'); run(e, 'mire-trap', 'fight');
    assert.equal(e.snapshot().district!.combat!.selectionRuleId, current(e).context!.enemyRuleId);
    validateState(e.snapshot(), registry);
    const codec = new SaveCodec(registry), loaded = await codec.decode(await codec.encode(e.snapshot()));
    assert.equal(loaded.status, 'ready'); if (loaded.status !== 'ready') return;
    const restored = new ActionExecutor(registry, loaded.state);
    if (outcome === 'victory') { for (let i = 0; restored.snapshot().district!.combat && i < 15; i++) act(restored, 'district:action.combat.attack'); }
    else {const move=outcome==='defeat'?'surrender':'flee';const option=restored.view().actions.find(a=>a.definition.effects.some(e=>e.op==='combat.turn'&&e.move===move))!;assert.ok(option);act(restored,option.definition.id);}
    assert.equal(restored.snapshot().district!.combat, null);
    assert.equal(restored.snapshot().adventure!.lastCombat!.result, outcome);
    assert.equal(current(restored).nodeId, outcome === 'defeat' ? 'defeat' : 'edge');
    if (outcome === 'defeat') assert.equal(legMaterial(restored.snapshot(), registry), 'progression:material.slime-mucus');
    validateState(restored.snapshot(), registry);
  }
});

test('escort binds an actual present worker; losses and earned money are real, requests remain idempotent', async () => {
  const names = new Set<string>();
  for (const seed of [1, 7, 23]) {
    const { registry, state } = await fixture('M1', seed, 'district:location.workshop');
    state.clock.totalMinutes = 600; encounter(state, registry, false);
    const resident = state.district!.residents[0]!; assert.ok(resident);
    const e = new ActionExecutor(registry, state); run(e, 'alley-handoff', 'start');
    const bound = current(e).context!; assert.equal(bound.residentId, resident.id); assert.equal(bound.fills.resident, resident.name);
    assert.match(e.view().sceneText, new RegExp(resident.name)); names.add(resident.name);
    run(e, 'alley-handoff', 'abandon'); assert.equal(e.snapshot().player.flags['stories:flag.cargo-lost'], true);
    run(e, 'alley-handoff', 'report-loss'); assert.match(e.view().sceneText, /丢货的结果不会/);
    const before = e.snapshot(), request = 'escort-pay-' + seed;
    const payment = act(e, 'stories:action.alley-handoff.investigate', request);
    assert.equal(e.snapshot().player.variables['core:money'], before.player.variables['core:money']! + 25);
    assert.equal(e.snapshot().player.variables['core:energy'], before.player.variables['core:energy']! - 10);
    assert.equal(e.snapshot().player.flags['stories:flag.cargo-lost'], true);
    assert.equal(e.snapshot().player.flags['stories:flag.false-order-found'], true);
    const paid = e.snapshot(); assert.deepEqual(e.performAction({ actionId: 'stories:action.alley-handoff.investigate' }, before.meta.revision, request), payment); assert.deepEqual(e.snapshot(), paid);
    validateState(paid, registry);
  }
  assert.ok(names.size > 1, 'different seeds must use real different residents, not a story-specific actor');
});

test('absent services, wrong environment and missing body parts hide unsupported entries; forged calls fail', async () => {
  const { registry, state } = await fixture('M1', 42, 'aetheria:location.apartment');
  const e = new ActionExecutor(registry, state), before = e.snapshot();
  assert.equal(e.view().actions.some(a => a.definition.id === 'stories:action.mire-trap.start'), false);
  assert.equal(e.performAction({ actionId: 'stories:action.mire-trap.start' }, before.meta.revision, 'forged-mire').ok, false); assert.deepEqual(e.snapshot(), before);
  assert.equal(e.view().actions.some(a => a.definition.id === 'stories:action.alley-handoff.start'), false);
  const f = await fixture('M1', 42, 'district:location.workshop'); f.state.clock.totalMinutes = 600; encounter(f.state, f.registry, false);
  const packs = structuredClone(f.packs); for (const t of packs.flatMap(p => p.residentTemplates ?? [])) t.services = {};
  const noWork = await loadPacks(packs), worker = new ActionExecutor(noWork, { ...f.state, meta: { ...f.state.meta, packs: structuredClone(noWork.packs) } });
  assert.equal(worker.view().actions.some(a => a.definition.id === 'stories:action.alley-handoff.start'), false);
  const noLegs=await fixture();noLegs.state.player.body!.parts=noLegs.state.player.body!.parts.filter(p=>noLegs.registry.bodyPart(p.definitionId).kind==='root');noLegs.state.player.body!.edges=[];validateBody(noLegs.state.player.body,noLegs.registry);
  assert.equal(new ActionExecutor(noLegs.registry,noLegs.state).view().actions.some(a=>a.definition.id==='stories:action.mire-trap.start'),false);
});

test('content validates skips and routes, accepts forward-only beats, and rejects forged binding snapshots', async () => {
  const bad = structuredClone(originalStory); const defeat = bad.events[0]!.nodes.find(n => n.id === 'defeat')!;
  bad.actions.find(a => a.id === defeat.skipActionId)!.effects = [{ op: 'event.exit' }];
  await assert.rejects(loadPacks(inputs.map(p => p.manifest.id === bad.manifest.id ? bad : p)), /跳过/);
  const unknown = structuredClone(originalStory); (unknown.events[0]!.binding as unknown as Record<string, unknown>).madeUp = true; assert.throws(() => parsePack(unknown));
  const { registry, state } = await fixture(); const e = new ActionExecutor(registry, state); run(e, 'mire-trap', 'start');
  const forged = structuredClone(e.snapshot()); forged.eventInstances[0]!.context!.enemyId = 'district:enemy.scavenger'; assert.throws(() => validateState(forged, registry));
  assert.ok(registry.event('stories:event.mire-trap').nodes.find(n => n.id === 'trapped')!.actionIds.every(id => !registry.action(id).effects.some(e => e.op === 'event.exit')));
});

test('generated worlds expose the same data-driven stories and old snapshots are restored without injecting new content', async () => {
  const registry = await loadPacks(inputs);
  const rules = await json('content/generation/rules.json'), reference = await json('content/generation/reference.json');
  const generated = await new WorldGenerator().generate({ seed: 3, registry, rules, references: [reference] });
  assert.ok(generated.registry.contentPacks.some(p => p.manifest.id === originalStory.manifest.id));
  validateState(generated.state, generated.registry);
  let played=false;
  for(const location of generated.world.definition.locations){
    const state=structuredClone(generated.state);state.world.locationId=location.id;state.world.knownLocationIds=[...new Set([...state.world.knownLocationIds,location.id])];
    const engine=new ActionExecutor(generated.registry,state);
    if(!engine.view().actions.some(a=>a.available&&a.definition.id==='stories:action.mire-trap.start'))continue;
    run(engine,'mire-trap','start');
    assert.match(engine.view().sceneText,/立即作出选择。$/,'a complete event scene must end at its decision, without unrelated location prose appended');
    run(engine,'mire-trap','sink');run(engine,'mire-trap','endure');assert.ok(['progression:material.slime-mucus','progression:material.living-latex'].includes(legMaterial(engine.snapshot(),generated.registry)!));run(engine,'mire-trap','skip');run(engine,'mire-trap','leave');validateState(engine.snapshot(),generated.registry);played=true;break;
  }
  assert.ok(played,'the default generated world must contain an actual playable story entry');
  const oldInputs = inputs.filter(p => p.manifest.id !== originalStory.manifest.id), oldRegistry = await loadPacks(oldInputs);
  const old = await new WorldGenerator().generate({ seed: 7, registry: oldRegistry, rules, references: [reference] });
  const save = await new SaveCodec(old.registry).encode(old.state), restored = await new SaveCodec(generated.registry).decode(save);
  assert.equal(restored.status, 'ready'); if (restored.status !== 'ready') return;
  assert.deepEqual(restored.state.worldInstance, old.state.worldInstance);
  assert.ok(restored.registry); assert.equal(restored.registry.contentPacks.some(p => p.manifest.id === originalStory.manifest.id), false);
});

test('narrative fast-forward executes the same beats and stops at the next decision; forged skipping cannot escape',async()=>{
  const registry=await loadPacks(inputs),state=createGameState(registry,17);state.world.locationId='district:location.canal';state.world.knownLocationIds.push(state.world.locationId);
  const entry=new ActionExecutor(registry,state);act(entry,'progression:action.defeat.play');
  const pick=entry.view().actions.find(a=>a.definition.label==='进入：束缚制服')!;assert.ok(pick);act(entry,pick.definition.id);
  const read=new ActionExecutor(registry,entry.snapshot()),skip=new ActionExecutor(registry,entry.snapshot());
  act(read,'progression:action.story.0');act(read,'progression:action.story.0');act(skip,'progression:action.story.skip');
  assert.equal(skip.snapshot().adventure!.story!.stage,'play-01-peak');
  for(const key of ['clock','player','rng']as const)assert.deepEqual(skip.snapshot()[key],read.snapshot()[key]);
  assert.deepEqual(skip.snapshot().adventure!.story,read.snapshot().adventure!.story);
  const before=skip.snapshot();assert.equal(skip.performAction({actionId:'progression:action.story.skip'},before.meta.revision,'skip-a-decision').ok,false);assert.deepEqual(skip.snapshot(),before);
  validateState(skip.snapshot(),registry);const codec=new SaveCodec(registry);assert.equal((await codec.decode(await codec.encode(skip.snapshot()))).status,'ready');
});

test('a TF begun in an earlier skipped beat keeps a complete, verifiable receipt',async()=>{
  const packs=structuredClone(inputs),adventure=packs.find(p=>p.manifest.id==='aetheria/adventure')!;
  const capture=adventure.narrativeNodes!.find(n=>n.id==='progression:node.defeat.g1.capture')!;
  capture.choices[0]!.effects.unshift({op:'tf.enqueue',id:'progression:tf.slime-coating'});
  const registry=await loadPacks(packs),state=createGameState(registry,17);state.world.locationId='district:location.canal';state.world.knownLocationIds.push(state.world.locationId);
  const engine=new ActionExecutor(registry,state);act(engine,'progression:action.defeat.play');const enter=engine.view().actions.find(a=>a.definition.label==='进入：束缚制服')!;act(engine,enter.definition.id);act(engine,'progression:action.story.skip');
  assert.equal(engine.snapshot().tfQueues.at(-1)!.sourceActionId,'progression:action.story.skip');
  assert.equal(engine.snapshot().ledger.transactions.at(-1)!.narrativeChoices!.length,2);
  validateState(engine.snapshot(),registry);const codec=new SaveCodec(registry);assert.equal((await codec.decode(await codec.encode(engine.snapshot()))).status,'ready');
  const forged=structuredClone(engine.snapshot());delete forged.ledger.transactions.at(-1)!.narrativeChoices;assert.throws(()=>validateState(forged,registry));
});
