# TAG-DECISIONS · 共存 / 分维度

| 项 | 值 |
|---|---|
| 包 | `authoring/tag-coexistence-v013` @ `tagcoexist` |
| 字典 | `aetheria/foundation@1.0.0`（hash `121dc466…6d5290`） |
| 状态 | 提出 / draft；未自批 approved |

## 1. 复用（不新增）

| 稳定 ID | 用途 | 为何够用 |
|---|---|---|
| `foundation:theme.gel` | 黑胶**题材** | 定义已写明「不证明实体状态…」 |
| `foundation:theme.transformation` | TF **题材** | 同上 |
| `foundation:theme.mechanical` | 机械**题材** | 同上 |
| `foundation:theme.night` | 夜间**题材** | 同上；≠ `foundation:time.night` |
| `foundation:time.night` | 时钟 22:00–06:00 派生 | 与题材夜间分维度 |
| `foundation:body.has-tail` | 真实有尾 | BodyGraph 查询 |
| `foundation:body.mechanical-tail` | 同尾 materialFamily=mechanical | 合取在同一 part |
| `foundation:body.can-grasp` | 抓握能力 | 活动 capabilities 对齐 |
| `foundation:service.workshop` / `commons` | 权威服务字段 | ReferencePack `data.service` / requiresTags |
| `foundation:setting.forge` | 炉巷环境语义 | 仅 boost 合法候选权重 |
| `foundation:material.gel` | 材料「黑胶」(organic 族) | **材料**≠题材；本包未新建「黑胶化」Tag |
| `foundation:prose.*`（5 条已审定） | proseSelections 目标 | 不自产 approved 正文 |

## 2. 明确不新增

| 曾想过的概念 | 决定 | 理由 |
|---|---|---|
| `tagcoexist:body.gel-surface` | **不建** | 缺已审定 gel 专用 prose 消费者；材料用 `materialId`/`materialFamily` 即可 |
| `××黑胶化` / `××黏液化` 物种专条 Tag | **禁止** | 总规范：转化用通用黑胶化/黏液化组合；定词挂前只修饰材质 |
| 58 类共存矩阵 Tag / 字段 | **禁止** | §10.2 / §12.2 未确认；不进词条字段 |
| NSFW 库际硬互斥表 | **禁止** | 首期靠审稿；除已写边界外不编造 |
| `suggestive` 运行字段 | **禁止** | 无正式运行字段；不进本包 JSON |
| `nsfw-role` | **不做** | §12.2 维持首期不做 |
| 意愿/合意 library | **不做** | 意愿≠14 库；用事件条件/记忆/旗标 |
| 把 kink 写成拼装 requiresTags | **禁止** | 性癖不进拼装槽 |

## 3. 别名 / 废弃

- 本包**不**声明 aliases，不废弃任何 foundation 条目。
- `goo转化` / `goo transformation` → 对齐已有「黑胶化」词条 synonyms 的审稿，仍在 NSFW 批次侧**待审**，不在本规则包双主定义。

## 4. 三层分离（本包遵守）

| 层 | 本包落点 |
|---|---|
| A 素材 | 只引用 foundation 已 `review=approved` 且 `tier=general` 的 prose；不塞互斥引擎字段 |
| B 规则 | `proseSelections.when` + ReferencePack requires/excludes/combination |
| C 状态 | **不写**；查询不改身体、不推进时间 |

## 5. 与词条库（lexicon）边界

- 通用 `aetheria-lexicon-batch` ↔ NSFW `aetheria-nsfw-lexicon-batch`：**互斥混装**（编辑+通用校验已拒 NSFW format）。
- 词条 batch ↔ ContentPack / ReferencePack / TextExpansion：**互斥互导**。
- 本包是 **ContentPack + ReferencePack 规则示范**，不是词条扩写，不声称 NSFW 已导入运行时。

## 6. 消费者

| 规则 | 消费者 | 是否需新代码 |
|---|---|---|
| 机械尾 / 长尾 / 有机尾 / 光照筛选 | 现有 prose 选择管道 | 否 |
| 工坊活动 requires service.workshop | WorldGenerator 候选过滤 | 否 |
| 两活动 excludesTemplates | 现有 combination 检查 | 否 |
| 编辑 10 条自检清单 | 抽条/补库人工 | 否（文档） |
