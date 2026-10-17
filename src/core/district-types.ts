import type { EntityRef } from './query-types.ts';
import type { Id, Condition } from './types.ts';
import type { BodyGraph, BodyCapability } from './body-types.ts';
import type { TraitVariant } from './personality-types.ts';
import type { ResidentServices } from './function-types.ts';
import type { NameCulture, PersonalName } from './name-types.ts';
export type EnemyTier = 'S' | 'M' | 'L' | 'boss';
export const ENEMY_SPECIES_KINDS = ['human', 'beast', 'monster', 'plant', 'slime', 'insect', 'construct'] as const;
export type EnemySpeciesKind = typeof ENEMY_SPECIES_KINDS[number];
export const DEFEAT_MATERIAL_KEYS = ['M1', 'M2', 'M3', 'M4', 'M5', 'M6', 'M7', 'M8', 'M9', 'M10'] as const;
export type DefeatMaterialKey = typeof DEFEAT_MATERIAL_KEYS[number];
export const DEFEAT_PLAY_KEYS = ['G1', 'G2', 'G3', 'G4', 'G5', 'G6', 'G7', 'G8'] as const;
export type DefeatPlayKey = typeof DEFEAT_PLAY_KEYS[number];
export const GENERIC_TF_ATOMS = ['黏液化', '黑胶化'] as const;
export type GenericTfAtom = typeof GENERIC_TF_ATOMS[number];
export interface EnemyFetishTendency {
  /** 已注册的性癖/玩法倾向 Tag ID */
  tagId: Id;
  /** 倾向权重（0–100），用于战败节点与玩法抽选加权 */
  weight: number;
}
export interface EnemyDefeatComboConfig {
  /** 允许抽取的定词挂前材质键（M1–M6） */
  materials?: DefeatMaterialKey[];
  /** 允许抽取的目标部位名称 */
  parts?: string[];
  /** 偏好的战败玩法大类（G1–G8） */
  plays?: DefeatPlayKey[];
  /** 允许抽取的通用转化原子（仅限通用黏液化/黑胶化，禁止物种专条） */
  tfs?: GenericTfAtom[];
  /** 战败进入叙事时是否自动抽取组合槽位（fills） */
  autoCombo?: boolean;
}
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
  services?: ResidentServices;
  /** 面向当前题材的职业称呼；职业适配和原始选池仍使用 profession。 */
  roleName?: string;
  traitTags?: Id[];
  traitVariants?: TraitVariant[];
  /** 显式声明 names 是名池；未知旧全名不进行猜测拆分。 */
  nameCulture?: NameCulture;
  /** 生成后的单实例模板快照，必须与 names[0] 格式化结果一致。 */
  personalName?: PersonalName;
}
export interface Resident {
  id: string; templateId: Id; name: string; locationId: Id; profession: string; appearance: string; personality: string;
  personalName?: PersonalName;
  traitTags?: Id[];
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
  /** 敌人物种/形态大类（人/兽/异形/植物/史莱姆/虫群/构装） */
  speciesKind?: EnemySpeciesKind;
  /** 敌人固有身体/材质/生态属性 Tag（如黏液、触手、藤蔓、甲壳、催眠信息素、群聚等） */
  attributeTags?: Id[];
  /** 敌人性癖/战败支配倾向 Tag（如束缚、覆层、侵入、感官剥夺、产卵寄宿、羞辱、调教、围攻等） */
  fetishTags?: Id[];
  /** 带权重的性癖倾向列表（供战败节点与玩法抽选加权） */
  fetishTendencies?: EnemyFetishTendency[];
  /** 战败自动组合候选池配置 */
  defeatCombo?: EnemyDefeatComboConfig;
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
/** 六主槽 + 遗留三槽 + proposed 扩展（翼/尾/其他）。遗留 weapon≈held、armor≈body、cosmetic 仍为零加成时装。 */
export const EQUIPMENT_SLOTS = [
  'held', 'head', 'body', 'hands', 'legs', 'accessory',
  'weapon', 'armor', 'cosmetic',
  'wings', 'tail', 'other',
] as const;
export type EquipmentSlot = typeof EQUIPMENT_SLOTS[number];
/** 不计战斗加成的槽（含遗留 cosmetic）。 */
export const EQUIPMENT_ZERO_BONUS_SLOTS: readonly EquipmentSlot[] = ['cosmetic', 'accessory', 'other'];
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
  /** 缺省 {}；cosmetic/accessory/other 必须全 0 / 省略 */
  bonuses?: EquipmentBonuses;
}
/** 消耗品：效果仅允许已有 core 变量的 var.change。 */
export type ItemCategory = 'recovery' | 'combat' | 'explore';
export const ITEM_EFFECT_VARS = ['core:health', 'core:energy', 'core:stamina', 'core:sanity', 'core:skillResource'] as const;
export interface ItemDef {
  id: Id;
  name: string;
  description: string;
  category: ItemCategory;
  /** 缺省 20 */
  maxStack?: number;
  /** 商店标价；缺省 8 */
  price?: number;
  /** 仅 var.change，且 id 必须在 ITEM_EFFECT_VARS */
  effects: { op: 'var.change'; id: Id; amount: number }[];
  /** 战内可用；缺省 false */
  usableInCombat?: boolean;
}
export interface DistrictDefinitions {
  storylets?: StoryletDef[]; residentTemplates?: ResidentTemplate[]; enemies?: EnemyDef[];
  interactions?: InteractionDef[]; textSlots?: TextSlotDef[]; sceneTexts?: SceneTextDef[]; equipment?: EquipmentDef[];
  items?: ItemDef[];
}
export type DistrictEffect =
  | { op: 'item.consume'; id:Id; amount:number }
  | { op: 'resident.remember'; residentId: string; memoryId: Id }
  | { op: 'resident.trust.change'; residentId: string; amount: number }
  | { op: 'world.encounter'; events?: boolean }
  | { op: 'resident.talk' | 'resident.help' }
  | { op: 'combat.start'; id: Id }
  | { op: 'combat.encounter' }
  | { op: 'combat.turn'; move: 'attack' | 'guard' | 'recover' | 'flee' | 'skill' | 'item' | 'surrender' | 'giveup'; id?: Id }
  | { op: 'scene.start'; id: Id }
  | { op: 'scene.act'; move: 'pose' | 'contact' | 'release' | 'pause' | 'resume' | 'exit'; poseId?: string }
  | { op: 'equipment.wear'; id: Id }
  | { op: 'equipment.remove' }
  | { op: 'item.use'; id: Id }
  | { op: 'item.gain'; id: Id; amount: number }
  | { op: 'player.create'; name: string; ageYears?: number }
  | { op: 'preference.set'; value: boolean };
