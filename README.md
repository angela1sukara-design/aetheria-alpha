# 以太都市：深渊重塑

2026-10-14 已整合用户提供的干净工程及存档、Tag 调试修复，并保留当前工程的未实装 Tag 与玩家无年龄创建。双击根目录 `启动游戏-双击直接运行.html` 可直接游玩；修改源码后按下方步骤构建。

已完成首批 NPC 服务与地点设施筛选（当前生成器 0.11.0）：新生成的中世纪世界按人物实际商品、教学与工作配置显示功能，地点按设施筛选行动。构建游戏后运行 `node scripts/build-function-example.mjs` 生成当前版本的 [首批可玩示例](examples/首批NPC与地点功能示例.html) 和 [示例人物与操作](examples/首批功能示例.md)。示例从铁匠面前开始，沿地图可找到摊主、护理员和路人；生成的离线文件与截图不随源码更新上传。

已接入 [模块 D 性格交谈](docs/module-d-implementation.md)，生成器 0.10.0/0.11.0 的正常 NPC 对话按六类及混合性格展开，有不同回应、真实赠礼和日程离场处理；旧档保留原行为。

0.11.0 新世界已采用 [结构化姓名及姓氏继承契约](docs/names-and-inheritance.md)：名与姓分池、按文化顺序显示并保存，去掉姓名数字后缀；17 题材有明确命名配置。子代命名接口支持指定亲代姓、家庭共姓和双姓，出生与后代实体生成尚未实装。离线槽位的动态人名/地名读取精确绑定快照，游戏正文拼装接入仍待开发。

多 AI 协作方案见 [ai.md](ai.md)。运行 `node scripts/build-ai-task-pack.mjs` 可在 deliverables/ai-tasks/ 生成面向不能读取工程的 AI 的完整任务文件，内含当前源码全文与优先级。A/B/E 和 C 的补充玩法仍待开发。生成的任务文件与压缩包只在本地交付，不重复提交到仓库。

2026-10-15 已另行交付 Tag 组合规则与九大类覆盖矩阵。仓库保留 [制作源与重建说明](production/tag-matrices/README.md)，运行 `npm run tag-matrices:build` 后可查看 [总规范](deliverables/tag-matrices/00-总规范与协作分工.md) 与 [按类分发说明](deliverables/tag-matrices/00-分发说明.md)。每类任务独立附规则、完整矩阵、相关源码全文、登记 Tag 及本类素材元数据；缺接口与范围外内容单独记账，不计玩法实装。生成后使用 `npm run test:tag-matrices` 和 `npm run tag-matrices:check` 验收。

写作规范已增加 [槽位模板与拼装校验](docs/prose-slot-assembly-standard.md)：八类槽、有序 proseTemplate、入槽词条、独立 assembly-rules.json 与完整普通 prose 回退。矩阵按实际来源与职责覆盖，不展开 Tag 笛卡尔写作格；离线拼装器和测试已提供，游戏引擎/UI/存档接入仍是独立待办。

这里是唯一的当前开发工程，包含固定都市、随机街区、BodyGraph / TF、人物、事件及存档系统。游戏包版本为 `0.2.0-alpha`，已加入 foundation v0.4 增量接口。旧交付目录是历史快照，继续开发使用本目录。

当前界面已按用户提供的“墨卷”框架重构：封面、书页、故事卡与对白共用真实游戏状态，补齐三个独立存档、阅读设置和手机资料抽屉。直接打开 `dist/Aetheria-Folio.html`；接入范围、实测与既有回归问题见 [墨卷 UI 接入](docs/folio-ui-2026-10-13.md)。运行 `npm run test:folio` 检查当前界面和实际玩法。

当前已接入Tag组合故事、敌人倾向与战败分支，以及训练、武器护甲、技能、经营和主线里程碑。玩法与兼容说明见[故事与成长框架](docs/adventure-framework-2026-10-13.md)，交给其他AI的正文制作要求见[Tag写作规范](production/TAG-STORY-WRITING-SPEC.md)。旧生成世界保留原快照，新生成世界使用新玩法。

## 启动与验证

