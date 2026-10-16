import type { ActionDef, Effect, GameState } from '../core/types.ts';
import type { ResidentServices, ServiceRequirement, LocationFacility } from '../core/function-types.ts';
import type { Registry } from '../content/registry.ts';
import { environment } from './query.ts';

export const facilitiesForService: Record<string, LocationFacility[]> = {
  home: ['seat', 'bed'], market: ['seat', 'workplace'], workshop: ['seat', 'workplace', 'training'],
  clinic: ['seat', 'care', 'workplace'], commons: ['seat', 'publicDesk', 'workplace'],
};
export function selectedResident(s: GameState) {
  return s.district?.residents.find(n => n.id === s.district?.currentResidentId && n.locationId === s.world.locationId);
}
export function residentServices(s: GameState, r: Registry): ResidentServices | undefined {
  const n = selectedResident(s); if (!n) return undefined;
  const template = r.residentTemplates.find(t => t.id === n.templateId);
  if (!template) return undefined;
  // 未携带新服务快照的旧世界不重新生成职业、商品或身份。
  if (template.services !== undefined) return template.services;
  return template.behavior === 'trade' || template.behavior === 'repair'
    ? { work: { label: '协助处理手边的工作', text: template.dialogue?.help ?? '你按对方的说明完成了一次交接。' } }
    : {};
}
export function serviceAvailable(s: GameState, r: Registry, need: ServiceRequirement): boolean {
  const location = r.location(s.world.locationId);
  let facilities=location.facilities;
  if(!facilities){const existingService=environment(s,r).service;facilities=existingService.known?facilitiesForService[existingService.value!]:undefined;}
  if (need.subject === 'location') {
    if (!facilities) return need.service==='wait';
    switch (need.service) {
      case 'rest': return facilities.includes('seat') || facilities.includes('bed') || (s.player.variables['core:stamina']??100)<8;
      case 'sleep': return facilities.includes('bed');
      case 'care': return facilities.includes('care');
      case 'work': return facilities.includes('workplace');
      case 'train': return facilities.includes('training');
      case 'publicDesk': return facilities.includes('publicDesk');
      case 'light': return facilities.includes('lightSwitch');
      case 'wait': return true;
    }
  }
  const n = selectedResident(s); if (!n) return false;
  if (need.service === 'talk') return true;
  const agent = s.worldInstance?.agents.find(a => a.residentId === n.id);
  if (agent && agent.originLocationId !== s.world.locationId) return false;
  const services = residentServices(s, r);if(!services)return false;
  if (need.service === 'work') return !!services.work && serviceAvailable(s, r, { subject: 'location', service: 'work' });
  if (need.service === 'trade') return !!need.id && !!services.trade?.includes(need.id);
  if (need.service === 'order') return !!services.orders && serviceAvailable(s,r,{subject:'location',service:'work'});
  if (need.service === 'invest') return !!services.investments && serviceAvailable(s,r,{subject:'location',service:'work'});
  return !!need.id && !!services.teach?.includes(need.id) && serviceAvailable(s, r, { subject: 'location', service: 'train' });
}
export function requiredFunction(a: ActionDef, effects: Effect[]): ServiceRequirement | undefined {
  // A story may require a care/work facility without itself being treatment or
  // employment. Its explicit prerequisites still run through evaluate.
  if(effects.some(e=>e.op==='event.start'))return undefined;
  const explicit = a.conditions.find(c => c.op === 'service.available');
  if (explicit?.op === 'service.available') return explicit;
  for (const e of effects) {
    if (e.op === 'resident.talk') return { subject: 'resident', service: 'talk' };
    if (e.op === 'resident.help') return { subject: 'resident', service: 'work' };
    if (e.op === 'narrative.start' && e.kind === 'conversation') return { subject: 'resident', service: 'talk' };
    if (e.op === 'progression.act' && e.move === 'buy') return { subject: 'resident', service: 'trade', id: e.id };
    if (e.op === 'progression.act' && e.move === 'train') return { subject: 'resident', service: 'teach', id: e.id };
    if (e.op === 'progression.act' && e.move === 'order') return {subject:'resident',service:'order'};
    if (e.op === 'progression.act' && e.move === 'invest') return {subject:'resident',service:'invest'};
    if (e.op === 'progression.act' && ['aid', 'reconcile', 'patrol'].includes(e.move)) return { subject: 'location', service: 'publicDesk' };
    if (e.op === 'environment.setLight') return { subject: 'location', service: 'light' };
  }
  if (a.id === 'progression:action.rest') return { subject: 'location', service: 'rest' };
  if (a.id === 'progression:action.sleep') return { subject: 'location', service: 'sleep' };
  if (a.id === 'progression:action.care') return { subject: 'location', service: 'care' };
  return undefined;
}
/** 纯展示修饰：执行仍使用相同效果和事务校验，不更改状态。 */
export function describeResidentAction(a: ActionDef, s: GameState, r: Registry): ActionDef {
  const n = selectedResident(s); if (!n) return a;
  const t = r.residentTemplates.find(t => t.id === n.templateId);
  if (!t?.services) return a;
  if (a.effects.some(e => e.op === 'resident.help') && t.services.work)
    return { ...a, label: t.services.work.label, hint: `${n.name} · 15分钟 · 体力−8 · 精力最多−2 · 零钱+3 · 每日一次` };
  const lesson = a.effects.find(e => e.op === 'progression.act' && e.move === 'train');
  if (lesson?.op === 'progression.act' && lesson.id)
    return { ...a, label: `向${n.name}请教${r.variable(lesson.id).label}`, hint: '45分钟 · 零钱8 · 体力8 · 精力4 · 对应能力+1' };
  const purchase = a.effects.find(e => e.op === 'progression.act' && e.move === 'buy');
  if (purchase?.op === 'progression.act' && purchase.id)
    return { ...a, hint: `${n.name}的货物 · ${a.hint}` };
  return a;
}
export function functionKey(need: ServiceRequirement): string | undefined {
  return (need.subject === 'location' && ['rest','care','wait'].includes(need.service)) || (need.subject==='resident'&&['work','talk'].includes(need.service)) ? need.subject + ':' + need.service : undefined;
}
export function usesFunctions(s:GameState,r:Registry):boolean {
  const n=selectedResident(s);return r.location(s.world.locationId).facilities!==undefined||!!r.residentTemplates.find(t=>t.id===n?.templateId)?.services;
}
