# 第一阶段最小数据协议 · API 0.1 / Schema 1

本协议只描述当时已执行的切片。后续 opcode 以 `src/content/schema.ts` 为准。新内容与新机制的交付格式见 [安装规范](reference/ai-install-spec.md)。

## 内容包

每个 `pack.json` 包含 `manifest / variables / flags / hooks / locations / routes / actions / events / texts / contributions`；世界包可声明唯一 `start`。

manifest 必填 `id、namespace、version、schemaVersion、engineApiVersion、author、status、dependencies、requiresCapabilities、migrations`。版本精确匹配（不是 semver 范围）；依赖拓扑排序，平级按 ID 排序。definition ID 为 `namespace:local.id`，每包只定义自己的 ID。SHA-256 根据整个包的稳定 JSON 计算；存档保留 ID/version/hash，不复制全部内容。

当前 capabilities：`condition.v1 / effect.v1 / event.choice.v1 / hook.action.v1`。迁移必须为空数组；未知字段、未知 opcode、未支持 capability 直接 ERROR 阻止启用。报告包含 severity/code/packId/definitionId/pointer/reason/suggestion。

## Definition

| 类别 | 必需字段 |
| --- | --- |
| Variable | id, label, initial, min, max, unit |
| Flag | id, initial |
| Hook | id, accepts=action, visibility=public |
| Location | id, name, subtitle, textKey, actionHook, map.x/y |
| Route | id, from, to（有方向） |
| Action | id, label, hint, group, conditions, effects, resultText；事件动作另有 context.eventId/nodeId |
| Event | id, startNode, nodes |
| Node | id, type=choice/exit, textVariants, actionIds, onEnter |
| Contribution | hookId, actionIds（只贡献自己定义的非事件专用动作） |

地点 action Hook 与身体 Slot 完全独立。文本为普通字符串，UI 通过 textContent 呈现，不执行 HTML 或脚本。地图坐标只是本轮布局数据，不代表已确认的完整城市地理。

## Condition / Effect

| Condition | 实际语义 |
| --- | --- |
| all / any / not | 组合纯读取条件，最多20层 |
| var.compare | 对已登记变量进行 eq/gte/lte 比较 |
| flag.has | 检查已登记布尔标记 |
| location.is | 当前地点匹配 |
| time.window | 分钟窗口；支持跨午夜，左闭右开 |
| event.state | unseen / active / completed |

| Effect | 实际语义 |
| --- | --- |
| var.change | 低于 min 拒绝并回滚；增加到 max 后封顶，显示实际结果 |
| flag.set | 修改已登记标记 |
| clock.advance | 非负整数，单次最多10080分钟；逐个记录午夜边界 |
| location.move | 使用已登记有向 route；检查起点，发现目标地点 |
| event.start | 创建稳定事件实例、独立 RNG 流并锁定初始文字 |
| event.advance | 进入已登记节点；首次进入执行 onEnter |
| event.exit | 标记完成并清理活动事件栈 |

身体、关系、背包、状态、TF、姿态、战斗等高级操作符**尚未实现，导入会失败**。本轮时钟不扣房租，不结算 TF；不得把午夜记录冒充账单系统。

## 单一写入入口

```ts
executor.performAction({ actionId }, expectedRevision, requestId)
```

检查参数 → 相同 requestId 的指纹重放 → revision → 当前授权动作集合 → 条件 → 克隆状态 → 完整结算（上限64个效果） → revision +1 → 记录结果 → 一次替换权威状态。

相同 requestId/intent 返回原结果，不提交新事务；同 requestId 不同 intent 拒绝。失败返回 reason code/文字，不改变任何状态，包括时间、RNG。UI/存档/叙事没有可写 snapshot。读取存档会创建新的 executor，是生命周期恢复而不是绕过行动事务进行玩法修改。

## 时间、随机、事件

累计分钟不使用墙上时钟推进。新游戏用浏览器随机源生成一次 seed，以后采用按用途/事件实例独立的确定性流。随机值和选中文字 ID 同时记在事件实例中，恢复时只读。无 RNG Condition，不从 UI 抽样。

本轮事件只有 choice/exit；不支持事件嵌套、暂停子事件、Storylet 池、schedule、四类 skip 机制。进入节点时不得递归 start/advance。每个 choice 有无条件合法出口。地图/存档/记录页都不能推进事件。

## 存档

`payload={format, schemaVersion, savedAt, state}` + SHA-256 checksum。时间戳仅是存档元信息，不驱动游戏。checksum 用于检测损坏，不是防作弊或安全签名。GameState 明确区分 meta、clock、world、player、eventInstances、activeEventStack、rng、ledger。

先校验 checksum，再检查状态结构、定义类型、变量范围、事件节点、随机记录、活动栈、事务唯一性、包 ID/version/hash。失败返回 quarantined 与原字符串；原数据不删除、不修补。当前上限4 MiB，无账本截断，无自动升级/降级迁移，无跨标签页协作游戏事务。

浏览器保存使用 IndexedDB readwrite 事务的 oncomplete 确认完成。JSON 导入通过同一 codec。单槽手动存档，无自动保存。

## 后续接口

`engine/module-boundaries.ts` 只保留 BodyGraph、LocalSlot、InteractionScene/Contact、TFQueueEntry、NPCInstance、CombatInstance 的最小分離数据边界。没有固定肢体数。后续接入步骤：定义版本化 state 字段及 codec → 新增明确 DSL opcode → 加入纯条件/草稿效果 → executor 统一提交 → selectors 派生 UI。不能通过任意 JS 插件写状态。
