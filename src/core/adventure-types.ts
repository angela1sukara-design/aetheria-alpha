import type { Condition, Effect, Id } from './types.ts';
import type { EntityRef } from './query-types.ts';
import type { EquipmentSlot } from './district-types.ts';

export const NARRATIVE_KINDS = ['defeat', 'encounter', 'exploration', 'daily', 'conversation', 'quest', 'transformation', 'ending'] as const;
export type NarrativeKind = typeof NARRATIVE_KINDS[number];
export interface ScopedTag { role: 'player' | 'opponent' | 'environment'; tagId: Id }
export interface NarrativeProfile { id: Id; enemyId?: Id; npcId?: Id; tags: Id[]; goals: Id[]; tendencies: { tagId: Id; weight: number }[]; defeatTags?: ScopedTag[] }
export interface NarrativeChoice { label: string; resultText: Id; conditions: Condition[]; effects: Effect[]; setTags: ScopedTag[]; unsetTags: ScopedTag[]; next: string | null }
export interface NarrativeNode { id: Id; kind: NarrativeKind; stage: string; title: string; textKey: Id; requiresTags: ScopedTag[]; excludesTags: ScopedTag[]; conditions: Condition[]; tendencies: { tagId: Id; weight: number }[]; weight: number; priority: number; maxVisits: number; choices: NarrativeChoice[] }
export interface NarrativeState { instanceId: string; kind: NarrativeKind; stage: string; nodeId: Id; profileId: Id | null; opponentName: string; actor: EntityRef | null; tags: ScopedTag[]; visits: Record<Id, number>; log: string[]; steps: number }
export const ADVENTURE_FIELDS = ['assets', 'influence', 'safety', 'reputation', 'orders', 'contracts'] as const;
export type AdventureField = typeof ADVENTURE_FIELDS[number];
export interface AdventureState {
  version: 1; assets: number; influence: number; safety: number; reputation: number; orders: number; contracts: number;
  victories: Record<Id, number>; daily: Record<string, number>; equipment: Partial<Record<EquipmentSlot, Id>>;
  story: NarrativeState | null; journal: { at: number; title: string; text: string }[];
  lastCombat: { enemyId: Id; enemyName: string; result: 'victory' | 'defeat' | 'escape'; turn: number; tags: ScopedTag[] } | null;
}
export interface AdventureDefinitions { narrativeProfiles?: NarrativeProfile[]; narrativeNodes?: NarrativeNode[] }
export type AdventureEffect = { op: 'narrative.start'; kind: NarrativeKind; profileId?: Id } | { op: 'narrative.choose'; index: number } | { op: 'adventure.change'; field: AdventureField; amount: number } | { op: 'progression.act'; move: 'train' | 'buy' | 'order' | 'invest' | 'patrol' | 'aid' | 'reconcile'; id?: Id };
export type AdventureCondition = { op: 'adventure.compare'; field: AdventureField | 'victories'; comparison: 'eq' | 'gte' | 'lte'; value: number } | { op: 'progression.available'; move: 'train' | 'buy' | 'order' | 'invest' | 'patrol' | 'aid' | 'reconcile'; id?: Id } | {op:'narrative.tag';role:ScopedTag['role'];id:Id;value:boolean};
