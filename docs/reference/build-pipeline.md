# 构建流水线依赖（简表）

日常改代码不必每次跑完整 `npm run check`。按改动选择命令；发版或合并前再跑 `npm run check`。

## 主链路

`npm run build` 按顺序执行：

| 步骤 | 脚本 | 主要输入 | 主要输出 |
| --- | --- | --- | --- |
| 1 | `scripts/build-adventure-content.mjs` | `content/adventure/` 等 | 冒险相关生成 JSON |
| 2 | `scripts/build-quest-content.mjs` | `production/quest-authoring/`、`content/` | 任务与世界题材包 |
| 3 | `scripts/build-lexicon-adapter.mjs` | 词库源 | 词库适配产物 |
| 4 | `scripts/build-b-observations.mjs` | `content/prose/b-authoring-v2.json` | `src/world/b-observation-data.ts` |
| 5 | `scripts/build-b-five-themes.mjs` | B 五题材计划 | `src/world/b-five-theme-data.ts` |
| 6 | `scripts/build-a-templates.mjs` | A 模板与 tag 矩阵 | `src/engine/prose-assembly.generated.ts` 等 |
| 7 | `scripts/build.mjs` | `src/**/*.ts` | `dist/`（剥类型 ESM） |
| 8 | `scripts/build-standalone.mjs` | `dist/` | 单机 HTML 入口 |
| 9 | `scripts/build-world-samples.mjs` | 生成配置 | 样例世界 |

改 **B 观察文案** 时至少跑 4 → 7；改 **A 槽位拼装** 时至少跑 6 → 7；只改 `src/` 逻辑且不动上述输入时，通常 **7** 即可。

## 常用局部命令

- 类型：`npm run typecheck`（`src/`）；测试类型检查逐步启用：`npm run typecheck:tests`（见 `tsconfig.tests.json`）
- 单元测试：`npm test` 或 `package.json` 中带 `test:` 前缀的脚本
- Tag 矩阵：`npm run tag-matrices:build` / `test:tag-matrices`
- AI 任务包（离线、体积大）：`node scripts/build-ai-task-pack.mjs` → `deliverables/ai-tasks/`

## UI 源码（`src/ui/`）

主界面渲染已拆分，便于协作时只打开相关文件：

| 文件 | 职责 |
| --- | --- |
| `render-dom.ts` | DOM 工具、`feedback`、`newSeed`、`asId` |
| `tag-debug.ts` | Tag 溯源、`buildParagraphTraces`、调试弹层 |
| `render-actions.ts` | 行动按钮与主列表分组/排序 |
| `render-map.ts` | 街区网格地图 |
| `render.ts` | `renderGame` 组装；对外 re-export 保持原 import 路径 |

## 与 AI 协作

能读仓库的 Agent 见根目录 [AGENTS.md](../../AGENTS.md)；不要默认通读 `production/tag-deliveries/` 或全文任务包。
