import type { Condition, Effect, Id } from './types.ts';
import type { EntityRef } from './query-types.ts';
import type {
  EquipmentSlot,
  EnemyCombatStats,
  EnemySpeciesKind,
  EnemyFetishTendency,
  EnemyDefeatComboConfig,
  DefeatMaterialKey,
  DefeatPlayKey,
  GenericTfAtom,
} from './district-types.ts';

export const NARRATIVE_KINDS = ['defeat', 'encounter', 'exploration', 'daily', 'conversation', 'quest', 'transformation', 'ending'] as const;
export type NarrativeKind = typeof NARRATIVE_KINDS[number];
export interface ScopedTag { role: 'player' | 'opponent' | 'environment'; tagId: Id }
export interface NarrativeProfile {
  id: Id;
  enemyId?: Id;
  npcId?: Id;
  tags: Id[];
  goals: Id[];
  tendencies: { tagId: Id; weight: number }[];
  defeatTags?: ScopedTag[];
  /** Optional closed candidate set for dedicated narrative entries. */
  nodeIds?: Id[];
  /** 对手物种/形态大类覆盖 */
  speciesKind?: EnemySpeciesKind;
  /** 对手身体/材质/生态属性 Tag */
  attributeTags?: Id[];
  /** 对手性癖/支配倾向 Tag */
  fetishTags?: Id[];
  /** 带权重的性癖倾向列表 */
  fetishTendencies?: EnemyFetishTendency[];
  /** 战败自动组合候选池配置 */
  defeatCombo?: EnemyDefeatComboConfig;
}
export interface NarrativeChoice { label: string; resultText: Id; conditions: Condition[]; effects: Effect[]; setTags: ScopedTag[]; unsetTags: ScopedTag[]; next: string | null }
export interface NarrativeNode { id: Id; kind: NarrativeKind; stage: string; title: string; textKey: Id; requiresTags: ScopedTag[]; excludesTags: ScopedTag[]; conditions: Condition[]; tendencies: { tagId: Id; weight: number }[]; weight: number; priority: number; maxVisits: number; choices: NarrativeChoice[]; skipChoiceIndex?: number; proseAssembly?: {version:1;mode:import('./prose-types.ts').ProseMode;rule:import('./prose-types.ts').ProseRule} }
export interface NarrativeState { instanceId: string; kind: NarrativeKind; stage: string; nodeId: Id; profileId: Id | null; opponentName: string; actor: EntityRef | null; tags: ScopedTag[]; visits: Record<Id, number>; log: string[]; steps: number; /** 战败玩法等入口的占位填充（{material}/{part}/{tf}…）；缺省兼容旧档 */ fills?: Record<string, string>; prose?: import('./prose-types.ts').ProseSnapshot }
export const ADVENTURE_FIELDS = ['assets', 'influence', 'safety', 'reputation', 'orders', 'contracts'] as const;
export type AdventureField = typeof ADVENTURE_FIELDS[number];
export interface AdventureState {
  version: 1; assets: number; influence: number; safety: number; reputation: number; orders: number; contracts: number;
  victories: Record<Id, number>; daily: Record<string, number>; equipment: Partial<Record<EquipmentSlot, Id>>;
  /** 消耗品堆叠；缺省视为 {}（旧档兼容） */
  items?: Record<Id, number>;
  story: NarrativeState | null; journal: { at: number; title: string; text: string }[];
  lastCombat: { enemyId: Id; enemyName: string; result: 'victory' | 'defeat' | 'escape'; turn: number; tags: ScopedTag[] } | null;
}
/** 地点层：环境 tag 组合 → 候选敌人 + 战斗/战败覆盖。词条≠玩法≠数值。 */
export interface EnvironmentEnemyRule {
  id: Id;
  enemyId: Id;
  /** 当前地点环境 tag 须全部具备 */
  requiresTags: Id[];
  excludesTags?: Id[];
  weight: number;
  priority?: number;
  /** 显示名覆盖；缺省用 EnemyDef.name */
  name?: string;
  /** 覆盖 EnemyDef.hp / reward / combat 字段（开打时注入运行时） */
  hp?: number;
  reward?: number;
  combat?: Partial<EnemyCombatStats>;
  /** 若填写则战败写入这些 tag（可进不同战败节点）；缺省仍用 NarrativeProfile.defeatTags */
  defeatTags?: ScopedTag[];
  /** 环境敌人变体的物种/属性/性癖与组合池覆盖 */
  speciesKind?: EnemySpeciesKind;
  attributeTags?: Id[];
  fetishTags?: Id[];
  fetishTendencies?: EnemyFetishTendency[];
  defeatCombo?: EnemyDefeatComboConfig;
}
export interface DefeatReactionRule {
  id: Id;
  label: string;
  stages: string[];
  playerConditions: Condition[];
  opponentConditions: Condition[];
  choiceLabel: string;
  resultText: Id;
  targetStage: string | null;
  effects: Effect[];
  setTags: ScopedTag[];
  unsetTags: ScopedTag[];
  priority: number;
}
export interface AdventureDefinitions {
  narrativeProfiles?: NarrativeProfile[];
  narrativeNodes?: NarrativeNode[];
  environmentEnemyRules?: EnvironmentEnemyRule[];
  defeatReactionRules?: DefeatReactionRule[];
}
export type AdventureEffect = {op:'conversation.respond';reaction:'welcomed'|'offended'|'gift'} | { op: 'narrative.start'; kind: NarrativeKind; profileId?: Id } | { op: 'narrative.choose'; index: number } | { op: 'narrative.skip' } | { op: 'adventure.change'; field: AdventureField; amount: number } | { op: 'progression.act'; move: 'train' | 'buy' | 'order' | 'invest' | 'patrol' | 'aid' | 'reconcile'; id?: Id };
export type OpponentMatchCondition = {
  op: 'opponent.matches';
  enemyId?: Id;
  speciesKind?: EnemySpeciesKind;
  attributeTag?: Id;
  fetishTag?: Id;
  materialKey?: DefeatMaterialKey;
  playKey?: DefeatPlayKey;
  tf?: GenericTfAtom;
};
export type AdventureCondition =
  | {op:'conversation.present'|'conversation.adultEligible'|'conversation.giftAvailable'}
  | {op:'conversation.trust';value:number}
  | { op: 'adventure.compare'; field: AdventureField | 'victories'; comparison: 'eq' | 'gte' | 'lte'; value: number }
  | { op: 'progression.available'; move: 'train' | 'buy' | 'order' | 'invest' | 'patrol' | 'aid' | 'reconcile'; id?: Id }
  | {op:'narrative.tag';role:ScopedTag['role'];id:Id;value:boolean}
  | OpponentMatchCondition;
