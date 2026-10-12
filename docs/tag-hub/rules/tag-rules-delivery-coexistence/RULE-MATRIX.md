# RULE-MATRIX · 共存 / 互斥 / 分维度（含试跑）

状态：`编辑约定` | `可加载(draft 1.1.0)` | `已实现(引擎)` | `待制定`

完整试跑表见 `PLAYTEST-SLICE.md`。下表为可加载规则摘要。

## A. proseSelections（可加载）

| id | when | 正例 | 反例 |
|---|---|---|---|
| mechanical-tail-by-material | tail∧mechanical | 机械尾 | 机械手+有机尾；仅 theme.mechanical |
| long-tail-by-length | tail∧minLengthMm≥600 | 600+ | 599；长度未知 |
| organic-tail-by-family | tail∧organic | 有机尾 | 机械尾 |
| environment-dark/lit | light | 匹配光照 | 相反光照 |
| **gel-foot-by-material** | foot∧materialId=gel | 足部黑胶材料 | 仅 theme.gel；足部 alloy |
| **gel-leg-by-material** | leg∧materialId=gel | 腿部黑胶材料 | 仅题材；无腿/材料未知 |
| **lab-night-by-clock** | time.window 1320–360 | 开局 22:00 | 白天 startMinutes |
| **lab-night-dark-conjoint** | night∧dark | 夜间暗光 | 夜间但 lit（本条失败；clock 条仍可过） |

## B. derivedTags

| id | tagId | when |
|---|---|---|
| derive.gel-foot | body.gel-foot | foot∧materialId=gel |
| derive.gel-leg | body.gel-leg | leg∧materialId=gel |

## C. Reference 模板互斥（可加载）

| 模板 | requires | excludesTemplates | boosts |
|---|---|---|---|
| workshop-tool-check | service.workshop | commons；clinic-night | setting.forge×2 |
| commons-quiet-observe | service.commons | workshop；clinic-night | — |
| **clinic-night-culture-observe** | service.clinic | workshop；commons；day-shift | theme.gel×2；theme.TF×2（权重 only） |
| **day-shift-intake-log** | service.clinic | clinic-night | — |

## D. generation-rules

| 字段 | 值 | 目的 |
|---|---|---|
| startMinutes | 1320 | 夜间窗口真 |
| locationCount/npcCount | 5 / 3 | 试跑缩小 |
| requiredServices | 五类齐全 | parseRules 硬约束 |

## E. 编辑约定（种子）

见 PLAYTEST-SLICE §1–2 与摘要 §5 十问。要点：一条一事；定词挂前；通用黑胶化/黏液化；theme≠材料/时钟；未成年⊥成人；勿××黑胶化专条。

## F. 不数值化

全库 58 类矩阵、全 NSFW 库际表、跨层字段对照、全词库冲突检测器 → FUTURE-REQUIREMENTS。
