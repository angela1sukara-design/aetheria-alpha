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

export interface NpcCodexEntry {
  id: string;
  name: string;
  role: string;
  tags: string[];
  relationSummary: string;
  locationHint: string;
  searchText: string;
}

/** 只读图鉴行：已结识固定 NPC + 已交谈/持久居民。不推进时间、不泄露未发现内容。 */
export function buildNpcCodex(view: GameView, registry: Registry): NpcCodexEntry[] {
  const rows: NpcCodexEntry[] = [];
  const district = view.state.district;

  for (const npc of view.state.npcs.filter(n => n.discovered)) {
    const def = registry.npc(npc.definitionId);
    const stage = [...npc.memories].reverse().map(m => registry.npcMemory(m.definitionId).relationshipStage).find(Boolean);
    const tags = [def.role, stage ? STAGE_LABELS[stage] ?? stage : '已结识'].filter(Boolean);
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
      searchText: [def.name, def.role, ...tags, relationSummary, locationHint].join(' '),
    });
  }

  if (district) {
    for (const n of district.residents.filter(r => r.persistent || r.visits > 0 || r.id === district.currentResidentId)) {
      const agent = view.state.worldInstance?.agents.find(a => a.residentId === n.id);
      const playerTags = (agent?.playerRelations ?? []).map((t: PlayerRelation) => RELATION_LABELS[t]);
      const peer = (agent?.relationships ?? [])
        .slice(0, 3)
        .map(rel => AGENT_KIND_LABELS[rel.kind] ?? rel.kind);
      let species: string | undefined;
      try { species = registry.species(n.speciesId).label; } catch { /* 未知种族定义时跳过 */ }
      const placeTags = locationTagSummary(registry, n.locationId as Id).slice(0, 3);
      const tags = [n.profession, ...(species ? [species] : []), ...playerTags, ...placeTags].filter(Boolean);
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
        searchText: [n.name, n.profession, appearance, n.personality, ...tags, relationSummary, locationHint].join(' '),
      });
    }
  }

  return rows;
}

/** 把图鉴行转成可检索 discovery 行（标题 + 详情）。 */
export function npcCodexDiscoveryRows(view: GameView, registry: Registry): { title: string; detail: string; kind: 'npc-codex' }[] {
  return buildNpcCodex(view, registry).map(entry => ({
    kind: 'npc-codex' as const,
    title: `图鉴 · ${entry.name}`,
    detail: [
      entry.role,
      entry.tags.length ? `标签：${entry.tags.join(' / ')}` : null,
      `关系：${entry.relationSummary}`,
      `去向：${entry.locationHint}`,
    ].filter(Boolean).join(' · '),
  }));
}

/** 地点环境 tag 摘要（给生成世界居民卡用，只读）。 */
export function locationTagSummary(registry: Registry, locationId: Id): string[] {
  const profile = registry.locationProfiles.find(p => p.locationId === locationId);
  if (!profile?.tags?.length) return [];
  return profile.tags.map(tag => tagLabel(registry, tag, 'story.v1') || tagLabel(registry, tag, 'generation.v1') || tag).filter(Boolean);
}
