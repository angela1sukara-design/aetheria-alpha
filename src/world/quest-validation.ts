import type { GameState, Id } from '../core/types.ts';
import type { Registry } from '../content/registry.ts';
import { object, string, list } from './schema.ts';

/** Restore saved bindings directly; never consult today's authoring source or reroll NPCs. */
export function validateQuestSnapshot(state: GameState, registry: Registry): void {
  const world = state.worldInstance!;
  const snapshot = world.definition.quests;
  const questPacks = registry.packs.filter(p => ['generated/cyber-apex-main', 'generated/cyber-apex-side'].includes(p.id));
  if (!snapshot) { if (questPacks.length) throw Error('缺少任务绑定快照。'); return; }
  object(snapshot, ['id', 'version', 'sourceHash', 'contentHash', 'stages', 'sides', 'journal']);
  string(snapshot.id); string(snapshot.version);
  if (questPacks.length !== 2 || questPacks.some(p => p.version !== snapshot.version) || !/^[a-f0-9]{64}$/.test(snapshot.sourceHash) || !/^[a-f0-9]{64}$/.test(snapshot.contentHash)) throw Error('任务来源或包版本无效。');
  if (world.agents.some(a => !a.playerRelations)) throw Error('任务世界缺少玩家关系标签。');
  const ids = new Set<string>();
  const check = (raw: unknown, namespace: 'main' | 'side') => {
    const b = raw as NonNullable<typeof snapshot>['stages'][number];
    object(b, ['id', 'locationId', 'residentId', 'flag', 'eventId', 'entryActionId']);
    string(b.id); if (ids.has(b.id)) throw Error('任务绑定 ID 重复。'); ids.add(b.id);
    if (!world.definition.locations.some(l => l.id === b.locationId) || !b.flag.startsWith(namespace + ':flag.')) throw Error('任务地点或旗标无效。');
    registry.flag(b.flag);
    const event = registry.event(b.eventId), action = registry.action(b.entryActionId);
    if (!b.eventId.startsWith(namespace + ':') || !b.entryActionId.startsWith(namespace + ':') || event.textMode !== 'fixed' || action.context || !registry.actionsAt(b.locationId).some(a => a.id === b.entryActionId) || !action.effects.some(e => e.op === 'event.start' && e.id === b.eventId)) throw Error('任务入口与快照不一致。');
    if (!action.conditions.some(c => c.op === 'location.is' && c.id === b.locationId) || !action.conditions.some(c => c.op === 'flag.has' && c.id === b.flag && !c.value)) throw Error('任务入口缺少地点或完成保护。');
    if (b.residentId !== null) {
      const agent = world.agents.find(a => a.residentId === b.residentId);
      if (!agent || !agent.schedule.some(s => s.locationId === b.locationId) || event.residentIds?.length !== 1 || event.residentIds[0] !== b.residentId) throw Error('任务居民与快照不一致。');
      if (!action.conditions.some(c => c.op === 'resident.present' && c.residentId === b.residentId) || !action.conditions.some(c => c.op === 'resident.relation' && c.residentId === b.residentId && agent.playerRelations?.includes(c.relation))) throw Error('任务居民缺少在场或关系约束。');
    } else if (event.residentIds?.length) throw Error('无人物任务不能声明居民。');
    if (namespace === 'main' && b.residentId !== null) throw Error('主线不能依赖可缺席的支线居民。');
  };
  list(snapshot.stages, b => check(b, 'main'), 6, 12);
  list(snapshot.sides, b => check(b, 'side'), 0, 100);
  const journalIds = new Set<string>();
  const conditions = (raw: unknown) => list(raw, c => {
    const condition = c as { op: string; id: Id; value: boolean };
    object(c, ['op', 'id', 'value']);
    if (condition.op !== 'flag.has' || typeof condition.value !== 'boolean') throw Error('任务日志条件无效。'); registry.flag(condition.id);
  }, 0, 20);
  list(snapshot.journal, raw => {
    const j = raw as typeof snapshot.journal[number]; object(j, ['id', 'title', 'unlock', 'steps']); string(j.id); string(j.title);
    if (journalIds.has(j.id)) throw Error('任务日志 ID 重复。'); journalIds.add(j.id); conditions(j.unlock);
    list(j.steps, raw => { const s = raw as typeof j.steps[number]; object(s, ['conditions', 'text']); conditions(s.conditions); string(s.text); }, 1, 20);
  }, 3, 100);
}
