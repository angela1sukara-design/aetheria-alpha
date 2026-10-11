import type { Change, GameState, Id } from '../core/types.ts';
import type { BodyGraph, TFDef, TFInstance } from '../core/body-types.ts';
import type { Registry } from '../content/registry.ts';
import { RuleError } from '../core/errors.ts';
import { patchedBody, patchTargets } from './body.ts';
import { advanceClock, MINUTES_PER_DAY } from './clock.ts';
const pending = (job: TFInstance): boolean => ['active', 'paused', 'blocked'].includes(job.status);
export function currentTF(state: GameState, id: Id): TFInstance | undefined {
  return state.tfQueues.find(x => x.definitionId === id && pending(x));
}
function requireBody(state: GameState): BodyGraph {
  if (!state.player.body) throw new RuleError('NO_BODY', '当前内容包没有提供初始身体模板。');
  return state.player.body;
}
function targets(def: TFDef, body: BodyGraph, registry: Registry): string[] {
  return [...new Set(def.stages.flatMap(s => s.patchId ? patchTargets(body, registry.bodyPatch(s.patchId), registry) : []))].sort();
}
function validatePlan(state: GameState, registry: Registry, def: TFDef, ownJob?: TFInstance): void {
  const body = requireBody(state); const wanted = targets(def, body, registry);
  for (const job of state.tfQueues.filter(x => pending(x) && x !== ownJob)) {
    const other = registry.transformation(job.definitionId);
    if (targets(other, body, registry).some(x => wanted.includes(x))) {
      throw new RuleError('TF_CONFLICT', `这个部位正在进行「${other.label}」。暂停仍保留改造预约；完成或取消后可修改。`);
    }
  }
  let planned = body;
  for (const stage of def.stages.filter(x => !ownJob?.completedStageIds.includes(x.id))) {
    if (stage.patchId) planned = patchedBody(planned, registry.bodyPatch(stage.patchId), registry);
  }
  if (JSON.stringify(planned) === JSON.stringify(body)) throw new RuleError('TF_UNCHANGED', '当前身体已经是这个形态。');
}
/** 只读预览用于 UI 与事务预检。它不抽随机、不扣钱、不增加进度。 */
export function transformationCheck(state: GameState, registry: Registry, id: Id, op: 'tf.apply' | 'tf.enqueue' | 'tf.pause' | 'tf.resume' | 'tf.cancel'): { pass: boolean; reason: string } {
  try {
    const def = registry.transformation(id), job = currentTF(state, id);
    if (op === 'tf.apply' || op === 'tf.enqueue') {
      if (def.source !== (op === 'tf.apply' ? 'free' : 'story')) throw new RuleError('TF_SOURCE', '变化入口与内容定义不一致。');
      if (job) throw new RuleError('TF_ALREADY_QUEUED', '这项改造已经安排好了。');
      validatePlan(state, registry, def);
    } else {
      if (!job) throw new RuleError('TF_NOT_PENDING', '没有正在进行的这项改造。');
      if (op === 'tf.pause' && job.status !== 'active') throw new RuleError('TF_NOT_ACTIVE', '这项改造当前没有推进。');
      if (op === 'tf.resume') {
        if (!['paused', 'blocked'].includes(job.status)) throw new RuleError('TF_NOT_PAUSED', '这项改造已经在推进。');
        validatePlan(state, registry, def, job);
      }
    }
    return { pass: true, reason: '' };
  } catch (error) {
    if (error instanceof RuleError) return { pass: false, reason: error.message };
    throw error;
  }
}
function applyStage(job: TFInstance, stage: TFDef['stages'][number], state: GameState, registry: Registry, changes: Change[]): void {
  if (stage.patchId) {
    const patch = registry.bodyPatch(stage.patchId);
    const occupied = state.district?.scene?.contacts.map(x => x.playerPartId) ?? [];
    if (patch.operations.some(op => occupied.includes(op.partId))) throw new RuleError('TF_CONTACT_OCCUPIED', '变化部位正在接触中。释放接触并恢复改造后继续。');
    state.player.body = patchedBody(requireBody(state), patch, registry);
    changes.push({ label: '身体变化', before: registry.transformation(job.definitionId).label, after: patch.summary });
  }
  job.completedStageIds.push(stage.id);
  if (stage.textKey) changes.push({ label: '变化感受', before: '此刻', after: registry.text(stage.textKey) });
  changes.push({ label: registry.transformation(job.definitionId).label, before: '阶段推进', after: stage.label });
}
export function performTransformation(op: 'tf.apply' | 'tf.enqueue' | 'tf.pause' | 'tf.resume' | 'tf.cancel', id: Id, state: GameState, registry: Registry, requestId: string, sourceActionId: Id, changes: Change[]): void {
  const check = transformationCheck(state, registry, id, op);
  if (!check.pass) throw new RuleError('TF_REJECTED', check.reason);
  const def = registry.transformation(id);
  if (op === 'tf.apply' || op === 'tf.enqueue') {
    // requestId 幂等由 executor 保证；实例另保留来源，保存后依然可追溯。
    const key = `${requestId}/${id}`;
    if (state.tfQueues.some(x => x.idempotencyKey === key)) throw new RuleError('TF_DUPLICATE', '同一事务不能重复创建同一变化。');
    const job: TFInstance = { instanceId: `tf-${key}`, definitionId: id, sourceActionId, idempotencyKey: key, elapsedMinutes: 0, completedStageIds: [], status: 'active', startedAt: state.clock.totalMinutes, blocker: '' };
    state.tfQueues.push(job);
    if (op === 'tf.apply') { for (const stage of def.stages) applyStage(job, stage, state, registry, changes); job.status = 'completed'; }
    else changes.push({ label: def.label, before: '未开始', after: '改造准备中' });
  } else {
    const job = currentTF(state, id)!; const before = job.status;
    job.status = op === 'tf.pause' ? 'paused' : op === 'tf.resume' ? 'active' : 'cancelled'; job.blocker = '';
    if (op === 'tf.resume') {
      // blocked 停在临界分钟；恢复时重试该阶段，不能保存为“已到边界却未结算”的 active。
      for (const stage of def.stages.filter(x => !job.completedStageIds.includes(x.id) && x.atMinutes <= job.elapsedMinutes)) applyStage(job, stage, state, registry, changes);
      if (job.completedStageIds.length === def.stages.length) job.status = 'completed';
    }
    const labels = { active: '进行中', paused: '已暂停', blocked: '等待处理', cancelled: '已取消', completed: '已完成' };
    changes.push({ label: def.label, before: labels[before], after: labels[job.status] });
  }
}
/** 时间只在行动事务中推进；按 TF 阶段/午夜分段，多个队列并行消耗同一段世界时间。 */
export function advanceTransformationTime(state: GameState, minutes: number, registry: Registry, changes: Change[]): void {
  // 先用同一个时钟验证器检查完整时长，避免越界/负数使循环失控。
  if (!Number.isSafeInteger(minutes) || minutes < 0 || minutes > 10080 || !Number.isSafeInteger(state.clock.totalMinutes + minutes)) throw new RuleError('INVALID_DURATION', '一次行动时间必须为 0–10080 分钟整数。');
  let remaining = minutes;
  while (remaining > 0) {
    const active = state.tfQueues.filter(x => x.status === 'active');
    let step = Math.min(remaining, MINUTES_PER_DAY - state.clock.totalMinutes % MINUTES_PER_DAY);
    for (const job of active) {
      const stage = registry.transformation(job.definitionId).stages.find(x => !job.completedStageIds.includes(x.id));
      if (stage) step = Math.min(step, Math.max(0, stage.atMinutes - job.elapsedMinutes));
    }
    const completedBefore = active.reduce((n, x) => n + x.completedStageIds.length, 0);
    advanceClock(state, step); remaining -= step;
    for (const job of active) {
      job.elapsedMinutes += step; const def = registry.transformation(job.definitionId);
      for (const stage of def.stages.filter(x => !job.completedStageIds.includes(x.id) && x.atMinutes <= job.elapsedMinutes)) {
        try { applyStage(job, stage, state, registry, changes); }
        catch (error) {
          if (!(error instanceof RuleError)) throw error;
          // 身体临界点不兼容时停在该边界。世界行动仍继续，失败阶段不标完成。
          job.status = 'blocked'; job.blocker = error.message;
          changes.push({ label: def.label, before: '进行中', after: `需要处理：${error.message}` }); break;
        }
      }
      if (job.status === 'active' && job.completedStageIds.length === def.stages.length) job.status = 'completed';
    }
    if (step === 0 && active.every(x => x.status === 'active') && active.reduce((n, x) => n + x.completedStageIds.length, 0) === completedBefore) throw new RuleError('TF_STALLED', '改造阶段无法推进，本次事务未提交。');
  }
}
