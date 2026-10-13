import type { GameView, Id } from '../core/types.ts';
import type { Registry } from '../content/registry.ts';
import { RELATION_LABELS, type PlayerRelation } from '../core/quest-types.ts';
import { tagLabel } from '../content/tags.ts';
import { residentAppearance } from '../engine/query.ts';
import { npcLocation } from '../engine/npc.ts';

const STAGE_LABELS: Record<string, string> = {
  introduced: '初识',
  familiar: '熟悉',
  trusted: '信任',
  private: '私人往来',
  closed: '私人关闭',
};

const AGENT_KIND_LABELS: Record<string, string> = {
  coworker: '同事',
  neighbor: '邻居',
  acquaintance: '熟人',
};

/** fantasy 试玩图鉴对齐：人 / 野兽 / 怪物（按 speciesId 或 label）。 */
export type FantasyNpcKind = 'human' | 'beast' | 'monster';
const FANTASY_KIND_LABELS: Record<FantasyNpcKind, string> = {
  human: '人类',
  beast: '野兽',
  monster: '怪物',
};

export function fantasyNpcKind(speciesId: string, speciesLabel?: string): FantasyNpcKind | undefined {
  const blob = `${speciesId} ${speciesLabel ?? ''}`.toLowerCase();
  if (/monster|怪物|slime|史莱姆|凝胶|魔/.test(blob)) return 'monster';
  if (/beast|野兽|wolf|兽|猎手|兽人|兽族/.test(blob)) return 'beast';
  if (/human|人类|person|citizen|squire|侍从/.test(blob) || speciesId.startsWith('fantasy:species.human') || speciesId.includes('species.person')) return 'human';
  if (speciesId.startsWith('fantasy:species.')) {
    const key = speciesId.slice('fantasy:species.'.length);
    if (key === 'human' || key === 'beast' || key === 'monster') return key;
  }
  return undefined;
}

export interface NpcCodexEntry {
  id: string;
  name: string;
  role: string;
  tags: string[];
  relationSummary: string;
  locationHint: string;
  searchText: string;
  /** fantasy 试玩：人/野兽/怪物；其它世界可缺省。 */
  fantasyKind?: FantasyNpcKind;
  speciesLabel?: string;
}

/** 只读图鉴行：已结识固定 NPC + 已交谈/持久居民。不推进时间、不泄露未发现内容。 */
export function buildNpcCodex(view: GameView, registry: Registry): NpcCodexEntry[] {
  const rows: NpcCodexEntry[] = [];
  const district = view.state.district;

  for (const npc of view.state.npcs.filter(n => n.discovered)) {
    const def = registry.npc(npc.definitionId);
    const stage = [...npc.memories].reverse().map(m => registry.npcMemory(m.definitionId).relationshipStage).find(Boolean);
    let speciesLabel: string | undefined;
    try { speciesLabel = registry.species(def.speciesId).label; } catch { /* 未知种族时跳过 */ }
    const kind = fantasyNpcKind(def.speciesId, speciesLabel);
    const tags = [
      def.role,
      ...(kind ? [FANTASY_KIND_LABELS[kind]] : speciesLabel ? [speciesLabel] : []),
      stage ? STAGE_LABELS[stage] ?? stage : '已结识',
    ].filter(Boolean);
    const location = npcLocation(view.state, registry, def.id);
    const locationHint = location ? registry.location(location).name : '此刻不在公开场所';
    const relationSummary = `熟悉 ${npc.relationship.familiarity} · 信任 ${npc.relationship.trust}`
      + (stage ? ` · ${STAGE_LABELS[stage] ?? stage}` : '')
      + (npc.memories.length ? ` · 共同经历 ${npc.memories.length}` : '');
    rows.push({
      id: def.id,
      name: def.name,
      role: def.role,
      tags,
      relationSummary,
      locationHint,
      fantasyKind: kind,
      speciesLabel,
      searchText: [def.name, def.role, ...(speciesLabel ? [speciesLabel] : []), ...tags, relationSummary, locationHint].join(' '),
    });
  }

  if (district) {
    for (const n of district.residents.filter(r => r.persistent || r.visits > 0 || r.id === district.currentResidentId)) {
      const agent = view.state.worldInstance?.agents.find(a => a.residentId === n.id);
      const playerTags = (agent?.playerRelations ?? []).map((t: PlayerRelation) => RELATION_LABELS[t]);
      const peer = (agent?.relationships ?? [])
        .slice(0, 3)
        .map(rel => AGENT_KIND_LABELS[rel.kind] ?? rel.kind);
      let speciesLabel: string | undefined;
      try { speciesLabel = registry.species(n.speciesId).label; } catch { /* 未知种族定义时跳过 */ }
      const kind = fantasyNpcKind(n.speciesId, speciesLabel);
      const placeTags = locationTagSummary(registry, n.locationId as Id).slice(0, 3);
      const tags = [
        n.profession,
        ...(kind ? [FANTASY_KIND_LABELS[kind]] : speciesLabel ? [speciesLabel] : []),
        ...playerTags,
        ...placeTags,
      ].filter(Boolean);
      const appearance = residentAppearance(view.state, registry, n.id);
      const relationSummary = `信任 ${n.trust} · 已交谈 ${n.visits} 日`
        + (playerTags.length ? ` · 共同背景 ${playerTags.join('、')}` : '')
        + (peer.length ? ` · 邻里 ${[...new Set(peer)].join('、')}` : '')
        + (n.memories.length ? ` · 记忆 ${n.memories.length}` : '');
      const locationHint = registry.location(n.locationId as Id).name;
      rows.push({
        id: `resident:${n.id}`,
        name: n.name,
        role: n.profession,
        tags,
        relationSummary,
        locationHint,
        fantasyKind: kind,
        speciesLabel,
        searchText: [n.name, n.profession, appearance, n.personality, ...(speciesLabel ? [speciesLabel] : []), ...tags, relationSummary, locationHint].join(' '),
      });
    }
  }

  return rows;
}

