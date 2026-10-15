# 给协作 AI：战败内容覆盖矩阵制作教程

日期：2026-10-15。交付形式：Markdown 标注稿，不修改游戏源码或 JSON。

本教程覆盖非性战败、投降、放弃抵抗、撤离、救援、恢复及明确接受的维护后续。不包含露骨色情、性胁迫或人与动物性内容的写作清单。它不是对用户原稿的改写，也不代表其他内容已被纳入覆盖。

## 1. 你需要交付什么

请一次交齐以下七份内容，不能只交几篇示例，也不能只交目录、Tag 名称或一句剧情摘要：

1. **维度与来源表**：全部题材、真实敌人/角色、战斗档位、目标/倾向、战败入口、真实身体与场景条件。每项标明已登记 ID 或“尚未定义”。
2. **有效组合覆盖矩阵**：每个有效组合至少指向一个可完成的段落路径；无效组合写明排斥原因，不强行编故事。
3. **段落职责与衔接表**：每段输入事实、正文职责、可选行动、产生事实、下一段及退出。
4. **复用段落库标注稿**：按实际行为与结果分类，不按每个敌人姓名重复写整链。各条路径要从进入写到真正收尾。
5. **题材与对象适配表**：17 种现有题材逐项适配；对象差异来自真实元数据，不只替换名字。
6. **冲突、优先级与回退表**：多标签同时命中、无人回应、缺少身体能力、无合适地点、信息不全时如何处理。
7. **完成验收表与缺口表**：哪些已写完、合法复用、条件不适用、缺少数据或尚未实装，逐项列清。

矩阵表头建议为：

| 编辑案例编号 | 题材/地点条件 | 对象定义 | 档位 | 谁战败 | 入口 | 对手目标 | 已知身体/状态 | 排斥条件 | 段落路径 | 结果 | 免费退出 | 状态/缺口 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |

这些列是编辑标注，不是新增游戏变量或已注册的 Tag。编辑编号不能冒充运行时 ID。

## 2. 先区分维度，不能全部当作同一类 Tag

- **题材**：决定设施、称谓、组织和行动的合理范围。
- **地点与环境**：决定出入口、救援方式及可使用的设施。题材本身不保证当前有树林、沙洞、门、道路或值班人员。
- **对象类别/身体/种族**：只有实际元数据明确提供时才采用；从显示名猜出的分类不能当权威身体事实。
- **战斗档位**：当前为 S、M、L、boss；这是战斗强度，不能直接翻译成身体尺寸。需要物理尺寸时另标数据缺口。
- **倾向与目标**：control/direct/repair 是行为倾向，goal.control/goal.leave/goal.repair 是本次目标；两者不能混写成万能结局权限。
- **入口**：正常战败、主动投降、主动放弃抵抗应分别标注。逃跑成功不是战败，不混入同一入口。
- **事实与进度**：已求助、已检查、外衣受牵连、双手受限等，不可由描述自行凭空成立。
- **结果**：回到自由行动、获得实际协助、接受实际维护、保留待办、终局必须区分。结束故事不等于结束游戏。

年龄不作为本教程的组合维度；标注稿也不修改既有资格校验。关系字段或终局接口若尚未实装，必须标注待接口实现，不能把正文当成状态已经改变。

## 3. 先做有效性筛选，再展开覆盖

依次检查：

1. 对象是否有真实定义，当前选敌规则是否允许出现。
2. 入口、目标及玩家状态是否一致。
3. 行动需要的身体能力和场景设施是否实际存在。
4. 是否命中更具体的排斥或路由条件。
5. 有没有可执行的收尾与无条件免费退出。

不通过的组合标为“不适用”并注明原因；来源缺失标为“待定义”。不能用默认人形、默认墙壁或默认救援人员补洞。

例如，6 个现有敌人 × 3 种战败入口 × 17 种题材共有 306 个**审计格子**。这不是 306 条已可达路径，更不是必须写 306 篇文章：实际生成规则、场景条件和身体事实会排除部分组合，其余可以复用经过验证的段落。

以后新增敌人或题材，先补适配与排斥记录，再检查是否真的需要新段落。不得把“覆盖未来所有组合”当作可验收承诺。

## 4. 按职责写段落，不按角色姓名堆长链

建议先组织这些编辑层面的段落职责，再映射到实际阶段：

