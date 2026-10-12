# 以太都市：深渊重塑

这里是唯一的当前开发工程，包含固定都市、随机街区、BodyGraph / TF、人物、事件及存档系统。游戏包版本为 `0.2.0-alpha`，已加入 foundation v0.4 增量接口。旧交付目录是历史快照，继续开发使用本目录。

## 启动与验证

需要 Node.js 24 或更新版本。首次从 Git 克隆后运行：

```sh
npm ci
npm run build
```

Windows 双击 `start_game.bat`，浏览器打开 `http://localhost:4173/`。也可运行 `npm run dev`。`dist/` 是本地构建结果，Git 仓库不附带构建、依赖和浏览器。

构建后，可直接打开 `dist/Aetheria-Alpha-0.2.html`；两个离线街区在 `dist/WorldGenerator-Seed-7.html` 和 `dist/WorldGenerator-Seed-42.html`。开发模板 `index.html` 需通过服务器加载。

```sh
npm run check
```

该命令执行类型检查、规则回归、构建和产物检查。浏览器流程分别使用 `npm run test:browser`、`npm run test:ui`、`npm run test:ux` 和 `npm run test:worldgen:browser`。首次运行浏览器测试需要 `npx playwright install chromium`；脚本的浏览器路径配置见相应测试文件。

## 文件与资料入口

| 位置 | 用途 |
| --- | --- |
| `src/` | 主游戏源码：内容加载、引擎、人物、身体、世界生成、存档和 UI |
| `content/` | 正式游戏内容、foundation 定义和生成参考库 |
| `scripts/`、`tests/` | 构建、服务、词库工具及回归验证 |
| [基础词条制作](production/lexicon-authoring/README.md) | 58 类基础素材、原始批次、审稿和用途账本 |
| [v2 格式与创作接口](production/lexicon-authoring/formats/v2/README.md) | 当前 foundation 的版本化交换格式、分类和字典约束 |
| [Tag 与组合规则 AI 任务](production/lexicon-authoring/formats/v2/TAG-RULES-AI-PROMPT.md) | 完整规则创作任务与验证示例 |
| [外部 Tag 资料](production/tag-deliveries/README.md) | 已接收的原始交付、整理结果和候选；收到不等于审定或实装 |
| [可选文本槽工具](production/text-slot-integration/README.md) | 独立接口说明和示例验证 |
| `docs/` | 当前接口说明、历史设计、阶段验收和审计证据 |

工具包内的 README 负责该工具的独立用法；本文件集中提供项目导航。

## 当前规范与历史记录

- [foundation v0.4](docs/foundation-v0.4.md)、[Tag 映射](docs/foundation-tag-mapping.md)、[兼容性与验证](docs/foundation-v0.4-validation.md)：当前实体、参数、语义查询及存档增量接口。
- [世界生成器 v0.2](docs/world-generator-v0.2.md)、[词库接入](docs/worldgen-lexicon-integration.md)、[首批词条验收](docs/lexicon-delivery-2026-10-11.md)：生成与原始词库接入范围。
- [UI 子页](docs/ui-pages-update.md)、[操作流程优化](docs/ui-ux-2026-10-12.md)：导航、保存状态与行动展示。
- [内容、Tag 与固定故事规范](docs/content-tag-story-standard.md)：Alpha 0.2 阶段的制作参考；涉及 Tag 注册表、参数与存档的旧描述，以当前 foundation 和 v2 文档为准。
- [实施前 Tag 审计](docs/tag-audit-2026-10-12/decision-summary.md)：保留问题来源与证据；其中“待实现”描述对应审计时点，不能作为当前功能清单。

早期 `docs/phase-*`、`docs/alpha02-*`、`docs/worldgen-*-acceptance.md` 和 `docs/design-sources/` 用于历史追溯，按文件标注的版本阅读。旧 README 已保存在 Git 历史中。

## 本地文件与 Git

| 本地位置 | 保存方式 |
| --- | --- |
| `dist/`、`node_modules/`、`.npm-cache/` | 可重建的构建、依赖及缓存，不提交 |
| `artifacts/` | 测试截图、日志、核验副本和整理记录，不提交 |
| `deliverables/current/` | 已交付试玩、源码 ZIP 和发布元数据，本地保留 |
| `deliverables/archive/`、`deliverables/checkpoints/` | 旧版本与 Git bundle，本地保留 |
| `deliverables/tools/` | 外发工具压缩包，本地保留；当前工具源码位于 `production/` |
| `docs/故事/` | 独立故事参考原稿，保留本地，不纳入工程提交 |

GitHub 保留三个分支：`main`、当前工程开发 `codex/foundation-v0.4`、grok 的 `codex/tag-effect-preview`。两个工作分支分别维护，不自动混合实现。

根目录名称 `aetheria-alpha-0.1` 是历史命名。服务器试玩继续使用 `localhost:4173`；更换浏览器、域名、端口或独立 HTML 入口前，可导出 JSON 再导入。刷新恢复最近一次手动保存，导出文件不会代替手动保存。
