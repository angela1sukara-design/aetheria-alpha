import { resolveTag } from '../content/tags.ts';
import type { Registry } from '../content/registry.ts';
import { clone, stableJson } from '../core/types.ts';
import type { Id } from '../core/types.ts';
import type { GenerationRulePack, ReferencePack } from './types.ts';
import { BODY_CAPABILITIES } from '../core/body-types.ts';

export const services = ['home', 'market', 'workshop', 'clinic', 'commons'] as const;
export function object(value: unknown, keys: string[]): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw Error('生成数据需要对象。');
  const x = value as Record<string, unknown>;
  if (Object.keys(x).sort().join('|') !== [...keys].sort().join('|')) throw Error('生成数据含未知或缺失字段。');
  return x;
}
function withOptional(value: unknown, required: string[], optional: string[]): Record<string, unknown> {
  return object(value, [...required, ...optional.filter(key => !!value && typeof value === 'object' && Object.hasOwn(value, key))]);
}
export function integer(v: unknown, min: number, max: number): void {
  if (!Number.isSafeInteger(v) || (v as number) < min || (v as number) > max) throw Error('生成整数超出范围。');
}
export function string(v: unknown): void { if (typeof v !== 'string' || !v.trim() || v.length > 10000) throw Error('生成文字无效。'); }
export function list(v: unknown, check: (x: unknown) => void, min = 0, max = 1000): void {
  if (!Array.isArray(v) || v.length < min || v.length > max) throw Error('生成列表长度无效。');
  v.forEach(check);
}
export function strings(v: unknown, min = 0): void { list(v, string, min); if (new Set(v as string[]).size !== (v as string[]).length) throw Error('生成列表重复。'); }
export async function hash(value: unknown): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(stableJson(value)));
  return [...new Uint8Array(digest)].map(x => x.toString(16).padStart(2, '0')).join('');
}
export function parseRules(raw: unknown): GenerationRulePack {
  const x = withOptional(raw, ['format', 'schemaVersion', 'id', 'version', 'requiredServices', 'locationCount', 'npcCount', 'extraConnections', 'startMinutes', 'workStart', 'workEnd', 'leisureEnd'], ['eventsPerLocation', 'activitiesPerLocation']);
  if (x.format !== 'aetheria-generation-rules' || x.schemaVersion !== 1) throw Error('不支持的生成规则格式。');
  string(x.id); version(x.version); strings(x.requiredServices, 5);
  if (stableJson([...(x.requiredServices as string[])].sort()) !== stableJson([...services].sort())) throw Error('首版必须覆盖住宿、市场、工坊、诊所、公共空间。');
  integer(x.locationCount, 5, 20); integer(x.npcCount, 3, 40); integer(x.extraConnections, 0, 30);
  integer(x.startMinutes, 0, 1439); integer(x.workStart, 1, 1000); integer(x.workEnd, 1, 1438); integer(x.leisureEnd, 1, 1439);
  if (!(Number(x.workStart) < Number(x.workEnd) && Number(x.workEnd) < Number(x.leisureEnd))) throw Error('工作和休闲日程必须按时间排序。');
  if (x.eventsPerLocation !== undefined) integer(x.eventsPerLocation, 1, 3);
  if (x.activitiesPerLocation !== undefined) integer(x.activitiesPerLocation, 0, 3);
  return clone(raw) as GenerationRulePack;
}
function version(v: unknown): void { if (typeof v !== 'string' || !/^\d+\.\d+\.\d+$/.test(v)) throw Error('生成版本必须为三段版本。'); }
export function parseReference(raw: unknown, registry: Registry): ReferencePack {
  const p = object(raw, ['format', 'schemaVersion', 'id', 'version', 'templates']);
  if (p.format !== 'aetheria-reference' || ![1,2].includes(p.schemaVersion as number)) throw Error('不支持的参考包格式。');
  string(p.id); version(p.version); const seen = new Set<string>();
  list(p.templates, value => {
    const t = object(value, ['id', 'kind', 'data', 'environmentTags', 'weight', 'requiresTags', 'excludesTags', 'compatibleTags', 'requiresPacks', 'combination', 'contributes']);
    string(t.id); if (seen.has(t.id as string)) throw Error('参考模板 ID 重复。'); seen.add(t.id as string);
    integer(t.weight, 1, 1000);
    for (const key of ['environmentTags', 'requiresTags', 'excludesTags', 'compatibleTags', 'requiresPacks']) strings(t[key]);
    const combo = object(t.combination, ['requiresTemplates', 'excludesTemplates', 'boosts']);
    strings(combo.requiresTemplates); strings(combo.excludesTemplates);
    list(combo.boosts, b => { const x = object(b, ['tag', 'multiplier']); string(x.tag); integer(x.multiplier, 1, 10); });
    const c = object(t.contributes, ['tags', 'npcTemplateIds', 'eventIds', 'tfIds']);
    for (const k of Object.keys(c)) strings(c[k]);
    if (t.kind === 'environment') { const d = object(t.data, ['name', 'description', 'tags']); string(d.name); string(d.description); strings(d.tags, 1); }
    else if (t.kind === 'place') { const d = withOptional(t.data, ['service', 'names', 'description', 'economy', 'professions'], ['ambience','facilities']); if(d.facilities!==undefined){strings(d.facilities);if((d.facilities as string[]).some(f=>!['seat','bed','care','workplace','training','publicDesk','lightSwitch'].includes(f)))throw Error('未知地点设施。');} if (!(services as readonly unknown[]).includes(d.service)) throw Error('地点用途无效。'); strings(d.names, 1); string(d.description); strings(d.economy, 1); strings(d.professions, 1); if (d.ambience !== undefined) { const a = object(d.ambience, ['morning','day','evening','night']); Object.values(a).forEach(string); } }
    else if (t.kind === 'npc') { const d = object(t.data, ['residentTemplateId']); string(d.residentTemplateId); }
    else if (t.kind === 'faction') { const d = object(t.data, ['name', 'activities']); string(d.name); strings(d.activities, 1); }
    else if (t.kind === 'event') { const d = object(t.data, ['label', 'prompt', 'completeText', 'minutes', 'reward']); for (const k of ['label', 'prompt', 'completeText']) string(d[k]); integer(d.minutes, 1, 120); integer(d.reward, 0, 20); }
    else if (t.kind === 'activity') { const d = object(t.data, ['label','description','minutes','energyChange','moneyChange','healthChange','capabilities']); string(d.label); string(d.description); integer(d.minutes, 5, 120); integer(d.energyChange, -12, 12); integer(d.moneyChange, -8, 8); integer(d.healthChange, 0, 8); strings(d.capabilities); if ((d.capabilities as string[]).some(c => !(BODY_CAPABILITIES as readonly string[]).includes(c))) throw Error('活动身体能力未实现。'); }
    else throw Error('未支持的参考模板类型。');
    if(p.schemaVersion===2||registry.tags.length){
      const check=(tag:string)=>{const id=resolveTag(registry,tag,'generation.v1');if(p.schemaVersion===2&&registry.tag(id).status!=='active')throw Error('新参考规则不可引用废弃 Tag。');if(p.schemaVersion===2&&tag!==id)throw Error('参考包 v2 必须使用规范 Tag ID。');return id;};
      const all=[...t.environmentTags as string[],...t.requiresTags as string[],...t.excludesTags as string[],...t.compatibleTags as string[],...c.tags as string[],...(combo.boosts as {tag:string}[]).map(b=>b.tag),...(t.kind==='environment'?(t.data as {tags:string[]}).tags:[])];all.forEach(check);
      const requires=(t.requiresTags as string[]).map(check),excludes=(t.excludesTags as string[]).map(check);if(requires.some(x=>excludes.includes(x)))throw Error('规则同时要求和排除同一语义。');
      if(t.kind==='place'&&(c.tags as string[]).some(tag=>{const id=check(tag);return id.startsWith('foundation:service.')&&id!==('foundation:service.'+(t.data as {service:string}).service);}))throw Error('地点 service 与重复服务 Tag 矛盾。');
      if(p.schemaVersion===2&&(c.tags as string[]).some(tag=>tag.startsWith('foundation:service.')))throw Error('参考包 v2 的 service Tag 必须从 data.service 派生。');
    }
    // 缺少所需包的模板可保留在库里，但不能进入候选池。
    if ((t.requiresPacks as string[]).every(id => registry.packs.some(p => p.id === id))) {
      const npc = (id: unknown) => { if (!registry.residentTemplates.some(n => n.id === id)) throw Error('参考居民模板未注册。'); };
      if (t.kind === 'npc') npc((t.data as { residentTemplateId: string }).residentTemplateId);
      (c.npcTemplateIds as string[]).forEach(npc);
      for (const id of c.tfIds as Id[]) registry.transformation(id);
      for (const id of c.eventIds as Id[]) {
        // 需要固定人物在场的剧情不能移植成无参与者的随机地点故事。
        if (registry.event(id).participantIds?.length) throw Error('地点事件贡献必须不依赖固定人物。');
        validatePortableEvent(id, registry);
      }
    }
  }, 1, 500);
  return clone(raw) as ReferencePack;
}

