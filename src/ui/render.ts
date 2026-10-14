import type { ActionOption, ActionResult, Condition, GameState, GameView, Id } from '../core/types.ts';
import type { Registry } from '../content/registry.ts';
import { formatClock } from '../engine/clock.ts';
import { renderBodyPanel } from './body-panel.ts';
import { renderNPCPanel } from './npc-panel.ts';
import { scenePresentation, resultAction } from './scene-presentation.ts';
import { actionPreview } from './action-preview.ts';
import { folioCategory, folioCategories } from './folio.ts';
import { derivedSemantics, explainPresentationText, presentationText } from '../engine/semantic-query.ts';
import { explainNarrativeNode } from '../engine/narrative.ts';
import { locationEnvironmentTags, matchingEnvironmentEnemyRules } from '../engine/environment-enemies.ts';
import { activeEvent } from '../engine/events.ts';
import { evaluate } from '../engine/conditions.ts';
import { uniqueParagraphs } from '../content/player-prose.ts';

export function element<K extends keyof HTMLElementTagNameMap>(tag: K, className = '', text = ''): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag); node.className = className; if (text) node.textContent = text; return node;
}
export function byId<T extends HTMLElement = HTMLElement>(id: string): T {
  const node = document.getElementById(id); if (!node) throw new Error(`缺少 UI 元素 ${id}`); return node as T;
}
let tagDebugRegistry: Registry | undefined;

/** Debug：正文【标签】及段落级 Tag 溯源查看器（只读，不改玩法）。 */
export function setTagDebugRegistry(registry: Registry): void {
  tagDebugRegistry = registry;
}

export interface TagBadgeInfo {
  id: string;
  label: string;
  relation: 'required' | 'excluded' | 'tendency' | 'environment' | 'derived' | 'set' | 'unset' | 'storylet' | 'material';
  detail: string;
}

export interface ParagraphDebugTrace {
  paragraphIndex: number;
  snippet: string;
  channel: string;
  sourceId: string;
  textKey?: string;
  logicSummary: string;
  tags: TagBadgeInfo[];
  sections: { title: string; lines: string[] }[];
}

function safeTagLabel(r: Registry, id: string): string {
  if (typeof r.hasTag === 'function' ? r.hasTag(id) : r.tags.some(t => t.id === id)) {
    const def = r.tag(id as Id);
    return `${def.label} (${def.id})`;
  }
  const hit = r.tags.find(t => t.aliases.some(a => a.value === id));
  return hit ? `${hit.label} (${hit.id} ← ${id})` : id;
}

function summarizeCondition(c: Condition, s: GameState, r: Registry): string {
  const res = evaluate(c, s, r);
  const status = res.pass ? '✓ 满足' : `✗ 未满足 (${res.reason || '不成立'})`;
  switch (c.op) {
    case 'location.is': return `地点为 ${r.location(c.id).name} (${c.id}) → ${status}`;
    case 'time.window': return `时段 ${Math.floor(c.start / 60)}:${String(c.start % 60).padStart(2, '0')}–${Math.floor(c.end / 60)}:${String(c.end % 60).padStart(2, '0')} → ${status}`;
    case 'environment.light': return `光照为 ${c.value === 'lit' ? '明亮 (lit)' : '昏暗 (dark)'} → ${status}`;
    case 'environment.service': return `地点服务为 ${c.value} → ${status}`;
    case 'body.matches': return `身体部件匹配 (${JSON.stringify(c.part)}) → ${status}`;
    case 'body.hasPart': return `拥有身体部件 ${c.definitionId} → ${status}`;
    case 'body.hasCapability': return `身体能力 ${c.capability} ≥ ${c.count} → ${status}`;
    case 'flag.has': return `标记 ${c.id} === ${String(c.value)} → ${status}`;
    case 'var.compare': return `数值 ${c.id} ${c.comparison} ${c.value} → ${status}`;
    case 'adventure.compare': return `成长指标 ${c.field} ${c.comparison} ${c.value} → ${status}`;
    case 'narrative.tag': return `故事标签 ${c.role}/${c.id} === ${String(c.value)} → ${status}`;
    default: return `${c.op} → ${status}`;
  }
}

function tagSourceLines(label: string): string[] {
  const r = tagDebugRegistry;
  if (!r) return [`标记「${label}」`, '来源：调试注册表尚未就绪'];
  const hits = r.tags.filter(t => t.label === label || t.id === label || t.id.endsWith('.' + label) || t.aliases.some(a => a.value === label));
  const list = hits.length ? hits : r.tags.filter(t => t.label.includes(label) || label.includes(t.label)).slice(0, 5);
  if (!list.length) return [`标记「${label}」`, '来源：未在已装 TagDef 中找到同名条目（可能是工作流分类标记或占位）'];
  return list.flatMap(t => {
    const refs = r.tagReferences[t.id] ?? [];
    return [
      `${t.label} · ${t.id}`,
      `定义：${t.definition}`,
      `状态：${t.status} · 维度 (facets)：${t.facets.join(', ') || '—'} · 别名：${t.aliases.map(a => `${a.scope}:${a.value}`).join(', ') || '无'}`,
      `规则包引用数：${refs.length} 处${refs.length ? `（示例：${refs.slice(0, 3).map(x => `${x.packId}${x.pointer}`).join('；')}）` : ''}`,
    ];
  });
}

function showDebugPopup(title: string, sections: { title: string; lines: string[] }[], anchor: HTMLElement): void {
  let tip = document.getElementById('tag-source-pop');
  if (!tip) {
    tip = element('div', 'tag-source-pop');
    tip.id = 'tag-source-pop';
    tip.setAttribute('role', 'dialog');
    tip.setAttribute('aria-label', '段落与标签逻辑溯源');
    document.body.append(tip);
    document.addEventListener('click', (event) => {
      const t = document.getElementById('tag-source-pop');
      if (!t || t.hidden) return;
      const el = event.target as Node | null;
      if (el && (t.contains(el) || (el instanceof Element && el.closest('.tag-mark, .debug-tag-pill, .debug-inspect-btn, p[data-debug-clickable="true"]')))) return;
      t.hidden = true;
    });
  }
  tip.replaceChildren();
  const header = element('div', 'debug-pop-header');
  header.append(element('strong', '', title));
  const close = element('button', 'button-text', '关闭 ×'); close.type = 'button';
  close.addEventListener('click', () => { tip!.hidden = true; });
  header.append(close);
  tip.append(header);
  for (const sec of sections) {
    if (!sec.lines.length) continue;
    const block = element('div', 'debug-pop-section');
    block.append(element('h4', '', sec.title));
    for (const line of sec.lines) block.append(element('p', '', line));
    tip.append(block);
  }
  tip.hidden = false;
  const rect = anchor.getBoundingClientRect();
  const box = tip.getBoundingClientRect();
  tip.style.left = `${Math.max(12, Math.min(rect.left, window.innerWidth - box.width - 12))}px`;
  tip.style.top = `${Math.max(12, Math.min(rect.bottom + 8, window.innerHeight - box.height - 12))}px`;
}

