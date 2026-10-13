import test from 'node:test';
import assert from 'node:assert/strict';
import {
  equipBonusesConfig,
  routeDistanceTier,
  routeDurationMinutes,
  routeStaminaCost,
  ROUTE_DEFAULT_DURATION,
  staminaGate,
  STAMINA_COST,
  sumEquipmentBonuses,
} from '../src/engine/numerics.ts';
import { packs, game, act } from './helpers.ts';
import { loadPacks } from '../src/content/loader.ts';
import { ActionExecutor } from '../src/engine/executor.ts';
import { createGameState } from '../src/engine/state.ts';
import { readFile } from 'node:fs/promises';
import type { ContentPack, Id } from '../src/core/types.ts';
import { parsePack } from '../src/content/schema.ts';

test('route defaults: adjacent/far/cross duration and stamina', () => {
  assert.equal(ROUTE_DEFAULT_DURATION.adjacent, 10);
  assert.equal(ROUTE_DEFAULT_DURATION.far, 25);
  assert.equal(ROUTE_DEFAULT_DURATION.cross, 45);
  assert.equal(routeDurationMinutes({}), 10);
  assert.equal(routeDurationMinutes({ distanceTier: 'far' }), 25);
  assert.equal(routeDurationMinutes({ distanceTier: 'cross' }), 45);
  assert.equal(routeDurationMinutes({ distanceTier: 'far', durationMinutes: 35 }), 35);
  assert.equal(routeStaminaCost({}), STAMINA_COST.moveShort);
  assert.equal(routeStaminaCost({ distanceTier: 'far' }), STAMINA_COST.moveFar);
  assert.equal(routeStaminaCost({ distanceTier: 'cross' }), STAMINA_COST.moveFar);
  assert.equal(routeDistanceTier({}), 'adjacent');
});

test('location.move adjacent: 10min / −2, no double clock from travel action', async () => {
  const { registry, engine } = await game();
  const before = engine.snapshot();
  const clock = before.clock.totalMinutes;
  const stamina = before.player.variables['core:stamina']!;
  const result = act(engine, 'travel.apartment_street');
  assert.equal(result.ok, true, result.message);
  const after = engine.snapshot();
  assert.equal(after.clock.totalMinutes, clock + 10);
  assert.equal(after.player.variables['core:stamina'], stamina - 2);
  assert.equal(after.world.locationId, 'aetheria:location.street');
  // 旧 world 包可仍带 clock.advance；运行时与 location.move 同批时跳过，不双计
  const travel = registry.action('aetheria:action.travel.apartment_street');
  assert.equal(travel.effects.filter(e => e.op === 'location.move').length, 1);
  assert.equal(after.clock.totalMinutes - clock, 10);
});

test('far route option unavailable at stamina 39', async () => {
  const base = await packs();
  const district = JSON.parse(await readFile(new URL('../content/district/pack.json', import.meta.url), 'utf8')) as ContentPack;
  const foundation = JSON.parse(await readFile(new URL('../content/foundation/pack.json', import.meta.url), 'utf8'));
  const registry = await loadPacks([...base, district, foundation]);
  const state = createGameState(registry, 7);
  // Place player at canal with stamina 39
  state.world.locationId = 'district:location.canal' as Id;
  if (!state.world.knownLocationIds.includes(state.world.locationId)) state.world.knownLocationIds.push(state.world.locationId);
  state.player.variables['core:stamina'] = 39;
  const engine = new ActionExecutor(registry, state);
  const opt = engine.view().actions.find(a => a.definition.id === 'district:action.travel.station.out');
  assert.ok(opt, 'station.out travel should be listed');
  assert.equal(opt!.available, false);
  assert.match(opt!.reason, /远路|跨区/);
  // Execute should also fail
  const denied = engine.performAction({ actionId: 'district:action.travel.station.out' }, engine.snapshot().meta.revision, 'far-deny');
  assert.equal(denied.ok, false);
});

