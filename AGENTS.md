# AI 协作指引（有仓库访问权限）

本文件给 **能读取本 Git 仓库** 的 Agent（Cursor、Claude、Gemini、GPT 等）。装入格式只有一份：[安装规范](docs/reference/ai-install-spec.md)（`aetheria-install/1`）。先选 `words` / `content` / `mechanism` 车道，再按该文件第 2 节写交付头。

不要默认打开 `deliverables/ai-tasks/` 里的全文任务包。玩法取舍记录在 [协作核对](docs/reference/ai-collaboration-review.md)。模块 A–E 的历史任务说明在 [development-plan.md](docs/reference/development-plan.md)，只在领用对应模块时阅读。

## 工程分层（改代码前先定位）

| 目录 | 职责 |
| --- | --- |
| `src/core` | 类型与领域模型 |
| `src/content` | 包加载、Schema、Registry（运行时） |
| `src/engine` | 游戏逻辑；**唯一状态写入**在 `executor.ts` |
| `src/world` | 世界生成与 A/B 观察素材编译 |
| `src/persistence` | 存档校验与迁移 |
| `src/ui` | 只读渲染；经 `ActionIntent` 提交，不直接改 `GameState` |
| `content/` | 审定 JSON 内容包（非 `src/content` 源码） |

当前世界生成器版本：`src/world/generator.ts` 中 `GENERATOR_VERSION`（现为 **0.11.0**）。

## 红线（摘要）

1. 状态只通过 `ActionExecutor.performAction` 提交；`conditions` / `selectors` / UI 渲染不得消耗游戏 RNG 或改写权威 `GameState`。
2. 新字段须同步：类型、`src/content/*-schema` 或 `src/world/schema.ts`、引擎初始化/效果、`src/persistence/*-validation`（或 `world/validation.ts`）。
3. NPC 功能由真实 **services** 与设施决定：不支持则 UI 不出现；缺资源才显示限制。不用 `functional` 二元或职业名代替能力。
4. 只在新世界启用新结构；旧档从快照恢复，不放宽包哈希、不静默重生成世界。
5. 交付 **针对当前 commit 的 diff/补丁**，不要整文件覆盖他人已改动的源文件。

## 按模块必读文件（白名单）

任务说明里应写明模块字母。除下列路径与任务指定的 `tests/*`、`content/*` 片段外，**不要**通读整个 `src/` 或全部 `content/`。

### 模块 A — 区域与地点

- `src/world/types.ts`, `schema.ts`, `generator.ts`, `validation.ts`, `relationship-validation.ts`
- `src/engine/numerics.ts`, `src/ui/world-panel.ts`
- 地图/UI 相关时再读 `src/ui/render.ts` 的局部
- 测试：`tests/worldgen.test.ts`, `tests/worldgen-v02.test.ts`, `tests/world-profiles.test.ts`

### 模块 B — 地点选人选敌

- `src/world/combat-encounters.ts`, `src/engine/environment-enemies.ts`
- `src/core/adventure-types.ts`, `src/world/generator.ts`, `src/world/types.ts`
- `src/content/adventure-schema.ts`
- 测试：`tests/environment-enemies.test.ts`, `tests/adventure.test.ts`

### 模块 C — NPC 功能与任务

- `src/core/district-types.ts`, `src/core/function-types.ts`
- `src/engine/entity-functions.ts`, `selectors.ts`, `district.ts`, `progression.ts`
- `src/content/district-schema.ts`, `src/persistence/district-validation.ts`, `src/ui/district-panel.ts`
- 测试：`tests/entity-functions.test.ts`, `tests/district.test.ts`, `tests/save.test.ts`

### 模块 D — 性格交谈（已实装，以回归/扩展为主）

- `src/engine/personality.ts`, `src/core/personality-types.ts`
- `src/engine/narrative.ts`, `district.ts`, `selectors.ts`, `resident-quests.ts`
- `scripts/build-personality-content.mjs`, `tests/personality.test.ts`
- 现状说明：`docs/reference/module-d-implementation.md`

### 模块 E — 关系与路线

- `src/core/npc-types.ts`, `district-types.ts`, `adventure-types.ts`
- `src/engine/npc.ts`, `narrative.ts`, `transformations.ts`, `conditions.ts`, `effects.ts`, `eligibility.ts`
- `src/content/schema.ts`, `foundation-schema.ts`
- `src/persistence/npc-validation.ts`, `district-validation.ts`
- 测试：`tests/npc.test.ts`, `tests/body-tf.test.ts`, `tests/save.test.ts`

## 默认不要读（除非任务明确要求）

- `production/tag-deliveries/**` — 历史交付档案，体积大，多数不参与运行时代码
- `production/lexicon-authoring/inbox/**`, `outbox/**` — 制作往返件
- `docs/tag-hub/outbox/**` — 外发草稿
- `src/world/b-five-theme-data.ts`, `b-observation-data.ts`, `a-template-data.ts` — 生成用大数据；改 B/A 文案应改 `content/prose/` 与对应 `scripts/build-*.mjs`，再跑构建
- `src/engine/prose-assembly.generated.ts` — 生成物，改 `production/tag-matrices` 与 `scripts/build-a-templates.mjs`
- 全文 `deliverables/ai-tasks/*.md` 或 `node scripts/build-ai-task-pack.mjs` 产出的 ZIP

词库/正文协作（不改游戏引擎）请用 `production/collaboration-pack/` 与 `node scripts/build-collaboration-pack.mjs`，见该目录 README。

## UI 改动时的文件范围

主界面已拆分，避免通读整份 `render.ts`：

- `src/ui/render.ts` — 主 `renderGame` 组装
- `src/ui/render-dom.ts` — DOM 工具与 `feedback`
- `src/ui/tag-debug.ts` — Tag 调试（非玩法）
- `src/ui/render-actions.ts` — 行动列表
- `src/ui/render-map.ts` — 地图

构建步骤见 [docs/reference/build-pipeline.md](docs/reference/build-pipeline.md)。

## 验证命令（按改动范围选，勿默认 `npm run check`）

```sh
npm run typecheck
npm run typecheck:tests
node --test tests/<与任务相关的>.test.ts
```

- 世界生成：`npm run test:worldgen`
- 性格/设施：`npm run test:quests` 或 `tests/entity-functions.test.ts`
- A/B 正文：`npm run test:a-content` / `npm run test:b-content`
- 发版前整合：`npm run check`

## Cursor Cloud specific instructions

- 使用 Node.js 24（`/usr/local/bin/node`）。`package.json` 的 `engines` 要求 `>=24`。
- 开发服务器：`npm run dev`。它编译 `src/` 到 `dist/`，并在 `http://127.0.0.1:4173/` 提供页面。
- 运行 `npm test` 时设置 `LANG=zh_CN.UTF-8` 与 `LC_ALL=zh_CN.UTF-8`。词库测试用 `localeCompare` 的 zh-CN 顺序对照已提交的中文文件名。

## 离线 / 无仓库 AI

按 [安装规范](docs/reference/ai-install-spec.md) 第 6 节的同一段说明交稿。`words` 与 `content` 交 JSON；`mechanism` 交针对 `base` 的 diff。`node scripts/build-ai-task-pack.mjs` 只是可选的全文附件，不是另一套规范。
