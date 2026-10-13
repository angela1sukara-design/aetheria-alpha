import test from 'node:test';
import assert from 'node:assert/strict';
import {
  aftertasteOnExit,
  aftertasteDecay,
  band,
  combatDamage,
  combatHitChance,
  fleeChancePercent,
  isSanityHostileLocation,
  sanityGain,
  sanityLoss,
  sanityPassiveDrainSteps,
  sanityRestDelta,
  skillResourceOutOfCombatRegen,
  staminaGate,
  ENEMY_TIER_TEMPLATES,
  BOSS_TEMPLATE,
} from '../src/engine/numerics.ts';

test('sanityLoss: defeat pressure magnitude mid base 6 with zero mods', () => {
  assert.equal(sanityLoss({ base: 6 }), 6);
  assert.equal(sanityLoss({ kind: 'standard' }), 6);
  assert.equal(sanityGain({ base: 6 }), 6);
});

test('sanityLoss: arousal/submission/tf multipliers', () => {
  const g = sanityLoss({ base: 6, arousal: 100, submissionTendency: 150, transformProgress: 250 });
  // 6 * (1 + 0.5 + 1 + 1) = 6 * 3.5 = 21
  assert.equal(g, 21);
});

test('sanityLoss: stress/400 mult and high-stress pulse', () => {
  // light：只乘区，无脉冲
  assert.equal(sanityLoss({ kind: 'light', base: 6, stress: 100 }), Math.round(6 * (1 + 0.25)));
  // standard + stress>=80 → +1 pulse
  assert.equal(sanityLoss({ kind: 'standard', base: 6, stress: 80 }), Math.round(6 * (1 + 80 / 400)) + 1);
  assert.equal(sanityLoss({ kind: 'light', base: 4, stress: 80 }), Math.round(4 * (1 + 80 / 400)));
});

test('sanityLoss: full mult with stress pulse', () => {
  const g = sanityLoss({ base: 6, arousal: 100, submissionTendency: 150, transformProgress: 250, stress: 400 });
  // 6 * (1 + 0.5 + 1 + 1 + 1) = 27; stress 400>=80 +1 pulse
  assert.equal(g, 28);
});

test('sanityLoss: statusMod clamp', () => {
  assert.equal(sanityLoss({ base: 10, statusModParts: [0.15, -0.2] }), Math.round(10 * 0.95));
  assert.equal(sanityLoss({ base: 10, statusModParts: [1, 1] }), Math.round(10 * 1.5));
});

test('sanityRestDelta recovers remaining sanity', () => {
  assert.equal(sanityRestDelta(10), 0);
  assert.equal(sanityRestDelta(30), 8);
  assert.equal(sanityRestDelta(360), 15);
  assert.equal(sanityRestDelta(1440), 15);
});

test('passive hostile drain helpers', () => {
  assert.equal(isSanityHostileLocation('district:location.canal'), true);
  assert.equal(isSanityHostileLocation('district:location.cafe'), false);
  assert.equal(isSanityHostileLocation('district:location.apartment'), false);
  assert.equal(sanityPassiveDrainSteps(89), 0);
  assert.equal(sanityPassiveDrainSteps(90), 1);
  assert.equal(sanityPassiveDrainSteps(180), 2);
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
