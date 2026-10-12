# TAG-DECISIONS · 共存 / 分维度（含试跑 1.1.0）

| 项 | 值 |
|---|---|
| 包 | `authoring/tag-coexistence-v013` @ `tagcoexist` **1.1.0** |
| 字典 | `aetheria/foundation@1.0.0` |
| 状态 | draft；试跑 prose `review=approved` **仅**为 loader `selectReviewedText` 可走通，≠词库审定，≠ content/index 集成 |

## 1. 复用

| 稳定 ID | 用途 |
|---|---|
| `foundation:theme.gel` / `transformation` / `night` / `mechanical` | 题材；Reference **boost only** |
| `foundation:time.night` | 时钟夜间派生（1320–360） |
| `foundation:material.gel` | 真实黑胶**材料**（organic 族） |
| `foundation:service.clinic` / `workshop` / `commons` | 权威服务；clinic 代理试跑实验室 |
| `foundation:prose.*`（5） | 原有维度示范选择 |
| `foundation:body.*` / setting.forge | 既有身体/环境语义 |

## 2. 本版新增（有消费者）

| ID | 为何旧 Tag 不够 | 消费者 | 需新代码？ |
|---|---|---|---|
| `tagcoexist:body.gel-foot` | theme.gel 不能证足部材料；无 foundation 足部 gel 派生 | derivedTags + proseSelection gel-foot | 否 |
| `tagcoexist:body.gel-leg` | 同上，腿侧路径（踝→小腿→大腿） | derivedTags + proseSelection gel-leg | 否 |
| `tagcoexist:prose.gel-foot/leg/lab-night-window` | 无已审定 gel/夜窗专用 general 文 | proseSelections | 否（playtest 自带 approved 标记，见上免责） |

## 3. 仍不新增

- ××黑胶化物种/物件专条 Tag  
- 58 类 / NSFW 全库互斥矩阵字段  
- suggestive / nsfw-role / 意愿 library  
- 把 NSFW batch 条目写成 proseMaterials（tier 仅 general）  

## 4. 别名 / 废弃

无。不废弃 foundation 项。goo转化→黑胶化 synonyms 仍待审（词条侧）。

## 5. 三层分离

| 层 | 落点 |
|---|---|
| A 素材 | general prose（试跑）+ 引用 foundation 已审定文；成人试写留 Markdown |
| B 规则 | proseSelections.when、derivedTags、Reference requires/excludes/boosts、generation-rules |
| C 状态 | 不写；查询不改身体 |

## 6. generation-rules 决定

新增 `authoring/tag-coexistence-playtest-rules@1.0.0`：夜间开局 + 缩小世界。不改仓库默认 `content/generation/rules.json`。