| 段落职责 | 必须写清 | 不可凭空写入 |
| --- | --- | --- |
| 进入 | 冲突已结束、谁在场、当前可知事实 | 新人物、未产生的伤势或器官变化 |
| 目标回应 | 对手要离开、稳住现场或提出维护 | 把倾向直接等同于所有行动权限 |
| 判断与选择 | 当前真实可行的选项及边界 | 没有对应物品、能力或效果的行动 |
| 行动反馈 | 本次选择具体完成了什么 | 未执行的任务、交易、修复或 TF |
| 后续承接 | 下一段仍有效的状态、对象和地点 | 重复开场、换人、状态倒退 |
| 收尾 | 是否回到自由行动，留下哪些真实进展 | 用“消失/死亡”等措辞伪造未实装终局 |

单个标注段落统一使用：

```text
编辑段落编号：
职责及适用阶段：
必须满足的事实与标签（写明角色作用域）：
排斥条件：
已绑定对象与实际地点：
完整正文：
选择标签及对应完整反馈：
实际效果或待接口实现的效果建议：
产生/保留/解除的事实：
后续段落：
无条件免费退出及完整反馈：
题材、身体与场景适配说明：
复用案例编号：
```

以上是空白制作格式，不是交付成品。最终稿不能保留空栏、TODO 或“此处描写”；确实不适用的栏须说明原因。

## 5. 当前基础路径应怎样整理

至少分别组织：通用回退、结束接触、稳定现场、检查当前处境、外衣受牵连、双手受限、求助与回应、明确接受或拒绝维护、投降后续、放弃抵抗后续。

它们并非互斥分类。例如“稳定现场”可以通向“检查处境”，继而发现外衣和双手同时受限，再选择求助。矩阵必须记录复合状态；不能选中双手受限段落后就假装外衣问题已经消失。

同一目标允许不同实际反馈，但最终结果相同、身体和场景前提也相同的组合可以复用。需要改变行动、前提或结果时，才拆分新路径。

普通敌人与头目的差异可以体现在决策范围、回应阶段、后续影响和可用资源上，不靠无意义加长正文。头目仍须受当前真实定义与接口约束。

## 6. 路由要标优先级，但不能凭标注稿改变引擎

当前正常战败路径中，通用 start 优先级为 0；控制、离开、维护等 start 节点为 5。投降与放弃抵抗 start 节点为 30，随后进入 yielded；控制/维护各有对应 yielded 后续。

assess 阶段，双手受限节点优先级 6，外衣受牵连为 5，普通检查为 0。maintenance 的特定机械尾节点为 6，同时还有免费普通收束。

优先级先筛候选，再由现有权重选择。更高权重不能越过更高优先级。矩阵必须区分：硬性适用条件、排斥条件、优先级、同池权重，不能把它们混成“概率”。

复合状态或新路径超出当前引擎表达能力时，列入“接口缺口”，交给集成者处理；不得声称标注稿已经修复运行逻辑。

## 7. 适配全部题材时，不只换名词

每个题材适配条目必须包含：可用组织/设施、合理行动方式、地点前提、称谓、身体/装备前提、回退表达及不适用项。未提供设施时，应使用不假设具体设施的通用表达。

物种与身体差异需要完整可读的适配短句，以及无匹配时的通用句。不能在最终正文留下“[毛发槽]”“[气味槽]”等未完成标记，也不能把编辑槽名直接变成运行时占位符。

当前 sceneContext 的实际填充字段包括 place、player、period、nearby、routeNames、bodyState、tfState、localWork；叙事另提供 opponent。其他编辑槽在没有接入前不能宣称能直接运行。身体变化以真实 TF 执行结果为准，不把外观短句当作已安装部件。

## 8. 三个不涉及色情的标注案例方向

- **收债客／正常战败／结束接触目标**：确认冲突结束 → 明确结束接触或请求协助 → 记录实际回应 → 返回可继续行动的位置。不得无依据生成新债务数值。
- **搬运机／维护目标**：说明实际维护范围 → 明确接受或拒绝 → 仅有合法定义及真实前提时执行 → 反馈实际结果。没有相应部件就用普通检查与收束。
- **重装哨卫／控制目标／双重限制**：确认两个真实限制 → 避免提供依赖受限能力的选择 → 可请求协助 → 分别说明已解除与仍保留的事实 → 收尾。不能仅因当前段落换了，旧状态就自动消失。

这些方向不是完整正文，也不计入写作完成数；协作 AI 应按前述格式交出完整标注稿。

## 9. 完成验收

