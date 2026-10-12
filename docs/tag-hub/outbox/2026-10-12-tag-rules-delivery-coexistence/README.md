# Tag 共存 / 互斥 / 分维度规则交付包（v0.13）

| 项 | 值 |
|---|---|
| 产出时间 | 2026-10-12 18:01 SGT |
| 角色 | Tag共存规则（Angla） |
| 规范口径 | 《整游戏 Tag / 词条规范》**v0.13** §0/3/5/8/10/12.2 |
| 权威分支 | `codex/tag-effect-preview` @ 基线 `ddc1cb5` |
| 命名空间 | `tagcoexist`（≠ `rulesdemo`） |
| 包状态 | **draft / 提出**；≠格式已并入游戏索引；≠审核通过；≠已集成；≠已被游戏使用 |
| 收录≠审定≠已实装 | 贯穿本包 |

## 本包解决什么

把 v0.13 已提炼的**共存 / 互斥 / 分维度**编辑约定，落到 TAG-RULES-AI-PROMPT 要求的交付结构：

1. **可加载示范**：用已有 foundation 身体/环境/服务条件写 `proseSelections`，证明题材 Tag ≠ 身体材料 / 形态 / TF 进度 / 真实时段。
2. **模板层互斥示范**：ReferencePack `combination.excludesTemplates`（引擎已支持）≠ 未确认的 58 类 / NSFW 库际硬互斥矩阵。
3. **编辑约定全文**：RULE-MATRIX + 既有 `docs/tag-hub/rules/共存互斥分维度规则摘要-v0.13-对照库存.md`。
4. **明确不编造**：§10.2 / §12.2 全部进 FUTURE-REQUIREMENTS，标「不可导入」。

## 文件

| 文件 | 用途 | 可否加载 |
|---|---|---|
| `content-pack.v2.json` | 0 新 Tag；5 条 proseSelections（复用 foundation 已审定正文） | 可与 foundation 合载验收；**未**写入 `content/index.json` |
| `reference-pack.v2.json` | 2 个活动模板；示范服务条件 + 模板互斥 | 须与已有 `reference.json` / `lexicon-reference.json` 合用 |
| `generation-rules.v1.json` | **未生成** | 本任务不改全局地点/NPC/时段参数；见下 |
| `TAG-DECISIONS.md` | 复用 / 不新增 / 边界 | 报告 |
| `RULE-MATRIX.md` | 每条规则输入→条件→结果与正反例 | 报告 |
| `VALIDATION.md` | 已执行 / 未执行 / 边界 | 报告 |
| `FUTURE-REQUIREMENTS.md` | §10.2 / §12.2 不可导入项 | 报告 |

## 为何不交付 generation-rules.v1.json

全局 GenerationRulePack 仍为 v1；本任务只整理共存/分维度口径，不需要改 `locationCount` / `requiredServices` / 工作时段等全局参数。沿用工程已有生成规则即可。

## 与摘要文档的关系

编辑约定权威摘要（对照库存）仍是：

→ [`../../rules/共存互斥分维度规则摘要-v0.13-对照库存.md`](../../rules/共存互斥分维度规则摘要-v0.13-对照库存.md)

本目录是按 TAG-RULES-AI-PROMPT 的**规则包交付**；摘要是**编辑自检与库存对照**。两者互补，不互相替代。

## 简短清单

| 指标 | 数量 |
|---|---|
| 文件（本目录） | 7（无 generation-rules） |
| 复用 Tag | foundation 既有（theme / body / service / setting / time） |
| 新增 Tag | **0** |
| proseSelections | 5 |
| Reference 模板 | 2 |
| 验证 | 静态 JSON + 条件形状检查已做；`npm run check:foundation` **不会**自动扫描本包（见 VALIDATION） |
| 待开发 | 见 FUTURE-REQUIREMENTS（§12.2 全表） |

## 主指针（给 Angela）

`docs/tag-hub/outbox/2026-10-12-tag-rules-delivery-coexistence/README.md`
