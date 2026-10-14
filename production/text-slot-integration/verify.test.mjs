import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

// The ZIP can live outside the repository. Always exercise the actual engine,
// rather than a second schema implementation that could drift from gameplay.
const repo = process.env.AETHERIA_REPO
  ? resolve(process.env.AETHERIA_REPO)
  : fileURLToPath(new URL('../../', import.meta.url));
const source = relative => import(pathToFileURL(resolve(repo, relative)).href);
const [{ loadPacks }, { createGameState }, { ActionExecutor }, { TextLibrary, parseTextExpansion }, { SaveCodec }, { writingContext }]
  = await Promise.all([
    source('src/content/loader.ts'), source('src/engine/state.ts'),
    source('src/engine/executor.ts'), source('src/content/text-variants.ts'),
    source('src/persistence/codec.ts'), source('src/engine/writing-context.ts'),
  ]);
const json = async url => JSON.parse(await readFile(url, 'utf8'));
const indexUrl = pathToFileURL(resolve(repo, 'content/index.json'));
const index = await json(indexUrl);
const base = await Promise.all(index.packs.map(relative => json(new URL(relative, indexUrl))));
const example = await json(new URL('examples/slot-content-pack.json', import.meta.url));
const prose = await json(new URL('examples/placeholder-text-pack.json', import.meta.url));
const slotId = 'slotdemo:textslot.placeholder';
const marker = '【可选正文占位】';
const fallback = example.texts['slotdemo:text.fallback'];

async function fixture() {
  const registry = await loadPacks([...structuredClone(base), structuredClone(example)]);
  const library = new TextLibrary();
  library.install(prose, registry);
  const engine = new ActionExecutor(registry, createGameState(registry, 314159), library);
  return { registry, library, engine };
}
function act(engine, actionId, params) {
  const result = engine.performAction({ actionId, ...(params ? { params } : {}) }, engine.snapshot().meta.revision, crypto.randomUUID());
  assert.equal(result.ok, true, `${actionId}: ${result.message}`);
}
function enter(engine, optional = true) {
  act(engine, 'district:action.create', { name: '接口测试者', ageYears: 25 });
  if (optional) {
    const setting = engine.view().actions.find(option => option.definition.effects.some(effect => effect.op === 'preference.set' && effect.value === true));
    assert.ok(setting, 'The existing preference action must be available.');
    act(engine, setting.definition.id);
  }
  act(engine, 'slotdemo:action.open');
}

test('slot kit: full pack registers a usable node, substitution and unconditional exit', async () => {
  const { engine, registry } = await fixture();
  assert.ok(registry.textSlots.some(slot => slot.id === slotId));
  enter(engine);
  assert.ok(engine.view().sceneText.includes(`${marker}接口测试者与槽位测试员`));
  const exit = engine.view().actions.find(option => option.definition.id === 'slotdemo:action.close');
  assert.equal(exit?.available, true);
  act(engine, 'slotdemo:action.close');
  assert.equal(engine.snapshot().activeEventStack.length, 0);
  assert.equal(engine.snapshot().world.locationId, 'aetheria:location.apartment');
});

test('slot kit: preference defaults off and an entered node uses neutral fallback', async () => {
  const { engine } = await fixture();
  assert.equal(engine.snapshot().district.profile.adultOptional, false);
  enter(engine, false);
  assert.ok(engine.view().sceneText.includes(fallback));
  assert.ok(!engine.view().sceneText.includes(marker));
});

test('slot kit: missing identity, disabled preference or required facts prevents optional display', async () => {
  const { engine, registry, library } = await fixture();
  enter(engine);
  const initial = engine.snapshot();
  for (const change of [
    state => { state.district.profile.created = false; },
    state => { state.district.profile.adultOptional = false; },
    state => { state.player.flags['slotdemo:flag.ready'] = false; },
  ]) {
    // Deliberately invalid snapshots are only read-only gate fixtures; never saved.
    const state = structuredClone(initial);
    change(state);
    assert.equal(library.resolve(slotId, state, registry), fallback);
  }
});

