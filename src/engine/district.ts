import { residentAppearance } from './query.ts';
import { activityEligibility } from '../world/adaptation.ts';
import type { GameState, Id } from '../core/types.ts';
import type { Registry } from '../content/registry.ts';
import type { DistrictState } from '../core/district-types.ts';
import { draw } from './rng.ts';
import { instantiateBody, patchedBody } from './body.ts';
import { evaluate } from './conditions.ts';
import { RuleError } from '../core/errors.ts';
import { conversationResident,structuredConversation } from './personality.ts';
import { serviceAvailable, usesFunctions } from './entity-functions.ts';
export function initialDistrict(): DistrictState {
  return { version: 1, profile: { name: '旅人', created: false, adultOptional: false }, residents: [], currentResidentId: null,
    storyletHistory: [], factsAt: {}, discovered: [], inventory: [], equipped: null, combat: null, scene: null };
}
export function district(state: GameState): DistrictState { if (!state.district) throw new RuleError('MODULE_ABSENT', '未安装街区内容。'); return state.district; }
export function encounter(state: GameState, registry: Registry, includeEvents = true): Id | undefined {
  const d = district(state), now = state.clock.totalMinutes, day = Math.floor(now / 1440);
  const templates = registry.residentTemplates.filter(t => t.locationIds.includes(state.world.locationId) && (t.start < t.end ? now % 1440 >= t.start && now % 1440 < t.end : now % 1440 >= t.start || now % 1440 < t.end));
  if (state.worldInstance) {
    // 生成居民已经拥有稳定实例与日程；遭遇只选择在场者，不能复制或重抽身份。
    const present = d.residents.filter(r => r.locationId === state.world.locationId);
    const previous = present.findIndex(r => r.id === d.currentResidentId);
    d.currentResidentId = present.length ? present[(previous + 1) % present.length]!.id : null;
  } else if (templates.length) {
    // 每个地点与职业实例稳定；跨日与读档不重建已生成的人。
    const stream = `residents:${state.world.locationId}`;
    const t = templates[Math.floor(draw(state, stream) * templates.length)]!;
    const id = `resident:${state.world.locationId}:${t.id}`;
    let resident = d.residents.find(r => r.id === id);
    if (!resident) {
      const pick = (a: string[]) => a[Math.floor(draw(state, stream) * a.length)]!;
      let body = instantiateBody(registry.bodyTemplate(t.bodyTemplateId));
      if (t.patchIds.length) body = patchedBody(body, registry.bodyPatch(t.patchIds[Math.floor(draw(state, stream) * t.patchIds.length)]!), registry);
      resident = { id, templateId: t.id, name: pick(t.names), locationId: state.world.locationId, profession: t.profession,
        appearance: pick(t.appearance), personality: pick(t.personality), speciesId: t.speciesId, ageYears: t.ageYears, body,
        persistent: false, visits: 0, trust: 0, lastTalkDay: -1, memories: [] };
      d.residents.push(resident);
    }
    d.currentResidentId = resident.id;
  } else d.currentResidentId = null;
  // Browsing residents is a separate public hook: it must not consume a storylet,
  // draw its RNG stream, or trap a conversation behind another event.
  if (!includeEvents) return undefined;
  let candidates = registry.storylets.filter(s => s.locationId === state.world.locationId && s.conditions.every(c => evaluate(c, state, registry).pass)
    && !d.storyletHistory.some(h => (h.id === s.id && (s.repeat === 'once' || (s.repeat === 'daily' && Math.floor(h.at / 1440) === day)))
      || (registry.storylets.find(x => x.id === h.id)?.cooldownGroup === s.cooldownGroup && now - h.at < s.cooldownMinutes)));
  if (!candidates.length) return undefined;
  const priority = Math.max(...candidates.map(s => s.priority));
  candidates = candidates.filter(s => s.priority === priority).sort((a, b) => a.id.localeCompare(b.id, 'en'));
  let roll = draw(state, `storylets:${state.world.locationId}`) * candidates.reduce((n, s) => n + s.weight, 0);
  const selected = candidates.find(s => (roll -= s.weight) < 0) ?? candidates.at(-1)!;
  d.storyletHistory.push({ id: selected.id, at: now });
  if (!d.discovered.includes(selected.id)) d.discovered.push(selected.id);
  return selected.eventId;
}
export function residentInteraction(state: GameState, registry: Registry, help: boolean): string {
  const d = district(state), r = !help&&structuredConversation(state,registry)?conversationResident(state):d.residents.find(x => x.id === d.currentResidentId && x.locationId === state.world.locationId);
  if(r&&r.locationId!==state.world.locationId)throw new RuleError('CONVERSATION_LEFT','交谈对象已经离开。');
  if (!r) throw new RuleError('NO_RESIDENT', '先留意附近的人。');
  const day = Math.floor(state.clock.totalMinutes / 1440), t = registry.residentTemplates.find(x => x.id === r.templateId)!;
  if (help) {
    if(usesFunctions(state,registry)&&!serviceAvailable(state,registry,{subject:'resident',service:'work'}))throw new RuleError('RESIDENT_NOT_EMPLOYER','对方此刻不提供工作。');
    if(!activityEligibility(r.body,t,registry).pass)throw new RuleError('RESIDENT_ACTIVITY_BODY','对方当前身体不满足这项工作的适配。');
    if (r.memories.includes(`help:${day}`)) throw new RuleError('ALREADY_HELPED', '今天的事情已经处理好。明天再见。');
    const stamina = state.player.variables['core:stamina'] ?? 0;
    const energy = state.player.variables['core:energy'] ?? 0;
    if (stamina < 8) throw new RuleError('EXHAUSTED', '需要8点体力。');
    state.player.variables['core:stamina'] = stamina - 8;
    // 脑力疲劳可选 −2 energy
    if (energy >= 2) state.player.variables['core:energy'] = energy - 2;
    r.memories.push(`help:${day}`); r.trust += 2; r.persistent = true;
    const line = { trade: '你帮忙核对称重与收据。对方把一份摊位余粮交给你，叮嘱雨前记得带回家。', repair: '你托稳松动的灯罩，对方接好电线。街角重新亮起来，你们约好有故障可以互相照应。', guide: '你们把模糊的路标重新擦亮。对方在你的路线纸上补了一条能避开积水的通道。' }[t.behavior];
    state.player.variables['core:money'] = Math.min(registry.variable('core:money').max,state.player.variables['core:money']!+3);
    return `${r.name}与你确认了手边的事情。${t.services?.work?.text ?? t.dialogue?.help ?? line}（体力−8，零钱+3；今天只能协助一次。）`;
  }
  if (r.lastTalkDay !== day) { r.visits++; r.trust++; r.lastTalkDay = day; r.memories.push(`talk:${day}`); }
  r.persistent = r.visits >= 2 || r.trust >= 2;
  const speech = r.visits > 1 ? t.dialogue?.repeat ?? '“又见面了。上次那条路还好走吗？”对方记得你们曾经的交谈。' : t.dialogue?.intro ?? '对方报出名字，说这片街区总有人需要搭一把手。';
  const sentence = (text: string) => /[。！？]$/.test(text) ? text : text + '。';
  return `${r.name}，${r.profession}，${sentence(residentAppearance(state,registry,r.id))}性情：${sentence(r.personality)}${speech}${r.persistent ? '你们互相留下了联络方式；身份与经历已记入人物册。' : t.services&&!t.services.work?'你记住了这个名字，下次见面还可以继续交谈。':'你记住了这个名字。下一天再聊，或帮一次忙，就能留下联络。'}`;
}
