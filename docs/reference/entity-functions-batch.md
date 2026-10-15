# NPC 与地点功能：首批实现

日期：2026-10-15；新世界生成器版本 0.9.0。可玩文件在 `examples/首批NPC与地点功能示例.html`，具体人物和路线见同目录说明。修改源码后，运行正常构建，再运行 `node scripts/build-function-example.mjs` 更新示例。该脚本通过真实创建、行走和找人动作建立初始进度，并检查保存、读取。

## 已完成的行为

功能由数据与当前场景共同决定。人物未提供的交易、教学、工作入口不进入引擎选项列表，包含不可用折叠栏；真实提供但玩家缺钱、体力不足或已完成当日工作的功能保留具体限制。执行器仍拦截伪造或过期调用，失败不改变状态。选项查询不抽随机数、不推进时间。

- 地点设施决定短休、睡觉、护理、训练、公共事务及灯具开关。相同短休、护理与等候入口去重；无设施且体力即将耗尽时允许原地喘息，保留恢复路径。
- NPC 在当前地点且位于其工作地点时，才提供配置的营业服务。对话面向在场人物；路人只交谈。职业展示名称与服务配置分别保存，不能仅凭“铁匠”这个名字开放所有功能。
- 商店只列出真实商品 ID，扣钱后装备或消耗品入包。教学引用真实能力变量，支付既有训练成本后能力增加。工作使用具体任务正文，每人每天一次，支付报酬。
- 新货物黑麦干粮、草药绷带、安神药饮通过普通动作与既有物品效果执行，并随生成快照保存。使用消耗一份、耗时五分钟。
- 首批中世纪来源提供铁匠、附魔工匠、集市摊主、护理员、委托文书、过路信使；服务数量与组合各不相同。人物、地点、身体、日程和名称仍由正常种子生成。

## 数据契约

`LocationDef.facilities` 与地点参考模板的 `data.facilities` 可声明：

| 字段 | 功能 |
| --- | --- |
| seat、bed | 短休；只有 bed 开放睡觉 |
| care | 伤势处理 |
| workplace | NPC 工作、订单、投资所需场所 |
| training | NPC 教学所需设施 |
| publicDesk | 公共事务 |
| lightSwitch | 灯具开关 |

`ResidentTemplate.services` 可声明下面的已实现服务。空对象表示不提供营业服务，仍可正常交谈。`roleName` 是可选的实际职业显示名称；原 `profession` 仍用于匹配生成来源。

```json
{
  "roleName": "铁匠",
  "services": {
    "work": {
      "label": "帮铁匠分拣锻件",
      "text": "你戴好手套，把冷却的锻件按尺寸放回木架，再清点一遍钉扣。铁匠验收后结清工钱。"
    },
    "trade": ["progression:equipment.blade", "progression:equipment.gloves"],
    "teach": ["core:attack", "core:defense"],
    "orders": true
  }
}
```

`trade` 必须引用已有物品或装备；`teach` 当前允许七项已有基础训练能力；`orders`、`investments` 开放既有订单和经营行为。未知服务、设施、商品与训练目标会在加载时被拒绝。跨包引用必须声明依赖。

动作可使用 `service.available` 条件，例如 `{"op":"service.available","subject":"resident","service":"trade","id":"fantasy:item.bandage"}`，或 `{"op":"service.available","subject":"location","service":"care"}`。交易、教学必须带目标 ID，其余服务不能带 ID。已有常见动作也通过统一推断映射到服务，筛选与执行保持一致。

## 范围与兼容

这是 C 的首批功能基础。教学目前是已实现的基础能力训练；新技能教学、独立接取与提交的 NPC 任务链、装备耐久和修理，以及 E 的关系路线尚未加入。模块 D 性格交谈已在生成器 0.10.0 接入统一对话入口，见 module-d-implementation.md。当前订单复用已有成长机制，不能作为新任务链验收。

显式设施优先；没有配置的中世纪服务地点由既有 home/market/workshop/clinic/commons 提供初始设施。新增数据可以改变组合，已验证给护理场所配置 training、给护理员配置教学后，同一执行器可以实际完成训练，无需按职业或地点名称加分支。

原有世界与旧生成快照不悄悄重生成：缺少新属性的旧动作继续原兼容行为。新世界保存自身生成定义、服务、设施和动作；读取同时支持旧版本和 0.9.0，包哈希、身体、图结构、随机流与存档完整性检查保留。要体验这批筛选请打开示例或重新生成中世纪世界。

验证入口：`node --test tests/entity-functions.test.ts`；构建并生成示例后运行 `node tests/entity-functions-browser.mjs`。完整回归沿用 `node --test tests/*.test.ts`。
