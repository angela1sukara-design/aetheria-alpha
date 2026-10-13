import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { loadPacks } from '../src/content/loader.ts';
import { parsePack } from '../src/content/schema.ts';
import { ActionExecutor } from '../src/engine/executor.ts';
import { createGameState } from '../src/engine/state.ts';
import { SaveCodec, validateState } from '../src/persistence/codec.ts';
import { sumEquipmentBonuses } from '../src/engine/numerics.ts';
import { EQUIPMENT_SLOTS } from '../src/core/district-types.ts';
import type { GameState, Id } from '../src/core/types.ts';

const json = async (p: string) => JSON.parse(await readFile(new URL('../' + p, import.meta.url), 'utf8'));
const index = await json('content/index.json');
const inputs = await Promise.all(index.packs.map((p: string) => json('content/' + p)));
const registry = await loadPacks(inputs);
let serial = 0;
function act(e: ActionExecutor, id: Id) {
  const result = e.performAction({ actionId: id }, e.snapshot().meta.revision, 'equip-item-' + ++serial);
  assert.equal(result.ok, true, `${id}: ${result.message}`);
  return result;
}
function stateAt(location: Id = 'district:location.workshop', seed = 7): GameState {
  const s = createGameState(registry, seed);
  s.world.locationId = location;
  if (!s.world.knownLocationIds.includes(location)) s.world.knownLocationIds.push(location);
  return s;
}

test('equipment slots include six primary plus proposed wings/tail', () => {
  for (const slot of ['held', 'head', 'body', 'hands', 'legs', 'accessory', 'wings', 'tail', 'other'] as const) {
    assert.ok((EQUIPMENT_SLOTS as readonly string[]).includes(slot), slot);
  }
  assert.ok(registry.equipment.some(e => e.slot === 'held'));
  assert.ok(registry.equipment.some(e => e.slot === 'head'));
  assert.ok(registry.equipment.some(e => e.slot === 'hands'));
  assert.ok(registry.equipment.some(e => e.slot === 'legs'));
  assert.ok(registry.equipment.some(e => e.slot === 'accessory'));
  assert.ok(registry.equipment.some(e => e.slot === 'tail'));
  assert.equal(registry.items.length >= 6, true);
});

test('multi-slot wear stacks held+body+accessory bonuses with caps; accessory is zero', () => {
  const s = stateAt();
  s.player.variables['core:money'] = 200;
  const e = new ActionExecutor(registry, s);
  act(e, 'progression:action.buy.blade');
  act(e, 'progression:action.buy.vest');
  act(e, 'progression:action.buy.charm');
  act(e, 'progression:action.wear.blade');
  act(e, 'progression:action.wear.vest');
  act(e, 'progression:action.wear.charm');
  const eq = e.snapshot().adventure!.equipment;
  assert.equal(eq.held, 'progression:equipment.blade');
  assert.equal(eq.body, 'progression:equipment.vest');
  assert.equal(eq.accessory, 'progression:equipment.charm');
  const gear = Object.values(eq).map(id => registry.equipment.find(x => x.id === id)!);
  assert.deepEqual(sumEquipmentBonuses(gear), { attack: 3, defense: 3, evasion: 3 });
  validateState(e.snapshot(), registry);
});

test('consumables buy, use out of combat, and use in combat with quantity deduct', async () => {
  const s = stateAt('aetheria:location.market');
  s.player.variables['core:money'] = 100;
  s.player.variables['core:health'] = 50;
  s.player.variables['core:skillResource'] = 5;
  const e = new ActionExecutor(registry, s);
  act(e, 'progression:action.buy.item.salve');
  act(e, 'progression:action.buy.item.cell');
  assert.equal(e.snapshot().adventure!.items!['progression:item.salve'], 1);
  assert.equal(e.snapshot().adventure!.items!['progression:item.cell'], 1);
  act(e, 'progression:action.use.item.salve');
  assert.equal(e.snapshot().adventure!.items!['progression:item.salve'], undefined);
  assert.equal(e.snapshot().player.variables['core:health'], 62);
  act(e, 'progression:action.challenge.gel');
  assert.ok(e.snapshot().district!.combat);
  act(e, 'progression:action.combat.item.cell');
  assert.equal(e.snapshot().adventure!.items!['progression:item.cell'], undefined);
  assert.ok((e.snapshot().player.variables['core:skillResource'] ?? 0) >= 17);
  const codec = new SaveCodec(registry);
  const loaded = await codec.decode(await codec.encode(e.snapshot()));
  assert.equal(loaded.status, 'ready');
  if (loaded.status === 'ready') validateState(loaded.state, registry);
});

test('accessory non-zero bonuses rejected; held attack sample allowed', () => {
  const bad = {
    manifest: { id: 't/eq2', namespace: 't', version: '0.1.0', schemaVersion: 1, engineApiVersion: '0.1', author: 't', status: 'draft', dependencies: [], requiresCapabilities: ['district.v1'], migrations: [] },
    variables: [], flags: [], hooks: [], locations: [], routes: [], actions: [], events: [], texts: { 't:text': 'x' }, contributions: [],
    equipment: [{ id: 't:equipment.badacc', name: 'bad', requires: [], description: 'x', slot: 'accessory', bonuses: { attack: 1 } }],
  };
  assert.throws(() => parsePack(bad));
  const ok = {
    ...bad,
    equipment: [{ id: 't:equipment.okheld', name: 'ok', requires: [], description: 'x', slot: 'held', bonuses: { attack: 2 } }],
  };
  assert.doesNotThrow(() => parsePack(ok));
});