export type DistrictCondition =
  | { op: 'resident.present'; residentId: string }
  | { op: 'resident.trust'; residentId: string; value: number }
  | { op: 'resident.relation'; residentId: string; relation: import('./quest-types.ts').PlayerRelation }
  | { op: 'resident.memory'; residentId: string; memoryId: Id; value: boolean }
  | { op: 'day.after'; flagId: Id; days: number }
  | { op: 'scene.state'; value: 'active' | 'paused' | 'none' }
  | { op: 'resident.available' }
  | { op: 'player.created'; value: boolean }
  | { op: 'preference.adultOptional'; value: boolean }
  | { op: 'item.has'; id: Id; comparison: 'eq' | 'gte' | 'lte'; value: number };
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
  /** 地点层环境选敌规则；缺省表示直接 combat.start 固定敌人 */
  selectionRuleId?: Id;
  /** 规则覆盖的显示名 */
  enemyName?: string;
  /** 规则注入的战败 tag；缺省回退 NarrativeProfile.defeatTags */
  defeatTags?: { role: 'player' | 'opponent' | 'environment'; tagId: Id }[];
  /** 规则覆盖的战斗报酬 */
  reward?: number;
}
export interface DistrictState {
  version: 1; profile: { name: string; ageYears?: number; created: boolean; adultOptional: boolean };
  residents: Resident[]; currentResidentId: string | null; storyletHistory: { id: Id; at: number }[];
  factsAt: Record<Id, number>; discovered: Id[]; inventory: Id[]; equipped: Id | null;
  combat: CombatState | null;
  scene: { definitionId: Id; phase: 'active' | 'paused'; poseId: string; turn: number;
    actors: { id: string; entity?: EntityRef; body?: BodyGraph; facing: 'front' | 'away'; zone: 'near' | 'across' }[];
    contacts: { playerPartId: string; npcPartId: string; sinceTurn: number }[];
    /** 场景临时：exit 前写入 aftertaste，再随 scene=null 丢弃。 */
    arousal: number; restraint: number } | null;
}