- 17 种现有题材逐项有适配或明确不适用说明。
- 每个真实对象和三种入口均有覆盖记录，未知身体/种族不能默认为人形。
- 有效组合均映射到完整路径；排除组合、缺数据与未实装接口分开统计。
- 每条路径进入、选择、反馈、后续和收尾齐全；每节点有无条件免费退出。
- 无候选有通用回退；复合状态不丢失事实；目标与人物不串线。
- 所有 Tag 写作用域；注册、选池、正文、状态变化不能互相冒充。
- 对象换名、同类复用、换题材及信息缺失时，完整连读仍成立。
- 不出现未填槽、制作指令、空正文、假奖励、假修理、假终局。
- 不把标注稿审查通过写成代码或浏览器测试通过。

最终汇报实际清单：对象数、题材数、有效案例数、排除案例数、复用段落数、独立段落数、未完成数。未完成不为零时不能称“全部完成”。

## 10. 当前工程的真实来源清单

下列信息由当前内容包提取，供无法读取工程的协作 AI 使用。范围是本教程的非性战败路径，不是整个游戏所有可选内容的清单。未列出的新物种、新敌人或新终局不能自行伪造已登记 ID。

### 全部 17 种已配置题材

| 题材 | 已登记 Tag |
| --- | --- |
| 赛博都市 | worlds:setting.cyberpunk |
| 废土世界 | worlds:setting.post-apocalypse |
| 轨道空间站 | worlds:setting.space-station |
| 沙漠世界 | worlds:setting.desert |
| 浮空世界 | worlds:setting.floating |
| 火山世界 | worlds:setting.volcanic |
| 地下矿城 | worlds:setting.underground |
| 极地世界 | worlds:setting.polar |
| 雨林世界 | worlds:setting.jungle |
| 蒸汽都市 | worlds:setting.steampunk |
| 仙侠世界 | worlds:setting.xianxia |
| 深海世界 | worlds:setting.underwater |
| 中世纪异世界 | worlds:setting.fantasy |
| 现代都市 | worlds:setting.modern |
| 自由港世界 | worlds:setting.harbor |
| 地下城世界 | worlds:setting.dungeon |
| 西部边境 | worlds:setting.western |

当前试玩入口的开放范围与底层题材配置是两件事；这里列配置全集。

### 真实敌人及目标

| 敌人 ID | 名称 | 战斗档位 | opponent 倾向 | opponent 目标 | 初始 player 事实 |
| --- | --- | --- | --- | --- | --- |
| district:enemy.scavenger | 失控搬运机 | S | progression:tag.repair、progression:tag.tools | progression:tag.goal.repair | progression:tag.clear、progression:tag.injured |
| district:enemy.collector | 拦路收债客 | M | progression:tag.direct | progression:tag.goal.leave | progression:tag.clear、progression:tag.injured |
| district:enemy.gel | 渠底黑胶群落 | S | progression:tag.control | progression:tag.goal.control | progression:tag.clear、progression:tag.injured、progression:tag.coat.stuck |
| progression:enemy.raider | 抢占通道的游荡者 | S | progression:tag.direct | progression:tag.goal.leave | progression:tag.clear、progression:tag.injured |
| progression:enemy.sentinel | 封锁通道的重装哨卫 | L | progression:tag.control | progression:tag.goal.control | progression:tag.clear、progression:tag.injured、progression:tag.hands.restricted |
| progression:enemy.overseer | 维护核心的失控监理 | boss | progression:tag.repair、progression:tag.tools | progression:tag.goal.repair | progression:tag.clear、progression:tag.injured |

档位不是物理尺寸。当前上述敌人定义不提供统一完整的身体/种族分类，新增体型或种族分类须标数据缺口。

### 与本教程有关的状态和环境标签

