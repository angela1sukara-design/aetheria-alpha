import type { Id } from './types.ts';
export const PART_KINDS = ['root', 'head', 'ear', 'arm', 'hand', 'leg', 'foot', 'tail'] as const;
export type PartKind = typeof PART_KINDS[number];
export const BODY_CAPABILITIES = ['grasp', 'walk', 'hear', 'balance', 'tailGrip'] as const;
export type BodyCapability = typeof BODY_CAPABILITIES[number];
export interface BodyPartDef {
  id: Id; label: string; kind: PartKind; material: 'organic' | 'mechanical';
  capabilities: BodyCapability[];
  anchors: { id: string; accepts: PartKind[]; capacity: number }[];
}
export interface BodyPartInstance { instanceId: string; definitionId: Id }
export interface BodyEdge { parentPartId: string; childPartId: string; anchorId: string }
export interface BodyGraph {
  templateId: Id; rootPartId: string; parts: BodyPartInstance[]; edges: BodyEdge[];
}
export interface BodyTemplateDef { id: Id; label: string; initial: boolean; rootPartId: string; parts: BodyPartInstance[]; edges: BodyEdge[] }
export type GraphOperation =
  | { type: 'replace'; partId: string; definitionId: Id }
  | { type: 'attach'; partId: string; definitionId: Id; parentPartId: string; anchorId: string }
  | { type: 'remove'; partId: string };
export interface BodyPatchDef { id: Id; label: string; summary: string; operations: GraphOperation[] }
export interface TFStage { id: string; atMinutes: number; label: string; patchId?: Id; textKey?: Id }
export interface TFDef { id: Id; label: string; source: 'free' | 'story'; stages: TFStage[] }
export type TFState = 'active' | 'paused' | 'blocked' | 'completed' | 'cancelled';
export interface TFInstance {
  instanceId: string; definitionId: Id; sourceActionId: Id; idempotencyKey: string;
  elapsedMinutes: number; completedStageIds: string[]; status: TFState;
  startedAt: number; blocker: string;
}
