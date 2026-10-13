import type { EnemyTier, EquipmentBonuses, EquipmentSlot } from '../core/district-types.ts';
import { EQUIPMENT_ZERO_BONUS_SLOTS } from '../core/district-types.ts';
import type { RouteDistanceTier } from '../core/types.ts';
export type { EnemyTier };

/** 数值深设计纯函数：理智 / 命中伤害 / 余韵 / TF 进度 / 倾向分档。字段 ID 以 VariableDef 为准。 */

export type ToneBand = 'low' | 'mid' | 'high';

export function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}

export function band(x: number): ToneBand {
  if (x <= 30) return 'low';
  if (x <= 70) return 'mid';
  return 'high';
}

export type SanityTickKind = 'light' | 'standard' | 'continue' | 'heavy';

const SANITY_BASE: Record<SanityTickKind, { lo: number; hi: number; mid: number }> = {
  light: { lo: 3, hi: 5, mid: 4 },
  standard: { lo: 5, hi: 8, mid: 6 },
  continue: { lo: 8, hi: 12, mid: 10 },
  heavy: { lo: 10, hi: 14, mid: 12 },
};

export interface SanityGainInput {
  kind?: SanityTickKind;
  /** 若给出区间则覆盖 kind 表；rng ∈ [0,1) */
  baseRange?: { lo: number; hi: number };
  rng?: number;
  /** 固定 base（如战败中位 6） */
  base?: number;
  arousal?: number;
  submissionTendency?: number;
  transformProgress?: number;
  /** 压抑/束缚类 +0.15；镇定类 −0.20；最终 clamp [0.5,1.5] */
  statusModParts?: number[];
}

/** 单次理智上涨（崩坏积蓄）；返回增量（≥0）。 */
export function sanityGain(input: SanityGainInput): number {
  const kind = input.kind ?? 'standard';
  const table = SANITY_BASE[kind];
  let base: number;
  if (typeof input.base === 'number') base = input.base;
  else if (input.baseRange) {
    const { lo, hi } = input.baseRange;
    const rng = input.rng ?? 0;
    base = lo + Math.floor(rng * (hi - lo + 1));
  } else if (typeof input.rng === 'number') {
    base = table.lo + Math.floor(input.rng * (table.hi - table.lo + 1));
  } else base = table.mid;

  const arousal = input.arousal ?? 0;
  const submission = input.submissionTendency ?? 0;
  const tf = input.transformProgress ?? 0;
  let statusMod = 1;
  for (const p of input.statusModParts ?? []) statusMod += p;
  statusMod = clamp(statusMod, 0.5, 1.5);

  const gain = Math.round(
    base * (1 + arousal / 200 + submission / 150 + tf / 250) * statusMod,
  );
  return Math.max(0, gain);
}

/** 休息恢复：短歇 −8；长睡片段（≥6h）−15。 */
export function sanityRestDelta(minutes: number): number {
  if (minutes >= 360) return -15;
  if (minutes >= 30) return -8;
  return 0;
}

export interface CombatActorStats {
  attack: number;
  defense: number;
  speed: number;
  skillPower: number;
  crit: number;
  hit: number;
  evasion: number;
}

/** hitChance = clamp(50 + atk.hit - def.evasion + floor((atk.speed-def.speed)/5), 5, 95) */
export function combatHitChance(atk: CombatActorStats, def: CombatActorStats): number {
  return clamp(50 + atk.hit - def.evasion + Math.floor((atk.speed - def.speed) / 5), 5, 95);
}

export interface CombatDamageInput {
  attack: number;
  skillPower: number;
  defense: number;
  powerMult: number;
  skill?: boolean;
  crit?: boolean;
}

/**
 * raw = atk * powerMult - def * (skill?0.35:0.5)
 * damage = max(1, floor(raw)); crit → max(damage+1, floor(damage*1.5))
 */
export function combatDamage(input: CombatDamageInput): number {
  const raw = input.skill
    ? input.skillPower * input.powerMult - input.defense * 0.35
    : input.attack * input.powerMult - input.defense * 0.5;
  let damage = Math.max(1, Math.floor(raw));
  if (input.crit) damage = Math.max(damage + 1, Math.floor(damage * 1.5));
  return damage;
}

/** 逃离检定基础成功率（%）：40 + speed - enemy.speed；再由 tier 微调。 */
export function fleeChancePercent(playerSpeed: number, enemySpeed: number, tierBonus = 0): number {
  return clamp(40 + playerSpeed - enemySpeed + tierBonus, 5, 95);
}

export function aftertasteOnExit(aftertaste: number, arousal: number, restraint: number): number {
  const delta = Math.round(arousal * 0.4 + restraint * 0.2);
  return clamp(aftertaste + delta - 10, 0, 100);
}

/** 每推进 60min：余韵 −5。返回衰减后值。 */
export function aftertasteDecay(aftertaste: number, minutes: number): number {
  const steps = Math.floor(Math.max(0, minutes) / 60);
  return Math.max(0, aftertaste - steps * 5);
}

/** 出战斗后每 30min skillResource +10。 */
export function skillResourceOutOfCombatRegen(current: number, minutes: number, max = 100): number {
  const steps = Math.floor(Math.max(0, minutes) / 30);
  return Math.min(max, current + steps * 10);
}

export interface EnemyTemplateStats extends CombatActorStats {
  hp: number;
  actionsPerTurn: number;
  skillResource: number;
  fleeBonus: number;
}

