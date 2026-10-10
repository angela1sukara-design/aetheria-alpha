import type { BodyGraph, BodyPartDef, BodyTemplateDef, BodyPatchDef, TFDef, TFInstance, TFState, BodyCapability } from './body-types.ts';
export type Id = `${string}:${string}`;
export type Scalar = string | number | boolean;
export type Condition =
  | { op: 'all' | 'any'; conditions: Condition[] }
  | { op: 'not'; condition: Condition }
  | { op: 'var.compare'; id: Id; comparison: 'eq' | 'gte' | 'lte'; value: number }
  | { op: 'flag.has'; id: Id; value: boolean }
  | { op: 'location.is'; id: Id }
  | { op: 'time.window'; start: number; end: number }
  | { op: 'event.state'; id: Id; state: 'active' | 'completed' | 'unseen' }
  | { op: 'body.hasPart'; definitionId: Id }
  | { op: 'body.hasCapability'; capability: BodyCapability; count: number }
  | { op: 'tf.state'; id: Id; state: TFState | 'idle' };
export type Effect =
  | { op: 'var.change'; id: Id; amount: number }
  | { op: 'flag.set'; id: Id; value: boolean }
  | { op: 'clock.advance'; minutes: number }
  | { op: 'location.move'; routeId: Id }
  | { op: 'event.start'; id: Id }
  | { op: 'event.advance'; nodeId: string }
  | { op: 'event.exit' }
  | { op: 'tf.apply' | 'tf.enqueue' | 'tf.pause' | 'tf.resume' | 'tf.cancel'; id: Id };
export interface VariableDef { id: Id; label: string; initial: number; min: number; max: number; unit: string }
export interface FlagDef { id: Id; initial: boolean }
export interface HookDef { id: Id; accepts: 'action'; visibility: 'public' }
export interface LocationDef { id: Id; name: string; subtitle: string; textKey: Id; actionHook: Id; map: { x: number; y: number } }
export interface RouteDef { id: Id; from: Id; to: Id }
export interface ActionDef {
  id: Id; label: string; hint: string; group: 'travel' | 'daily' | 'explore' | 'event';
  conditions: Condition[]; effects: Effect[]; resultText: Id;
  context?: { eventId: Id; nodeId: string };
  surface?: 'scene' | 'body';
}
export interface EventNode { id: string; type: 'choice' | 'exit'; textVariants: Id[]; actionIds: Id[]; onEnter: Effect[] }
export interface EventDef { id: Id; startNode: string; nodes: EventNode[] }
export interface PackManifest {
  id: string; namespace: string; version: string; schemaVersion: 1; engineApiVersion: '0.1';
  author: string; status: 'draft' | 'reviewed' | 'approved';
  dependencies: { id: string; version: string; optional: boolean }[];
  requiresCapabilities: string[];
  migrations: []; // Alpha 不伪装有迁移功能；版本不匹配必须隔离。
}
export interface ContentPack {
  manifest: PackManifest; variables: VariableDef[]; flags: FlagDef[]; hooks: HookDef[];
  locations: LocationDef[]; routes: RouteDef[]; actions: ActionDef[]; events: EventDef[];
  texts: Record<Id, string>; contributions: { hookId: Id; actionIds: Id[] }[];
  start?: { locationId: Id; minutes: number };
  bodyParts?: BodyPartDef[]; bodyTemplates?: BodyTemplateDef[]; bodyPatches?: BodyPatchDef[];
  transformations?: TFDef[]; globalActionHooks?: Id[];
}
export interface PackRef { id: string; version: string; hash: string }
export interface EventInstance {
  instanceId: string; definitionId: Id; nodeId: string; status: 'active' | 'completed';
  textByNode: Record<string, Id>; draws: { nodeId: string; value: number }[]; locals: Record<string, Scalar>;
}
export interface ActionIntent { actionId: Id; params?: Record<string, never> }
export interface Change { label: string; before: string | number | boolean; after: string | number | boolean }
export interface ActionResult {
  ok: boolean; code: string; message: string; revision: number;
  text: string; changes: Change[]; requestId: string;
}
export interface Transaction { requestId: string; fingerprint: string; result: ActionResult }
export interface GameState {
  meta: { schemaVersion: 2; engineVersion: '0.1-stage2'; revision: number; packs: PackRef[] };
  clock: { totalMinutes: number; crossedDays: number[] };
  world: { locationId: Id; knownLocationIds: Id[] };
  player: { variables: Record<Id, number>; flags: Record<Id, boolean>; body: BodyGraph | null };
  tfQueues: TFInstance[];
  eventInstances: EventInstance[]; activeEventStack: string[];
  rng: { seed: number; streams: Record<string, { state: number; draws: number }> };
  ledger: { transactions: Transaction[] };
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
