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
| 6a | `scripts/build-personal-content.mjs` | 个人故事/职业原稿与显式结算计划 | `src/world/personal-content-data.ts` |
| 7 | `scripts/build.mjs` | `src/**/*.ts` | `dist/`（剥类型 ESM） |
| 8 | `scripts/build-standalone.mjs` | `dist/` | 单机 HTML 入口 |

改 **B 观察文案** 时至少跑 4 → 7；改 **A 槽位拼装** 时至少跑 6 → 7；只改 `src/` 逻辑且不动上述输入时，通常 **7** 即可。

上述局部步骤更新的是模块版。需要更新双击运行的独立HTML时继续跑8。正式入口统一为根目录“启动游戏-双击直接运行.html”，start_game.bat也打开该文件。dist中的兼容HTML供既有测试与工具使用。

种子示例已移出默认构建；需要时在步骤8后执行npm run examples:worldgen（scripts/build-world-samples.mjs），输出到dist。依赖种子示例的npm浏览器检查命令会先生成示例；直接运行对应测试文件时须自行准备。

## 常用局部命令

- 类型：`npm run typecheck`（`src/`）；`npm run typecheck:tests`严格检查全部`tests/**/*.ts`，不排除现有测试。测试依赖的`.mjs`工具通过`allowJs`推断接口，`checkJs=false`表示不单独检查JavaScript工具内部；这些工具仍需实际测试验证。
- 单元测试：`npm test` 或 `package.json` 中带 `test:` 前缀的脚本
- Tag 矩阵：`npm run tag-matrices:build` / `test:tag-matrices`
- AI 任务包（离线、体积大）：`node scripts/build-ai-task-pack.mjs` → `deliverables/ai-tasks/`

`npm run check`依次执行源码类型、测试类型、单元测试、完整构建、运行产物与基础规则检查；测试类型失败会阻止后续发布构建。

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

装入只走 [安装规范](ai-install-spec.md)。能读仓库时的目录白名单在根目录 [AGENTS.md](../../AGENTS.md)。不要默认通读 `production/tag-deliveries/` 或全文任务包。
