import { entityBody, entityKey, PLAYER } from '../engine/query.ts';
import { entityRef } from '../content/foundation-schema.ts';
import type { GameState } from '../core/types.ts';
import type { Registry } from '../content/registry.ts';
import { patchTargets } from '../engine/body.ts';
/** 不接受任意进度/阶段布尔；已完成阶段必须是定义的时间前缀。 */
export function validateTFState(state: GameState, registry: Registry): void {
  const bad = (reason: string): never => { throw new Error(`TF 存档无效：${reason}`); };
  if (!Array.isArray(state.tfQueues)) bad('队列不是数组。');
  const ids = new Set<string>(), keys = new Set<string>(); const occupied = new Set<string>();
  for (const job of state.tfQueues) {
    if (!job || typeof job !== 'object' || Array.isArray(job) || Object.keys(job).sort().join('|') !== ['instanceId', 'definitionId', 'sourceActionId', 'idempotencyKey', 'elapsedMinutes', 'completedStageIds', 'status', 'startedAt', 'blocker', ...(state.meta.schemaVersion===4&&job.target?['target']:[])].sort().join('|')) bad('实例字段缺失或未登记。');
    if (typeof job.instanceId !== 'string' || !job.instanceId.length || typeof job.idempotencyKey !== 'string' || !job.idempotencyKey.length || ids.has(job.instanceId) || keys.has(job.idempotencyKey)) bad('实例或防重键重复/无效。');
    ids.add(job.instanceId); keys.add(job.idempotencyKey);
    if(job.target)entityRef(job.target);
    const def = registry.transformation(job.definitionId); const action = registry.action(job.sourceActionId);
    const suffix = !job.target||job.target.kind==='player'?`/${def.id}`:`/${entityKey(job.target)}/${def.id}`;
    if (!job.idempotencyKey.endsWith(suffix) || job.instanceId !== `tf-${job.idempotencyKey}`) bad('实例来源无效。');
    const request = job.idempotencyKey.slice(0, -suffix.length);
    const transaction = state.ledger.transactions.find(x => x.requestId === request);
    if (!transaction || JSON.parse(transaction.fingerprint).actionId !== action.id || !action.effects.some(e => e.op === (def.source === 'free' ? 'tf.apply' : 'tf.enqueue') && e.id === def.id && entityKey(e.target)===entityKey(job.target))) bad('没有对应的创建事务。');
    const duration = def.stages.at(-1)!.atMinutes;
    if (!Number.isSafeInteger(job.elapsedMinutes) || job.elapsedMinutes < 0 || job.elapsedMinutes > duration || !Number.isSafeInteger(job.startedAt) || job.startedAt < 0 || job.startedAt > state.clock.totalMinutes || job.elapsedMinutes > state.clock.totalMinutes - job.startedAt) bad('进度/时间范围错误。');
    if (!Array.isArray(job.completedStageIds) || job.completedStageIds.length > def.stages.length || job.completedStageIds.some((id, i) => id !== def.stages[i].id || def.stages[i].atMinutes > job.elapsedMinutes)) bad('阶段不构成合法时间前缀。');
    if (!['active', 'paused', 'blocked', 'completed', 'cancelled'].includes(job.status) || typeof job.blocker !== 'string') bad('实例状态无效。');
    const next = def.stages[job.completedStageIds.length];
    if (job.status === 'completed' && (next || job.elapsedMinutes !== duration)) bad('完成状态与阶段不符。');
    if (def.source === 'free' && (job.status !== 'completed' || job.elapsedMinutes !== 0)) bad('自由塑形不是即时完成状态。');
    if (['active', 'paused', 'blocked'].includes(job.status)) {
      if (!next || (job.status === 'blocked' ? next.atMinutes !== job.elapsedMinutes || !job.blocker : next.atMinutes <= job.elapsedMinutes)) bad('推进状态与临界阶段不符。');
      const body=entityBody(state,job.target??PLAYER);if(!body.known)bad('没有实际身体。');
      const targets = new Set(def.stages.flatMap(s => s.patchId ? patchTargets(body.known?body.value:null!, registry.bodyPatch(s.patchId), registry) : []));
      for (const target of targets) {const key=entityKey(job.target)+'/'+target;if (occupied.has(key)) bad('待完成队列占用冲突。'); occupied.add(key); }
    }
    if (job.status !== 'blocked' && job.blocker) bad('非阻塞状态不应有阻塞原因。');
  }
}
