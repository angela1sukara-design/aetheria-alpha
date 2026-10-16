import type { ActionResult, Condition, GameState, GameView, Id } from '../core/types.ts';
import type { Registry } from '../content/registry.ts';
import { derivedSemantics, explainPresentationText } from '../engine/semantic-query.ts';
import { explainNarrativeNode } from '../engine/narrative.ts';
import { locationEnvironmentTags, matchingEnvironmentEnemyRules } from '../engine/environment-enemies.ts';
import { activeEvent } from '../engine/events.ts';
import { evaluate } from '../engine/conditions.ts';
import { resultAction } from './scene-presentation.ts';
import { element } from './render-dom.ts';

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

export function renderDebugInspectorHost(hostId: string, afterTarget: HTMLElement, traces: ParagraphDebugTrace[], title: string): void {
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

export function proseParagraphs(target: HTMLElement, text: string, traces?: ParagraphDebugTrace[]): void {
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
