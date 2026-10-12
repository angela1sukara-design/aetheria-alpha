# FUTURE-REQUIREMENTS · 不可导入（更新：试跑切片）

> 全库矩阵仍不可混进可加载 JSON。试跑切片已填部分见 `PLAYTEST-SLICE.md`。

## 0. 试跑已填 vs 仍 TBD

| # | 需求 | 试跑切片（本包 1.1.0） | 全库 |
|---|---|---|---|
| F1 | 通用类共存/互斥矩阵 | **已填种子相关模板/材料族互斥**（见 PLAYTEST-SLICE §1） | 58×58 **仍 TBD** |
| F2 | NSFW 库际硬互斥 | **已填种子硬边界** N1–N9（编辑+不混装）；无全库表 | 除已写边界外 **仍 TBD** |
| F3 | 身体跨层字段对照 | 未填；禁止假共享 id | **仍 TBD** |
| F4 | 词条组合运行时冲突检测 | **已填可执行 when/excludes**（gel/night/模板）；≠全词库检测器 | 引擎级检测器 **仍 TBD** |
| F5 | `suggestive` 正式字段 | 未做；不进 JSON | **仍 TBD** |
| — | `generation-rules` | **已提供** playtest 包（夜间开局） | 默认社区规则未改 |

## 1. 仍禁止伪解决的全库项

| # | 需求 | 建议默认 |
|---|---|---|
| F1-full | 58 类正式矩阵 | 仅编辑指南，不进词条字段 |
| F2-full | NSFW 库际硬表 | 首期靠审稿 |
| F3 | 跨层去重强制表 | 人工对照 |
| F4-full | 通用冲突检测 opcode | 词条层不假装已有 |
| F5 | suggestive | 不进运行时 JSON |
| F6 | nsfw-role | 首期不做 |
| F7 | slots 四段式 | 继续 name/tags |
| F8–F13 | schema/ID/成年公式/导入路径/goo 别称等 | 见 v0.13 §12.2 |

## 2. 不可导入伪格式

```json
{
  "NOTE": "不可导入",
  "lexiconClassMutexMatrix": {},
  "suggestive": true,
  "runtimeComboConflictDetector": true
}
```

## 3. 关系

- 可加载 JSON 只含试跑需要的 Tag/派生/prose when、Reference 模板互斥、generation-rules。
- 成人试写与 NSFW 词条挂靠留在 Markdown 种子；≠已实装玩法。
