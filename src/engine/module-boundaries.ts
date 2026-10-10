import type { Id, Scalar } from '../core/types.ts';
/** 后续模块的挂接方向，只定义最小数据边界。本轮不声称实现身体/TF/NPC/姿态/战斗。 */
export interface ModuleStateEnvelope<T> { schemaVersion: number; data: T }
export interface BodyGraph {
  rootPartId: string;
  parts: { instanceId: string; definitionId: Id; anchorIds: string[]; materialId: Id }[];
  edges: { parentPartId: string; childPartId: string; anchorId: string; type: 'attach' | 'articulation' }[];
}
export interface LocalSlot { ownerId: string; anchorId?: string; capacity: number; occupiedBy: string[] }
export interface InteractionScene {
  id: string; phase: 'active' | 'exitRequested' | 'resolved';
  actorPoses: { actorId: string; poseId: Id; facing: string }[];
  contacts: { sourceActorId: string; sourcePartId: string; targetActorId: string; targetPartId: string; contactType: Id }[];
  reservations: { actorId: string; partId: string; actionId: Id }[];
}
export interface TFQueueEntry { instanceId: string; sourceId: Id; targetPartIds: string[]; progress: number; idempotencyKey: string }
export interface NPCInstance { instanceId: string; definitionId: Id; facts: Record<Id, Scalar>; bodyId: string; scheduleId: Id }
export interface CombatInstance { instanceId: string; definitionId: Id; actorIds: string[]; turn: number; aftermathEventId: Id }
// 不把这些空结构放进 GameState，也不生成对应按钮。
// 新模块需增加版本化的 GameState 字段、存档校验、明确 opcode，再通过 executor 的草稿提交。
// 插槽不代表 Hook/日程；BodyGraph 不推定固定肢体数；InteractionScene 不放进 BodyGraph。
