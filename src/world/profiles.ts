import { shape, stableId } from '../content/foundation-schema.ts';
import { parseQuestContent } from '../content/quest-schema.ts';
import { clone } from '../core/types.ts';
import type { Id } from '../core/types.ts';
import type { QuestContent } from '../core/quest-types.ts';
import type { Registry } from '../content/registry.ts';
import type { ReferenceTemplate, Service } from './types.ts';

export interface WorldProfile {
  id: string; tag: Id; name: string; version: string; description: string;
  sourceTheme: string; residentNames: string[];
  locations: Record<Service, { names: string[]; description: string; economy: string[]; professions: string[] }>;
  factions: { name: string; activities: string[] }[];
  quests: QuestContent;
}
export interface WorldSettingSnapshot { id: string; tag: Id; name: string; version: string; hash: string; ecologyTag: Id; questId: string }
const services: Service[] = ['home', 'market', 'workshop', 'clinic', 'commons'];
const starterProfessions = new Set(['交接信使','烘焙师','缝补工','维护电工','水务工','摊贩','护理员','档案整理员','园艺工']);
export function professionName(profile: WorldProfile, service: Service, original: string): string {
  return starterProfessions.has(original) ? profile.locations[service].professions[0]! : original;
}
const ecologies: Record<string, [string, string]> = {
  wet: ['湿润环境', '潮气凝在遮蔽设施边缘，排水通道把生活区与工作区连在一起。'],
  dry: ['干燥环境', '空气干燥，遮阴与储水设施沿着公共通道分布。'],
  garden: ['植被环境', '植物覆盖着受维护的生长区，休息处和工作区之间留有步道。'],
  frost: ['低温环境', '低温让保温与供暖成为日常需要，公共通道保留了回暖位置。'],
  forge: ['热源环境', '加工区与生活区之间设有隔热和通风设施，材料回收点分散在各处。'],
  tidal: ['滨水环境', '湿气与水位变化影响日常通行，高处通道连接生活与工作区域。']
};
export function parseWorldProfiles(raw: unknown, registry?: Registry): WorldProfile[] {
  const catalog = shape(raw, ['format', 'schemaVersion', 'profiles']);
  if (catalog.format !== 'aetheria-world-profiles' || catalog.schemaVersion !== 1 || !Array.isArray(catalog.profiles) || !catalog.profiles.length || catalog.profiles.length > 40) throw Error('世界配置目录无效。');
  const ids = new Set(), tags = new Set();
  const text = (v: unknown) => { if (typeof v !== 'string' || !v.trim() || v.length > 10000) throw Error('世界配置文字无效。'); };
  const words = (v: unknown) => { if (!Array.isArray(v) || !v.length || v.length > 30 || new Set(v).size !== v.length) throw Error('世界配置列表无效。'); v.forEach(text); };
  for (const p of catalog.profiles) {
    shape(p, ['id', 'tag', 'name', 'version', 'description', 'sourceTheme', 'residentNames', 'locations', 'factions', 'quests']);
    if (typeof p.id !== 'string' || !/^world\.[a-z][a-z0-9-]*$/.test(p.id) || !/^\d+\.\d+\.\d+$/.test(p.version)) throw Error('世界配置标识或版本无效。');
    stableId(p.tag); if (p.tag !== `worlds:setting.${p.id.slice(6)}`) throw Error('世界配置标识与题材 Tag 不一致。');
    if (ids.has(p.id) || tags.has(p.tag)) throw Error('世界配置或世界 Tag 重复。'); ids.add(p.id); tags.add(p.tag);
    if (registry) { const tag = registry.tag(p.tag); if (tag.status !== 'active' || !tag.facets.includes('setting')) throw Error('世界 Tag 未启用或不是题材。'); }
    [p.name, p.description, p.sourceTheme].forEach(text); words(p.residentNames);
    shape(p.locations, services);
    for (const service of services) { const place = shape(p.locations[service], ['names', 'description', 'economy', 'professions']); [place.names, place.economy, place.professions].forEach(words); text(place.description); }
    if (!Array.isArray(p.factions) || p.factions.length !== 2) throw Error('世界配置需要两个组织。');
    for (const f of p.factions) { shape(f, ['name', 'activities']); text(f.name); words(f.activities); }
    const quest = parseQuestContent(p.quests);
    if (quest.id !== `aetheria/world-${p.id.slice(6)}-apex`) throw Error('世界任务来源与世界配置不一致。');
  }
  return clone(catalog.profiles) as WorldProfile[];
}
/** Separate deterministic selection does not consume or alter ecology/route/NPC random streams. */
export function chooseWorldProfile(profiles: WorldProfile[], seed: number, tag?: string): WorldProfile {
  if (tag !== undefined) { const found = profiles.find(p => p.tag === tag); if (!found) throw Error('未知世界题材 Tag。'); return clone(found); }
  let value = (seed ^ 0x9e3779b9) >>> 0;
  value = Math.imul(value ^ value >>> 16, 0x21f0aaad) >>> 0;
  value = Math.imul(value ^ value >>> 15, 0x735a2d97) >>> 0;
  const sorted = [...profiles].sort((a, b) => a.id.localeCompare(b.id, 'en'));
  return clone(sorted[((value ^ value >>> 15) >>> 0) % sorted.length]!);
}
/** Adapt copies of reference templates; imported originals and shared service IDs remain intact. */
export function applyWorldProfile(templates: ReferenceTemplate[], profile: WorldProfile): void {
  for (const t of templates) {
    if (t.kind === 'environment') {
      const key = t.data.tags.map(tag => tag.match(/(?:setting\.|climate\.)(wet|dry|garden|frost|forge|tidal)$/)?.[1]).find(Boolean);
      const ecology = ecologies[key ?? ''];
      t.data.name = ecology?.[0] ?? '当地环境';
      t.data.description = profile.description + '\n\n' + (ecology?.[1] ?? '住处、交易、生产、护理和公共事务由当地居民维持。');
    } else if (t.kind === 'place') {
      const p = profile.locations[t.data.service]; t.data = { ...clone(p), service: t.data.service, professions: t.data.professions };
      t.data.ambience = {
        morning: `清晨，${p.names[0]}的值守人员开始交班。${p.description}`,
        day: `日间，${p.names[0]}里有人工作，也有人停下来休息。${p.description}`,
        evening: `傍晚，${p.names[0]}的照明逐渐亮起，通道仍然开放。${p.description}`,
        night: `夜间，${p.names[0]}降低了声响，值守和公共座位仍然可用。${p.description}`
      };
    } else if (t.kind === 'faction') t.data = clone(profile.factions[t.id.endsWith('.trade') ? 0 : 1]!);
    else if (t.kind === 'activity') {
      const service = t.requiresTags.map(tag => tag.match(/(?:service\.)(home|market|workshop|clinic|commons)$/)?.[1]).find(Boolean) as Service | undefined;
      const place = profile.locations[service ?? 'commons'];
      t.data.label = t.data.energyChange > 0 ? `在${place.names[0]}补给与休整` : t.data.moneyChange > 0 ? `协助${place.economy[0]}` : `了解${place.economy[0]}的安排`;
      t.data.description = t.data.energyChange > 0 ? `你在${place.names[0]}按现场安排补充所需，休整片刻后重新出发。` : `你在${place.names[0]}按现场安排完成了一段${place.economy[0]}，随后确认约定的结算。`;
    } else if (t.kind === 'event') {
      const service = t.requiresTags.map(tag => tag.match(/(?:service\.)(home|market|workshop|clinic|commons)$/)?.[1]).find(Boolean) as Service | undefined;
      const place = profile.locations[service ?? 'commons'];
      t.data.label = `参与${place.economy[0]}的现场协作`;
      t.data.prompt = `${place.description}\n\n有人正在处理${place.economy[0]}，其中一个环节需要两人配合。你可以就地参与，也可以继续自己的安排。`;
      t.data.completeText = `你和当班人员在现场完成了分工，核对结算后各自继续安排。`;
    }
  }
}
