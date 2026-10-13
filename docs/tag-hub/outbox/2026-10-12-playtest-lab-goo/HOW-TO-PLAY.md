# 试玩：合载 Tag 共存切片（研究员 × 触手黏液 × 黑胶）

| 项 | 值 |
|---|---|
| 分支 | `codex/tag-effect-preview` |
| 形态 | **ContentPack + Reference + generation-rules** 合载进引擎（**无** EventGraph） |
| 状态 | draft / 试跑可挂载；收录 ≠ 审定 ≠ 已实装 |
| 默认清单 | **未改** `content/index.json` |

## 一键挂载（推荐）

1. 根目录：`npm run dev`（或 `node scripts/serve.mjs`）
2. 浏览器打开：`http://localhost:4173/?playtest=tagcoexist`
3. 打开「世界」→ 用夜间规则生成街区（地点约 5、居民约 3；`startMinutes=1320`）
4. 到诊所/工坊相关地点观察活动互斥与 gel/night prose 条件（见 `PLAYTEST-SLICE.md`）

`?playtest=tagcoexist` 会：

- 加载 `content/index.playtest-tagcoexist.json`（默认包 + `playtest-tagcoexist`）
- 默认生成规则改为 `content/generation/playtest-tagcoexist-rules.json`
- 参考库叠加 `playtest-tagcoexist-reference.json`

去掉查询参数即回默认世界。

## 手动挂载（世界面板）

不改 URL 时，在「世界」里分别导入：

1. **生成用内容包**：`content/playtest-tagcoexist/pack.json`
2. **参考库**：`content/generation/playtest-tagcoexist-reference.json`
3. **生成规则**：`content/generation/playtest-tagcoexist-rules.json`

然后「生成并进入街区」。当前世界不会被写；需新生成才吃规则。

## 合载顺序

1. 工程默认 content packs + foundation  
2. `content/playtest-tagcoexist/pack.json`  
3. `lexicon-reference.json` + `playtest-tagcoexist-reference.json`  
4. `playtest-tagcoexist-rules.json`（夜间开局；不覆盖权威 `generation/rules.json`）

## 源文件（docs / tag-hub）

- 切片说明：`docs/tag-hub/rules/tag-rules-delivery-coexistence/PLAYTEST-SLICE.md`
- 原稿包：`docs/tag-hub/rules/tag-rules-delivery-coexistence/{content-pack,reference-pack,generation-rules}*`
- 种子三分栏：`docs/tag-hub/inventory/seeds/2026-10-12-接tag试跑-研究员触手黏液黑胶.md`
- 故事试写（旁路阅读）：`docs/tag-hub/outbox/2026-10-12-故事试写-研究员触手黏液黑胶.md`

## 限制

- 运行时 prose 为 **general**；成人正文在 Markdown 旁路  
- 不是全库共存矩阵；仅本种子切片  
- 不做 EventGraph / 固定故事 ContentPack（本次范围外）  
- 待封装：部位覆盖进度、材质态机、封口感官滤波等（见故事试写 §4）