function showTagSource(label: string, anchor: HTMLElement): void {
  showDebugPopup(`标签字典溯源 · 【${label}】`, [{ title: '匹配的 TagDef 与引用位置', lines: tagSourceLines(label) }], anchor);
}

/** 为指定文本容器构建逐段 Tag 与生成逻辑溯源记录。只读不改状态。 */
export function buildParagraphTraces(kind: 'location' | 'scene' | 'result', text: string, view: GameView, r: Registry, result?: ActionResult): ParagraphDebugTrace[] {
  const paras = text.split('\n\n').filter(Boolean);
  const s = view.state;
  const envTags = locationEnvironmentTags(s, r, view.location.id);
  const playerDerived = derivedSemantics(s, r, { entity: { kind: 'player' } });
  const worldLoc = s.worldInstance?.definition.locations.find(l => l.id === view.location.id);
  const region = s.worldInstance?.definition.regions.find(reg => reg.id === worldLoc?.regionId);
  const envProseTrace = explainPresentationText(s, r, 'environment');
  const activeContextLines = [
    `当前地点环境 Tag (${envTags.length})：${envTags.map(id => safeTagLabel(r, id)).join('、') || '无'}`,
    `玩家实时派生 Tag (${playerDerived.length})：${playerDerived.map(id => safeTagLabel(r, id)).join('、') || '无'}`,
    ...(s.worldInstance?.definition.setting ? [`世界题材 Tag：${safeTagLabel(r, s.worldInstance.definition.setting.tag)} · 生态 Tag：${safeTagLabel(r, s.worldInstance.definition.setting.ecologyTag)}`] : []),
  ];

  if (kind === 'location') {
    const locBaseParas = r.text(view.location.textKey).split('\n\n').filter(Boolean);
    return paras.map((para, idx) => {
      const snippet = para.length > 42 ? para.slice(0, 40) + '…' : para;
      if (envProseTrace.selectedMaterial && para.trim() === envProseTrace.selectedMaterial.text.trim()) {
        const mat = envProseTrace.selectedMaterial;
        return {
          paragraphIndex: idx,
          snippet,
          channel: '语义规则派生 · 环境短描 (proseSelection)',
          sourceId: `${envProseTrace.matchedRules.map(x => x.id).join(', ')} → ${mat.id}`,
          textKey: mat.id,
          logicSummary: `命中规则 ${envProseTrace.matchedRules.length} 条 | 候选池 ${envProseTrace.selectedIndex + 1}/${envProseTrace.candidateCount} (种子哈希轮换)`,
          tags: mat.tags.map(id => ({ id, label: safeTagLabel(r, id), relation: 'material', detail: `词条 ${mat.id} 绑定的语义标签` })),
          sections: [
            { title: '1. 词条与规则来源', lines: [`词条 ID：${mat.id}（来源：${mat.source}）`, `触发规则：${envProseTrace.matchedRules.map(x => `${x.id} -> ${x.entryId}`).join('；')}`] },
            { title: '2. 满足的触发条件 (when)', lines: envProseTrace.matchedRules.flatMap(rule => rule.conditions.map(c => summarizeCondition(c, s, r))) },
            { title: '3. 候选池抽样与淘汰规则', lines: [
              `同通道通过条件的候选词条（共 ${envProseTrace.candidateCount} 条，当前抽中 #${envProseTrace.selectedIndex + 1}）：${envProseTrace.candidateIds.join(', ')}`,
              ...envProseTrace.rejectedRules.slice(0, 6).map(rej => `未命中规则 ${rej.id} (${rej.entryId})：${rej.failedReason}`),
            ] },
            { title: '4. 当前场景激活 Tag 快照', lines: activeContextLines },
          ],
        };
      }
      const isEnvHeader = worldLoc && idx === 0 && locBaseParas.length >= 2;
      const isLexiconDetail = worldLoc && idx >= 1 && idx < locBaseParas.length - 1;
      const channel = isEnvHeader
        ? '世界生成 · 区域与题材基底 (EnvironmentTemplate)'
        : isLexiconDetail
          ? '世界生成 · 地点与词库建筑细节 (PlaceTemplate + Lexicon)'
          : worldLoc
            ? '世界生成 · 地点经济与组织协调 (PlaceTemplate)'
            : '固定世界 · 地点基础描述 (LocationDef)';
      const tagList: TagBadgeInfo[] = [
        ...(worldLoc ? worldLoc.tags.map(id => ({ id, label: safeTagLabel(r, id), relation: 'environment' as const, detail: '生成地点携带的 Tag' })) : envTags.map(id => ({ id, label: safeTagLabel(r, id), relation: 'environment' as const, detail: '当前地点环境 Tag' }))),
      ];
      return {
        paragraphIndex: idx,
        snippet,
        channel,
        sourceId: worldLoc ? `${worldLoc.templateId} (${view.location.id})` : view.location.id,
        textKey: view.location.textKey,
        logicSummary: worldLoc
          ? `生成模板: ${worldLoc.templateId} | 服务: service.${worldLoc.service} | 地点 Tag: ${worldLoc.tags.length} 项`
          : `地点定义: ${view.location.id} | 文本键: ${view.location.textKey}`,
        tags: tagList,
        sections: [
          { title: '1. 段落生成来源', lines: [
            `地点 ID：${view.location.id}（${view.location.name}）`,
            `文本键：${view.location.textKey}（第 ${idx + 1}/${locBaseParas.length} 段）`,
            ...(worldLoc ? [`生成参考模板：${worldLoc.templateId} · 服务类型：${worldLoc.service} · 经济活动：${worldLoc.economy.join('、')}`] : []),
            ...(region ? [`所属区域：${region.name} (${region.id}) · 生态 Tag：${region.ecologyTags.map(id => safeTagLabel(r, id)).join('、')}`] : []),
          ] },
          { title: '2. 关联的地点与环境 Tag', lines: tagList.map(t => `${t.label} — ${t.detail}`) },
          { title: '3. 当前场景激活 Tag 快照', lines: activeContextLines },
        ],
      };
    });
  }

  if (kind === 'result' && result?.ok) {
    const actDef = resultAction(view, r, result);
    const lastTx = s.ledger.transactions.find(tx => tx.requestId === result.requestId);
    const narChoice = lastTx?.narrativeChoice ? r.narrativeNodes.find(n => n.id === lastTx.narrativeChoice!.nodeId)?.choices[lastTx.narrativeChoice!.index] : undefined;
    const narNode = lastTx?.narrativeChoice ? r.narrativeNodes.find(n => n.id === lastTx.narrativeChoice!.nodeId) : undefined;
    return paras.map((para, idx) => {
      const snippet = para.length > 42 ? para.slice(0, 40) + '…' : para;
      const tags: TagBadgeInfo[] = [
        ...(narChoice?.setTags.map(t => ({ id: t.tagId, label: `+${t.role}/${safeTagLabel(r, t.tagId)}`, relation: 'set' as const, detail: '选项执行后写入的故事 Tag' })) ?? []),
        ...(narChoice?.unsetTags.map(t => ({ id: t.tagId, label: `-${t.role}/${safeTagLabel(r, t.tagId)}`, relation: 'unset' as const, detail: '选项执行后移除的故事 Tag' })) ?? []),
        ...(narNode?.tendencies.map(t => ({ id: t.tagId, label: safeTagLabel(r, t.tagId), relation: 'tendency' as const, detail: `所属节点倾向 Tag (权重+${t.weight})` })) ?? []),
        ...envTags.slice(0, 4).map(id => ({ id, label: safeTagLabel(r, id), relation: 'environment' as const, detail: '执行时所在地点环境 Tag' })),
      ];
      return {
        paragraphIndex: idx,
        snippet,
        channel: narChoice ? `故事选项结算 (NarrativeChoice #${lastTx!.narrativeChoice!.index + 1})` : '行动结算反馈 (ActionResult)',
        sourceId: narChoice ? `${narNode!.id} → choice[${lastTx!.narrativeChoice!.index}]` : (actDef?.id ?? 'unknown-action'),
        textKey: narChoice ? narChoice.resultText : actDef?.resultText,
        logicSummary: narChoice
          ? `节点: ${narNode!.id} | 选项:「${narChoice.label}」| 赋予 Tag: ${narChoice.setTags.length} 项 | 后续阶段: ${narChoice.next ?? '结束'}`
          : `动作: ${actDef?.id ?? '—'} (${actDef?.label ?? '—'}) | 分组: ${actDef?.group ?? '—'}`,
        tags,
        sections: [
          { title: '1. 行动与文本来源', lines: [
            `执行动作 ID：${actDef?.id ?? '—'}（${actDef?.label ?? '—'}）`,
            ...(narChoice && narNode ? [`所属故事节点：${narNode.id}（${narNode.title}）`, `结果文本键：${narChoice.resultText}`] : [`结果文本键：${actDef?.resultText ?? '动态结算日志'}`]),
          ] },
          { title: '2. 前置条件校验 (Conditions)', lines: (narChoice?.conditions ?? actDef?.conditions ?? []).map(c => summarizeCondition(c, s, r)).concat((narChoice?.conditions ?? actDef?.conditions ?? []).length ? [] : ['无额外前置条件（默认可执行）']) },
          { title: '3. Tag 状态变更与数值结果', lines: [
            ...(narChoice?.setTags.length ? [`写入 Tag (setTags)：${narChoice.setTags.map(t => `${t.role}/${safeTagLabel(r, t.tagId)}`).join('、')}`] : []),
            ...(narChoice?.unsetTags.length ? [`移除 Tag (unsetTags)：${narChoice.unsetTags.map(t => `${t.role}/${safeTagLabel(r, t.tagId)}`).join('、')}`] : []),
            `本轮数值变化：${result.changes.map(c => `${c.label} ${c.before} → ${c.after}`).join('；') || '无数值变动'}`,
          ] },
          { title: '4. 当前场景激活 Tag 快照', lines: activeContextLines },
        ],
      };
    });
  }

  // kind === 'scene'
  const narTrace = explainNarrativeNode(s, r);
  if (narTrace) {
    const n = narTrace.node;
    const nodeTags: TagBadgeInfo[] = [
      ...n.requiresTags.map(t => ({ id: t.tagId, label: `必含:${t.role}/${safeTagLabel(r, t.tagId)}`, relation: 'required' as const, detail: `硬性要求 ${t.role} 具备该 Tag` })),
      ...n.excludesTags.map(t => ({ id: t.tagId, label: `互斥:${t.role}/${safeTagLabel(r, t.tagId)}`, relation: 'excluded' as const, detail: `若 ${t.role} 具备该 Tag 则排除此节点` })),
      ...n.tendencies.map(t => ({ id: t.tagId, label: `倾向:${safeTagLabel(r, t.tagId)} (+${t.weight})`, relation: 'tendency' as const, detail: `节点倾向加权 Tag (基础权重+${t.weight})` })),
      ...narTrace.activeTags.slice(0, 5).map(t => ({ id: t.tagId, label: `${t.role}:${t.label}`, relation: 'environment' as const, detail: t.origin })),
    ];
    return paras.map((para, idx) => {
      const snippet = para.length > 42 ? para.slice(0, 40) + '…' : para;
      const isStepLog = s.adventure?.story?.log.length && idx === paras.length - 1 && para.trim() === s.adventure.story.log.at(-1)?.trim();
      return {
        paragraphIndex: idx,
        snippet,
        channel: isStepLog ? '故事阶段推进反馈 (story.log)' : `Tag 驱动叙事节点 (${n.kind} / ${n.stage})`,
        sourceId: n.id,
        textKey: n.textKey,
        logicSummary: `节点: ${n.id} | 优先级 ${n.priority} | 权重 ${narTrace.baseWeight}→${narTrace.finalWeight} | 同阶段候选 ${narTrace.candidates.length} 项 (淘汰 ${narTrace.rejected.length} 项)`,
        tags: nodeTags,
        sections: [
          { title: '1. 叙事节点与文本键', lines: [
            `节点 ID：${n.id}（标题：${n.title}）`,
            `类别 / 阶段：kind = ${n.kind} · stage = ${n.stage} · 访问次数 = ${s.adventure?.story?.visits[n.id] ?? 1}/${n.maxVisits}`,
            `正文键 (textKey)：${n.textKey}`,
            `行为档案 (profileId)：${narTrace.profileId ?? '无（使用地点环境与玩家当前状态）'}`,
          ] },
          { title: '2. 节点 Tag 规则与倾向加权计算', lines: [
            `硬性要求 Tag (requiresTags)：${n.requiresTags.map(t => `${t.role}/${safeTagLabel(r, t.tagId)} ✓`).join('、') || '无'}`,
            `互斥排除 Tag (excludesTags)：${n.excludesTags.map(t => `${t.role}/${safeTagLabel(r, t.tagId)} ✓未触发`).join('、') || '无'}`,
            `前置条件 (conditions)：${n.conditions.map(c => summarizeCondition(c, s, r)).join('；') || '无（无条件开放）'}`,
            `权重计算公式：基础权重 ${narTrace.baseWeight} + 倾向命中 [${narTrace.tendencyHits.map(h => `${h.label} (${h.nodeWeight}×${h.multiplier}=+${h.added})`).join('，') || '无额外加权'}] = 最终权重 ${narTrace.finalWeight}`,
          ] },
          { title: '3. 动态占位符插值 ({...} Fills)', lines: narTrace.fillsUsed.length ? narTrace.fillsUsed.map(f => `${f.placeholder} → 「${f.value}」`) : ['本段未使用动态占位符变量'] },
          { title: `4. 同阶段 (${n.kind}/${n.stage}) 候选池竞争与淘汰原因`, lines: [
            ...narTrace.candidates.map(c => `${c.selected ? '★ [当前抽中]' : '○ [同池候选]'} ${c.id}（${c.title}）— 优先级 ${c.priority} · 权重 ${c.weight}`),
            ...narTrace.rejected.slice(0, 10).map(rej => `✗ [已筛除] ${rej.id}（${rej.title}）— ${rej.reason}`),
          ] },
          { title: '5. 当前激活的全量 ScopedTag 快照', lines: narTrace.activeTags.map(t => `[${t.role}] ${t.label} (${t.tagId}) ← ${t.origin}`) },
        ],
      };
    });
  }

  if (s.district?.combat) {
    const b = s.district.combat;
    const rule = r.environmentEnemyRules.find(x => x.id === b.selectionRuleId);
    const matchingRules = matchingEnvironmentEnemyRules(s, r);
    const profile = r.narrativeProfiles.find(p => p.enemyId === b.enemyId);
    const combatTags: TagBadgeInfo[] = [
      ...(rule?.requiresTags.map(id => ({ id, label: `选敌要求:${safeTagLabel(r, id)}`, relation: 'required' as const, detail: `EnvironmentEnemyRule (${rule.id}) 要求的地点环境 Tag` })) ?? []),
      ...playerDerived.map(id => ({ id, label: `我方:${safeTagLabel(r, id)}`, relation: 'derived' as const, detail: '我方身体/状态实时派生 Tag' })),
      ...(profile?.tags.map(id => ({ id, label: `敌方:${safeTagLabel(r, id)}`, relation: 'environment' as const, detail: `敌方档案 (${profile.id}) 固有 Tag` })) ?? []),
    ];
    return paras.map((para, idx) => ({
      paragraphIndex: idx,
      snippet: para.length > 42 ? para.slice(0, 40) + '…' : para,
      channel: idx === 0 ? '交锋状态与 Tag 面板 (Combat Header)' : '交锋回合结算日志 (Combat Turn Log)',
      sourceId: b.selectionRuleId ?? b.enemyId,
      logicSummary: `敌人: ${b.enemyName ?? b.enemyId} | 选敌规则: ${b.selectionRuleId ?? '默认 EnemyDef'} | 当前地点匹配规则: ${matchingRules.length} 条`,
      tags: combatTags,
      sections: [
        { title: '1. 环境选敌规则 (EnvironmentEnemyRule)', lines: [
          `当前敌人 ID：${b.enemyId}（显示名：${b.enemyName ?? '默认'}）`,
          `命中选敌规则：${rule ? `${rule.id}（要求环境 Tag：${rule.requiresTags.map(id => safeTagLabel(r, id)).join('、')} · 权重 ${rule.weight} · 优先级 ${rule.priority ?? 0}）` : '直接指定 EnemyDef（未走环境规则覆盖）'}`,
          `当前地点所有匹配选敌规则：${matchingRules.map(x => `${x.id} -> ${x.enemyId} (权重 ${x.weight})`).join('；') || '无'}`,
        ] },
        { title: '2. 我方与敌方激活 Tag 溯源', lines: [
          `我方派生 Tag (derivedSemantics)：${playerDerived.map(id => safeTagLabel(r, id)).join('、') || '无'}`,
          `敌方行为档案 (${profile?.id ?? '无'})：Tag [${(profile?.tags ?? []).map(id => safeTagLabel(r, id)).join('、')}] · 目标 [${(profile?.goals ?? []).map(id => safeTagLabel(r, id)).join('、')}]`,
        ] },
        { title: '3. 当前场景激活 Tag 快照', lines: activeContextLines },
      ],
    }));
  }

  const ev = activeEvent(s);
  if (ev) {
    const def = r.event(ev.definitionId);
    const lockedTextKey = ev.textByNode[ev.nodeId];
    const storylet = r.storylets.find(st => st.eventId === def.id && (!st.locationId || st.locationId === view.location.id));
    const evTags: TagBadgeInfo[] = [
      ...(storylet?.tags.map(id => ({ id, label: safeTagLabel(r, id), relation: 'storylet' as const, detail: `Storylet (${storylet.id}) 主题/检索标签` })) ?? []),
      ...envTags.slice(0, 5).map(id => ({ id, label: safeTagLabel(r, id), relation: 'environment' as const, detail: '当前地点环境 Tag' })),
    ];
    return paras.map((para, idx) => ({
      paragraphIndex: idx,
      snippet: para.length > 42 ? para.slice(0, 40) + '…' : para,
      channel: storylet ? `Storylet 抽取事件 (${storylet.id})` : `固定/主支线事件 (${def.id})`,
      sourceId: `${def.id}#${ev.nodeId}`,
      textKey: lockedTextKey,
      logicSummary: `事件: ${def.id} (节点 ${ev.nodeId}) | 文本键: ${lockedTextKey ?? '—'}${storylet ? ` | Storylet 权重 ${storylet.weight} · 优先级 ${storylet.priority}` : ''}`,
      tags: evTags,
      sections: [
        { title: '1. 事件与节点来源', lines: [
          `事件定义 ID：${def.id} · 当前节点：${ev.nodeId} · 锁定文本键：${lockedTextKey ?? '—'}`,
          ...(storylet ? [`触发 Storylet：${storylet.id} · 冷却组：${storylet.cooldownGroup ?? '无'} (${storylet.cooldownMinutes}分钟) · 重复规则：${storylet.repeat}`] : ['触发方式：由行动 event.start 直接进入']),
        ] },
        { title: '2. Storylet 条件与标签', lines: [
          ...(storylet ? [
            `Storylet 标签：${storylet.tags.map(id => safeTagLabel(r, id)).join('、') || '无'}`,
            `Storylet 触发条件：${storylet.conditions.map(c => summarizeCondition(c, s, r)).join('；') || '无额外条件'}`,
          ] : ['无关联 Storylet']),
        ] },
        { title: '3. 当前场景激活 Tag 快照', lines: activeContextLines },
      ],
    }));
  }

  // 普通地点场景正文：区分地点基底、环境语义派生 (presentationText)、时段氛围变体 (sceneTexts)
  const variants = r.sceneTexts
    .filter(v => v.locationId === s.world.locationId && !v.owner && v.conditions.every(c => evaluate(c, s, r).pass))
    .sort((a, b) => b.priority - a.priority || a.id.localeCompare(b.id, 'en'));
  const activeVariant = variants[0];
  const activeVariantText = activeVariant ? r.text(activeVariant.textKey).trim() : '';

  return paras.map((para, idx) => {
    const snippet = para.length > 42 ? para.slice(0, 40) + '…' : para;
    if (envProseTrace.selectedMaterial && para.trim() === envProseTrace.selectedMaterial.text.trim()) {
      const mat = envProseTrace.selectedMaterial;
      return {
        paragraphIndex: idx,
        snippet,
        channel: '语义规则派生 · 环境短描 (proseSelection)',
        sourceId: `${envProseTrace.matchedRules.map(x => x.id).join(', ')} → ${mat.id}`,
        textKey: mat.id,
        logicSummary: `命中规则 ${envProseTrace.matchedRules.length} 条 | 候选池 ${envProseTrace.selectedIndex + 1}/${envProseTrace.candidateCount}`,
        tags: mat.tags.map(id => ({ id, label: safeTagLabel(r, id), relation: 'material', detail: `词条 ${mat.id} 绑定的语义标签` })),
        sections: [
          { title: '1. 词条与规则来源', lines: [`词条 ID：${mat.id}`, `触发规则：${envProseTrace.matchedRules.map(x => `${x.id} -> ${x.entryId}`).join('；')}`] },
          { title: '2. 满足的触发条件 (when)', lines: envProseTrace.matchedRules.flatMap(rule => rule.conditions.map(c => summarizeCondition(c, s, r))) },
          { title: '3. 当前场景激活 Tag 快照', lines: activeContextLines },
        ],
      };
    }
    if (activeVariant && para.trim() === activeVariantText) {
      return {
        paragraphIndex: idx,
        snippet,
        channel: '时段/条件场景变体 (SceneTextDef)',
        sourceId: activeVariant.id,
        textKey: activeVariant.textKey,
        logicSummary: `变体 ID: ${activeVariant.id} | 优先级 ${activeVariant.priority} | 条件: ${activeVariant.conditions.map(c => summarizeCondition(c, s, r)).join(' & ')}`,
        tags: envTags.slice(0, 5).map(id => ({ id, label: safeTagLabel(r, id), relation: 'environment', detail: '所属地点环境 Tag' })),
        sections: [
          { title: '1. 场景时段变体来源 (SceneTextDef)', lines: [
            `变体 ID：${activeVariant.id} · 文本键：${activeVariant.textKey} · 优先级：${activeVariant.priority}`,
            `触发条件：${activeVariant.conditions.map(c => summarizeCondition(c, s, r)).join('；')}`,
          ] },
          { title: '2. 当前地点同级时段变体状态', lines: r.sceneTexts.filter(v => v.locationId === s.world.locationId && !v.owner).map(v => `${v.id === activeVariant.id ? '★ [当前生效]' : '○ [未生效]'} ${v.id}：${v.conditions.map(c => summarizeCondition(c, s, r)).join('；')}`) },
          { title: '3. 当前场景激活 Tag 快照', lines: activeContextLines },
        ],
      };
    }
    return {
      paragraphIndex: idx,
      snippet,
      channel: worldLoc ? `世界生成 · 地点正文 (${worldLoc.templateId})` : `固定世界 · 地点正文 (${view.location.id})`,
      sourceId: worldLoc ? worldLoc.templateId : view.location.id,
      textKey: view.location.textKey,
      logicSummary: worldLoc ? `模板: ${worldLoc.templateId} | 服务: service.${worldLoc.service} | 关联 Tag: ${worldLoc.tags.length} 项` : `地点: ${view.location.id} | 文本键: ${view.location.textKey}`,
      tags: (worldLoc?.tags ?? envTags).map(id => ({ id, label: safeTagLabel(r, id), relation: 'environment', detail: '地点关联的环境/服务 Tag' })),
      sections: [
        { title: '1. 段落生成来源', lines: [
          `地点：${view.location.name} (${view.location.id}) · 文本键：${view.location.textKey}`,
          ...(worldLoc ? [`生成模板：${worldLoc.templateId} · 服务：${worldLoc.service} · 经济：${worldLoc.economy.join('、')}`] : []),
        ] },
        { title: '2. 关联 Tag 列表', lines: (worldLoc?.tags ?? envTags).map(id => safeTagLabel(r, id)) },
        { title: '3. 当前场景激活 Tag 快照', lines: activeContextLines },
      ],
    };
  });
}

