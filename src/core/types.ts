import type { EntityRef, FoundationDefinitions, QueryCondition } from './query-types.ts';
import type { BodyGraph, BodyPartDef, BodyTemplateDef, BodyPatchDef, TFDef, TFInstance, TFState, BodyCapability } from './body-types.ts';
import type { NPCDef, NPCState, NPCMemoryDef, SpeciesDef, RelationField } from './npc-types.ts';
import type { DistrictDefinitions, DistrictEffect, DistrictCondition, DistrictState } from './district-types.ts';
import type { AdventureCondition, AdventureDefinitions, AdventureEffect, AdventureState } from './adventure-types.ts';
import type { LocationFacility, ServiceRequirement } from './function-types.ts';
export type Id = `${string}:${string}`;
export type Scalar = string | number | boolean;
export type Condition =
  | ({ op: 'service.available' } & ServiceRequirement)
  | AdventureCondition
  | QueryCondition
  | DistrictCondition
  | { op: 'all' | 'any'; conditions: Condition[] }
  | { op: 'not'; condition: Condition }
  | { op: 'var.compare'; id: Id; comparison: 'eq' | 'gte' | 'lte'; value: number }
  | { op: 'flag.has'; id: Id; value: boolean }
  | { op: 'location.is'; id: Id }
  | { op: 'time.window'; start: number; end: number }
  | { op: 'event.state'; id: Id; state: 'active' | 'completed' | 'unseen' }
  | { op: 'body.hasPart'; definitionId: Id; target?: EntityRef }
  | { op: 'body.hasCapability'; capability: BodyCapability; count: number; target?: EntityRef }
  | { op: 'tf.state'; id: Id; state: TFState | 'idle'; target?: EntityRef }
  | { op: 'tf.available'; id: Id; target?: EntityRef }
  | { op: 'npc.present'; npcId: Id }
  | { op: 'npc.memory'; npcId: Id; memoryId: Id; value: boolean }
  | { op: 'npc.relation'; npcId: Id; field: RelationField; comparison: 'eq' | 'gte' | 'lte'; value: number };
export type Effect =
  | AdventureEffect
  | { op: 'environment.setLight'; locationId: Id; value: 'lit' | 'dark' }
  | DistrictEffect
  | { op: 'var.change'; id: Id; amount: number }
  | { op: 'flag.set'; id: Id; value: boolean }
  | { op: 'clock.advance'; minutes: number }
  | { op: 'location.move'; routeId: Id }
  | { op: 'event.start'; id: Id }
  | { op: 'event.advance'; nodeId: string }
  | { op: 'event.exit' }
  | { op: 'tf.apply' | 'tf.enqueue' | 'tf.pause' | 'tf.resume' | 'tf.cancel'; id: Id; target?: EntityRef }
  | { op: 'npc.remember'; npcId: Id; memoryId: Id; relationship: Record<RelationField, number> };