需要 Node.js 24 或更新版本。首次从 Git 克隆后运行：

```sh
npm ci
npm run build
```

Windows 双击 `start_game.bat`，浏览器打开 `http://localhost:4173/`。也可运行 `npm run dev`。`dist/` 是本地构建结果，Git 仓库不附带构建、依赖和浏览器。

构建后，可直接打开 `dist/Aetheria-Folio.html`；原 `dist/Aetheria-Alpha-0.2.html` 为兼容入口，两个离线世界示例在 `dist/WorldGenerator-Seed-7.html` 和 `dist/WorldGenerator-Seed-42.html`。当前新世界试玩入口限定中世纪异世界；底层 17 种题材配置与既有世界快照保留。开发模板 `index.html` 需通过服务器加载。

```sh
npm run check
```

该命令执行类型检查、规则回归、构建和产物检查。浏览器流程分别使用 `npm run test:browser`、`npm run test:ui`、`npm run test:ux` 和 `npm run test:worldgen:browser`。首次运行浏览器测试需要 `npx playwright install chromium`；脚本的浏览器路径配置见相应测试文件。

故事与成长的实际操作检查使用`npm run test:adventure:browser`，世界主线使用`npm run test:quests:browser`，foundation离线检查使用`npm run test:foundation:browser`。

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
- [世界 Tag 与任务配置](docs/world-profiles.md)：当前 17 种世界、共享地点服务、两条主线路线、每世界 18 条支线配置及存档兼容。
- [主线人物关系生成器](docs/main-relationships.md)：创建时自动生成主线人物圈、阶段联络角色和 NPC 关系网，人物册展示、支线绑定与旧档兼容。
- [UI 子页](docs/ui-pages-update.md)、[操作流程优化](docs/ui-ux-2026-10-12.md)：导航、保存状态与行动展示。
- [内容、Tag 与固定故事规范](docs/content-tag-story-standard.md)：Alpha 0.2 阶段的制作参考；涉及 Tag 注册表、参数与存档的旧描述，以当前 foundation 和 v2 文档为准。
- [实施前 Tag 审计](docs/tag-audit-2026-10-12/decision-summary.md)：保留问题来源与证据；其中“待实现”描述对应审计时点，不能作为当前功能清单。

早期 `docs/phase-*`、`docs/alpha02-*`、`docs/worldgen-*-acceptance.md` 和 `docs/design-sources/` 用于历史追溯，按文件标注的版本阅读。旧 README 已保存在 Git 历史中。

## 本地文件与 Git

| 本地位置 | 保存方式 |
| --- | --- |
| `dist/`、`node_modules/`、`.npm-cache/` | 可重建的构建、依赖及缓存，不提交 |
| `artifacts/` | 近期验证日志、结论与工具仍引用的记录；大型截图和快照另存，不提交 |
| `../aetheria-history/` | 工程外的旧版本、备份和大型测试产物；附校验清单，不提交 |
| `dist/Aetheria-Folio.html` | 当前源码构建出的单文件游戏；不再从历史交付目录辨认当前版本 |
| `deliverables/tools/` | 外发工具压缩包，本地保留；当前工具源码位于 `production/` |
| `docs/故事/` | 独立故事参考原稿，保留本地，不纳入工程提交 |

2026-10-14 已整理历史副本。归档方式与恢复说明见 [工程目录说明](docs/project-layout.md)。需要再次整理时，先运行 `powershell -NoProfile -File scripts/organize-workspace.ps1` 查看范围，确认后加 `-Apply`；脚本只整理列明的本地历史目录，拒绝归档 Git 跟踪文件和链接路径。

GitHub 保留三个分支：`main`、当前工程开发 `codex/foundation-v0.4`、grok 的 `codex/tag-effect-preview`。两个工作分支分别维护，不自动混合实现。

根目录名称 `aetheria-alpha-0.1` 是历史命名。服务器试玩继续使用 `localhost:4173`；更换浏览器、域名、端口或独立 HTML 入口前，可导出 JSON 再导入。刷新恢复最近一次手动保存，导出文件不会代替手动保存。