function renderDebugInspectorHost(hostId: string, afterTarget: HTMLElement, traces: ParagraphDebugTrace[], title: string): void {
  const debugOn = document.body.dataset.debug === 'true';
  let host = document.getElementById(hostId);
  if (!debugOn || !traces.length || afterTarget.hidden) {
    if (host) host.hidden = true;
    return;
  }
  if (!host) {
    host = element('section', 'tag-debug-inspector');
    host.id = hostId;
    afterTarget.after(host);
  }
  host.hidden = false;
  host.replaceChildren();
  const head = element('div', 'tag-debug-head');
  head.append(
    element('span', 'tag-debug-title', `🔍 ${title}（共 ${traces.length} 段 · 点击任意胶囊或段落查看完整逻辑链）`),
  );
  host.append(head);

  for (const trace of traces) {
    const card = element('div', 'para-debug-card');
    const top = element('div', 'para-debug-top');
    top.append(
      element('span', 'debug-para-num', `第 ${trace.paragraphIndex + 1} 段`),
      element('span', 'debug-badge-source', `${trace.channel} · ${trace.sourceId}`),
    );
    const inspectBtn = element('button', 'debug-inspect-btn', '查看完整逻辑链 ↗');
    inspectBtn.type = 'button';
    inspectBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      showDebugPopup(`第 ${trace.paragraphIndex + 1} 段生成逻辑诊断 · ${trace.sourceId}`, trace.sections, inspectBtn);
    });
    top.append(inspectBtn);
    card.append(top);
    card.append(element('p', 'para-debug-snippet', `「${trace.snippet}」`));
    card.append(element('p', 'para-debug-logic', trace.logicSummary));

    const tagRow = element('div', 'para-debug-tags');
    if (trace.tags.length) {
      for (const t of trace.tags) {
        const pill = element('button', `debug-tag-pill rel-${t.relation}`, t.label);
        pill.type = 'button';
        pill.title = `${t.detail}（点击查看字典定义与引用）`;
        pill.addEventListener('click', (e) => {
          e.stopPropagation();
          showDebugPopup(`标签与段落关联 · ${t.label}`, [
            { title: '在本段中的作用', lines: [`关联方式：${t.detail}`, `所属段落来源：${trace.channel} (${trace.sourceId})`] },
            { title: 'TagDef 字典定义与全包引用', lines: tagSourceLines(t.id) },
            ...trace.sections,
          ], pill);
        });
        tagRow.append(pill);
      }
    } else {
      tagRow.append(element('span', 'muted', '本段为无特定 Tag 约束的基础文本'));
    }
    card.append(tagRow);
    host.append(card);
  }
}