test('slot kit: optional player text does not require an age attribute', async () => {
  const { engine, registry, library } = await fixture();
  enter(engine);
  const state = structuredClone(engine.snapshot());
  assert.equal(Object.hasOwn(state.district.profile, 'ageYears'), false);
  assert.ok(library.resolve(slotId, state, registry).includes(marker));
});

test('slot kit: unknown-age fixed NPC is rejected when registering optional slot', async () => {
  const invalid = structuredClone(example);
  invalid.npcs[0].ageYears = null;
  await assert.rejects(() => loadPacks([...structuredClone(base), invalid]));
});

test('slot kit: dynamic instance cannot be passed as a fixed NPC definition', async () => {
  const invalid = structuredClone(example);
  invalid.textSlots[0].participants[1] = 'slotdemo:resident.instance';
  await assert.rejects(() => loadPacks([...structuredClone(base), invalid]));
});

test('slot kit: text package cannot register a missing slot', async () => {
  const registry = await loadPacks(structuredClone(base));
  assert.throws(() => parseTextExpansion(prose, registry));
});

test('slot kit: unknown variables, effect fields and invented ratings are rejected', async () => {
  const { registry } = await fixture();
  for (const change of [
    pack => { pack.variants[0].text = '{npc.body.unknown}'; },
    pack => { pack.variants[0].effects = []; },
    pack => { pack.variants[0].tier = 'explicit'; },
  ]) {
    const invalid = structuredClone(prose);
    change(invalid);
    assert.throws(() => parseTextExpansion(invalid, registry));
  }
});

test('slot kit: existing adult event loader guard is retained', async () => {
  const invalid = structuredClone(example);
  invalid.events[0].rating = 'adult';
  await assert.rejects(() => loadPacks([...structuredClone(base), invalid]), /ADULT_PLAYER_UNVERIFIED/);
});

test('slot kit: import, update, disable, remove and repeated rendering preserve authoritative state', async () => {
  const { engine, registry, library } = await fixture();
  enter(engine);
  const before = engine.snapshot();
  for (let i = 0; i < 20; i++) engine.view();
  library.setEnabled(prose.manifest.id, false);
  assert.ok(engine.view().sceneText.includes(fallback));
  library.setEnabled(prose.manifest.id, true);
  assert.ok(engine.view().sceneText.includes(marker));
  const update = structuredClone(prose);
  update.manifest.version = '1.0.1';
  update.variants[0].text = '【占位更新】接口显示已更新。';
  library.install(update, registry);
  assert.ok(engine.view().sceneText.includes('【占位更新】'));
  library.remove(prose.manifest.id);
  assert.ok(engine.view().sceneText.includes(fallback));
  library.install(prose, registry);
  assert.deepEqual(engine.snapshot(), before);
});

test('slot kit: save restores exact node and identity; missing prose changes presentation only', async () => {
  const { engine, registry } = await fixture();
  enter(engine);
  const before = engine.snapshot();
  const codec = new SaveCodec(registry);
  const restored = await codec.decode(await codec.encode(before));
  assert.equal(restored.status, 'ready');
  assert.deepEqual(restored.state, before);
  const running = new ActionExecutor(registry, restored.state);
  assert.ok(running.view().sceneText.includes(fallback));
  assert.deepEqual(running.snapshot(), before);
  running.texts.install(prose, registry);
  assert.ok(running.view().sceneText.includes(marker));
  assert.deepEqual(running.snapshot(), before);
  act(running, 'slotdemo:action.close');
  assert.equal(running.snapshot().activeEventStack.length, 0);
});

test('slot kit: exported context reports real fixed participant and no invented scene', async () => {
  const { engine, registry } = await fixture();
  assert.throws(() => writingContext(engine.snapshot(), registry));
  enter(engine);
  const before = engine.snapshot();
  const context = writingContext(before, registry);
  assert.equal(context.slotId, slotId);
  assert.equal(context.participants[0].definition.id, 'slotdemo:npc.tester');
  assert.equal(context.participants[0].state.instanceId, 'fixed:slotdemo:npc.tester');
  assert.equal(context.facts[0].value, true);
  assert.equal(context.scene, null);
  assert.equal(context.allowedReplacement, 'prose_only');
  assert.deepEqual(engine.snapshot(), before);
});
