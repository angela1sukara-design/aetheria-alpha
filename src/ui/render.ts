import type { ActionOption, ActionResult, GameView, Id } from '../core/types.ts';
import type { Registry } from '../content/registry.ts';
import { formatClock } from '../engine/clock.ts';
import { renderBodyPanel } from './body-panel.ts';
import { renderNPCPanel } from './npc-panel.ts';
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
  button.append(element('span', 'action-label', option.definition.label), element('span', 'action-hint', option.available ? option.definition.hint : option.reason));
  if (!option.available) button.title = option.reason;
  return button;
}
export function renderGame(view: GameView, registry: Registry, result?: ActionResult): void {
  byId('scene-title').textContent = view.location.name; byId('scene-subtitle').textContent = view.location.subtitle;
  byId('scene-mode').textContent = view.state.district?.combat?'正在交锋':view.state.district?.scene?'私人相处':view.eventTitle ?? '当前所在'; byId('clock').textContent = formatClock(view.state.clock.totalMinutes);
  prose(byId('scene-text'), view.sceneText);
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
  const groups = { event: '眼下的选择', travel: '去哪儿', daily: '做些什么', explore: '留意周围' } as const;
  for (const [group, label] of Object.entries(groups)) {
    const options = view.actions.filter(x => x.definition.group === group && x.definition.surface !== 'body'); if (!options.length) continue;
    const section = element('div', 'action-group'); const grid = element('div', 'action-grid');
    section.append(element('div', 'action-group-title', label)); grid.append(...options.map(x => actionButton(x))); section.append(grid); actions.append(section);
  }
  byId('district-location').textContent = `你在${view.location.name}。`;
  const nearby = byId('nearby'); nearby.replaceChildren();
  for (const route of registry.routes.filter(x => x.from === view.location.id)) {
    const item = element('div', 'nearby-route', registry.location(route.to).name); item.append(element('span', '', view.eventTitle ? '结束当前事件后可以前往' : '沿路步行即可到达')); nearby.append(item);
  }
  byId('action-result').hidden = !result?.ok;
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
