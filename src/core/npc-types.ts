import type { Id } from './types.ts';
export const RELATION_FIELDS = ['familiarity', 'trust'] as const;
export type RelationField = typeof RELATION_FIELDS[number];
export interface SpeciesDef { id: Id; label: string; intelligent: boolean; adultAgeYears: number }
export interface NPCDef {
  id: Id; canonKey: string; name: string; role: string; descriptionText: Id;
  speciesId: Id; ageYears: number | null; topicHook: Id;
  schedule: { start: number; end: number; locationId: Id | null; activityText: Id }[];
}
export interface NPCMemoryDef { id: Id; npcId: Id; textKey: Id }
export interface NPCMemory {
  definitionId: Id; recordedAt: number; sourceActionId: Id; sourceRequestId: string;
}
export interface NPCState {
  instanceId: string; definitionId: Id; discovered: boolean;
  relationship: Record<RelationField, number>; memories: NPCMemory[];
}