test('cross route: 45min / −5 when stamina allows', async () => {
  const base = await packs();
  const district = JSON.parse(await readFile(new URL('../content/district/pack.json', import.meta.url), 'utf8')) as ContentPack;
  const foundation = JSON.parse(await readFile(new URL('../content/foundation/pack.json', import.meta.url), 'utf8'));
  const registry = await loadPacks([...base, district, foundation]);
  const state = createGameState(registry, 11);
  state.world.locationId = 'aetheria:location.street' as Id;
  state.player.variables['core:stamina'] = 50;
  // need district profile created for some actions? travel shouldn't need it
  const engine = new ActionExecutor(registry, state);
  const clock = engine.snapshot().clock.totalMinutes;
  const result = engine.performAction({ actionId: 'district:action.travel.cafe.out' }, engine.snapshot().meta.revision, 'cross-ok');
  assert.equal(result.ok, true, result.message);
  assert.equal(engine.snapshot().clock.totalMinutes, clock + 45);
  assert.equal(engine.snapshot().player.variables['core:stamina'], 45);
  assert.equal(engine.snapshot().world.locationId, 'district:location.cafe');
});

test('equipment bonuses: weapon +3 ATK at combat read; VariableDef unchanged; cosmetic 0; switch off', () => {
  const prev = equipBonusesConfig.enabled;
  try {
    equipBonusesConfig.enabled = true;
    const weapon = { slot: 'weapon' as const, bonuses: { attack: 3 } };
    const armor = { slot: 'armor' as const, bonuses: { defense: 2, evasion: 3 } };
    const coat = { slot: 'cosmetic' as const, bonuses: { attack: 0 } };
    assert.deepEqual(sumEquipmentBonuses([weapon]), { attack: 3, defense: 0, evasion: 0 });
    assert.deepEqual(sumEquipmentBonuses([armor]), { attack: 0, defense: 2, evasion: 3 });
    assert.deepEqual(sumEquipmentBonuses([coat]), { attack: 0, defense: 0, evasion: 0 });
    assert.deepEqual(sumEquipmentBonuses([weapon, armor]), { attack: 3, defense: 2, evasion: 3 });
    // global cap
    assert.deepEqual(sumEquipmentBonuses([{ slot: 'weapon', bonuses: { attack: 4 } }, { slot: 'armor', bonuses: { attack: 4 } }]), { attack: 4, defense: 0, evasion: 0 });
    equipBonusesConfig.enabled = false;
    assert.deepEqual(sumEquipmentBonuses([weapon, armor]), { attack: 0, defense: 0, evasion: 0 });
  } finally {
    equipBonusesConfig.enabled = prev;
  }
});

test('safe-zone heal is +40 not +100', async () => {
  const district = JSON.parse(await readFile(new URL('../content/district/pack.json', import.meta.url), 'utf8')) as ContentPack;
  const heals = district.actions.filter(a => a.id.startsWith('district:action.heal.'));
  assert.equal(heals.length, 5);
  for (const a of heals) {
    const health = a.effects.find(e => e.op === 'var.change' && e.id === 'core:health');
    assert.ok(health && health.op === 'var.change');
    if (health && health.op === 'var.change') assert.equal(health.amount, 40, a.id);
  }
});

test('staminaGate allowFarMove threshold 40', () => {
  assert.equal(staminaGate(39).allowFarMove, false);
  assert.equal(staminaGate(40).allowFarMove, true);
});

test('cosmetic non-zero bonuses rejected by schema', () => {
  const minimal = {
    manifest: { id: 't/eq', namespace: 't', version: '0.1.0', schemaVersion: 1, engineApiVersion: '0.1', author: 't', status: 'draft', dependencies: [], requiresCapabilities: ['district.v1'], migrations: [] },
    variables: [], flags: [], hooks: [], locations: [], routes: [], actions: [], events: [], texts: { 't:text': 'x' }, contributions: [],
    equipment: [{ id: 't:equipment.bad', name: 'bad', requires: [], description: 'x', slot: 'cosmetic', bonuses: { attack: 1 } }],
  };
  assert.throws(() => parsePack(minimal));
});
