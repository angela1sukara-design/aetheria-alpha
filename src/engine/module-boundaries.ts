import type { Id } from '../core/types.ts';
/** 已实现身体/TF和固定NPC；姿态、资源占用与战斗继续保持独立边界。 */
export interface ModuleStateEnvelope<T> { schemaVersion: number; data: T }
// 身体/TF与固定NPC已实现；其余模块继续独立预留。
export type { BodyGraph, TFInstance as TFQueueEntry } from '../core/body-types.ts';
export interface LocalSlot { ownerId: string; anchorId?: string; capacity: number; occupiedBy: string[] }
export interface InteractionScene {
  id: string; phase: 'active' | 'exitRequested' | 'resolved';
  actorPoses: { actorId: string; poseId: Id; facing: string }[];
  contacts: { sourceActorId: string; sourcePartId: string; targetActorId: string; targetPartId: string; contactType: Id }[];
  reservations: { actorId: string; partId: string; actionId: Id }[];
}
export type { NPCState as NPCInstance } from '../core/npc-types.ts';
export interface CombatInstance { instanceId: string; definitionId: Id; actorIds: string[]; turn: number; aftermathEventId: Id }
// 未实现的 LocalSlot/InteractionScene/Combat 不放进 GameState，也不生成对应按钮。
// 新模块需增加版本化的 GameState 字段、存档校验、明确 opcode，再通过 executor 的草稿提交。
// 插槽不代表 Hook/日程；BodyGraph 不推定固定肢体数；InteractionScene 不放进 BodyGraph。
