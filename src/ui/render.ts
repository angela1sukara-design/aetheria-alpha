import type { ActionOption, ActionResult, GameState, GameView, Id } from '../core/types.ts';
import type { Registry } from '../content/registry.ts';
import { formatClock } from '../engine/clock.ts';
import { renderBodyPanel } from './body-panel.ts';
import { renderNPCPanel } from './npc-panel.ts';
import { scenePresentation } from './scene-presentation.ts';
import { actionPreview } from './action-preview.ts';
import { presentationText } from '../engine/semantic-query.ts';
export function element<K extends keyof HTMLElementTagNameMap>(tag: K, className = '', text = ''): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag); node.className = className; if (text) node.textContent = text; return node;
}
export function byId<T extends HTMLElement = HTMLElement>(id: string): T {
  const node = document.getElementById(id); if (!node) throw new Error(`缺少 UI 元素 ${id}`); return node as T;
}
let tagDebugRegistry: Registry | undefined;
/** Debug：正文【标签】下划线可点查看来源（只读，不改玩法）。 */
export function setTagDebugRegistry(registry: Registry): void { tagDebugRegistry = registry; }

function tagSourceLines(label: string): string[] {
  const r = tagDebugRegistry;
  if (!r) return [`标记「${label}」`, '来源：调试注册表尚未就绪'];
  const hits = r.tags.filter(t => t.label === label || t.id.endsWith('.' + label) || t.aliases.some(a => a.value === label));
  if (!hits.length) {
    // 亦匹配「伤后乏力」类已写入正文的 label
    const loose = r.tags.filter(t => t.label.includes(label) || label.includes(t.label));
    if (!loose.length) return [`标记「${label}」`, '来源：未在已装 TagDef 中找到同名条目（可能是素材指向 / 编辑编号 / 占位）'];
    return loose.slice(0, 5).flatMap(t => [`${t.label} · ${t.id}`, `定义：${t.definition}`, `状态：${t.status} · facets：${t.facets.join(',') || '—'}`]);
  }
  return hits.flatMap(t => [`${t.label} · ${t.id}`, `定义：${t.definition}`, `状态：${t.status} · facets：${t.facets.join(',') || '—'}`]);
}

function showTagSource(label: string, anchor: HTMLElement): void {
  let tip = document.getElementById('tag-source-pop');
  if (!tip) {
    tip = element('div', 'tag-source-pop');
    tip.id = 'tag-source-pop';
    tip.setAttribute('role', 'dialog');
    tip.setAttribute('aria-label', '标签来源');
    document.body.append(tip);
    document.addEventListener('click', (event) => {
      const t = document.getElementById('tag-source-pop');
      if (!t || t.hidden) return;
      const el = event.target as Node | null;
      if (el && (t.contains(el) || (el instanceof Element && el.closest('.tag-mark')))) return;
      t.hidden = true;
    });
  }
  tip.replaceChildren();
  tip.append(element('strong', '', '标签来源（调试）'));
  for (const line of tagSourceLines(label)) tip.append(element('p', '', line));
  const close = element('button', '', '关闭'); close.type = 'button';
  close.addEventListener('click', () => { tip!.hidden = true; });
  tip.append(close);
  tip.hidden = false;
  const rect = anchor.getBoundingClientRect();
  tip.style.left = `${Math.min(rect.left, window.innerWidth - 320)}px`;
  tip.style.top = `${Math.min(rect.bottom + 8, window.innerHeight - 120)}px`;
}

