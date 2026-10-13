import type { Condition, Id } from './types.ts';
import type { Service } from '../world/types.ts';

export const PLAYER_RELATIONS = ['colleague', 'neighbor', 'acquaintance', 'grudge', 'debt'] as const;
export type PlayerRelation = typeof PLAYER_RELATIONS[number];
export const RELATION_LABELS: Record<PlayerRelation, string> = { colleague: '同事', neighbor: '邻居', acquaintance: '熟人', grudge: '旧怨', debt: '人情债' };
export interface JournalEntry { id: string; title: string; unlock: Condition[]; steps: { conditions: Condition[]; text: string }[] }
export interface QuestChoice {
  id: string; label: string; result: string; requires: Id[]; minutes: number; energy: number;
  complete: boolean; memory: string | null;
}
export interface QuestStage {
  id: string; name: string; locationType: Service; objective: string; flag: Id;
  actions: string[]; requires: Id[]; next: string[];
}
export interface QuestSide {
  id: string; type: 'main-related' | 'character' | 'atmosphere'; locationType: Service;
  requiresRelation: PlayerRelation | null; objective: string; flag: Id;
  effectOnMain: string | null; journalText: string | null;
}
export interface QuestSource {
  mainQuest: { id: string; goal: string; paths: { id: string; style: string; stages: QuestStage[] }[]; journal: { unlockFlag: Id; text: string }[] };
  sideQuests: QuestSide[];
  relationRules: { types: PlayerRelation[]; perResident: '1-2'; usage: string };
}
export interface QuestContent {
  format: 'aetheria-quest-content'; schemaVersion: 1; id: string; version: string; sourceHash: string;
  source: QuestSource;
  execution: { stages: Record<string, QuestChoice[]>; sides: Record<string, { title: string; prompt: string; choices: QuestChoice[] }> };
}
export interface QuestBinding {
  id: string; locationId: Id; residentId: string | null; flag: Id; eventId: Id; entryActionId: Id;
}
export interface QuestSnapshot {
  id: string; version: string; sourceHash: string; contentHash: string;
  stages: QuestBinding[]; sides: QuestBinding[]; journal: JournalEntry[];
}
