import { validateBody } from '../engine/body.ts';
import type { GameState, Id } from '../core/types.ts';
import type { Registry } from '../content/registry.ts';
import type { NPCMemory, NPCState } from '../core/npc-types.ts';
export function validateNPCState(value: GameState, registry: Registry): void {
  const bad = (message: string): never => { throw new Error(`NPC 存档无效：${message}`); };
  const object = (v: unknown, keys: string[]): Record<string, unknown> => {
    if (!v || typeof v !== 'object' || Array.isArray(v) || Object.keys(v).sort().join('|') !== [...keys].sort().join('|')) bad('未知字段或缺少字段。');
    return v as Record<string, unknown>;
  };
  if (!Array.isArray(value.npcs) || value.npcs.length !== registry.npcs.length) bad('固定人物集合不符。');
  const ids = new Set<string>();
  for (const raw of value.npcs) {
    const o = object(raw, ['instanceId', 'definitionId', 'discovered', 'relationship', 'memories', ...(value.meta.schemaVersion===4&&Object.hasOwn(raw,'body')?['body']:[])]);
    const def = registry.npc(o.definitionId as Id);
    if(o.body!==undefined&&o.body!==null){if(!registry.npcBodies.some(b=>b.npcId===def.id))bad('人物没有显式身体声明。');validateBody(o.body,registry);}
    if(registry.npcBodies.some(b=>b.npcId===def.id)&&!o.body)bad('已声明的 NPC 身体缺失。');
    if (ids.has(def.id) || o.instanceId !== `fixed:${def.id}` || typeof o.discovered !== 'boolean') bad('身份或发现标记不符。'); ids.add(def.id);
    const rel = object(o.relationship, ['familiarity', 'trust']);
    for (const v of Object.values(rel)) if (!Number.isSafeInteger(v) || (v as number) < -100 || (v as number) > 100) bad('关系数值越界。');
    if (!Array.isArray(o.memories)) bad('记忆不是数组。');
    const memories = o.memories as NPCMemory[], seen = new Set<Id>();
    const expected: NPCState['relationship'] = { familiarity: 0, trust: 0 };
    let previousTime = -1;
    for (const rawMemory of memories) {
      const m = object(rawMemory, ['definitionId', 'recordedAt', 'sourceActionId', 'sourceRequestId']);
      const memory = registry.npcMemory(m.definitionId as Id);
      if (memory.npcId !== def.id || seen.has(memory.id)) bad('记忆所有者错误或重复。'); seen.add(memory.id);
      if (!Number.isSafeInteger(m.recordedAt) || (m.recordedAt as number) < 0 || (m.recordedAt as number) < previousTime || (m.recordedAt as number) > value.clock.totalMinutes) bad('记忆时间无效。');
      previousTime = m.recordedAt as number;
      const tx = value.ledger.transactions.find(x => x.requestId === m.sourceRequestId);
      if (!tx || JSON.parse(tx.fingerprint).actionId !== m.sourceActionId) bad('来源事务缺失或错配。');
      const a = registry.action(m.sourceActionId as Id);
      const effects = a.effects.flatMap(e => {
        if (e.op === 'event.start') return [e, ...registry.event(e.id).nodes.find(n => n.id === registry.event(e.id).startNode)!.onEnter];
        if (e.op === 'event.advance' && a.context) return [e, ...registry.event(a.context.eventId).nodes.find(n => n.id === e.nodeId)!.onEnter];
        return [e];
      });
      const effect = effects.find(e => e.op === 'npc.remember' && e.npcId === def.id && e.memoryId === memory.id);
      if (!effect || effect.op !== 'npc.remember') throw new Error('NPC 存档无效：来源行动没有登记该记忆。');
      // 关系不是随意可写的数字：从每项一次性记忆的真实来源重建并核对。
      for (const field of ['familiarity', 'trust'] as const) expected[field] = Math.max(-100, Math.min(100, expected[field] + effect.relationship[field]));
    }
    if (o.discovered !== (memories.length > 0) || expected.familiarity !== rel.familiarity || expected.trust !== rel.trust) bad('发现/关系与经历不一致。');
  }
}
