import type { GameView, Id } from '../core/types.ts';
import type { Registry } from '../content/registry.ts';
import { element, byId } from './render-dom.ts';

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
export function renderMap(view: GameView, registry: Registry): void {
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
