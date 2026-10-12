import test from 'node:test';
import assert from 'node:assert/strict';
import {
  aftertasteOnExit,
  aftertasteDecay,
  band,
  combatDamage,
  combatHitChance,
  fleeChancePercent,
  sanityGain,
  sanityRestDelta,
  skillResourceOutOfCombatRegen,
  staminaGate,
  ENEMY_TIER_TEMPLATES,
  BOSS_TEMPLATE,
} from '../src/engine/numerics.ts';

test('sanityGain: defeat mid base 6 with zero mods', () => {
  assert.equal(sanityGain({ base: 6 }), 6);
  assert.equal(sanityGain({ kind: 'standard' }), 6);
});

test('sanityGain: arousal/submission/tf multipliers', () => {
  const g = sanityGain({ base: 6, arousal: 100, submissionTendency: 150, transformProgress: 250 });
  // 6 * (1 + 0.5 + 1 + 1) = 6 * 3.5 = 21
  assert.equal(g, 21);
});

test('sanityGain: statusMod clamp', () => {
  assert.equal(sanityGain({ base: 10, statusModParts: [0.15, -0.2] }), Math.round(10 * 0.95));
  assert.equal(sanityGain({ base: 10, statusModParts: [1, 1] }), Math.round(10 * 1.5));
});

test('sanityRestDelta', () => {
  assert.equal(sanityRestDelta(10), 0);
  assert.equal(sanityRestDelta(30), -8);
  assert.equal(sanityRestDelta(360), -15);
  assert.equal(sanityRestDelta(1440), -15);
});

test('combatHitChance bounds', () => {
  const atk = { attack: 10, defense: 10, speed: 10, skillPower: 10, crit: 5, hit: 80, evasion: 10 };
  const def = { attack: 8, defense: 4, speed: 8, skillPower: 6, crit: 3, hit: 70, evasion: 5 };
  // 50 + 80 - 5 + floor(2/5) = 125 → clamp 95
  assert.equal(combatHitChance(atk, def), 95);
  assert.equal(combatHitChance({ ...atk, hit: 0 }, { ...def, evasion: 100, speed: 50 }), 5);
});

test('combatDamage physical and crit', () => {
  // floor(10*1 - 4*0.5) = 8
  assert.equal(combatDamage({ attack: 10, skillPower: 10, defense: 4, powerMult: 1 }), 8);
  // floor(10*0.7 - 4*0.5) = floor(7-2)=5
  assert.equal(combatDamage({ attack: 10, skillPower: 10, defense: 4, powerMult: 0.7 }), 5);
  const base = combatDamage({ attack: 10, skillPower: 10, defense: 4, powerMult: 1 });
  const crit = combatDamage({ attack: 10, skillPower: 10, defense: 4, powerMult: 1, crit: true });
  assert.equal(crit, Math.max(base + 1, Math.floor(base * 1.5)));
});

test('combatDamage skill uses 0.35 defense factor', () => {
  // floor(10*1.2 - 10*0.35) = floor(12-3.5)=8
  assert.equal(combatDamage({ attack: 10, skillPower: 10, defense: 10, powerMult: 1.2, skill: true }), 8);
});

test('fleeChance and aftertaste', () => {
  assert.equal(fleeChancePercent(10, 8, 10), 52);
  assert.equal(aftertasteOnExit(0, 50, 50), Math.round(50 * 0.4 + 50 * 0.2) - 10);
  assert.equal(aftertasteDecay(20, 120), 10);
  assert.equal(skillResourceOutOfCombatRegen(50, 60), 70);
});

test('band and staminaGate', () => {
  assert.equal(band(0), 'low');
  assert.equal(band(30), 'low');
  assert.equal(band(31), 'mid');
  assert.equal(band(71), 'high');
  assert.equal(staminaGate(40).allowLabor, true);
  assert.equal(staminaGate(39).allowLabor, false);
  assert.equal(staminaGate(19).allowAttack, false);
  assert.equal(staminaGate(0).combatOnlyGuardOrFlee, true);
});

test('enemy tiers: Boss not derived from S/M/L multipliers', () => {
  assert.equal(ENEMY_TIER_TEMPLATES.S.hp, 35);
  assert.equal(ENEMY_TIER_TEMPLATES.M.hp, 60);
  assert.equal(ENEMY_TIER_TEMPLATES.L.hp, 90);
  assert.equal(BOSS_TEMPLATE.hp, 160);
  assert.ok(BOSS_TEMPLATE.hp !== ENEMY_TIER_TEMPLATES.L.hp * 2);
  assert.ok(BOSS_TEMPLATE.phases.length >= 1);
});
