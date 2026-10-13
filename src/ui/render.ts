import type { ActionOption, ActionResult, GameState, GameView, Id } from '../core/types.ts';
import type { Registry } from '../content/registry.ts';
import { formatClock } from '../engine/clock.ts';
import { renderBodyPanel } from './body-panel.ts';
import { renderNPCPanel } from './npc-panel.ts';
import { scenePresentation } from './scene-presentation.ts';
import { actionPreview } from './action-preview.ts';
import { folioCategory, folioCategories } from './folio.ts';
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
  const box = tip.getBoundingClientRect();
  tip.style.left = `${Math.max(12, Math.min(rect.left, window.innerWidth - box.width - 12))}px`;
  tip.style.top = `${Math.max(12, Math.min(rect.bottom + 8, window.innerHeight - box.height - 12))}px`;
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
      const mark = element(document.body.dataset.debug === 'true' ? 'button' : 'span', 'tag-mark', `【${label}】`);
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
  const id = option.definition.id;
  if (/\.buy\.|:buy\./.test(id)) return true;
  if (option.definition.effects.some(e => e.op === 'equipment.wear' || e.op === 'item.use')) return true;
  // 战内消耗品按钮仍留在事件/战斗选择里
  if (option.definition.effects.some(e => e.op === 'combat.turn' && (e as { move?: string }).move === 'item')) return false;
  return false;
}
/** 训练 + 经营/订单/巡查/协作/调解 → 「更多日常」折叠。 */
function isMoreDailyAction(option: ActionOption): boolean {
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
  grid.style.gridTemplateColumns = `repeat(${maxCol + 1}, minmax(72px, 1fr))`;
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
