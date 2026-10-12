# FUTURE-REQUIREMENTS · 不可导入

> 下列片段与需求**不可**混进可加载 JSON。对齐 v0.13 §10.2 / §12.2 建议默认。

## 1. 未确认矩阵与检测（禁止本包伪解决）

| # | 需求 | 缺什么 | 建议默认 | 需要的消费者 |
|---|---|---|---|---|
| F1 | 通用 58 类正式共存/互斥矩阵 | 产品拍板的类×类表 | 仅编辑指南，不进词条字段 | 未来可选 lint；运行时冲突另议 |
| F2 | NSFW 库际硬互斥表（除已写边界） | 库×库 / pose×locus 等论证 | 首期不设硬表；靠审稿 | NSFW 校验器（待接入） |
| F3 | 身体字段级对照 / 跨层去重 | SFW body-* ↔ NSFW part/creature 映射 | 暂不建强制表；人工对照；禁止假共享 id | 编辑工具 |
| F4 | 词条组合运行时冲突检测 | 引擎 opcode + 权威规则源 | 词条层不假装已有 | condition/冲突管线（待开发） |
| F5 | `suggestive` 正式挂载字段 | 字段归属与校验 | 维持草案名；**不**进运行时 JSON | ContentPack/TextExpansion（明确前不做） |

## 2. 其它 §12.2 项（本任务边界外）

| # | 项 | 建议默认 |
|---|---|---|
| F6 | `nsfw-role` | 维持首期不做 |
| F7 | 触碰四段式 → `slots` | 继续 name/tags |
| F8 | NSFW schema 批规模/唯一性强制 | 对齐通用习惯为建议；待制定后实装 |
| F9 | 跨库稳定 ID 引用协议 | 稳定 ID+校验；标注语法无自动解析 |
| F10 | 成年资格统一公式 | `ageYears >= max(18, species.adultAgeYears)`；**尚未完整实装** |
| F11 | 替代关系正式字段 | 暂用修订报告 |
| F12 | NSFW 自动校验/导入路径 | 待接入；不能当已覆盖能力 |
| F13 | goo 英文别称落库 | `goo转化` → 黑胶化 synonyms/**待审**（词条侧） |

## 3. 不可导入的伪格式示例（禁止照抄进正式包）

```json
{
  "NOTE": "不可导入 — 示意未确认矩阵，不是合法 ContentPack 字段",
  "lexiconClassMutexMatrix": { "body-beast": { "nsfw-creature": "hard-mutex" } },
  "suggestive": true,
  "runtimeComboConflictDetector": true
}
```

## 4. 与本交付的关系

- 本包 **只**示范：题材≠身体/时段、服务权威、模板层 excludesTemplates。
- 上表任一项被误写入词条或本包 JSON，视为**不合格交付**。
