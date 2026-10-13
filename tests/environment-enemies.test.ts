import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { loadPacks } from '../src/content/loader.ts';
import { ActionExecutor } from '../src/engine/executor.ts';
import { createGameState } from '../src/engine/state.ts';
import { locationEnvironmentTags, matchingEnvironmentEnemyRules, overlayEnvironmentEnemy, selectEnvironmentEnemyRule } from '../src/engine/environment-enemies.ts';
import { resolveEnemyRuntime } from '../src/engine/district-effects.ts';
import type { GameState, Id } from '../src/core/types.ts';

const json = async (p: string) => JSON.parse(await readFile(new URL('../' + p, import.meta.url), 'utf8'));
const index = await json('content/index.json');
const inputs = await Promise.all(index.packs.map((p: string) => json('content/' + p)));
const registry = await loadPacks(inputs);
let serial = 0;
function act(e: ActionExecutor, id: Id) {
  const result = e.performAction({ actionId: id }, e.snapshot().meta.revision, 'env-enemy-' + ++serial);
  assert.equal(result.ok, true, `${id}: ${result.message}`);
  return result;
}
function stateAt(location: Id, seed = 42): GameState {
  const s = createGameState(registry, seed);
  s.world.locationId = location;
  if (!s.world.knownLocationIds.includes(location)) s.world.knownLocationIds.push(location);
  return s;
}

test('location profiles expose environment tags used by enemy matching', () => {
  const s = stateAt('district:location.canal');
  const tags = locationEnvironmentTags(s, registry);
  assert.ok(tags.includes('foundation:service.commons' as Id));
  assert.ok(tags.includes('foundation:context.waterways' as Id));
  assert.ok(tags.includes('foundation:theme.gel' as Id));
  const rules = matchingEnvironmentEnemyRules(s, registry);
  assert.ok(rules.some(r => r.enemyId === 'district:enemy.gel'));
  assert.ok(rules.some(r => r.enemyId === 'district:enemy.scavenger'));
});

test('combat.encounter at canal starts an env-matched enemy with overlays', () => {
  const e = new ActionExecutor(registry, stateAt('district:location.canal', 7));
  assert.ok(e.view().actions.some(o => o.definition.id === 'progression:action.encounter.env' && o.available));
  act(e, 'progression:action.encounter.env');
  const battle = e.snapshot().district!.combat!;
  assert.ok(['district:enemy.gel', 'district:enemy.scavenger'].includes(battle.enemyId));
  assert.ok(battle.selectionRuleId?.startsWith('progression:env-enemy.'));
  assert.ok((battle.enemyName ?? '').length > 0);
  assert.equal(battle.hp, battle.enemy.hpMax);
});

test('workshop scavenger overlay injects hands.restricted defeat tags', () => {
  const e = new ActionExecutor(registry, stateAt('district:location.workshop', 3));
  act(e, 'progression:action.encounter.env');
  const battle = e.snapshot().district!.combat!;
  assert.equal(battle.enemyId, 'district:enemy.scavenger');
  assert.ok(battle.defeatTags?.some(t => t.tagId === 'progression:tag.hands.restricted'));
  assert.equal(battle.enemy.hpMax, 44);
  assert.equal(battle.enemy.attack, 11);
});

test('fixed combat.start still applies matching overlay when env fits', () => {
  const e = new ActionExecutor(registry, stateAt('district:location.canal', 11));
  act(e, 'district:action.battle.gel');
  const battle = e.snapshot().district!.combat!;
  assert.equal(battle.enemyId, 'district:enemy.gel');
  assert.equal(battle.selectionRuleId, 'progression:env-enemy.gel.canal');
  assert.equal(battle.enemy.defense, 6);
  assert.ok(battle.defeatTags?.some(t => t.tagId === 'progression:tag.coat.stuck'));
});

test('cafe has no env-enemy match so encounter action is hidden', () => {
  const e = new ActionExecutor(registry, stateAt('district:location.cafe'));
  assert.equal(matchingEnvironmentEnemyRules(e.snapshot(), registry).length, 0);
  assert.equal(e.view().actions.some(o => o.definition.id === 'progression:action.encounter.env'), false);
});

test('overlay helper keeps base enemy when no rule matches', () => {
  const enemy = registry.enemies.find(x => x.id === 'district:enemy.collector')!;
  const applied = overlayEnvironmentEnemy(enemy, resolveEnemyRuntime(enemy), undefined);
  assert.equal(applied.hp, enemy.hp);
  assert.equal(applied.name, enemy.name);
  assert.equal(applied.selectionRuleId, undefined);
});

test('selectEnvironmentEnemyRule is deterministic for a fixed seed stream', () => {
  const s = stateAt('district:location.canal', 99);
  const a = selectEnvironmentEnemyRule(s, registry, 'combat:encounter:test');
  const s2 = stateAt('district:location.canal', 99);
  const b = selectEnvironmentEnemyRule(s2, registry, 'combat:encounter:test');
  assert.deepEqual(a, b);
});
