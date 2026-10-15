import type { Condition, Effect, Id } from './types.ts';
import type { EntityRef } from './query-types.ts';
import type { EquipmentSlot, EnemyCombatStats } from './district-types.ts';

export const NARRATIVE_KINDS = ['defeat', 'encounter', 'exploration', 'daily', 'conversation', 'quest', 'transformation', 'ending'] as const;
export type NarrativeKind = typeof NARRATIVE_KINDS[number];
export interface ScopedTag { role: 'player' | 'opponent' | 'environment'; tagId: Id }
export interface NarrativeProfile { id: Id; enemyId?: Id; npcId?: Id; tags: Id[]; goals: Id[]; tendencies: { tagId: Id; weight: number }[]; defeatTags?: ScopedTag[]; /** Optional closed candidate set for dedicated narrative entries. */ nodeIds?: Id[] }
export interface NarrativeChoice { label: string; resultText: Id; conditions: Condition[]; effects: Effect[]; setTags: ScopedTag[]; unsetTags: ScopedTag[]; next: string | null }
export interface NarrativeNode { id: Id; kind: NarrativeKind; stage: string; title: string; textKey: Id; requiresTags: ScopedTag[]; excludesTags: ScopedTag[]; conditions: Condition[]; tendencies: { tagId: Id; weight: number }[]; weight: number; priority: number; maxVisits: number; choices: NarrativeChoice[]; proseAssembly?: {version:1;mode:import('./prose-types.ts').ProseMode;rule:import('./prose-types.ts').ProseRule} }
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
}
export interface AdventureDefinitions {
  narrativeProfiles?: NarrativeProfile[];
  narrativeNodes?: NarrativeNode[];
  environmentEnemyRules?: EnvironmentEnemyRule[];
}
export type AdventureEffect = {op:'conversation.respond';reaction:'welcomed'|'offended'|'gift'} | { op: 'narrative.start'; kind: NarrativeKind; profileId?: Id } | { op: 'narrative.choose'; index: number } | { op: 'adventure.change'; field: AdventureField; amount: number } | { op: 'progression.act'; move: 'train' | 'buy' | 'order' | 'invest' | 'patrol' | 'aid' | 'reconcile'; id?: Id };
export type AdventureCondition = {op:'conversation.present'|'conversation.adultEligible'|'conversation.giftAvailable'} | {op:'conversation.trust';value:number} | { op: 'adventure.compare'; field: AdventureField | 'victories'; comparison: 'eq' | 'gte' | 'lte'; value: number } | { op: 'progression.available'; move: 'train' | 'buy' | 'order' | 'invest' | 'patrol' | 'aid' | 'reconcile'; id?: Id } | {op:'narrative.tag';role:ScopedTag['role'];id:Id;value:boolean};