/** 小/中/大精英固定表；Boss 独立，禁止用三类倍率生成。 */
export const ENEMY_TIER_TEMPLATES: Record<Exclude<EnemyTier, 'boss'>, EnemyTemplateStats> = {
  S: { hp: 35, attack: 8, defense: 4, speed: 8, skillPower: 6, hit: 70, evasion: 5, crit: 3, actionsPerTurn: 1, skillResource: 0, fleeBonus: 10 },
  M: { hp: 60, attack: 12, defense: 8, speed: 10, skillPower: 10, hit: 75, evasion: 10, crit: 5, actionsPerTurn: 1, skillResource: 30, fleeBonus: 0 },
  L: { hp: 90, attack: 16, defense: 12, speed: 12, skillPower: 14, hit: 80, evasion: 15, crit: 8, actionsPerTurn: 2, skillResource: 60, fleeBonus: -10 },
};

export const BOSS_TEMPLATE: EnemyTemplateStats & { phases: { hpRatio: number; defenseBonus: number; extraActions: number }[] } = {
  hp: 160,
  attack: 18,
  defense: 14,
  speed: 11,
  skillPower: 16,
  hit: 85,
  evasion: 12,
  crit: 10,
  actionsPerTurn: 2,
  skillResource: 100,
  fleeBonus: -15,
  phases: [{ hpRatio: 0.5, defenseBonus: 4, extraActions: 1 }],
};

export const STAMINA_COST = {
  moveShort: 2,
  moveFar: 5,
  labor: 8,
  struggle: 10,
  attack: 3,
  guard: 1,
  flee: 4,
  skill: 4,
  recover: 4,
} as const;

export const COMBAT_CARD = {
  attack: { ap: 2, skillResource: 0, powerMult: 1.0, skill: false },
  guard: { ap: 1, skillResource: 0, powerMult: 0, skill: false },
  recover: { ap: 2, skillResource: 0, powerMult: 0, skill: false, heal: 8 },
  flee: { ap: 2, skillResource: 0, powerMult: 0, skill: false },
  skill: { ap: 2, skillResource: 15, powerMult: 1.2, skill: true },
  item: { ap: 1, skillResource: 0, powerMult: 0, skill: false },
} as const;

export function staminaGate(stamina: number): {
  allowFarMove: boolean;
  allowLabor: boolean;
  allowStruggle: boolean;
  allowAttack: boolean;
  allowFlee: boolean;
  combatOnlyGuardOrFlee: boolean;
  onlyRestOrHelp: boolean;
} {
  if (stamina <= 0) {
    return {
      allowFarMove: false,
      allowLabor: false,
      allowStruggle: false,
      allowAttack: false,
      allowFlee: true,
      combatOnlyGuardOrFlee: true,
      onlyRestOrHelp: true,
    };
  }
  if (stamina <= 19) {
    return {
      allowFarMove: false,
      allowLabor: false,
      allowStruggle: false,
      allowAttack: false,
      allowFlee: true,
      combatOnlyGuardOrFlee: false,
      onlyRestOrHelp: true,
    };
  }
  if (stamina <= 39) {
    return {
      allowFarMove: false,
      allowLabor: false,
      allowStruggle: true,
      allowAttack: true,
      allowFlee: true,
      combatOnlyGuardOrFlee: false,
      onlyRestOrHelp: false,
    };
  }
  return {
    allowFarMove: true,
    allowLabor: true,
    allowStruggle: true,
    allowAttack: true,
    allowFlee: true,
    combatOnlyGuardOrFlee: false,
    onlyRestOrHelp: false,
  };
}


/** Route 默认推进分钟（缺 durationMinutes 时按 tier）。 */
export const ROUTE_DEFAULT_DURATION: Record<RouteDistanceTier, number> = {
  adjacent: 10,
  far: 25,
  cross: 45,
};

export function routeDistanceTier(route: { distanceTier?: RouteDistanceTier }): RouteDistanceTier {
  return route.distanceTier ?? 'adjacent';
}

export function routeDurationMinutes(route: { distanceTier?: RouteDistanceTier; durationMinutes?: number }): number {
  const tier = routeDistanceTier(route);
  return route.durationMinutes ?? ROUTE_DEFAULT_DURATION[tier];
}

export function routeStaminaCost(route: { distanceTier?: RouteDistanceTier }): number {
  return routeDistanceTier(route) === 'adjacent' ? STAMINA_COST.moveShort : STAMINA_COST.moveFar;
}

/** U1：装备战斗加成开关与硬顶（不写回 VariableDef）。 */
export const equipBonusesConfig = { enabled: true };

export const EQUIP_BONUS_ITEM_MAX = { attack: 4, defense: 4, evasion: 6 } as const;
export const EQUIP_BONUS_CAP = { attack: 4, defense: 4, evasion: 8 } as const;

export interface GearBonusSource {
  slot?: EquipmentSlot;
  bonuses?: EquipmentBonuses;
}

/** 结算时读取；cosmetic 贡献 0；总和再按全局帽 clamp。 */
export function sumEquipmentBonuses(items: GearBonusSource[]): { attack: number; defense: number; evasion: number } {
  if (!equipBonusesConfig.enabled) return { attack: 0, defense: 0, evasion: 0 };
  let attack = 0, defense = 0, evasion = 0;
  for (const item of items) {
    const slot = item.slot ?? 'cosmetic';
    if ((EQUIPMENT_ZERO_BONUS_SLOTS as readonly string[]).includes(slot)) continue;
    attack += item.bonuses?.attack ?? 0;
    defense += item.bonuses?.defense ?? 0;
    evasion += item.bonuses?.evasion ?? 0;
  }
  return {
    attack: clamp(attack, 0, EQUIP_BONUS_CAP.attack),
    defense: clamp(defense, 0, EQUIP_BONUS_CAP.defense),
    evasion: clamp(evasion, 0, EQUIP_BONUS_CAP.evasion),
  };
}

