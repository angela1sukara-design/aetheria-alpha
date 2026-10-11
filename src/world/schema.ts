import type { Registry } from '../content/registry.ts';
import { clone, stableJson } from '../core/types.ts';
import type { Id } from '../core/types.ts';
import type { GenerationRulePack, ReferencePack } from './types.ts';

export const services = ['home', 'market', 'workshop', 'clinic', 'commons'] as const;
export function object(value: unknown, keys: string[]): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw Error('生成数据需要对象。');
  const x = value as Record<string, unknown>;
  if (Object.keys(x).sort().join('|') !== [...keys].sort().join('|')) throw Error('生成数据含未知或缺失字段。');
  return x;
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
  const x = object(raw, ['format', 'schemaVersion', 'id', 'version', 'requiredServices', 'locationCount', 'npcCount', 'extraConnections', 'startMinutes', 'workStart', 'workEnd', 'leisureEnd']);
  if (x.format !== 'aetheria-generation-rules' || x.schemaVersion !== 1) throw Error('不支持的生成规则格式。');
  string(x.id); version(x.version); strings(x.requiredServices, 5);
  if (stableJson([...(x.requiredServices as string[])].sort()) !== stableJson([...services].sort())) throw Error('首版必须覆盖住宿、市场、工坊、诊所、公共空间。');
  integer(x.locationCount, 5, 20); integer(x.npcCount, 3, 40); integer(x.extraConnections, 0, 30);
  integer(x.startMinutes, 0, 1439); integer(x.workStart, 1, 1000); integer(x.workEnd, 1, 1438); integer(x.leisureEnd, 1, 1439);
  if (!(Number(x.workStart) < Number(x.workEnd) && Number(x.workEnd) < Number(x.leisureEnd))) throw Error('工作和休闲日程必须按时间排序。');
  return clone(raw) as GenerationRulePack;
}
function version(v: unknown): void { if (typeof v !== 'string' || !/^\d+\.\d+\.\d+$/.test(v)) throw Error('生成版本必须为三段版本。'); }
export function parseReference(raw: unknown, registry: Registry): ReferencePack {
  const p = object(raw, ['format', 'schemaVersion', 'id', 'version', 'templates']);
  if (p.format !== 'aetheria-reference' || p.schemaVersion !== 1) throw Error('不支持的参考包格式。');
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
    else if (t.kind === 'place') { const d = object(t.data, ['service', 'names', 'description', 'economy', 'professions']); if (!(services as readonly unknown[]).includes(d.service)) throw Error('地点用途无效。'); strings(d.names, 1); string(d.description); strings(d.economy, 1); strings(d.professions, 1); }
    else if (t.kind === 'npc') { const d = object(t.data, ['residentTemplateId']); string(d.residentTemplateId); }
    else if (t.kind === 'faction') { const d = object(t.data, ['name', 'activities']); string(d.name); strings(d.activities, 1); }
    else if (t.kind === 'event') { const d = object(t.data, ['label', 'prompt', 'completeText', 'minutes', 'reward']); for (const k of ['label', 'prompt', 'completeText']) string(d[k]); integer(d.minutes, 1, 120); integer(d.reward, 0, 20); }
    else throw Error('未支持的参考模板类型。');
    // 缺少所需包的模板可保留在库里，但不能进入候选池。
    if ((t.requiresPacks as string[]).every(id => registry.packs.some(p => p.id === id))) {
      const npc = (id: unknown) => { if (!registry.residentTemplates.some(n => n.id === id)) throw Error('参考居民模板未注册。'); };
      if (t.kind === 'npc') npc((t.data as { residentTemplateId: string }).residentTemplateId);
      (c.npcTemplateIds as string[]).forEach(npc);
      for (const id of c.tfIds as Id[]) registry.transformation(id);
      for (const id of c.eventIds as Id[]) {
        // 需要固定人物在场的剧情不能移植成无参与者的随机地点故事。
        if (registry.event(id).participantIds?.length) throw Error('地点事件贡献必须不依赖固定人物。');
      }
    }
  }, 1, 500);
  return clone(raw) as ReferencePack;
}