function prose(target: HTMLElement, text: string): void {
  target.replaceChildren(...text.split('\n\n').map(para => {
    const node = element('p', '');
    const re = /【([^【】]+)】/g;
    let last = 0;
    let match: RegExpExecArray | null;
    while ((match = re.exec(para))) {
      if (match.index > last) node.append(document.createTextNode(para.slice(last, match.index)));
      const label = match[1]!;
      const mark = element('button', 'tag-mark', `【${label}】`);
      mark.type = 'button';
      mark.title = '点击查看来源';
      mark.setAttribute('aria-label', `标签 ${label}，点击查看来源`);
      mark.addEventListener('click', event => { event.preventDefault(); event.stopPropagation(); showTagSource(label, mark); });
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
export function renderGame(view: GameView, registry: Registry, result?: ActionResult, browsing = false): void {
  const scene = scenePresentation(view, registry, result, browsing);
  byId('scene-panel').dataset.mode = scene.mode;
  byId('scene-title').textContent = scene.title; byId('scene-subtitle').textContent = scene.subtitle;
  byId('scene-mode').textContent = scene.label; byId('clock').textContent = formatClock(view.state.clock.totalMinutes);
  byId('session-context').textContent = `${view.location.name} · ${scene.label}`;
  byId('action-context').textContent = scene.active ? '查看人物、身体或存档后，点“继续故事”即可回到这里。' : '选择行动前，可查看耗时与数值变化；实际恢复受状态上限影响。';
  byId('location-name').textContent = view.location.name;
  const observation = presentationText(view.state, registry, 'environment');
  prose(byId('location-description'), registry.text(view.location.textKey) + (observation ? `\n\n${observation}` : ''));
  prose(byId('scene-text'), view.sceneText);
  byId('scene-text').hidden = scene.primaryResult || scene.mode === 'hub';
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
  const expanded = new Set([...actions.querySelectorAll<HTMLDetailsElement>('.locked-actions[open]')].map(node => node.dataset.group));
  const filterKey = `${view.location.id}:${scene.active}:${scene.mode === 'conversation'}`;
  if (actions.dataset.filterKey !== filterKey) actions.dataset.filter = 'all';
  actions.dataset.filterKey = filterKey; actions.replaceChildren();
  const groups = scene.active ? { event: '眼下的选择', daily: '当前互动', explore: '当前互动', travel: '离开' } : { event: '人物与故事', daily: '生活与工作', explore: '探索与遇见', travel: '前往其他地点' };
  for (const [group, label] of Object.entries(groups)) {
    const options = view.actions.filter(x => x.definition.group === group && x.definition.surface !== 'body'
      && !x.definition.effects.some(effect => effect.op === 'preference.set' || effect.op === 'player.create')
      && (!(scene.mode === 'conversation' && !scene.active) || x.definition.effects.some(effect => effect.op === 'resident.talk' || effect.op === 'resident.help')));
    if (!options.length) continue;
    const section = element('div', 'action-group'); section.dataset.group = group; const grid = element('div', 'action-grid');
    section.append(element('div', 'action-group-title', label));
    grid.append(...options.filter(option => option.available).map(x => actionButton(x, registry, false, view.state))); section.append(grid);
    const locked = options.filter(option => !option.available);
    if (locked.length) {
      const details = element('details', 'locked-actions');
      details.dataset.group = group; details.open = expanded.has(group);
      details.append(element('summary', '', `暂不可用 · ${locked.length} 项`));
      const lockedGrid = element('div', 'action-grid'); lockedGrid.append(...locked.map(x => actionButton(x, registry, false, view.state))); details.append(lockedGrid); section.append(details);
    }
    actions.append(section);
  }
  renderActionFilters(scene.active);
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
    prose(byId('result-text'), result.text);
    byId('result-changes').replaceChildren(...result.changes.map(x => element('span', 'change', `${x.label} ${x.before} → ${x.after}`)));
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
function renderMap(view: GameView, registry: Registry): void {
  const generatedIds = view.state.worldInstance?.definition.locations.map(l => l.id);
  const locations = registry.locations.filter(l => !generatedIds || generatedIds.includes(l.id));
  const routes = registry.routes.filter(r => !generatedIds || (generatedIds.includes(r.from) && generatedIds.includes(r.to)));
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); svg.classList.add('map-art'); svg.setAttribute('viewBox', '0 0 100 100'); svg.setAttribute('preserveAspectRatio', 'none'); svg.setAttribute('aria-hidden', 'true');
  const pair = new Set<string>();
  for (const route of routes) {
    const key = [route.from, route.to].sort().join('|'); if (pair.has(key)) continue; pair.add(key);
    const from = registry.location(route.from).map; const to = registry.location(route.to).map;
    const line = document.createElementNS(svg.namespaceURI, 'line'); for (const [name, value] of Object.entries({ x1: from.x, y1: from.y, x2: to.x, y2: to.y })) line.setAttribute(name, String(value));
    line.setAttribute('stroke', '#5b5368'); line.setAttribute('stroke-width', '.7'); line.setAttribute('stroke-dasharray', '2 2'); svg.append(line);
  }
  for (const place of locations) {
    const circle = document.createElementNS(svg.namespaceURI, 'circle'); circle.setAttribute('cx', String(place.map.x)); circle.setAttribute('cy', String(place.map.y)); circle.setAttribute('r', '2'); circle.setAttribute('fill', place.id === view.location.id ? '#b9a1eb' : '#8fcbc4'); svg.append(circle);
  }
  const links = element('div', 'map-links');
  for (const place of locations) {
    const option = view.actions.find(x => x.definition.effects.some(fx => fx.op === 'location.move' && registry.route(fx.routeId).to === place.id));
    if (option) links.append(actionButton(option, registry, true, view.state));
    else { const label = element('div', `map-label ${place.id === view.location.id ? 'current' : ''}`, place.name); label.append(element('small', '', place.id === view.location.id ? '当前位置' : view.eventTitle ? '当前事件进行中' : '需经相邻街道')); links.append(label); }
  }
  byId('map-content').replaceChildren(svg, links);
}
function renderActionFilters(active: boolean): void {
  const host = byId('action-filters'), actions = byId('actions'); host.replaceChildren();
  const categories = [...actions.querySelectorAll<HTMLElement>('.action-group')];
  host.hidden = active || categories.length < 2;
  if (host.hidden) actions.dataset.filter = 'all';
  let selected = actions.dataset.filter ?? 'all';
  if (selected !== 'all' && !categories.some(node => node.dataset.group === selected)) { selected = 'all'; actions.dataset.filter = selected; }
  for (const [group, label] of [['all', '全部'], ['event', '故事'], ['daily', '生活'], ['explore', '探索'], ['travel', '出行']]) {
    const category = categories.find(node => node.dataset.group === group);
    if (group !== 'all' && !category) continue;
    const count = (group === 'all' ? actions : category!).querySelectorAll('button[data-action]:enabled').length;
    const button = element('button', '', `${label} ${count}`); button.type = 'button'; button.dataset.actionFilter = group;
    button.setAttribute('aria-pressed', String(selected === group));
    button.addEventListener('click', () => { actions.dataset.filter = group; renderActionFilters(active); byId('action-filters').querySelector<HTMLButtonElement>(`[data-action-filter="${group}"]`)?.focus({preventScroll:true}); });
    host.append(button);
  }
  for (const category of categories) category.hidden = selected !== 'all' && category.dataset.group !== selected;
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