/** v0.1 只移植自足事件：避免把固定城市的移动/战斗后续或付费唯一出口带入随机街区。 */
function validatePortableEvent(id: Id, registry: Registry): void {
  const event = registry.event(id);
  if (event.rating === 'adult') throw Error('首版参考事件只接受通用评级。');
  const forbidden = new Set(['location.move', 'event.start', 'scene.start', 'combat.start', 'player.create']);
  for (const node of event.nodes) {
    if (node.onEnter.some(e => !['event.exit', 'flag.set', 'clock.advance', 'var.change'].includes(e.op) || (e.op === 'var.change' && e.amount < 0))) throw Error('参考事件进入节点不能有阻断退出的效果。');
    for (const aid of node.actionIds) if (registry.action(aid).effects.some(e => forbidden.has(e.op))) throw Error('参考事件不能依赖固定地图、固定人物或嵌套后续。');
  }
  const exits = new Set(event.nodes.filter(n => n.onEnter.some(e => e.op === 'event.exit')).map(n => n.id));
  for (let size = -1; size !== exits.size;) {
    size = exits.size;
    for (const node of event.nodes) if (node.actionIds.some(aid => {
      const a = registry.action(aid);
      return !a.conditions.length && a.effects.length > 0 && a.effects.every(e => e.op === 'event.exit' || (e.op === 'event.advance' && exits.has(e.nodeId)));
    })) exits.add(node.id);
  }
  if (event.nodes.some(n => !exits.has(n.id))) throw Error('参考事件的每个节点必须有无条件、免费退出路径。');
}
