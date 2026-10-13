import type { EntityRef } from './query-types.ts';
import type { Id, Condition } from './types.ts';
import type { BodyGraph, BodyCapability } from './body-types.ts';
export type EnemyTier = 'S' | 'M' | 'L' | 'boss';
export interface StoryletDef {
  id: Id; locationId: Id; conditions: Condition[]; eventId: Id; weight: number; priority: number;
  cooldownMinutes: number; cooldownGroup: string; repeat: 'once' | 'daily' | 'repeat'; hidden: boolean; tags: string[];
}
export interface ResidentTemplate {
  id: Id; locationIds: Id[]; start: number; end: number; names: string[]; profession: string;
  appearance: string[]; personality: string[]; behavior: 'trade' | 'repair' | 'guide';
  speciesId: Id; ageYears: number; bodyTemplateId: Id; patchIds: Id[];
  dialogue?: { intro: string; repeat: string; help: string };
  /** 经编辑适配的服装文字；不定义身体部件、装备属性或能力。生成时抽定并保存。 */
  attire?: string[];
}
export interface Resident {
  id: string; templateId: Id; name: string; locationId: Id; profession: string; appearance: string; personality: string;
  speciesId: Id; ageYears: number; body: BodyGraph; persistent: boolean; visits: number; trust: number; lastTalkDay: number; memories: string[];
}
/** 敌方八维与行动经济；不写玩家 VariableDef。 */
export interface EnemyCombatStats {
  attack: number; defense: number; speed: number; skillPower: number;
  crit: number; hit: number; evasion: number;
  actionsPerTurn: number; skillResource: number;
}
export interface EnemyPhaseDef {
  /** HP 比例阈值，如 0.5 表示 ≤50% */
  hpRatio: number; defenseBonus: number; extraActions: number;
}
export interface EnemyDef {
  id: Id; name: string; hp: number; reward: number;
  /** S/M/L 三类或 boss 专表；缺省时由 combat/hp 推断。 */
  tier?: EnemyTier;
  combat?: EnemyCombatStats;
  /** Boss 阶段；非 boss 勿填。 */
  phases?: EnemyPhaseDef[];
  intents: { label: string; damage: number; guard: number; drain: number }[];
  victoryEventId: Id; defeatEventId: Id; escapeEventId: Id;
}
export interface InteractionDef {
  id: Id; npcId: Id; conditions: Condition[]; textSlotId: Id; endEventId: Id;
  poses: { id: string; label: string; facing: 'front' | 'away'; zone: 'near' | 'across'; requires: BodyCapability | null }[];
  contact: { playerKind: 'hand'; npcKind: 'hand'; label: string };
}
export interface TextSlotDef {
  id: Id; owner: { eventId: Id; nodeId: string }; contentTier: 'mature_fade' | 'adult_optional';
  fallbackTextKey: Id; participants: (Id | 'player')[]; allowedVariables: string[]; requiredFacts: Id[];
  sceneRequirements: string[]; before: string; after: string; purpose: string; requiredBeats: string[];
  nextNodeId: string; exitActionIds: Id[]; allowedReplacement: 'prose_only';
}
export interface SceneTextDef { id: Id; locationId: Id; conditions: Condition[]; priority: number; textKey: Id; owner?:{eventId:Id;nodeId:string} }
export type EquipmentSlot = 'weapon' | 'armor' | 'cosmetic';
export interface EquipmentBonuses {
  /** 对应 VariableDef core:attack，加法整数 */
  attack?: number;
  /** core:defense */
  defense?: number;
  /** core:evasion（百分点） */
  evasion?: number;
}
export interface EquipmentDef {
  id: Id;
  name: string;
  requires: Condition[];
  description: string;
  /** 缺省 cosmetic（兼容雨衣/尾衣） */
  slot?: EquipmentSlot;
  /** 缺省 {}；cosmetic 必须全 0 / 省略 */
  bonuses?: EquipmentBonuses;
}
export interface DistrictDefinitions {
  storylets?: StoryletDef[]; residentTemplates?: ResidentTemplate[]; enemies?: EnemyDef[];
  interactions?: InteractionDef[]; textSlots?: TextSlotDef[]; sceneTexts?: SceneTextDef[]; equipment?: EquipmentDef[];
}
export type DistrictEffect =
  | { op: 'resident.remember'; residentId: string; memoryId: Id }
  | { op: 'world.encounter'; events?: boolean }
  | { op: 'resident.talk' | 'resident.help' }
  | { op: 'combat.start'; id: Id }
  | { op: 'combat.turn'; move: 'attack' | 'guard' | 'recover' | 'flee' }
  | { op: 'scene.start'; id: Id }
  | { op: 'scene.act'; move: 'pose' | 'contact' | 'release' | 'pause' | 'resume' | 'exit'; poseId?: string }
  | { op: 'equipment.wear'; id: Id }
  | { op: 'equipment.remove' }
  | { op: 'player.create'; name: string; ageYears: number }
  | { op: 'preference.set'; value: boolean };
export type DistrictCondition =
  | { op: 'resident.present'; residentId: string }
  | { op: 'resident.relation'; residentId: string; relation: import('./quest-types.ts').PlayerRelation }
  | { op: 'resident.memory'; residentId: string; memoryId: Id; value: boolean }
  | { op: 'day.after'; flagId: Id; days: number }
  | { op: 'scene.state'; value: 'active' | 'paused' | 'none' }
  | { op: 'resident.available' }
  | { op: 'player.created'; value: boolean };
/** 战斗运行时敌方快照（开打时从模板拷入）。 */
export interface CombatEnemyRuntime {
  hpMax: number;
  attack: number; defense: number; speed: number; skillPower: number;
  crit: number; hit: number; evasion: number;
  skillResource: number; actionsPerTurn: number;
  /** 本回合临时 DEF 加成（来自 intent.guard / 阶段） */
  defenseBonus: number;
  tier: EnemyTier;
  fleeBonus: number;
}
export interface CombatState {
  enemyId: Id; hp: number; turn: number; log: string[];
  enemy: CombatEnemyRuntime;
  /** 本回合剩余 AP；开回合 = min(10, core:actionPoints) */
  playerAp: number;
  guarding: boolean;
}
export interface DistrictState {
  version: 1; profile: { name: string; ageYears: number; created: boolean; adultOptional: boolean };
  residents: Resident[]; currentResidentId: string | null; storyletHistory: { id: Id; at: number }[];
  factsAt: Record<Id, number>; discovered: Id[]; inventory: Id[]; equipped: Id | null;
  combat: CombatState | null;
  scene: { definitionId: Id; phase: 'active' | 'paused'; poseId: string; turn: number;
    actors: { id: string; entity?: EntityRef; body?: BodyGraph; facing: 'front' | 'away'; zone: 'near' | 'across' }[];
    contacts: { playerPartId: string; npcPartId: string; sinceTurn: number }[];
    /** 场景临时：exit 前写入 aftertaste，再随 scene=null 丢弃。 */
    arousal: number; restraint: number } | null;
}
