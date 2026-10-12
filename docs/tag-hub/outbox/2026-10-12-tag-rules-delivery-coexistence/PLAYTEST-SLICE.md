# 试跑切片 · 研究员 × 触手黏液 × 黑胶

| 项 | 值 |
|---|---|
| 产出 | 2026-10-12 18:17 SGT |
| 种子 | `docs/tag-hub/inventory/seeds/2026-10-12-接tag试跑-研究员触手黏液黑胶.md` |
| 故事试写 | `docs/tag-hub/outbox/2026-10-12-故事试写-研究员触手黏液黑胶.md` |
| 包版本 | content/reference **1.1.0** + `generation-rules.v1.json` |
| 状态 | **draft / 提出 / 试跑可挂载**；≠全库审定；≠已写入 content/index.json |
| 范围 | **仅本种子会碰到的维度**；其余明确未确认 |

成人正文仍在种子/试写 Markdown；运行时 prose 仅 `tier=general`（引擎限制）。本切片不把 NSFW 词条 batch 塞进 ContentPack。

---

## 1. 类/模板共存与互斥（试跑 only）

### 1.1 可共存（种子需要）

| 维度 A | 维度 B | 口径 | 可执行落点 |
|---|---|---|---|
| 触手黏液 (material∥fluid) | 活体黑胶 / 半硬化 / 硬化 (material) | 可并存描写；**禁 synonyms 互充** | 编辑约定；运行时仅有 `foundation:material.gel` 材料查询 |
| 黏液化 (tf) | 黑胶化 / 局部黑胶化 (tf) | 通用过程可阶段性并存 | 编辑；无 per-species 专条 |
| 缠绕 / 涂覆 / 封口包覆 (action) | 黑胶塑形中 (state) | action ≠ state | 编辑 |
| foundation:theme.gel | foundation:material.gel / body.gel-* | **题材 ∥ 材料**，不互替 | prose when 只用 materialId；boost 可用 theme |
| foundation:theme.night | foundation:time.night | **题材 ∥ 时钟** | `time.window` 1320–360；generation startMinutes=1320 |
| 种族/身份「研究员」 | 形态/材料变化 | 称呼∥形态；勿建「研究员黑胶化」 | 编辑禁止专条 |
| pose 俗称+precise | （本种子未强制 pose 条） | 若挂 pose 须同条 precise | 编辑 |

### 1.2 互斥（试跑硬边界）

| 左 | 右 | 类型 | 可执行？ |
|---|---|---|---|
| 未成年参与者 | 成人场景 / 本种子正文 | **硬互斥** | 编辑强制；本包 prose 不含成人正文；不导入未成年内容 |
| 通用 lexicon batch | NSFW lexicon batch | format 互斥混装 | 工具侧；本包不混装 |
| 词条 batch | ContentPack / ReferencePack | 互斥互导 | 本包是规则包，不冒充词条 |
| `theme.gel` 当 body when | `materialId=gel` 查询 | 语义互斥冒充 | when **零** theme.gel |
| 白班接样登记 模板 | 培养槽夜间观察 模板 | 模板互斥 | `excludesTemplates` 双向 |
| 工坊核对 / 公共静观 | 夜间培养观察 | 模板互斥 | `excludesTemplates` |
| 同 part 上 mechanical 族 | 同 part 上 gel(organic) | 材料族互斥 | `body.matches` 合取；两选择不能同时真 |

### 1.3 明确未覆盖（仍 TBD）

- 通用 58×58 类矩阵
- NSFW 14 库全库际硬表（pose×locus 等）
- 身体 SFW↔NSFW 字段级对照表
- 全词库运行时组合冲突检测器

---

## 2. NSFW 试跑硬规则（种子会碰到的）

| # | 规则 | 种子触点 | 状态 |
|---|---|---|---|
| N1 | 未成年 ⊥ 成人场景 | 成年女研究员；禁任何未成年 | **硬**；编辑+不进运行时成人 JSON |
| N2 | 定词挂前：触手黏液 | A 栏已有；定词≠creature | 编辑 |
| N3 | 黑胶 ⊄ 触手黏液 ⊄ 凝胶 | C 栏；勿 synonyms 互充 | 编辑 |
| N4 | 转化用通用黑胶化/黏液化 | 禁研究员/触手/培养槽/鞋黑胶化专条 | 编辑 |
| N5 | kink ≠ state ≠ 意愿 | 「先别封口」→ 挂封口包覆动作；勿意愿 kink | 编辑 |
| N6 | 一条一事 | 节点 A/B/C 分账；勿整场一条 | 编辑 |
| N7 | 性癖不进拼装槽 | 本试跑不把 kink 写入 Reference requiresTags | 可执行遵守 |
| N8 | suggestive 不进运行时 JSON | 本包无 suggestive 字段 | 可执行遵守 |
| N9 | gore 不强产 | 本种子无 gore | 遵守 |

除已写边界外，**不**新增全库 NSFW 硬互斥数值表。

---

## 3. 运行时可执行冲突 / 条件（仅本切片）

| id | 条件 | 期望 |
|---|---|---|
| `…gel-foot-by-material` | foot ∧ materialId=gel | 有足部黑胶材料 → 选中 gel-foot 文 |
| `…gel-leg-by-material` | leg ∧ materialId=gel | 腿侧黑胶材料 → 选中 |
| `…lab-night-by-clock` | time.window 1320–360 | 夜间开局（generation-rules）→ 选中 |
| `…lab-night-dark-conjoint` | night ∧ light=dark | 夜间+暗光合取 |
| `…mechanical-tail-by-material` | tail ∧ mechanical | 与 gel 足/腿无关；同尾 gel(organic) 时本条失败 |
| clinic-night vs day-shift | excludesTemplates | 不能同池并选 |
| theme boost | combination.boosts theme.gel/TF | **只加权重**；无 service 时仍不入候选 |

**不是**词条层冲突检测引擎；只是 playtest 会用到的 Condition / combination。

---

## 4. generation-rules 为何需要

试跑「深夜实验室」依赖 `foundation:time.night`（22:00–06:00）。默认社区规则 `startMinutes=540`（09:00）开局时夜间窗口为假。

本包 `generation-rules.v1.json`：`startMinutes=1320`，五类服务齐全，缩小地点/NPC，供与 Reference/ContentPack **合载试跑**。不修改 `content/generation/rules.json` 权威默认。
