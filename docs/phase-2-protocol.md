# 第二阶段最小协议（候选，未冻结）

沿用第一阶段pack schema 1 / engineApiVersion 0.1。新增字段为可选的能力扩展，不静默忽略新opcode；包需显式声明 `body.graph.v1`、`tf.pipeline.v1`、`hook.global.v1`。第一阶段core/world定义未修改。完整类型见 `src/core/body-types.ts` 与 `src/core/types.ts`。

## 定义与状态

| 项目 | 字段/规则 |
| --- | --- |
| bodyParts | id、label、kind、material、capabilities、anchors。类别仅root/head/ear/arm/hand/leg/foot/tail；材料organic/mechanical；能力grasp/walk/hear/balance/tailGrip。未知词项拒绝。 |
| anchors | 稳定局部id、接收类别、1–16容量。身体连接使用锚点；不是装备Slot或场景占用。 |
| bodyTemplates | id、label、initial、rootPartId、parts、edges。安装集合唯一初始模板。两手两腿由人类数据提供，非引擎全局约束。 |
| player.body | templateId、rootPartId、parts（instanceId/definitionId）、edges（parentPartId/childPartId/anchorId）。最多128节点，每个非根节点唯一父边并可追溯到根。 |
| bodyPatches | id、label、summary、operations，1–32个attach/replace/remove。remove不递归销毁子节点；必须先处理子部件；根不能删除/替换。整组补丁整体检查、整体成功。 |
| transformations | id、label、source（free/story）、stages。free为一个0分钟即时阶段；story为正数起点、严格递增的累计活动分钟；每定义1–32阶段，至少一阶段真实改变身体。 |
| stages | id、atMinutes、label、可选patchId。此版仅图补丁；不支持作者脚本或任意stage effect。 |
| tfQueues | instanceId、definitionId、sourceActionId、idempotencyKey、elapsedMinutes、completedStageIds、status、startedAt、blocker。已完成阶段必须为定义时间前缀，来源必须对应事务账本中的tf.apply/enqueue。 |

描述和能力由注册部件和当前节点推导，不保存重复能力计数。不改变既有金钱、标记或人格字段来假装身体变化。初始模板之外的拓扑可合法增减；测试的第三手掌使grasp从2增至3，不需引擎特例。

## Condition / Effect / UI

- `body.hasPart {definitionId}`、`body.hasCapability {capability,count}`、`tf.state {id,state}` 为纯读取条件。
- `tf.apply / enqueue / pause / resume / cancel {id}` 为本轮效果。apply仅接受free，enqueue仅接受story；控制pending实例。
- Action可选 `surface: body`。包公开自己的globalActionHooks后，身体动作与事件/地点动作进入同一个授权集合；正文只显示scene动作，身体面板只显示body动作。
- UI、表单、地图、身体面板均只读取selector并提交注册actionId；没有自由写入图或队列的参数通道。
- 自由塑形按内容暴露有限试用选择。本轮没有冻结全部形态开放、图鉴解锁或最终费用政策。

## 冲突与时间

TF目标由整条阶段补丁的部件/锚点计算。active/paused/blocked队列保留目标预约。修改相同部件、相关子连接或锚点时拒绝，其他部位可继续自由TF。此为身体结构目标锁，不等于尚未实现的场景contact/reservation。

每次clock.advance按最近的TF阶段与午夜分段。并行队列消耗同一段世界时间；暂停/阻塞不增加TF活动分钟；完成后不再增长。边界只在ActionExecutor草稿事务中结算，重绘/读档不重放。

阶段图不兼容时停在对应边界并记录blocked原因；已经度过的世界时间仍属于该行动。resume预检剩余图，再在原边界重试已到期阶段，不额外计时。取消释放预约，不回退既有结构，付款/退款行为由已注册内容明确给出，本测试改造不退款。

## 存档与校验边界

schema 2 / engineVersion `0.1-stage2`。正常存档依旧严格匹配包集合、version/hash；图、队列、阶段顺序、来源事务、时间及目标冲突额外校验。读取不修补新格式坏状态。

唯一旧档升级：schema 1 / engineVersion 0.1且精确匹配 `src/persistence/stage1-packs.ts` 的两个官方包；当前core/world指纹也必须一致。新状态只加默认身体/空TF队列与新版meta，再验证所有旧字段。只接受本轮官方目标包集合；第三方旧包不猜测迁移。原存储不自动覆盖。

pack-lint检查字段、支持词表/能力、跨包引用、默认模板拓扑、锚点是否注册、阶段时间与入口来源。具体动态补丁的容量/连通性/冲突在预览及执行中再校验，不宣称穷尽所有可能的形态组合。没有装备适配、剧情事件锁、ContactGraph占用、自动完成Hook、剂量合并或治疗逆转协议；包不能通过未知opcode伪装支持。
