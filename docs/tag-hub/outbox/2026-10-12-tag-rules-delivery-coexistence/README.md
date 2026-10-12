# Tag 共存 / 互斥 / 分维度规则交付包（v0.13 + 试跑切片）

| 项 | 值 |
|---|---|
| 更新 | 2026-10-12 18:17 SGT |
| 角色 | Tag共存规则（Angla） |
| 试跑种子 | 研究员 × 触手黏液 × 黑胶 |
| 命名空间 | `tagcoexist` |
| Content/Reference | **1.1.0** draft |
| Generation rules | **1.0.0**（playtest 专用，夜间开局） |
| 状态 | draft / 提出 / **试跑可挂载**；≠已集成 content/index；≠词库审定 |

## 文件

| 文件 | 用途 | 可加载 |
|---|---|---|
| `content-pack.v2.json` | 2 新 Tag（gel-foot/leg）+ 派生；3 条试跑 general prose；9 proseSelections（含 gel/night） | 与 foundation 合载 |
| `reference-pack.v2.json` | 4 活动；clinic 夜间培养观察 ↔ 白班登记互斥；theme 仅 boost | 与已有 reference 合用 |
| `generation-rules.v1.json` | 夜间 startMinutes=1320；缩小世界 | 试跑导入；不覆盖默认社区规则 |
| `PLAYTEST-SLICE.md` | 种子维共存/互斥 + NSFW 硬边界 + 可执行条件表 | 报告 |
| `TAG-DECISIONS.md` / `RULE-MATRIX.md` / `VALIDATION.md` / `FUTURE-REQUIREMENTS.md` | 决定、矩阵、验证、TBD | 报告 |

## 试跑合载顺序（建议）

1. 工程已有 content packs + foundation  
2. 本 `content-pack.v2.json`  
3. 已有 `reference.json` / `lexicon-reference.json` + 本 `reference-pack.v2.json`  
4. 本 `generation-rules.v1.json`（替代默认 rules 做夜间开局）  

## 简短清单

| 指标 | v1.0.0 | v1.1.0 试跑 |
|---|---|---|
| 新增 Tag | 0 | 2（gel-foot/leg） |
| proseSelections | 5 | 9 |
| Reference 模板 | 2 | 4 |
| generation-rules | 无 | 有（夜间） |
| 全库矩阵 | 不编造 | 仍不编造；仅种子切片 |

## 主指针

`docs/tag-hub/outbox/2026-10-12-tag-rules-delivery-coexistence/README.md`