export interface VariableDef { id: Id; label: string; initial: number; min: number; max: number; unit: string }
export interface FlagDef { id: Id; initial: boolean }
export interface HookDef { id: Id; accepts: 'action'; visibility: 'public' }
export interface LocationDef { id: Id; name: string; subtitle: string; textKey: Id; actionHook: Id; map: { x: number; y: number }; facilities?: LocationFacility[]; proseScenery?: import('./prose-types.ts').ProseScenery[] }
export type RouteDistanceTier = 'adjacent' | 'far' | 'cross';
export interface RouteDef {
  id: Id;
  from: Id;
  to: Id;
  /** 距离档；缺省 adjacent */
  distanceTier?: RouteDistanceTier;
  /** 推进分钟；缺省按 tier 默认表 */
  durationMinutes?: number;
}
export interface ActionDef {
  id: Id; label: string; hint: string; group: 'travel' | 'daily' | 'explore' | 'event';
  conditions: Condition[]; effects: Effect[]; resultText: Id;
  context?: { eventId: Id; nodeId: string };
  surface?: 'scene' | 'body';
}
export interface EventBinding {
  environmentTags?: Id[];
  resident?: { tags: Id[]; service?: import('./function-types.ts').ServiceRequirement & { subject: 'resident' } };
  enemy?: 'environment';
  partKind?: import('./body-types.ts').PartKind;
}
export interface EventContext {
  locationId: Id;
  residentId?: string;
  enemyId?: Id;
  enemyRuleId?: Id;
  partId?: string;
  fills: Record<string, string>;
}
export interface EventNode {
  id: string; type: 'choice' | 'exit'; textVariants: Id[]; actionIds: Id[]; onEnter: Effect[];
  /** First matching complete paragraph; effects share the normal transaction. */
  textCases?: { when: Condition[]; text: Id; onEnter: Effect[] }[];
  /** Alias of the sole continuation action, with exactly the same settlement. */
  skipActionId?: Id;
  combatOutcomes?: { victory: string; defeat: string; escape: string };
}
export interface EventDef { id: Id; startNode: string; nodes: EventNode[]; participantIds?: Id[]; residentIds?: string[]; textMode?: 'fixed'; rating?: 'general' | 'adult'; binding?: EventBinding }
export interface PackManifest {
  id: string; namespace: string; version: string; schemaVersion: 1 | 2; engineApiVersion: '0.1';
  author: string; status: 'draft' | 'reviewed' | 'approved';
  dependencies: { id: string; version: string; optional: boolean }[];
  requiresCapabilities: string[];
  migrations: []; // 通用内容包迁移未实现；仅存档codec允许已发布官方版本的精确升级。
}
export interface ContentPack extends DistrictDefinitions, FoundationDefinitions, AdventureDefinitions {
  manifest: PackManifest; variables: VariableDef[]; flags: FlagDef[]; hooks: HookDef[];
  locations: LocationDef[]; routes: RouteDef[]; actions: ActionDef[]; events: EventDef[];
  texts: Record<Id, string>; contributions: { hookId: Id; actionIds: Id[] }[];
  start?: { locationId: Id; minutes: number };
  bodyParts?: BodyPartDef[]; bodyTemplates?: BodyTemplateDef[]; bodyPatches?: BodyPatchDef[];
  transformations?: TFDef[]; globalActionHooks?: Id[];
  species?: SpeciesDef[]; npcs?: NPCDef[]; npcMemories?: NPCMemoryDef[];
}
export interface PackRef { id: string; version: string; hash: string }
export interface EventInstance {
  instanceId: string; definitionId: Id; nodeId: string; status: 'active' | 'completed';
  textByNode: Record<string, Id>; draws: { nodeId: string; value: number }[]; locals: Record<string, Scalar>;
  context?: EventContext;
}
export interface ActionIntent { actionId: Id; params?: { name?: string; ageYears?: number } }
export interface Change { label: string; before: string | number | boolean; after: string | number | boolean }
export interface ActionResult {
  ok: boolean; code: string; message: string; revision: number;
  text: string; changes: Change[]; requestId: string;
}
export interface EventEntry { eventId: Id; nodeId: string; textId: Id }
export interface Transaction { requestId: string; fingerprint: string; result: ActionResult; narrativeChoice?: { nodeId: Id; index: number }; narrativeChoices?: { nodeId: Id; index: number }[]; eventEntries?: EventEntry[] }
export interface LedgerCheckpoint { revision: number; requests: string; evidence: Transaction[]; completedEvents: Id[] }
export interface GameState {
  adventure?: AdventureState;
  environment?: Record<Id, { light?: 'lit' | 'dark' }>;
  worldInstance?: import('../world/types.ts').WorldInstance;
  district?: DistrictState;
  meta: { schemaVersion: 3 | 4; engineVersion: '0.1-stage3' | '0.2-foundation'; revision: number; packs: PackRef[] };
  clock: { totalMinutes: number; crossedDays: number[]; recovery?: { aftertasteMinutes: number; skillMinutes: number; sanityHostileMinutes?: number } };
  world: { locationId: Id; knownLocationIds: Id[] };
  player: { variables: Record<Id, number>; flags: Record<Id, boolean>; body: BodyGraph | null };
  tfQueues: TFInstance[];
  npcs: NPCState[];
  eventInstances: EventInstance[]; activeEventStack: string[];
  rng: { seed: number; streams: Record<string, { state: number; draws: number }> };
  ledger: { transactions: Transaction[]; checkpoint?: LedgerCheckpoint };
}
export interface ActionOption { definition: ActionDef; available: boolean; reason: string }
export interface GameView { location: LocationDef; sceneText: string; eventTitle?: string; actions: ActionOption[]; state: GameState }

export function clone<T>(value: T): T { return structuredClone(value); }
export function freeze<T>(value: T): T {
  if (value && typeof value === 'object') {
    for (const item of Object.values(value)) freeze(item);
    Object.freeze(value);
  }
  return value;
}
export function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.entries(value).sort(([a], [b]) => a.localeCompare(b, 'en')).map(([key, v]) => `${JSON.stringify(key)}:${stableJson(v)}`).join(',')}}`;
  }
  return JSON.stringify(value);
}