function prose(target: HTMLElement, text: string, traces?: ParagraphDebugTrace[]): void {
  const debugOn = document.body.dataset.debug === 'true';
  target.replaceChildren(...text.split('\n\n').map((para, pIndex) => {
    const node = element('p', '');
    const trace = traces?.[pIndex];
    if (debugOn && trace) {
      node.dataset.debugClickable = 'true';
      node.dataset.paraIndex = String(pIndex + 1);
      node.title = `[第 ${pIndex + 1} 段] ${trace.channel} (${trace.sourceId}) — 点击查看 Tag 逻辑溯源`;
      node.addEventListener('click', (event) => {
        if ((event.target as Element).closest('.tag-mark')) return;
        showDebugPopup(`第 ${pIndex + 1} 段生成逻辑诊断 · ${trace.sourceId}`, trace.sections, node);
      });
    }
    const re = /【([^【】]+)】/g;
    let last = 0;
    let match: RegExpExecArray | null;
    while ((match = re.exec(para))) {
      if (match.index > last) node.append(document.createTextNode(para.slice(last, match.index)));
      const label = match[1]!;
      const mark = element(debugOn ? 'button' : 'span', 'tag-mark', `【${label}】`);
      if(mark instanceof HTMLButtonElement)mark.type = 'button';
      if(mark instanceof HTMLButtonElement){mark.title = '点击查看来源';mark.setAttribute('aria-label', `标签 ${label}，点击查看来源`);}
      if(mark instanceof HTMLButtonElement)mark.addEventListener('click', event => { event.preventDefault(); event.stopPropagation(); showTagSource(label, mark); });
      node.append(mark);
      last = match.index + match[0].length;
    }
    if (last < para.length) node.append(document.createTextNode(para.slice(last)));
    if (!node.childNodes.length) node.textContent = para;
    return node;
  }));
}
function actionButton(option: ActionOption, registry: Registry, compact = false, state?: GameState): HTMLButtonElement {
  const button = element('button', compact ? 'map-label' : 'action-button'); button.type = 'button';
  button.dataset.action = option.definition.id; button.dataset.group = option.definition.group;
  button.disabled = !option.available;
  button.append(element('span', 'action-label', option.definition.label));
  const preview = actionPreview(option.definition, registry, state);
  const rawHint = option.available ? option.definition.hint : option.reason;
  const normalize = (text: string) => text.replace(/\s/g, '');
  const hint = option.available ? rawHint.split(' · ').filter(part => {
    if (part === '选择会推进经历 · 查看行动反馈' || part === '选择会推进经历' || part === '查看行动反馈') return false;
    if (preview.some(tag => normalize(tag) === normalize(part))) return false;
    return !(preview.length && option.definition.effects.some(effect => effect.op === 'clock.advance' || effect.op === 'location.move') && /^(?:步行\s*)?\d+\s*(?:分钟|小时)$/.test(part));
  }).join(' · ') : rawHint;
  if (hint) button.append(element('span', 'action-hint', hint));
  if (preview.length) {
    const costs = element('span', 'action-costs');
    costs.append(...preview.map(text => element('span', '', text))); button.append(costs);
  }
  if (!option.available) button.title = option.reason;
  return button;
}

