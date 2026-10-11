import type { ContentPack, GameState, Id, PackRef } from '../core/types.ts';

export type Service = 'home' | 'market' | 'workshop' | 'clinic' | 'commons';
export interface TemplateRules {
  environmentTags: string[]; weight: number; requiresTags: string[]; excludesTags: string[];
  compatibleTags: string[]; requiresPacks: string[];
  combination: { requiresTemplates: string[]; excludesTemplates: string[]; boosts: { tag: string; multiplier: number }[] };
  contributes: { tags: string[]; npcTemplateIds: Id[]; eventIds: Id[]; tfIds: Id[] };
}
export type ReferenceTemplate = TemplateRules & { id: string } & (
  | { kind: 'environment'; data: { name: string; description: string; tags: string[] } }
  | { kind: 'place'; data: { service: Service; names: string[]; description: string; economy: string[]; professions: string[] } }
  | { kind: 'npc'; data: { residentTemplateId: Id } }
  | { kind: 'faction'; data: { name: string; activities: string[] } }
  | { kind: 'event'; data: { label: string; prompt: string; completeText: string; minutes: number; reward: number } }
);
export interface ReferencePack { format: 'aetheria-reference'; schemaVersion: 1; id: string; version: string; templates: ReferenceTemplate[] }
export interface GenerationRulePack {
  format: 'aetheria-generation-rules'; schemaVersion: 1; id: string; version: string;
  requiredServices: Service[]; locationCount: number; npcCount: number; extraConnections: number;
  startMinutes: number; workStart: number; workEnd: number; leisureEnd: number;
}
export interface WorldDef {
  id: string; name: string; startLocationId: Id;
  regions: { id: string; name: string; environmentTags: string[]; ecologyTags: string[] }[];
  locations: { id: Id; regionId: string; templateId: string; service: Service; tags: string[]; economy: string[]; professions: string[]; factionId: string }[];
  factions: { id: string; templateId: string; name: string; activities: string[]; locationIds: Id[] }[];
  eventPool: Id[];
  // 已生成定义的完整快照；新参考库永远不参与旧档恢复。
  packs: ContentPack[];
}
export interface WorldAgent {
  residentId: string; originLocationId: Id; factionId: string;
  relationships?: { otherResidentId: string; kind: 'coworker' | 'neighbor' | 'acquaintance'; strength: number }[];
  schedule: { start: number; end: number; locationId: Id; activity: 'home' | 'work' | 'leisure' }[];
}
export interface WorldInstance {
  version: 1; definition: WorldDef;
  generation: { generatorVersion: string; seed: number; rules: GenerationRulePack; rulesHash: string; references: PackRef[]; contentPacks: PackRef[]; parameters: { locationCount: number; npcCount: number }; selectedTemplateIds: string[] };
  agents: WorldAgent[];
  simulation: { version: 1; lastMinute: number };
}
export interface GeneratedWorld { world: WorldInstance; state: GameState; registry: import('../content/registry.ts').Registry }
