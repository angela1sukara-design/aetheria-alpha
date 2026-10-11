import type { ActionOption, ActionResult, GameView, Id } from '../core/types.ts';
import type { Registry } from '../content/registry.ts';
import { formatClock } from '../engine/clock.ts';
import { renderBodyPanel } from './body-panel.ts';
import { renderNPCPanel } from './npc-panel.ts';
import { scenePresentation } from './scene-presentation.ts';
export function element<K extends keyof HTMLElementTagNameMap>(tag: K, className = '', text = ''): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag); node.className = className; if (text) node.textContent = text; return node;
}
export function byId<T extends HTMLElement = HTMLElement>(id: string): T {
  const node = document.getElementById(id); if (!node) throw new Error(`缺少 UI 元素 ${id}`); return node as T;
}
function prose(target: HTMLElement, text: string): void { target.replaceChildren(...text.split('\n\n').map(t => element('p', '', t))); }
function actionButton(option: ActionOption, compact = false): HTMLButtonElement {
  const button = element('button', compact ? 'map-label' : 'action-button'); button.type = 'button';
  button.dataset.action = option.definition.id; button.dataset.group = option.definition.group;
  button.disabled = !option.available;
  button.append(element('span', 'action-label', option.definition.label));
  const hint = option.available ? option.definition.hint : option.reason;
  if (hint && hint !== '选择会推进经历 · 查看行动反馈') button.append(element('span', 'action-hint', hint));
  if (!option.available) button.title = option.reason;
  return button;
}
export function renderGame(view: GameView, registry: Registry, result?: ActionResult, browsing = false): void {
  const scene = scenePresentation(view, registry, result, browsing);
  byId('scene-panel').dataset.mode = scene.mode;
  byId('scene-title').textContent = scene.title; byId('scene-subtitle').textContent = scene.subtitle;
  byId('scene-mode').textContent = scene.label; byId('clock').textContent = formatClock(view.state.clock.totalMinutes);
  byId('location-name').textContent = view.location.name;
  prose(byId('location-description'), registry.text(view.location.textKey));
  prose(byId('scene-text'), view.sceneText);
  byId('scene-text').hidden = scene.primaryResult || scene.mode === 'hub';
  byId('scene-return').hidden = scene.active || scene.mode === 'arrival' || scene.mode === 'hub';
  byId('scene-return').textContent = scene.mode === 'conversation' ? '← 结束交谈，返回地点' : '← 返回地点';
  byId('actions-title').textContent = scene.active ? '你的选择' : scene.mode === 'conversation' ? '继续交谈' : '下一步';
  const status = byId('status'); status.replaceChildren();
  for (const def of registry.variables) {
    const value = view.state.player.variables[def.id]; const stat = element('div', 'stat');
    const heading = element('div', 'stat-heading'); const number = element('span', 'stat-value', String(value));
    number.dataset.stat = def.id; if (def.unit) number.append(element('small', '', def.unit));
    heading.append(element('span', '', def.label), number); stat.append(heading);
    if (def.max <= 100) { const meter = element('div', 'meter'); const fill = element('div', 'meter-fill'); fill.style.width = `${(value - def.min) / (def.max - def.min) * 100}%`; meter.append(fill); stat.append(meter); }
    status.append(stat);
  }
  const actions = byId('actions'); actions.replaceChildren();
  const groups = scene.active ? { event: '眼下的选择', daily: '当前互动', explore: '当前互动', travel: '离开' } : { event: '与人物交谈', daily: '做些什么', explore: '留意周围', travel: '前往其他地点' };
  for (const [group, label] of Object.entries(groups)) {
    const options = view.actions.filter(x => x.definition.group === group && x.definition.surface !== 'body'
      && !x.definition.effects.some(effect => effect.op === 'preference.set' || effect.op === 'player.create')
      && (!(scene.mode === 'conversation' && !scene.active) || x.definition.effects.some(effect => effect.op === 'resident.talk' || effect.op === 'resident.help')));
    if (!options.length) continue;
    const section = element('div', 'action-group'); const grid = element('div', 'action-grid');
    section.append(element('div', 'action-group-title', label));
    grid.append(...options.filter(option => option.available).map(x => actionButton(x))); section.append(grid);
    const locked = options.filter(option => !option.available);
    if (locked.length) {
      const details = element('details', 'locked-actions');
      details.append(element('summary', '', `暂不可用 · ${locked.length} 项`));
      const lockedGrid = element('div', 'action-grid'); lockedGrid.append(...locked.map(x => actionButton(x))); details.append(lockedGrid); section.append(details);
    }
    actions.append(section);
  }
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
  renderBodyPanel(view, registry, byId('body-content'), option => actionButton(option));
  renderNPCPanel(view, registry, option => actionButton(option));
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
    if (option) links.append(actionButton(option, true));
    else { const label = element('div', `map-label ${place.id === view.location.id ? 'current' : ''}`, place.name); label.append(element('small', '', place.id === view.location.id ? '当前位置' : view.eventTitle ? '当前事件进行中' : '需经相邻街道')); links.append(label); }
  }
  byId('map-content').replaceChildren(svg, links);
}
export function feedback(text: string, error = false): void { const target = byId('feedback'); target.textContent = text; target.classList.toggle('error', error); }
export function newSeed(): number { return crypto.getRandomValues(new Uint32Array(1))[0]; }
export function asId(text: string): Id { return text as Id; }