/** 把图鉴行转成可检索 discovery 行（标题 + 详情）。fantasy 试玩标题带种类。 */
export function npcCodexDiscoveryRows(view: GameView, registry: Registry): { title: string; detail: string; kind: 'npc-codex' }[] {
  return buildNpcCodex(view, registry).map(entry => ({
    kind: 'npc-codex' as const,
    title: entry.fantasyKind
      ? `图鉴 · ${FANTASY_KIND_LABELS[entry.fantasyKind]} · ${entry.name}`
      : `图鉴 · ${entry.name}`,
    detail: [
      entry.role,
      entry.speciesLabel && !entry.fantasyKind ? `种族：${entry.speciesLabel}` : null,
      entry.tags.length ? `标签：${entry.tags.join(' / ')}` : null,
      `关系：${entry.relationSummary}`,
      `去向：${entry.locationHint}`,
    ].filter(Boolean).join(' · '),
  }));
}

/** NSFW 制作暴露：当前图鉴中的 fantasy NPC 摘要（按人/野兽/怪物）。不改玩法数值。 */
export function fantasyNpcRosterForNsfw(view: GameView, registry: Registry): {
  kind: FantasyNpcKind;
  label: string;
  npcs: { id: string; name: string; role: string; speciesLabel?: string }[];
}[] {
  const buckets: Record<FantasyNpcKind, { id: string; name: string; role: string; speciesLabel?: string }[]> = {
    human: [], beast: [], monster: [],
  };
  for (const entry of buildNpcCodex(view, registry)) {
    if (!entry.fantasyKind) continue;
    buckets[entry.fantasyKind].push({
      id: entry.id,
      name: entry.name,
      role: entry.role,
      speciesLabel: entry.speciesLabel,
    });
  }
  return (['human', 'beast', 'monster'] as FantasyNpcKind[]).map(kind => ({
    kind,
    label: FANTASY_KIND_LABELS[kind],
    npcs: buckets[kind],
  }));
}

/** 地点环境 tag 摘要（给生成世界居民卡用，只读）。 */
export function locationTagSummary(registry: Registry, locationId: Id): string[] {
  const profile = registry.locationProfiles.find(p => p.locationId === locationId);
  if (!profile?.tags?.length) return [];
  return profile.tags.map(tag => tagLabel(registry, tag, 'story.v1') || tagLabel(registry, tag, 'generation.v1') || tag).filter(Boolean);
}
