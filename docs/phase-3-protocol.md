# 第三阶段最小 NPC 协议（候选，未冻结）

## 定义与边界

增加 `npc.fixed.v1` 能力。`content/social/pack.json` 为官方世界子包，依赖已有 core/world/reshaping；核心人物世界身份仍由项目所有者控制，没有改写前三包或允许其他包覆盖 ID。

| 定义 | 实际支持字段 | 权威归属 |
| --- | --- | --- |
| SpeciesDef | id、label、intelligent、adultAgeYears | 只读 Registry；通用资格词表，不是身体结构 |
| NPCDef | id、canonKey、name、role、descriptionText、speciesId、ageYears、topicHook、schedule | 只读 Registry；固定实体与日程 |
| NPCMemoryDef | id、npcId、textKey | 登记的事实与人物所有者 |
| NPCState | instanceId、definitionId、discovered、relationship、memories | GameState；由 ActionExecutor 草稿提交 |
| NPCMemory | definitionId、recordedAt、sourceActionId、sourceRequestId | 一次性经历，来源事务可核验 |

`canonKey: velvet` 保留既有角色身份；实例 ID 为 `fixed:<definitionId>`，不调用随机数。NPCDef 不伪装拥有完整身体图、装备、目标、秘密或个人攻略线。人物自我身份、身体、关系、日程与接触场景继续独立；本轮只落实日程/关系/记忆。

人物年龄字段必须显式存在：普通内容允许 `null` 表示未知，不能默认为成年。成年资格由 `ageYears >= species.adultAgeYears && species.intelligent` 检查；未知年龄、年龄缺失、未成年和非智慧角色不能通过。当前薇尔维特的精确年龄和身体构型未确定，保留未知；通用18岁资格阈值为 PROPOSED 测试词表。本阶段无玩家年龄协议，因此 `rating: adult` 事件始终加载失败；不会把普通交谈的成功误当成人内容资格。

## 日程与事件参与者

`schedule` 有1–32个 `{start,end,locationId,activityText}`，起止为每日分钟，半开区间 `[start,end)`，start>end 表示跨午夜。每个分钟恰好一个条目，重叠、缺口、空时段、错类型地点均拒绝。`locationId:null` 表示暂不在公开场所，没有虚构可导航的私宅。

位置通过只读 `npcLocation` 计算，推进时间只发生在真实行动中；读图、读档案、渲染不写NPC位置，不抽RNG。带 `participantIds` 的活动事件临时覆盖参与者位置到当前事件地点。当前只支持一层事件栈且禁止事件中移动；事件退出清理 stack 后即时恢复日程。不会把该临时覆盖写成永久搬家，也没有每分钟模拟整座城市。

NPC的公开 `topicHook` 接受普通 action。仅人物实际在场且没有其他活动事件时，选择器加入该 Hook 的动作。事件开始时再次检查参与者在场。第三方作者可贡献自己的动作/新事件，需要显式依赖所有引用包；不能修改原NPC定义或借用其命名空间。

## DSL

| 操作符 | 字段与行为 |
| --- | --- |
| npc.present | npcId；查询日程/活动事件覆盖后的当前在场情况 |
| npc.memory | npcId、memoryId、value；查询人物已经知道的登记事实 |
| npc.relation | npcId、field、comparison、value；field为familiarity/trust，comparison为eq/gte/lte |
| npc.remember | npcId、memoryId、relationship:{familiarity,trust}；记忆首次写入时才改变关系 |

关系整数范围 `[-100,100]`，增量同范围且按上下限截断。**记忆与关系增量是同一个效果**；已有同一事实时整体不再结算。每次真实谈话仍可消耗内容声明的时间，但不能刷同一里程碑。

`npc.remember` 只能由登记了该人物的事件动作或节点进入效果触发；登记事实必须属于该人物，人物须在场。记录来源 requestId/actionId 和世界分钟。存档验证会核对来源账本、动作/节点登记的记忆效果，并从有序的一次性来源重算关系，拒绝随意改熟悉/信任或伪造事实。

本轮清单委托通过“接受的NPC记忆 → 玩家在集市核对后的旗标 → 回来报告的NPC记忆”组成。集市核对先改变玩家事实，人物不会远程获得完成记忆；未核对不能领取报酬，交付后入口条件防止再次领取。拒绝记录经历且不锁死后来接受。

## 存档 schema 3

增加 `npcs`；meta.engineVersion 为 `0.1-stage3`。当前全部安装包的 id/version/hash 必须匹配。

精确旧档升级只支持已发布官方 Stage1/Stage2 指纹与本轮官方4包安装集合。升级校验原字段、玩家旗标集合、原包哈希和checksum；Stage1新增默认身体和空TF；Stage2保留真实BodyGraph、所有TF状态/阶段/来源；两者仅新增人物默认实例和本包初始旗标，最后完整验证schema3。时间、金钱、旧旗标、RNG、事件文字与账本均保留。未知包/损坏旧字段隔离保留，读取升级不写存储。

这是两个明确官方版本的迁移，不是通用作者内容包热安装或任意版本兼容。新版档不能回到旧引擎；仍有单手动槽与4MiB上限，不截断事务。

## 仍未实现

持久路人生成/晋升、任务专门状态机、完整NPC身体图/个人线、记忆遗忘/更新与秘密可见性图、事件嵌套与暂停、完整Storylet/EventGraph、InteractionScene/ContactGraph、Slot/装备、战斗与失败后续。相关边界保留，本轮没有占位玩法按钮；本协议仍是候选，不宣称M1或M2全部验收。
