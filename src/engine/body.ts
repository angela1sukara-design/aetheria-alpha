import { clone } from '../core/types.ts';
import type { BodyCapability, BodyGraph, BodyPatchDef, BodyTemplateDef } from '../core/body-types.ts';
import type { Registry } from '../content/registry.ts';
import { RuleError } from '../core/errors.ts';
const fail = (message: string): never => { throw new RuleError('BODY_INVALID', message); };
/** 同一验证器用于模板、变形结果、存档；图不能靠文字宣称有效。 */
export function validateBody(value: unknown, registry: Registry): asserts value is BodyGraph {
  const obj = (v: unknown, keys: string[]): Record<string, unknown> => {
    if (!v || typeof v !== 'object' || Array.isArray(v)) fail('身体图必须是对象。');
    const x = v as Record<string, unknown>;
    if (Object.keys(x).length !== keys.length || Object.keys(x).some(k => !keys.includes(k))) fail('身体图有缺失或未登记字段。');
    return x;
  };
  const token = (v: unknown): string => { if (typeof v !== 'string' || !/^[a-z][a-z0-9_.-]{0,79}$/.test(v)) fail('身体实例/锚点 ID 无效。'); return v as string; };
  const graph = obj(value, ['templateId', 'rootPartId', 'parts', 'edges']);
  const template = registry.bodyTemplate(graph.templateId as never);
  const root = token(graph.rootPartId);
  if (root !== template.rootPartId) fail('身体根节点与模板规则不一致。');
  if (!Array.isArray(graph.parts) || graph.parts.length < 1 || graph.parts.length > 128 || !Array.isArray(graph.edges) || graph.edges.length !== graph.parts.length - 1) fail('身体图节点/边数量无效。');
  const parts = new Map<string, ReturnType<Registry['bodyPart']>>();
  for (const raw of graph.parts as unknown[]) {
    const p = obj(raw, ['instanceId', 'definitionId']); const id = token(p.instanceId);
    if (parts.has(id)) fail('身体部件实例 ID 重复。');
    parts.set(id, registry.bodyPart(p.definitionId as never));
  }
  if (parts.get(root)?.kind !== 'root' || [...parts].some(([id, p]) => id !== root && p.kind === 'root')) fail('身体图必须有且只有一个根部件。');
  const parents = new Map<string, string>(); const usage = new Map<string, number>();
  for (const raw of graph.edges as unknown[]) {
    const e = obj(raw, ['parentPartId', 'childPartId', 'anchorId']);
    const parent = token(e.parentPartId), child = token(e.childPartId), anchorId = token(e.anchorId);
    if (!parts.has(parent) || !parts.has(child) || child === root || parents.has(child)) fail('连接端点不存在，或子部件有多个父节点。');
    const anchor = parts.get(parent)!.anchors.find(x => x.id === anchorId);
    if (!anchor || !anchor.accepts.includes(parts.get(child)!.kind)) fail(`连接锚点 ${parent}/${anchorId} 不接受该部件。`);
    const key = `${parent}/${anchorId}`, count = (usage.get(key) ?? 0) + 1;
    if (count > anchor!.capacity) fail(`连接锚点 ${key} 已达到容量。`);
    usage.set(key, count); parents.set(child, parent);
  }
  // 沿唯一父边抵达根才算连通；不能把闭合循环冒充一个有效身体。
  for (const id of parts.keys()) {
    const visited = new Set<string>(); let cursor = id;
    while (cursor !== root) {
      if (visited.has(cursor) || !parents.has(cursor)) fail('身体图断开或存在循环。');
      visited.add(cursor); cursor = parents.get(cursor)!;
    }
  }
}
export function instantiateBody(template: BodyTemplateDef): BodyGraph {
  return clone({ templateId: template.id, rootPartId: template.rootPartId, parts: template.parts, edges: template.edges });
}
/** 补丁在独立图上整体验证；替换父部件造成的不兼容子连接同样拒绝。 */
export function patchedBody(body: BodyGraph, patch: BodyPatchDef, registry: Registry): BodyGraph {
  const next = clone(body);
  for (const op of patch.operations) {
    const part = next.parts.find(x => x.instanceId === op.partId);
    if (op.type === 'attach') {
      if (part) fail(`这个位置已有「${registry.bodyPart(part.definitionId).label}」，请先处理现有结构。`);
      registry.bodyPart(op.definitionId);
      next.parts.push({ instanceId: op.partId, definitionId: op.definitionId });
      next.edges.push({ parentPartId: op.parentPartId, childPartId: op.partId, anchorId: op.anchorId });
    } else {
      if (!part || part.instanceId === next.rootPartId) fail('当前没有可处理的对应部件，或它是身体根部件。');
      if (op.type === 'replace') { registry.bodyPart(op.definitionId); part!.definitionId = op.definitionId; }
      else {
        if (next.edges.some(e => e.parentPartId === op.partId)) fail('请先处理这个部件上仍连接的子部件。');
        next.parts = next.parts.filter(x => x !== part); next.edges = next.edges.filter(e => e.childPartId !== op.partId);
      }
    }
  }
  validateBody(next, registry);
  return next;
}
export function patchTargets(body: BodyGraph, patch: BodyPatchDef, registry: Registry): string[] {
  const targets = new Set<string>();
  for (const op of patch.operations) {
    targets.add(`part:${op.partId}`);
    if (op.type === 'attach') targets.add(`anchor:${op.parentPartId}/${op.anchorId}`);
    else {
      const edge = body.edges.find(x => x.childPartId === op.partId);
      if (edge) targets.add(`anchor:${edge.parentPartId}/${edge.anchorId}`);
      // 替换或删除父部件会影响全部子连接，不能绕过正在改造的锚点。
      const current = body.parts.find(x => x.instanceId === op.partId);
      for (const anchor of current ? registry.bodyPart(current.definitionId).anchors : []) targets.add(`anchor:${op.partId}/${anchor.id}`);
      for (const e of body.edges.filter(x => x.parentPartId === op.partId)) { targets.add(`anchor:${e.parentPartId}/${e.anchorId}`); targets.add(`part:${e.childPartId}`); }
    }
  }
  return [...targets].sort();
}
export function bodyTraits(body: BodyGraph | null, registry: Registry): Record<BodyCapability, number> {
  const traits = { grasp: 0, walk: 0, hear: 0, balance: 0, tailGrip: 0 };
  for (const part of body?.parts ?? []) for (const cap of registry.bodyPart(part.definitionId).capabilities) traits[cap]++;
  return traits;
}