/** 主列表密度：购买/装备/使用只留在背包面板，不占「下一步」。 */
function isInventoryOnlyAction(option: ActionOption): boolean {
  if(option.definition.conditions.some(c=>c.op==='service.available'&&c.subject==='resident'))return false;
  const id = option.definition.id;
  if (/\.buy\.|:buy\./.test(id)) return true;
  if (option.definition.effects.some(e => e.op === 'equipment.wear' || e.op === 'item.use')) return true;
  // 战内消耗品按钮仍留在事件/战斗选择里
  if (option.definition.effects.some(e => e.op === 'combat.turn' && (e as { move?: string }).move === 'item')) return false;
  return false;
}
/** 训练 + 经营/订单/巡查/协作/调解 → 「更多日常」折叠。 */
function isMoreDailyAction(option: ActionOption): boolean {
  if(option.definition.conditions.some(c=>c.op==='service.available'&&c.subject==='resident'))return false;
  const id = option.definition.id;
  if (/\.train\.|:train\./.test(id)) return true;
  if (/:action\.(order|invest|patrol|aid|reconcile)$/.test(id)) return true;
  if (option.definition.effects.some(e => e.op === 'progression.act' && ['train', 'order', 'invest', 'patrol', 'aid', 'reconcile'].includes((e as { move?: string }).move ?? ''))) return true;
  return false;
}
/** 主列表优先排序：休息/伤势 → 出行 → 挑战/环境 → 短叙事 → NSFW试跑 → 战败8玩法。 */
function mainActionPriority(option: ActionOption): number {
  const id = option.definition.id;
  const ops = option.definition.effects.map(e => e.op);
  if (/:action\.(rest|sleep|care)$/.test(id) || ops.includes('var.change') && /rest|sleep|care/.test(id)) return 10;
  if (ops.includes('location.move') || option.definition.group === 'travel') return 20;
  if (ops.includes('combat.start') || ops.includes('combat.encounter') || /challenge\.|encounter\.env/.test(id)) return 30;
  if (/nsfwcombo/.test(id)) return 50;
  if (/defeat\.play/.test(id)) return 60;
  if (ops.includes('narrative.start') || ops.includes('narrative.choose') || /narrative\./.test(id)) return 40;
  return 80;
}
export function renderGame(view: GameView, registry: Registry, result?: ActionResult, browsing = false): void {
  setTagDebugRegistry(registry);
  const scene = scenePresentation(view, registry, result, browsing);
  byId('scene-panel').dataset.mode = scene.mode;
  byId('scene-title').textContent = scene.title; byId('scene-subtitle').textContent = scene.subtitle;
  byId('scene-mode').textContent = scene.label; byId('clock').textContent = formatClock(view.state.clock.totalMinutes);
  byId('session-context').textContent = `${view.location.name} · ${scene.label}`;
  byId('action-context').textContent = scene.active ? '查看人物、身体或存档后，点“继续故事”即可回到这里。' : '选择行动前，可查看耗时与数值变化；实际恢复受状态上限影响。';
  byId('location-name').textContent = view.location.name;
  const observation = presentationText(view.state, registry, 'environment');
  const locFullText = registry.text(view.location.textKey) + (observation ? `\n\n${observation}` : '');
  const locTraces = document.body.dataset.debug === 'true' ? buildParagraphTraces('location', locFullText, view, registry, result) : undefined;
  prose(byId('location-description'), locFullText, locTraces);
  renderDebugInspectorHost('debug-inspector-location', byId('location-description'), locTraces ?? [], '地点描述 Tag 与生成模板溯源');

  const sceneBody = view.sceneText.startsWith(scene.title+'\n\n') ? view.sceneText.slice(scene.title.length+2) : view.sceneText;
  const sceneTraces = document.body.dataset.debug === 'true' ? buildParagraphTraces('scene', sceneBody, view, registry, result) : undefined;
  prose(byId('scene-text'), sceneBody, sceneTraces);
  byId('scene-text').hidden = scene.primaryResult || scene.mode === 'hub';
  renderDebugInspectorHost('debug-inspector-scene', byId('scene-text'), sceneTraces ?? [], '当前书页段落 Tag 与节点选择逻辑');

  byId('scene-return').hidden = scene.active || scene.mode === 'arrival' || scene.mode === 'hub';
  byId('scene-return').textContent = scene.mode === 'conversation' ? '← 结束交谈，返回地点' : '← 返回地点';
  byId('actions-title').textContent = scene.active ? '你的选择' : scene.mode === 'conversation' ? '继续交谈' : '下一步';
  const status = byId('status'); status.replaceChildren();
  // HUD 只展示硬核心；战斗八维/倾向值在 VariableDef 中但不挤状态栏（见 docs/NOTES-vars-engine.md）
  const hudIds = new Set(['core:money', 'core:energy', 'core:health', 'core:stamina', 'core:sanity', 'core:skillResource']);
  for (const def of registry.variables) {
    if (!hudIds.has(def.id)) continue;
    const value = view.state.player.variables[def.id]; const stat = element('div', 'stat');
    const heading = element('div', 'stat-heading'); const number = element('span', 'stat-value', String(value));
    number.dataset.stat = def.id; if (def.unit) number.append(element('small', '', def.unit));
    heading.append(element('span', '', def.label), number); stat.append(heading);
    if (def.max <= 100) { const meter = element('div', 'meter'); const fill = element('div', 'meter-fill'); fill.style.width = `${(value - def.min) / (def.max - def.min) * 100}%`; meter.append(fill); stat.append(meter); }
    status.append(stat);
  }
  if(view.state.adventure){const a=view.state.adventure;const info=element('p','muted',`经营份额 ${a.assets} · 组织影响 ${a.influence} · 街区安全 ${a.safety} · 声望 ${a.reputation}`);info.id='adventure-status';info.style.gridColumn='1 / -1';status.append(info);}
  const actions = byId('actions');
  const expanded = new Set([...actions.querySelectorAll<HTMLDetailsElement>('.locked-actions[open], .more-daily-actions[open]')].map(node => node.dataset.group));
  const moreDailyOpen = expanded.has('more-daily');
  const filterKey = `${view.location.id}:${scene.active}:${scene.mode === 'conversation'}`;
  if (actions.dataset.filterKey !== filterKey) actions.dataset.filter = 'all';
  actions.dataset.filterKey = filterKey; actions.replaceChildren();
  const groups = scene.active || scene.mode === 'conversation' ? { event: '眼下的选择', daily: '当前互动', explore: '当前互动', travel: '离开' } : Object.fromEntries(Object.entries(folioCategories).map(([id,value])=>[id,value[0]]));
  const densityHub = !scene.active && scene.mode !== 'conversation';
  for (const [group, label] of Object.entries(groups)) {
    let options = view.actions.filter(x => (scene.active || scene.mode === 'conversation' ? x.definition.group === group : folioCategory(x,registry) === group) && x.definition.surface !== 'body'

      && !x.definition.effects.some(effect => effect.op === 'preference.set' || effect.op === 'player.create')
      && (!(scene.mode === 'conversation' && !scene.active) || x.definition.effects.some(effect => effect.op === 'resident.talk' || effect.op === 'resident.help')));
    // 可见性瘦身：购买/装备/使用不进主列表（背包面板仍有按钮）；玩法未删。
    if (densityHub) options = options.filter(x => !isInventoryOnlyAction(x));
    const folded = densityHub ? options.filter(isMoreDailyAction) : [];
    if (densityHub) options = options.filter(x => !isMoreDailyAction(x));
    if (densityHub) options = [...options].sort((a, b) => mainActionPriority(a) - mainActionPriority(b) || a.definition.label.localeCompare(b.definition.label, 'zh'));
    if (!options.length && !folded.length) continue;
    const section = element('div', 'action-group'); section.dataset.group = group; const grid = element('div', 'action-grid');
    section.append(element('div', 'action-group-title', label));
    grid.append(...options.filter(option => option.available).map(x => actionButton(x, registry, false, view.state))); section.append(grid);
    if (folded.length) {
      const more = element('details', 'more-daily-actions locked-actions');
      more.dataset.group = 'more-daily'; more.open = moreDailyOpen;
      more.append(element('summary', '', `更多日常 · ${folded.length} 项`));
      const moreGrid = element('div', 'action-grid');
      moreGrid.append(...folded.filter(o => o.available).map(x => actionButton(x, registry, false, view.state)));
      const foldedLocked = folded.filter(o => !o.available);
      if (foldedLocked.length) moreGrid.append(...foldedLocked.map(x => actionButton(x, registry, false, view.state)));
      more.append(moreGrid); section.append(more);
    }
    const locked = options.filter(option => !option.available);
    if (locked.length) {
      const details = element('details', 'locked-actions');
      details.dataset.group = group; details.open = expanded.has(group);
      details.append(element('summary', '', `暂不可用 · ${locked.length} 项`));
      const lockedGrid = element('div', 'action-grid'); lockedGrid.append(...locked.map(x => actionButton(x, registry, false, view.state))); details.append(lockedGrid); section.append(details);
    }
    actions.append(section);
  }
  byId('action-filters').hidden = true;
  byId('district-location').textContent = `你在${view.location.name}。`;
  const nearby = byId('nearby'); nearby.replaceChildren();
  for (const route of registry.routes.filter(x => x.from === view.location.id)) {
    const travel = view.actions.find(option => option.definition.effects.some(effect => effect.op === 'location.move' && effect.routeId === route.id));
    const item = element('button', 'nearby-route', registry.location(route.to).name); item.type = 'button';
    item.disabled = !travel?.available || scene.active;
    if (travel) item.dataset.action = travel.definition.id;
    item.append(element('span', '', scene.active ? '结束当前互动后可以前往' : travel && !travel.available ? travel.reason : '前往这里 →')); nearby.append(item);
  }
  byId('action-result').hidden = !result?.ok || browsing;
  byId('action-result').classList.toggle('result-primary', scene.primaryResult);
  const detail = byId<HTMLDetailsElement>('result-detail');
  const resultKey = `${result?.requestId ?? ''}:${scene.primaryResult}`;
  if (detail.dataset.result !== resultKey) { detail.open = scene.primaryResult; detail.dataset.result = resultKey; }
  byId('result-label').textContent = scene.primaryResult ? '行动经过' : '刚刚的行动';
  if (result?.ok) {
    const cleanResultText = uniqueParagraphs(result.text);
    const resultTraces = document.body.dataset.debug === 'true' ? buildParagraphTraces('result', cleanResultText, view, registry, result) : undefined;
    prose(byId('result-text'), cleanResultText, resultTraces);
    renderDebugInspectorHost('debug-inspector-result', byId('result-text'), resultTraces ?? [], '行动反馈段落 Tag 与结算溯源');
    const value = (v: string | number | boolean) => typeof v==='boolean' ? v?'已完成':'未完成' : String(v);
    byId('result-changes').replaceChildren(...result.changes.map(x => element('span', 'change', `${x.label} ${value(x.before)} → ${value(x.after)}`)));
  } else {
    renderDebugInspectorHost('debug-inspector-result', byId('result-text'), [], '');
  }
  renderMap(view, registry);
  renderBodyPanel(view, registry, byId('body-content'), option => actionButton(option, registry, false, view.state));
  renderNPCPanel(view, registry, option => actionButton(option, registry, false, view.state));
  const log = byId('log-content'); log.replaceChildren();
  for (const tx of [...view.state.ledger.transactions].reverse().slice(0, 20)) {
    const item = element('article', 'log-item'); item.append(element('small', '', `行动 ${tx.result.revision}`), element('p', '', tx.result.text)); log.append(item);
  }
  if (!log.childElementCount) log.append(element('p', 'muted', '你还没有行动。'));
}
/** 将地点 map.x/y 吸附到无重叠网格；不足时按路线图 BFS 补位。见 docs/map-grid-layout.md */
function layoutMapGrid(locations: { id: Id; name: string; map: { x: number; y: number } }[], routes: { from: Id; to: Id }[], startId: Id): Map<Id, { col: number; row: number }> {
  const ids = locations.map(l => l.id);
  const idSet = new Set(ids);
  const adj = new Map<Id, Id[]>();
  for (const id of ids) adj.set(id, []);
  for (const r of routes) {
    if (!idSet.has(r.from) || !idSet.has(r.to)) continue;
    adj.get(r.from)!.push(r.to); adj.get(r.to)!.push(r.from);
  }
  const xs = [...new Set(locations.map(l => Math.round(l.map.x)))].sort((a, b) => a - b);
  const ys = [...new Set(locations.map(l => Math.round(l.map.y)))].sort((a, b) => a - b);
  const colOf = (x: number) => Math.max(0, xs.indexOf(Math.round(x)));
  const rowOf = (y: number) => Math.max(0, ys.indexOf(Math.round(y)));
  const taken = new Map<string, Id>();
  const pos = new Map<Id, { col: number; row: number }>();
  const key = (c: number, r: number) => `${c},${r}`;
  const placeAt = (id: Id, col: number, row: number) => {
    let c = col, r = row, guard = 0;
    while (taken.has(key(c, r)) && guard++ < 64) {
      // 螺旋外扩找空格，保证无重叠
      const ring = Math.ceil(guard / 8); const step = (guard - 1) % 8;
      const dx = [1, 1, 0, -1, -1, -1, 0, 1][step]!; const dy = [0, 1, 1, 1, 0, -1, -1, -1][step]!;
      c = col + dx * ring; r = row + dy * ring;
    }
    c = Math.max(0, c); r = Math.max(0, r);
    taken.set(key(c, r), id); pos.set(id, { col: c, row: r });
  };
  // 先按 map 坐标吸附；同格冲突再螺旋错开
  for (const loc of [...locations].sort((a, b) => a.map.x - b.map.x || a.map.y - b.map.y || a.id.localeCompare(b.id))) {
    placeAt(loc.id, colOf(loc.map.x), rowOf(loc.map.y));
  }
  // 若吸附挤成一条线（坐标退化），改用从起点 BFS 的四邻布局
  const cols = [...pos.values()].map(p => p.col); const rows = [...pos.values()].map(p => p.row);
  const degenerate = locations.length > 1 && (new Set(cols).size === 1 || new Set(rows).size === 1) && locations.length <= 12;
  if (degenerate || locations.every(l => l.map.x === locations[0]!.map.x && l.map.y === locations[0]!.map.y)) {
    taken.clear(); pos.clear();
    const origin = idSet.has(startId) ? startId : ids[0]!;
    const queue: Id[] = [origin]; const seen = new Set<Id>([origin]);
    placeAt(origin, 0, 0);
    const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]] as const;
    while (queue.length) {
      const cur = queue.shift()!; const base = pos.get(cur)!;
      let di = 0;
      for (const n of adj.get(cur) ?? []) {
        if (seen.has(n)) continue; seen.add(n);
        const [dx, dy] = dirs[di++ % dirs.length]!;
        placeAt(n, base.col + dx, base.row + dy); queue.push(n);
      }
    }
    for (const id of ids) if (!pos.has(id)) placeAt(id, pos.size, 0);
  }
  // 平移到非负紧凑包围盒
  let minC = Infinity, minR = Infinity;
  for (const p of pos.values()) { minC = Math.min(minC, p.col); minR = Math.min(minR, p.row); }
  for (const [id, p] of pos) pos.set(id, { col: p.col - minC, row: p.row - minR });
  return pos;
}
function renderMap(view: GameView, registry: Registry): void {
  const generatedIds = view.state.worldInstance?.definition.locations.map(l => l.id);
  const locations = registry.locations.filter(l => !generatedIds || generatedIds.includes(l.id));
  const routes = registry.routes.filter(r => !generatedIds || (generatedIds.includes(r.from) && generatedIds.includes(r.to)));
  const startId = view.state.worldInstance?.definition.startLocationId ?? view.location.id;
  const gridPos = layoutMapGrid(locations, routes, startId);
  let maxCol = 0, maxRow = 0;
  for (const p of gridPos.values()) { maxCol = Math.max(maxCol, p.col); maxRow = Math.max(maxRow, p.row); }
  const adjacent = new Set(routes.filter(r => r.from === view.location.id).map(r => r.to));
  const grid = element('div', 'map-grid');
  grid.style.gridTemplateColumns = `repeat(${maxCol + 1}, minmax(0, 1fr))`;
  grid.style.gridTemplateRows = `repeat(${maxRow + 1}, minmax(56px, auto))`;
  grid.setAttribute('role', 'grid');
  grid.setAttribute('aria-label', '街区网格地图');
  // 先填空单元格占位，保持网格对齐
  const byCell = new Map<string, typeof locations[number]>();
  for (const place of locations) {
    const p = gridPos.get(place.id)!;
    byCell.set(`${p.col},${p.row}`, place);
  }
  for (let r = 0; r <= maxRow; r++) {
    for (let c = 0; c <= maxCol; c++) {
      const place = byCell.get(`${c},${r}`);
      if (!place) {
        const empty = element('div', 'map-cell map-cell-empty'); empty.setAttribute('aria-hidden', 'true');
        empty.style.gridColumn = String(c + 1); empty.style.gridRow = String(r + 1);
        grid.append(empty); continue;
      }
      const isCurrent = place.id === view.location.id;
      const travel = view.actions.find(x => x.definition.effects.some(fx => fx.op === 'location.move' && registry.route(fx.routeId).to === place.id));
      const canGo = !!travel?.available && !view.eventTitle;
      const reason = isCurrent ? '当前位置' : view.eventTitle ? '当前事件进行中' : travel && !travel.available ? travel.reason : adjacent.has(place.id) ? '前往这里' : '需经相邻街道（不可直达）';
      const cell = element(canGo || isCurrent ? 'button' : 'div', `map-cell${isCurrent ? ' current' : ''}${canGo ? ' reachable' : ' blocked'}`);
      if (cell instanceof HTMLButtonElement) { cell.type = 'button'; if (canGo && travel) cell.dataset.action = travel.definition.id; else cell.disabled = true; }
      cell.style.gridColumn = String(c + 1); cell.style.gridRow = String(r + 1);
      cell.setAttribute('role', 'gridcell');
      const short = place.name.length > 8 ? place.name.slice(0, 7) + '…' : place.name;
      cell.append(element('span', 'map-cell-name', short));
      cell.append(element('small', '', reason));
      cell.title = `${place.name} · ${reason}`;
      cell.setAttribute('aria-label', `${place.name}，${reason}`);
      if (isCurrent) cell.setAttribute('aria-current', 'true');
      grid.append(cell);
    }
  }
  const legend = element('p', 'muted map-grid-legend', '点击相邻格子前往（沿用 location.move）。灰色格：事件中或非相邻不可直达。右侧「周围环境」仍列出邻接。');
  byId('map-content').replaceChildren(grid, legend);
}
let feedbackTimer: ReturnType<typeof setTimeout> | undefined;
export function feedback(text: string, error = false): void {
  if (feedbackTimer) clearTimeout(feedbackTimer);
  const target = byId('feedback'); target.textContent = text; target.classList.toggle('error', error);
  target.setAttribute('role', error ? 'alert' : 'status');
  if (text && !error) feedbackTimer = setTimeout(() => { target.textContent = ''; }, 6000);
}
export function newSeed(): number { return crypto.getRandomValues(new Uint32Array(1))[0]; }
export function asId(text: string): Id { return text as Id; }
