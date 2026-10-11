# 以太都市：深渊重塑｜游戏架构（插槽模型）v0.1

来源：https://app.notion.com/p/3f5498122a0281eea49dfe6810a69ab2?pvs=204

Here is the result of "fetch" for the Page with URL https://app.notion.com/p/3f5498122a0281eea49dfe6810a69ab2 as of 2026-10-10T11:08:18.437Z:
<page url="https://app.notion.com/p/3f5498122a0281eea49dfe6810a69ab2">
<ancestor-path></ancestor-path>
<properties>
{"title":"以太都市：深渊重塑｜游戏架构（插槽模型）v0.1"}
</properties>
<iconMetadata>null</iconMetadata>
<content>
整理：Claude｜2026-10-10｜状态：**PROPOSED 候选稿，待你确认**｜未包含旧源码审计，也没有任何已实现的模块
## 0. 一页总览
世界 = **实体**（玩家、NPC、地点、场景）+ **插槽**（实体上有类型、有容量的接口）+ **占用者**（某个定义的实例）。
- **内容包**：声明插槽类型，往插槽里放定义。新增常规内容不改引擎。
- **引擎**：唯一能改变占用关系的一方，经 `performAction` 一次事务提交。
- **UI / AI**：只读，不写状态。
依赖只能向下：UI 与 AI 适配层 → 引擎服务 → Registry（只读定义）→ 内容包。
## 1. 四条原则
1. 插槽只描述**结构性占用**。时间、金钱、关系值、任务进度、RNG 不是插槽，仍用标量和变量。
2. 能力、描述、可用动作全部由占用者**派生**，不存档。
3. 作者只能**正向引用**：往别人的钩子槽里插内容，不修改别人的文件。
4. 只有一套 Condition/Effect DSL，所有占用变化共用 `slot.*`。
## 2. 插槽的三个部分
- **SlotType（定义）**：`id`、`domain`、`capacity{min,max}`、`sided`、`layers`（可选）、`accepts`（条件或标签）、`exclusiveWith`、`requires`。
- **SlotInstance（状态）**：`owner + slotType + side/index`，指向占用者列表。
- **Occupant（实例）**：`definitionId`、`source`（来源事件或 TF）、`lockedBy`（剧情锁）、`overrides`（损坏等个别差异）。
统一判定 `canFill(slot, def, ctx)`：检查容量、accepts、互斥、依赖、锁。通用效果只有三个：`slot.fill`、`slot.clear`、`slot.replace`，取代原先分散的 `body.replacePart`、`equipment.equip` 和姿势占用。
## 3. 插槽域一览
<table header-row="true">
<tr>
<td>域</td>
<td>拥有者</td>
<td>例子</td>
<td>占用者</td>
<td>派生出</td>
</tr>
<tr>
<td>身体 body</td>
<td>角色</td>
<td>耳×2（分侧）、上肢×2、尾 0..1</td>
<td>部件定义</td>
<td>能力、描述、可用姿势</td>
</tr>
<tr>
<td>义体 augment</td>
<td>身体槽</td>
<td>上肢义体覆盖或替代</td>
<td>义体定义</td>
<td>同上，来源标为机械</td>
</tr>
<tr>
<td>装备 equip</td>
<td>角色</td>
<td>头、上身外层/内层、手、脚（分层、覆盖）</td>
<td>物品</td>
<td>暴露部位、防护、兼容性</td>
</tr>
<tr>
<td>使用 use</td>
<td>身体部件</td>
<td>手：空闲 / 持物 / 被动作占用</td>
<td>动作</td>
<td>姿势转换是否合法</td>
</tr>
<tr>
<td>场景角色 role</td>
<td>PoseScene</td>
<td>施动方、对象方、第三方</td>
<td>参与者</td>
<td>各角色须满足的部件要求</td>
</tr>
<tr>
<td>钩子 hook</td>
<td>地点、NPC、事件</td>
<td>进入地点、NPC 话题、时间节点</td>
<td>事件、话题、日程条目</td>
<td>候选集合与评估时机</td>
</tr>
<tr>
<td>文本 text</td>
<td>节点、身体</td>
<td>身体描述按槽顺序拼装、节点文本变体</td>
<td>文本 key + 条件</td>
<td>最终文案</td>
</tr>
<tr>
<td>日程 schedule</td>
<td>NPC</td>
<td>时段 × 地点</td>
<td>日程条目</td>
<td>在场位置</td>
</tr>
</table>
**不是插槽**：时间、货币、关系向量、任务阶段、flag 与计数变量、RNG 流。强行槽位化只会增加复杂度。
## 4. 内容包怎么“插”
```json
// core 包：只含词表与槽类型，不含剧情
{"id":"slot.body.ear","domain":"body","capacity":{"min":0,"max":2},"sided":true,"accepts":{"op":"tag.has","tag":"tag.part.ear"}}

// 作者包（命名空间 ax，名称仅为示意）：新部件，自带显示名
{"id":"ax:part.ear.fox","slotType":"slot.body.ear","nameKey":"part.ear.fox","tags":["tag.part.ear"],"capabilities":["cap.hear","cap.hear_high"]}

// 作者包：TF 配方，用统一效果
{"id":"ax:tf.fox_ears","stages":[{"id":"latent","durationMinutes":60}],
 "onComplete":[{"op":"slot.replace","slotType":"slot.body.ear","side":"all","with":"ax:part.ear.fox"}]}

// 作者包：向他人 NPC 的话题钩子追加内容（只追加，不覆盖）
{"contribute":{"hook":"core:hook.npc.nara.topic","entry":{"id":"ax:topic.fox","startEvent":"ax:event.fox_talk","unlock":{"op":"slot.has","slotType":"slot.body.ear","def":"ax:part.ear.fox"}}}}
```
规则：
- 非 core 包声明 `namespace`，所定义的 ID 必须带前缀；文本 key、flag、变量按包自动作用域。
- 删除 `eventPool`、`npcPresenceDefs`、`neighbors` 这类反向列表。地点连接改为顶层 `routes`，反向索引由 Registry 加载时生成。
- 钩子槽自带评估时机（进地点、对话、时间流逝），候选先按 priority、再按 ID 稳定排序，然后才用 RNG 抽取，保证加包顺序不改变结果。
## 5. 目录与依赖方向
```javascript
src/engine/   registry slots conditions effects actions clock rng
              body tf pose events npc save        # 无 DOM、无网络、无 AI
src/ui/       只读 selectors，只提交 intents
src/ai/       可选叙事适配器，不得写状态
src/tools/    pack-lint、词表生成、迁移、打包
content/      core/ 与各作者包（manifest + definitions + texts）
schemas/      由 TS 类型生成的 JSON Schema（三者同源）
tests/        unit integration e2e mutation fixtures
```
## 6. 最小权威状态
- `meta`：saveSchemaVersion、各包版本与哈希、stateRevision。
- `clock`：worldMinute。`rng`：按事件实例派生的独立流。
- `entities`：玩家与 NPC 实例，各含身份事实、`slots`（占用表）、`vars`。
- `occupants`：占用者实例表，含 `lockedBy`、`source`。
- `queues`：TF 队列、已调度事件。
- `events`：事件实例，以及**活跃事件栈**（可挂起与恢复，替代单个 `activeEventId`）。
- `scene`：当前 PoseScene。
- `ledger`：已处理事务 ID、发现记录、日志。
NPC 位置由 schedule 派生，只有被事件或效果显式移动时才存储覆盖值。路人提升为持久居民时，快照姓名、身体和性格。
## 7. DSL 第一批
- **条件**：保留现有 16 个，新增 `slot.has`、`slot.count`（含侧别、材质）、`slot.free`、`tf.stage`、`memory.hasFact`、`var.compare`、`time.day`、`pref.content`。
- **效果**：`slot.fill / clear / replace`、`var.change`、`event.start / schedule`、`npc.moveTo`、`scene.start / end`，保留现有 `equipment.*` 的语义并入 `slot.*`。
- **节点类型**：`narration`、`choice`、`resolve`（含 `rng.chance`）、`combat`、`interaction`、`exit`，全部写全规格；`exit` 支持 `then:{startEvent}`，以表达战败后续。
## 8. 三个关键流程
1. **自由 TF 与剧情 TF**：同一个入口 `slot.replace`。剧情 TF 写入 `lockedBy`，自由编辑遇到锁时返回原因和可选方案，不覆盖。
2. **TF 与姿势冲突**：TF 阶段随时钟自动推进，若目标槽位的占用者正被 `use` 槽占用，则该次提交**延后**到场景结束，或要求场景重新校验。
3. **事件触发**：钩子在对应时机收集候选，按条件过滤和稳定排序，再抽取；一次抽取的结果存入事件实例，读档不重抽。
## 9. 校验与作者工具链
- `pack-lint` 先于一切其他工作，作者 AI 可直接运行，覆盖 doc 02 §7 的全部 14 项，并新增：命名空间归属、`contributions` 目标存在、槽位容量与互斥、TF 与槽类型匹配、flag 与词表声明、节点必有退出、环路内奖励检测。
- **成年约束**：`ageYears` 加 `adultFrom` 规则取代自填 `adult`；事件显式声明 `participants`；带成人标签的事件，其全部参与者（含路人模板）必须通过检查，不通过为 ERROR。
- 上一轮的 17 个变异用例固化为校验器的回归测试，要求 100% 拦截。
- manifest 增加 `author`、`status`（draft / reviewed / approved）、内容哈希。
## 10. 阶段与 Gate
<table header-row="true">
<tr>
<td>阶段</td>
<td>产出</td>
<td>可复验 Gate</td>
</tr>
<tr>
<td>M1 契约</td>
<td>全部 Definition 的 Schema、core 词表包、`pack-lint`</td>
<td>变异集 100% 拦截；示例包按新 Schema 重写并通过</td>
</tr>
<tr>
<td>M2 内核</td>
<td>slots、事务、时钟、RNG、事件栈、存档</td>
<td>Node 无 DOM 测试：幂等、跨日账单、读档不重发效果、TF×姿势延后</td>
</tr>
<tr>
<td>M3 切片</td>
<td>4–6 地点，1 固定 NPC + 1 路人，自由与剧情 TF，义体，一个多节点事件</td>
<td>真机 20 分钟流程、刷新、存档、回放均不重复结算</td>
</tr>
<tr>
<td>M4 零改引擎</td>
<td>两个不同 AI 的内容包</td>
<td>不改 `engine/` 与 `ui/`；**作者 B 为作者 A 的 NPC 与地点追加内容而不改 A 的任何文件**；加载顺序互换结果一致</td>
</tr>
</table>
## 11. 状态与待你确认
**CONFIRMED**（沿用决定清单 C01–C10）：固定世界、自由与剧情 TF 并存、内容包可由多 AI 预制、机械改装存在、不再给旧代码打补丁。 **PROPOSED**：本文全部内容，包括插槽作为核心抽象、TypeScript、IndexedDB、命名空间方案。
需要你确认：
1. 以“插槽”为核心抽象，并用钩子槽承接跨包追加。
2. 命名空间规则，以及 core 包只放词表与槽类型。
3. 成年规则的口径（≥18，非人类种族另定 `adultFrom`）。
4. 现有 `examples/` 作废，M1 重写。
5. 冻结 doc 01 / doc 07 中核心人物与地点的 **ID**，细节不冻结。
## 12. 补充模块（参考同类游戏）
以下 9 块来自对 RimWorld、Lilith's Throne、DoL、Fallen London、Wildermyth 的设计对照，**全部为 PROPOSED**。对这些游戏的机制描述凭我的了解，未逐个联网核对，落地前以你的判断和实际体验为准。
### 12.1 状态效果层 Status
- 过敏、药效、黑胶覆盖、疲劳这类随时间变化的状态，**不是插槽**（§3 的“不是插槽”列表应补上它），也不进 TF 队列，单独成层。
- `StatusDef`：`attachTo`（角色、槽位或部件）、`duration`、`stacking`（刷新、叠加、互斥）、`onTick`、`onExpire`、`curedBy`、`modifies`（对能力的加减，不改占用者）。
- 实例存 `statuses[]`：定义 ID、挂载目标、起止时间、层数、来源。
- 能力派生顺序固定：占用者 → 装备 → 状态修正。
### 12.2 衣物覆盖与暴露
- 装备槽加 `layer` 与 `covers[]`（所覆盖的身体槽类型）；装备定义加 `fitsSlots` 与 `bodyRequires`（例如需要尾部开口）。
- 派生 `reachable(slot)` 与 `exposed(slot)`：被更外层覆盖则不可触及。
- 身体变化后与已穿装备不兼容时，自动卸下并返还背包或明确提示，**不得静默销毁**。
### 12.3 Storylet 池与节奏控制
- 钩子槽的候选改为 storylet：小块内容，字段 `conditions`、`priority`、`weight`、`cooldownGroup`、`exclusiveGroup`、`repeat`。
- 近期触发过同一 `cooldownGroup` 则权重衰减；全局 `pacing` 参数限制单日事件数并设置安静时段，防止同类事件刷屏。
- 事件图只留给长剧情，storylet 可用 `startEvent` 进入事件图。
- 好处：多个 AI 各自追加小块内容即可，不必改同一张大图，合并更安全。
### 12.4 NPC 偏好与边界类型化
- `preferences` 使用 core 词表中的标签加强度（喜欢、中性、回避、硬边界），取代自由字符串 `boundaries`。
- 引擎派生 `willing(npc, action, ctx)`，返回结果与 `reasonCode`，拒绝、隐瞒、改变态度由数据驱动。
- 硬边界不能被关系数值解锁；成人主题动作仍受 §9 的成年约束把关。
### 12.5 节点级内容开关
- 节点加 `contentTags[]`、`skippable`、`skipTo`（跳过后的汇合节点）。玩家设置按标签选择显示、淡化或跳过。
- 引擎在 `AvailableAction` 中过滤未启用标签的入口。
- 跳过默认**只跳过文本，效果照常结算**，避免跳过导致状态不一致；`pack-lint` 检查 `skipTo` 路径完整。
### 12.6 包生命周期
- manifest 依赖标注 `required` 或 `optional`；存档记录各包版本与哈希。
- 包缺失或降级时，相关占用者与事件实例进入**隔离区**：不删除、不崩溃，提示玩家，包恢复后自动还原。
- 同一主版本内禁止删除或改名已发布 ID，变更必须附 `migrations`。
- 覆盖策略默认**只追加**。RimWorld 式 patch（修改他人定义）列为 OPEN，默认关闭。
### 12.7 TF 参数化与自由编辑菜单
- 自由编辑菜单由槽位的 `accepts` 加部件的 `unlock` 条件自动生成，不必每个部件手写配方。
- 配方改为模板：`targetSlotType`、`candidates[]`、`speed`、`cost`、`reversible`，一个模板可展开成多个具体配方。
- 流程沿用 §8：草案预览 → 兼容检查 → 提交，遇 `lockedBy` 返回原因。
### 12.8 文本与表现预留
- 身体描述按槽顺序拼装，每个部件定义提供 `descriptor`（可含条件变体）。
- 增加代词与称谓：`pronoun`、`honorific` 由身份事实决定，文本中只能用受控插值，如 `{pronoun.subject}`。
- 槽位类型预留可空的 `visualLayer`，将来加分层立绘不改 schema。
### 12.9 世界事实表与风格样例
- `canon/facts.json`：每条事实含 `id`、`text`、`visibility`（worldFact、npcKnows、playerKnows、rumor）、`status`（CONFIRMED 或 PROPOSED）。`memory.addFact` 与 AI 输入都引用事实 ID，而不是自然语言句子，这样 `usedFactIds` 才能核对。
- `canon/style/`：每个核心角色 2–3 段口吻样例与禁用写法。
- 作者包可以引用或新增 PROPOSED 事实，**不得改动 CONFIRMED**。
### 12.10 新增待确认（接 §11 的 1–5）
1. 日常内容以 storylet 池为主形式，事件图仅用于长剧情。
2. 节点跳过的语义，默认“只跳文本、效果照常结算”。
3. 是否允许 patch 式覆盖，默认不允许。
4. 世界事实表由我基于 doc 01 与 doc 07 起草 PROPOSED 初稿，由你审定。
</content>
</page>
