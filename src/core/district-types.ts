import type { Id, Condition } from './types.ts';
import type { BodyGraph, BodyCapability } from './body-types.ts';
export interface StoryletDef {
  id: Id; locationId: Id; conditions: Condition[]; eventId: Id; weight: number; priority: number;
  cooldownMinutes: number; cooldownGroup: string; repeat: 'once' | 'daily' | 'repeat'; hidden: boolean; tags: string[];
}
export interface ResidentTemplate {
  id: Id; locationIds: Id[]; start: number; end: number; names: string[]; profession: string;
  appearance: string[]; personality: string[]; behavior: 'trade' | 'repair' | 'guide';
  speciesId: Id; ageYears: number; bodyTemplateId: Id; patchIds: Id[];
}
export interface Resident {
  id: string; templateId: Id; name: string; locationId: Id; profession: string; appearance: string; personality: string;
  speciesId: Id; ageYears: number; body: BodyGraph; persistent: boolean; visits: number; trust: number; lastTalkDay: number; memories: string[];
}
export interface EnemyDef {
  id: Id; name: string; hp: number; reward: number; intents: { label: string; damage: number; guard: number; drain: number }[];
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
export interface EquipmentDef { id: Id; name: string; requires: Condition[]; description: string }
export interface DistrictDefinitions {
  storylets?: StoryletDef[]; residentTemplates?: ResidentTemplate[]; enemies?: EnemyDef[];
  interactions?: InteractionDef[]; textSlots?: TextSlotDef[]; sceneTexts?: SceneTextDef[]; equipment?: EquipmentDef[];
}
export type DistrictEffect =
  | { op: 'world.encounter' | 'resident.talk' | 'resident.help' }
  | { op: 'combat.start'; id: Id }
  | { op: 'combat.turn'; move: 'attack' | 'guard' | 'recover' | 'flee' }
  | { op: 'scene.start'; id: Id }
  | { op: 'scene.act'; move: 'pose' | 'contact' | 'release' | 'pause' | 'resume' | 'exit'; poseId?: string }
  | { op: 'equipment.wear'; id: Id }
  | { op: 'equipment.remove' }
  | { op: 'player.create'; name: string; ageYears: number }
  | { op: 'preference.set'; value: boolean };
export type DistrictCondition =
  | { op: 'day.after'; flagId: Id; days: number }
  | { op: 'scene.state'; value: 'active' | 'paused' | 'none' }
  | { op: 'resident.available' }
  | { op: 'player.created'; value: boolean };
export interface DistrictState {
  version: 1; profile: { name: string; ageYears: number; created: boolean; adultOptional: boolean };
  residents: Resident[]; currentResidentId: string | null; storyletHistory: { id: Id; at: number }[];
  factsAt: Record<Id, number>; discovered: Id[]; inventory: Id[]; equipped: Id | null;
  combat: { enemyId: Id; hp: number; turn: number; log: string[] } | null;
  scene: { definitionId: Id; phase: 'active' | 'paused'; poseId: string; turn: number;
    actors: { id: string; body: BodyGraph; facing: 'front' | 'away'; zone: 'near' | 'across' }[];
    contacts: { playerPartId: string; npcPartId: string; sinceTurn: number }[] } | null;
}