| 作用域 | 已登记 ID | 标签名称 |
| --- | --- | --- |
| opponent | progression:tag.control | 控制倾向 |
| opponent | progression:tag.direct | 直接倾向 |
| opponent | progression:tag.repair | 改造与修理倾向 |
| opponent | progression:tag.cautious | 谨慎 |
| opponent | progression:tag.tools | 携带维护工具 |
| opponent | progression:tag.goal.control | 控制现场目标 |
| opponent | progression:tag.goal.leave | 结束接触目标 |
| opponent | progression:tag.goal.repair | 检查改装目标 |
| player | progression:tag.clear | 保持清醒 |
| player | progression:tag.injured | 伤后乏力 |
| player | progression:tag.coat.stuck | 外衣黏附 |
| player | progression:tag.hands.restricted | 双手受限 |
| player | progression:tag.signal | 已发出求助 |
| player | progression:tag.assessed | 已检查处境 |
| player | progression:tag.repair.accepted | 接受本次修理 |
| player | progression:tag.surrender | 主动投降 |
| player | progression:tag.giveup | 放弃抵抗 |
| environment | foundation:service.commons | 公共空间 |
| environment | foundation:service.workshop | 工坊服务 |
| environment | foundation:service.market | 市场服务 |
| environment | foundation:context.waterways | 水道背景 |
| environment | foundation:theme.gel | 黑胶 |
| environment | foundation:theme.risk | 风险 |
| environment | foundation:theme.mechanical | 机械 |
| environment | foundation:theme.boundary | 边界 |
| environment | foundation:theme.trade | 交易 |
| player | foundation:body.mechanical-tail | 机械尾部 |

作用域依据当前用途填写。标签名字相近不意味着可互换，goal 与倾向尤其要区分。

### 现有环境选敌规则

| 规则 ID | 对手 | 所需 environment Tag |
| --- | --- | --- |
| progression:env-enemy.gel.canal | district:enemy.gel | foundation:service.commons、foundation:context.waterways、foundation:theme.gel |
| progression:env-enemy.scavenger.canal | district:enemy.scavenger | foundation:service.commons、foundation:context.waterways、foundation:theme.risk |
| progression:env-enemy.scavenger.workshop | district:enemy.scavenger | foundation:service.workshop、foundation:theme.mechanical |
| progression:env-enemy.collector.station | district:enemy.collector | foundation:service.commons、foundation:theme.boundary |
| progression:env-enemy.collector.market | district:enemy.collector | foundation:service.market、foundation:theme.trade |

### 现有非性战败节点（17 个）

| 节点 ID | 阶段 | 必须标签（作用域/ID） | 优先级 | 可接续阶段 |
| --- | --- | --- | ---: | --- |
| progression:node.defeat.start | start | 无标签硬门槛；仍需检查其他条件 | 0 | assess、结束本次故事 |
| progression:node.defeat.control | start | opponent/progression:tag.goal.control | 5 | assess、help、结束本次故事 |
| progression:node.defeat.direct | start | opponent/progression:tag.goal.leave | 5 | 结束本次故事、help |
| progression:node.defeat.repair | start | opponent/progression:tag.goal.repair、opponent/progression:tag.tools | 5 | repair、结束本次故事 |
| progression:node.defeat.assess | assess | 无标签硬门槛；仍需检查其他条件 | 0 | help、结束本次故事 |
| progression:node.defeat.coat | assess | player/progression:tag.coat.stuck | 5 | 结束本次故事、help |
| progression:node.defeat.hands | assess | player/progression:tag.hands.restricted | 6 | help、结束本次故事 |
| progression:node.defeat.help | help | player/progression:tag.signal | 0 | 结束本次故事 |
| progression:node.defeat.repair.scope | repair | 无标签硬门槛；仍需检查其他条件 | 0 | 结束本次故事 |
| progression:node.defeat.repair.tail | repair | player/foundation:body.mechanical-tail、opponent/progression:tag.tools | 6 | 结束本次故事 |
| progression:node.defeat.surrender | start | player/progression:tag.surrender | 30 | yielded、help、结束本次故事 |
| progression:node.defeat.giveup | start | player/progression:tag.giveup | 30 | yielded、结束本次故事 |
| progression:node.defeat.yielded | yielded | 无标签硬门槛；仍需检查其他条件 | 0 | 结束本次故事 |
| progression:node.defeat.yielded.control | yielded | opponent/progression:tag.goal.control | 5 | 结束本次故事 |
| progression:node.defeat.yielded.repair | yielded | opponent/progression:tag.goal.repair | 5 | 结束本次故事 |
| progression:node.defeat.control.cautious | start | opponent/progression:tag.goal.control | 5 | assess、help、结束本次故事 |
| progression:node.defeat.repair.cautious | start | opponent/progression:tag.goal.repair、opponent/progression:tag.tools | 5 | repair、结束本次故事 |

该表仅列标签与阶段，不能替代节点其他条件、实际效果和身体资格的核对。现有生成战斗主要在 commons 编译危险遭遇；未实现的区域/原型选池不能只靠标注稿宣布存在。
