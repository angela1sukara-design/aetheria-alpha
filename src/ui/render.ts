import type { ActionResult, GameView } from '../core/types.ts';
import type { Registry } from '../content/registry.ts';
import { formatClock } from '../engine/clock.ts';
import { renderBodyPanel } from './body-panel.ts';
import { renderNPCPanel } from './npc-panel.ts';
import { scenePresentation } from './scene-presentation.ts';
import { folioCategory, folioCategories } from './folio.ts';
import { presentationText } from '../engine/semantic-query.ts';
import { uniqueParagraphs } from '../content/player-prose.ts';
import { byId, element } from './render-dom.ts';
import { buildParagraphTraces, proseParagraphs, renderDebugInspectorHost, setTagDebugRegistry } from './tag-debug.ts';
import { actionButton, isInventoryOnlyAction, isMoreDailyAction, mainActionPriority } from './render-actions.ts';
import { renderMap } from './render-map.ts';

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
  proseParagraphs(byId('location-description'), locFullText, locTraces);
  renderDebugInspectorHost('debug-inspector-location', byId('location-description'), locTraces ?? [], '地点描述 Tag 与生成模板溯源');

  const sceneBody = view.sceneText.startsWith(scene.title+'\n\n') ? view.sceneText.slice(scene.title.length+2) : view.sceneText;
  const sceneTraces = document.body.dataset.debug === 'true' ? buildParagraphTraces('scene', sceneBody, view, registry, result) : undefined;
  proseParagraphs(byId('scene-text'), sceneBody, sceneTraces);
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
    proseParagraphs(byId('result-text'), cleanResultText, resultTraces);
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

export { element, byId, feedback, newSeed, asId } from './render-dom.ts';
export { setTagDebugRegistry, buildParagraphTraces } from './tag-debug.ts';
export type { TagBadgeInfo, ParagraphDebugTrace } from './tag-debug.ts';
