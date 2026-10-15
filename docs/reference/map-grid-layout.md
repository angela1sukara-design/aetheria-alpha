# Map grid layout (tip)

`renderMap` 用 **2D CSS grid** 替代 SVG 圆点+虚线与长 `map-label` 行。

## 算法（2–3 句）

1. 把每个地点的 `location.map.x/y` **按去重排序吸附**成列/行索引；同格冲突时螺旋外扩，保证无重叠。
2. 若吸附后退化成单行/单列（或坐标全相同），则从 `startLocationId`（或当前点）沿 **route 邻接做 BFS**，按四邻方向落格。
3. 平移到非负紧凑包围盒后渲染：当前格高亮；相邻且 `location.move` 可用的格可点；其余灰显并写原因（事件中 / 非相邻）。

主交互在网格；侧栏「周围环境」仍保留瘦邻接列表。不改 worldgen。
