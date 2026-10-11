# 🧩 以太都市：深渊重塑｜架构修订 v0.2（BodyGraph × 内容包）

来源：https://app.notion.com/p/3f5498122a0281a48989f06a23e7ecad?pvs=204

Here is the result of "fetch" for the Page with URL https://app.notion.com/p/3f5498122a0281a48989f06a23e7ecad as of 2026-10-11T04:12:50.297Z:
<page url="https://app.notion.com/p/3f5498122a0281a48989f06a23e7ecad" icon="🧩">
<ancestor-path>
<parent-page url="https://app.notion.com/p/3e3498122a0281a08375ebf2e9f0d0f7" title="游戏"/>
<ancestor-2-page url="https://app.notion.com/p/3e5498122a0280cfa6d4fd4c2f83d3ba" title="工作台"/>
</ancestor-path>
<properties>
{"title":"以太都市：深渊重塑｜架构修订 v0.2（BodyGraph × 内容包）"}
</properties>
<iconMetadata>{"type":"emoji","emoji":"🧩"}</iconMetadata>
<content>
> 版本：v0.2（2026-10-10）｜状态：**PROPOSED 待审定、未实现**。本文替代 Claude v0.1 的架构提议部分，保留 v0.1 作为历史记录；不声称已审计 Work 最新源码。
>
> 目标不是立刻做完整黄油，而是定下**可以由多个 AI 分工创作、无需持续修改引擎即可扩充的固定世界 TF 沙盒文字 RPG**。本页为技术与内容协议的候选基线；数值、具体世界新设、文案规模另行定稿。
**来源对照：** <mention-page url="https://app.notion.com/p/3f5498122a0281eea49dfe6810a69ab2"/>；原《以太都市：深渊重塑》v3.0 策划与旧 HTML Demo。**优先级**：用户最新明确确认的需求 ＞ 本文经确认的协议 ＞ v3.0 经确认的世界与玩法 ＞ v0.1 建议 ＞ 旧 Demo；未确认的数值/角色建议不自动升格为正史。
<table_of_contents/>
## 0. 决策状态与本轮改动
**CONFIRMED（已确认的产品要求）**
- 固定世界观、固定地图与核心 NPC。多周目重置玩家经历，不重建一个陌生世界。
- 以 TF 为主导，**自由 TF 与剧情 TF 同一存档并存**；不把它们做成二选一开局模式。
- 都市有机械改装。城市中大量兽人形态来自**人类主动改造、异化转化以及这些人的后代**，不是默认天然独立的原始兽人文明。
- 主 NPC 可持续攻略，普通路人基于地区和规则生成；普通路人可因持续互动转为存档内持久 NPC。
- DoL 风格条件词条、动态遭遇、战斗/失败后续；Lilith's Throne 风格身体结构与变化后果；长事件可以有专属演出和多分支，不能只是换名的文案。
- 游戏要像游戏而非说明书；Grok 或其他模型可负责文案，游戏事实与结算由代码维护；允许后续由不同 AI 批量填内容。
**ACCEPT（本轮推荐保留的 v0.1 技术方向，仍需验收）**
- TS 开发、模块化构建；UI / AI / Engine 分层；事务唯一入口；Condition / Effect 数据协议；内容包、命名空间和校验器。
- Storylet 小事件池 + EventGraph 长事件图；状态化 NPC、可重复事件与隐藏触发；随机结果写入事件实例，存档恢复不重抽。
- 已发生世界事实稳定；跨 AI 扩展只能通过声明式的扩展接口，不能任意执行脚本、暗改他人的文件。
**REPLACE（替换 v0.1 的部分设计）**
1. “一切都抽象为槽”：**身体拓扑 BodyGraph + 局部 Slot**；时间、日程、Hook、文本、姿势是各自专门模型。
2. PoseScene 的槽位占用：**独立 InteractionScene / ContactGraph**，定义姿态、朝向、接触边、资源占用、动作转换。
3. core 包只含词表却又命名 core:nara：拆成 engine/core、aetheria/world、扩展包三个层级。
4. “跳过文本仍无条件结算效果”：改为四种明确的 skip/exit 语义，各自拥有可验证的状态转换。
5. “先写全量 Schema 再做可玩版”：改为**先最小契约与纵向切片，验证后冻结接口并扩展测试**。
6. “全局一致的固定两只手/固定双足”：只允许定义为具体**身体模板的默认值**，引擎不得据此限制未来形态。
**OPEN（尚未确认）**：前端框架与本地存储最终选型、自由 TF 是否全部形态开局可用、剧情锁精细权限、视觉素材格式、具体成人事件内容和游戏数值。本文不替玩家决定这些体验。
---
## 1. 产品边界与世界正史
### 1.1 产品边界
单机优先的 HTML 文字沙盒 RPG，固定世界、持续存档、可导入作者内容包。基本玩法不依赖网络；AI 负责离线内容制作或可选的实时叙事。没有 API 也能完整游玩已经安装的内容。
### 1.2 世界范围（保留已讨论方向，不擅自填空）
- 城市伊琉西斯 / 以太都市：上中下城区、沙龙、检查站、黑市/诊室、机械改装与转化人口。
- 外部荒野：深林、黑胶沼泽、菌核岩壁等已在旧资料出现的生态；深层地区按扩展包制作。
- 经济、身份、地区规范、变形适配、职业与 NPC 反应联动。
- 黑胶共生、兽化、异种改造、机械义体均可成为可持续形态，不等于自动人格改变。
- **严禁**自动把本项目与“归原界/Angla”等其他世界合并。
- 固定核心 NPC 的 ID 优先兼容已经确认的名字（如 velvet、riker）；v3.0 新增默认角色与数值必须标注 PROPOSED，不能默认为玩家已定正史。
### 1.3 内容分级与角色年龄约束
成人标签事件只允许使用通过年龄资格校验的**成年智慧人物实体**；模板未提供可验证成年信息时不能抽入成人事件。普通动物保持环境/战斗生态身份，不以该约束的漏洞转化为亲密参与者。年龄规则为具体种族可配置的成年年龄条件，不能靠作者手填布尔值绕过。年龄缺失判 ERROR，而不是默许。
---
## 2. 总体架构：分层、权威、依赖
```plain text
content packs (definitions / texts / assets)
             ↓ load + validate + compile
Registry + canon + hooks + indexes (read-only)
             ↓
Engine: world clock / RNG / action transaction / event graph
        BodyGraph / slots / TF / pose / NPC / combat / saves
             ↑ intents                 ↓ selectors/result
UI game shell ──────────────────────────────┘
             ↓ optional requests        ↑ approved prose
AI adapter (pre-authoring and optional runtime narration)
```
**单一写入权威：** 只有 Engine.performAction(intent, expectedRevision, requestId) 修改 GameState。所有按钮、快捷键、AI 候选行为、脚本化事件效果都从同一入口预检 → 锁定结果 → 原子提交 → 生成不可重复事务记录。
- UI 不写状态；渲染不触发 RNG、时间推进、效果或事件重放。
- Registry 是只读定义，不存玩家进度；Save 存差异与实例，不复制整套世界定义。
- AI 不决定金钱、器官存在性、任务完成、好感或骰子结果。AI 只能返回文案、引用已注册动作 ID，或离线提交待审核的新内容包。
- 模块化源代码；可以构建为单文件 HTML 作离线分发，但源码**不得**写成一个巨大的 HTML 字符串/Passage 集合。
- TypeScript + 浏览器本地数据库（建议 IndexedDB，带 JSON 导入导出）为 PROPOSED。选择其他实现必须证明同等事务和迁移能力。真实 API key 不进前端发布包或存档。
### 2.1 三类内容包
1. **engine/core**：公共类型、DSL 操作符、最小词表、基础错误码；没有具体城市 NPC。
2. **aetheria/world**：世界正史、地图、路线、阵营、固定 NPC、环境设定、权威世界事实及保留的世界钩子。
3. **扩展包**（例如 authorA）：自有名字空间的角色、TF、事件、物品、文本；通过 contributions 给 world 或他包的公共 Hook 增加候选，**不改原包源文件**。
加载顺序：依赖拓扑排序 → Schema → 引用解析 → 语义检验 → 固定排序生成索引；禁止循环必需依赖。包提供 id、namespace、version、dependencies（required/optional）、author、status（draft/reviewed/approved）、hash、migration。
**补充原则：** 扩展包默认只追加已公开 Hook。修复已有错误通过**包所有者发布新版 + migrations**；跨包 patch 覆盖不是默认能力。禁止插件执行任意 JS、用未登记字段更新存档或以生成文本作为规则。
### 2.2 Hook 是登记点，不是 Slot
例如 aetheria:hook.npc.nara.topic、aetheria:[hook.location.market](http://hook.location.market).enter、aetheria:[hook.tf](http://hook.tf).completed 等，每个 Hook 声明接受的内容类型、触发时机和可见范围。作者向其贡献 Storylet、EventGraph 入口、话题或事件候选。Hook 不保存永久状态，运行时只求值。
排序只需保证**相同包集合不同加载顺序结果一致**；新增或删除候选包可以合法改变以后的随机遭遇分布。事件已经被抽取后必须固化候选结果，不因新增包/读档变动。
---
## 3. BodyGraph + Slot：身体模型
**目的：** 支持局部替换，也支持兽化、机械化、额外肢体、蛇尾/四足/软体化等会改变连接结构的 TF。不能把任意变化都视为“往固定两条腿槽填新皮肤”。
### 3.1 三层模型
- **BodyGraph：结构权威**。节点 BodyPartInstance（partId、type、side、parentAnchor、attachPoints、material、capabilities、state），连接 edge（attach/articulation 等）；支持动态增删、变形、合并与替换节点；根节点与连通性规则由 bodyTemplate 定义。
- **Slots：局部容器**。挂在身体节点、角色或装备上的容量、侧别、层级与兼容性接口，用于耳部装配、义体安装、装备覆盖、持物等。槽不能取代拓扑连接。
- **Derived Traits：推导值**。从当前图结构 + 装备 + statuses 计算行动能力、可见描述、动作可行性、服装适配、种族标签；不在存档保存可重复计算的能力数值。
**稳定身份**（自称种族、身份与性格）、**身体结构**、**装备**、**临时状态**、**TF 进度队列**互相独立。长出尾巴不自动改人格；穿上黑胶衣物不等于皮肤被同化。
### 3.2 一次结构变化的事务
准备目标 BodyGraphPatch（新增/删去/替换/连接/断开）→ 检查锚点与容量、连通性、占用、装备适配、剧情锁、活动场景约束 → 生成预览及不兼容原因 → 提交或安全延后 → 派生能力/描述更新 → 发出变形完成 Hook。
- 结构变化必须整体成功或整体失败；不能扣钱后才发现没有足够槽位。
- 删除或替换被装备占用部位：依法卸装入背包/隔离，不直接销毁物品。
- 同一局部不能无条件并发两个互斥 TF；需要冲突仲裁（合并剂量/排队/拒绝/玩家选择）。
- “手有两个”是**人类模板**默认图；新增肢体后动作资源预算随实际结构计算。
- 特殊不可表达结构必须由扩展定义明确新增拓扑原语/能力接口；不能只写自由字符串，假装规则已经支持。
### 3.3 数据草图（示意，不视为最终 JSON Schema）
```json
{
  "id": "author:tf.mechanical_tail",
  "target": {"owner": "player", "anchor": "pelvis.back"},
  "operation": {"type": "graph.attach", "partDef": "author:part.tail.mechanical"},
  "requirements": [{"op": "anchor.exists", "id": "pelvis.back"}],
  "onConflict": "reject_with_reason"
}
```
BodyGraphPatch 的 allowedOps、锚点协议和能力派生必须在第一个切片实现后冻结，不应允许任意自定义 JS effect。
---
## 4. 姿态与接触：InteractionScene（独立于 BodyGraph）
这是专门针对 AI 容易写错朝向、位置、换姿势、接触部位的问题。**目标是离散逻辑正确，不宣称实现真实 3D 物理模拟。**
### 4.1 场景组成
- **ActorPose**：参与角色、姿态枚举/姿态族、面向、相对区域（前/后/左/右/上/下）、可用身体锚点、稳定性/移动限制。
- **ContactGraph**：有方向的接触边，字段 sourceActor/sourcePart → targetActor/targetPart、contactType、startTurn、holdsUntil、occupies\[\]、constraints\[\]。
- **ActionReservation**：占用手、尾、足、工具、位置资源；资源预算源自当前 BodyGraph。一个资源可否共享由明确模式决定。
- **Transition**：fromPose → preconditions → releases/retains/creates contacts → toPose → revalidate；不允许瞬间改变姿势而保留不可能存在的接触。
- **SceneLifecycle**：enter、active、roundEnd、exitRequested、resolved，支持暂停和恢复，不把场景文本当作状态。
### 4.2 流程契约
1. 基于当前身体/衣物/状态生成可用动作。
2. 选择 actionId 与合法 targetId、anchorId；系统校验目标与接触端点。
3. 算法检查已有资源占用、相对位置与改变姿势后受影响的 contact。
4. 统一事务提交 scene delta，并持久化新的 ContactGraph；随后才准备 AI 叙事上下文。
5. AI 只能描述提交后的 delta。文本错误不会反向修改 Scene；可重生成或回落固定文本。
6. TF 推进碰到正在占用的 part：规则定义 defer、abort-and-release 或 allow-with-revalidate，不能暗中替换。
7. 退出时按 exitRules 清理 contact 和 reservation，转入已登记的事件/战斗后续。
### 4.3 中性测试例
角色 A 正面握住角色 B 的右手；B 改为面向背后。若当前握手边不允许跨越该朝向，转换必须先释放接触、重新定位、再建立合法接触，不能维持不存在的“前方握手”。另一个测试：没有尾巴的角色不能使用 tail-grab 行动。额外手臂形态则按实际资源预算判定，不固定双手。
### 4.4 保守范围
首版提供有限姿态族 + 相对位置 + 部位接触检查；暂不做连续角度、刚体、碰撞仿真。**复杂动态解剖学永远有模型无法验证的细节**；通过结构化动作记录与必要的人工评审降低错误，而非保证模型绝不写错。
---
## 5. TF Pipeline：自由编辑、剧情变化、临时效果
### 5.1 三条入口，共用同一图操作
- **自由编辑**：玩家选目标结构并预览兼容，正常情况下可即时或快速生效；普通合法部件的开放程度作为设置/内容规则，而不是为了“剧情解锁”强制锁死所有外观。
- **剧情 TF**：按事件阶段触发队列；记录来源、目标部位与目标图、阶段、进度、暂停/治疗/逆转条件、剧情锁。
- **环境 / 道具 TF**：暴露或装备机制产生队列，可以叠加或影响速率，但由引擎仲裁冲突。
- **Status** 是另一层：疲惫、药效、负伤、表面污损、短期黑胶附着等，不自动等同于稳定结构改变。
### 5.2 关键不变量
- TF 队列每一实例有 source、idempotencyKey、target、progress、state 和 stages；重复渲染不会重复增长。
- 一次支付、一次消耗只结算一次；时间推进可跨多个临界阶段，但要按边界分段。
- 身体处于剧情锁时，自由塑形菜单只禁止**相冲突目标**；其余部位可继续编辑。
- 接受、抑制、治疗、恢复与不可逆代价由内容明确表达。锁定有可查看的原因和解除条件，不能用“剧情需要”当万能黑箱。
- 100% 黑胶覆盖与丧失人格/游戏结束不是同一状态；结合程度与控制权分开存。
- TF 必须改变真实图或状态，不允许只有一段文字说“已经变化”而没有实际结构结果。
### 5.3 TF 四件套样例验收
A. 自由更换耳型不触发剧情事件；B. 一条分阶段机械改装任务；C. 同部位冲突显示清楚的拒绝/延期；D. 变化中切换装备并退出交互场景后，存读结果一致。
---
## 6. 人物、路人与长期关系
### 6.1 人物层级
- **核心 NPC**：世界包内稳定实体 ID、年龄与智慧种族、性格、关系向量、目标、日程、秘密、个人任务、重要事件与不同阶段互动。
- **路人模板**：由地区、时段、职业、种族组合范围、行为词条、个性模板、特殊标签与概率权重定义；模板不等于一个永久世界角色。
- **持久路人实例**：当玩家结识、记忆、互动满足持久化条件时，冻结稳定 UUID/seed、姓名、身体、身份事实、关系与历史；后续不重新随机滚出另一个人。
- **事件临时角色**：仅随该事件实例存活，可在内容规则下晋升持久实体。
### 6.2 行为与记忆
NPC 行程按时间与任务状态解析；事件锁定的临时位置覆盖日常日程；离开事件后恢复。人物关系维度与关键事实分开；不允许反复送礼绕过整个角色线，也不能让每个人无差别围着玩家行动。
按事实 ID 持久记录帮助、拒绝、违约、身体变化、任务经历等；角色只知道其设定中可见的事实。AI 生成的“NPC 猜想”不是权威世界事实。
### 6.3 标签检索与发现
提供可搜索的 NPC、TF、动作/姿态、互动主题索引，支持“在哪里可能遇到”“已知哪位 NPC 与此有关”。需根据玩家发现进度隐藏秘密触发条件；开发者调试页可查看完整索引。某个标签不直接等于任何 NPC 自动同意特定互动；必须通过身份、关系、年龄、状态与情境检查。
---
## 7. Storylet、EventGraph、战斗/失败后续
### 7.1 Storylet 小事件
字段至少为 id、hook、conditions、weight、priority、cooldownGroup、repeatPolicy、exclusiveGroup、contentTags、textKey/variant、actions、startEvent。统一由 Hook 收集 → 条件过滤 → 近期重复降权 → 稳定排序 → 以**该事件独立 RNG 流**抽取。无候选时安全返回空/日常场景，不报错。
### 7.2 EventGraph 长事件
EventDef 包含 startNode、节点集合、事件锁、参与者、tags、局部变量、暂停/返回位置及 exit paths。节点类型：narration、choice、resolve、combat、interaction、wait、exit。每个节点的可用选项在运行时由同一 Condition/Effect DSL 求值；效果只有事件节点进入或明确动作提交时执行，渲染/回退历史不执行。
- **事件栈**：支持暂时进入子事件并返回，不因打开地图或身体面板丢失当前节点。
- **分支选择**：允许汇合，但要保留真实代价/关系/信息差异；不能三个按钮只换形容词。
- **失败可持续**：普通战败进入 recoverable aftermath，支持逃离、求助、恢复、继续或另行进入长期结局；HP=0 不自动永久终局。
- **专属演出 / CG**：可以是多节点独特文本和未来的图像资源引用；资产缺失时保持可读文本，不因此丢失事件。
- 不同敌人/条件能够注册不同失败后续；事件的退出条件、跳过与重复入口都必须可检验。
### 7.3 四种「跳过/退出」不可混淆
1. **skipText**：只折叠或快进阅读已结算文本；**不额外推进时间、不重新提交效果**。
2. **skipRepeat**：已解锁的可重复内容走作者声明的 fastForwardPath；按固定摘要/代价结算一次。
3. **requestExit**：尝试从当前互动退出，读取 exitRules 的合法时机、代价和失败反馈；不等于立即成功。
4. **abortEvent**：明确允许放弃的任务/互动，走 cleanup + 结果/关系后续；仅在 EventDef 提供合法边时可用。
不能写出“skipTo 后面节点”就把未经过的选择和不可逆 TF 自动结算。未支持的退出动作不显示为可点击假按钮。
---
## 8. DSL、动作、状态与事务
### 8.1 类型安全、最小而扩展
建议 v0.2 第一批 Condition 原语：all、any、not、flag.has、[var.compare](http://var.compare)、time.window、entity.exists、npc.relationship、memory.hasFact、[location.is](http://location.is)、body.hasPart、body.hasCapability、slot.has、[slot.free](http://slot.free)、contact.exists、[pose.is](http://pose.is)、status.has、tf.stage、event.state、pref.content、rng.chance（仅在 resolve，不可在 UI 渲染中用）。
第一批 Effect 原语：var.change、flag.set、memory.addFact、inventory.add/remove、relationship.change、status.apply/clear、tf.enqueue/modify、body.patch、slot.fill/clear/replace、scene.enter/transition/exit、event.start/schedule/advance/exit、npc.overrideLocation、clock.advance、combat.resolve。effect 不允许调用任意用户代码。
**不要在第一版一次实现每种高级操作。** 为未实现 opcode 做明确版本能力声明，未支持时包导入报错，绝不能静默忽略。
### 8.2 统一 Intent
```json
{
  "intentId": "i_001",
  "actionId": "aetheria:action.travel.market",
  "params": {"routeId": "aetheria:route.street_market"},
  "expectedRevision": 142,
  "requestId": "ui-action-unique-001"
}
```
流程：validateIntent → check preconditions → calculate deterministic plan（不改状态）→ reserve resources and conflicts → atomic commit → log transactionId → derive selectors and raise hooks → deliver resolved text context。失败返回 reasonCode + required/actual，不扣资源，不变更事件。
**必须避免无限递归 Hook。** 每事务固定阶段、派生事件队列上限、重复触发防重 key；跨午夜账单/长期 TF 的结算须按边界推进且只结算一次。
### 8.3 持久状态划分
- meta：saveSchemaVersion、已安装包 ID/version/hash、revision、存档时间。
- clock/world：累计分钟、已知路线、天气、阵营/地区变量、地区实例。
- entities：玩家、核心 NPC、持久路人的事实/BodyGraph/可变数值/装备/状态/关系。
- tfQueues、eventInstances + activeEventStack、interactionScene、combatState、scheduledEvents。
- rngStreams：按事件实例/用途独立，已抽样结果写实例；不能因刷新或打开菜单变值。
- ledger：processed transaction IDs、已结算账单、一次性奖励标记、关键事实与日志。
- 玩家已读图鉴与“当前存档发现”分离；全局图鉴只能展示曾发现内容。
---
## 9. UI：先是游戏，再是资料工具
- **主游戏视图**：顶部地点、时间、紧迫状态；正文场景；底部当下可执行的分组行动；左右可收纳状态、地图、角色、背包、任务。
- **场景导向**：在 NPC 互动时显示对话、关系变化与当前活动；战斗时切换专用回合信息与意图；TF 时显示身体变化图/阶段、可能处理方式与已知结果。
- **检索页**：玩家可查 NPC、已知 TF、姿态与特殊玩法标签，但不泄露未发现隐藏剧情。内容包安装页、存档页和图鉴单独存在。
- 未开放功能不生成可点击按钮；锁定行为有具体原因。行动后展示统一变化摘要，不用浏览器 alert() 充当游戏 UI。
- 浏览器前进后退不重新结算；重复点击禁用或按 requestId 幂等。移动端单栏；场景选择不得因展开面板而丢失。
- 开发者视图可检查：当前事件节点、revision、事务、随机抽样、BodyGraph、ContactGraph、Hook 候选、校验错误；正式游玩默认隐藏。
---
## 10. AI 内容制作与实时文本
### 10.1 两种模式必须分开
**离线作者工作流**：读取 canon + schema + 风格基准 + 已有内容索引 → 提案 → 生成内容包 → pack-lint → 剧情/状态模拟测试 → 相似度检查 → 人工审核 → approved。**实时叙事**：只接收当前可见的局部上下文与已结算结果，返回限定文本，不增加长期事实。
### 10.2 模型可替换
Grok 目前是用户偏好的最终文字模型，但工程不能绑定。不同模型可担任创意、改稿、校验与局部叙事；API 网络/费用/政策变化不能损坏存档。模型断网使用已安装文本。API 密钥通过本地桥接服务或受保护的服务端配置提供，不打包进公开 HTML。
### 10.3 NarrativeRequest 契约
请求：sceneId、eventId/nodeId、stateRevision、已确认 actionResult、可见 ActorPose/ContactGraph、参与 NPC 卡、可见事实 ID、近期对话线程、contentStyle、allowedChoices。应过滤 NPC 不应知道的秘密，也不发送整个世界数据库。
响应：narrative、citedFactIds、usedActionIds、optionalTextVariants。所有选择必须引用允许的 actionId；不得生成自由 JS effect。文本中的“得到钱/新增肢体/关系确立”等事实必须能与已结算 delta 对齐。校验不通过：有限次数局部重试 → 固定回退文字，并输出调试错误码。
### 10.4 内容质量审核
- schema/reference/成年资格/姿态兼容等可程序检查；
- 叙事与角色记忆、先后事件的矛盾可做规则+模型辅助检查；
- 事件重复、角色同质化、机械套路需要 AI 初筛 + 真实试玩复核；
- **不能以“生成了 200 个事件”代替“内容有 200 个不同体验”**。
---
## 11. pack-lint 与开发者工具
导入时检查以下最小项，ERROR 阻止启用；WARNING 可保留但在报告中列出：
1. manifest/schema/version/namespace 唯一性与类型；
2. 必需依赖、循环依赖和扩展 Hook 的归属及可见性；
3. 交叉引用目标、弃用 ID 与 migration 映射；
4. Core/world 词表与标签来源，不允许随手编未知标签；
5. Condition / Effect opcode 存在及参数正确；
6. body patch 锚点存在、图连通、部件数量/互斥和能力依赖；
7. slot 容量、侧别、装备适配、剧情锁；
8. pose/contact 端点可用、资源占用冲突与 action 转换合法；
9. TF stage 边界、目标图和冲突处理、重复结算；
10. eventGraph 节点可达、退出路径、死循环、重复奖励；
11. storylet pool 触发时机、权重、冷却、空候选安全；
12. 账单/库存/金钱/奖励不会从渲染路径生效；
13. NPC 模板与成年智慧角色规则，缺数据阻止相关成人事件；
14. action 权限与 context 约束、角色信息可见性；
15. 文字占位变量、描述部位与真实 body/scene 字段映射；
16. 内容包之间重复 ID、冲突 contributions、冻结 ID 不可私改；
17. AI 返回 actionId、事实引用和格式校验；
18. 跳过/退出路径的后果和状态清理；
19. 存档缺包/降级隔离、迁移及恢复；
20. 玩家可到达地区至少存在合法离开/恢复路径。
报告至少输出 severity、code、packId、definitionId、JSON pointer、原因、修复建议；不要只报“无效”。
### 11.1 必须有的负例测试
- 换了尾部结构后旧装备无兼容开口；
- 玩家打开状态面板两次，绝不能重复扣钱/抽事件；
- 狼耳 TF 与猫耳 TF 并行竞争同一部位；
- 角色没有第三只手，却同时占用三只手的动作；
- 手被使用时发生结构变形并触发 defer/revalidate；
- 接触边不允许保持时，角色突然转身；
- 删除内容包后读取含该包部件的存档；
- 长事件中途暂停、保存、重载、恢复；
- 两个作者包的加载顺序相反，Hook 候选一致；
- 非法成人参与者或缺年龄信息的路人模板；
- 连点同一个领取奖励按钮；
- 重复事件 skip 不得再次结算一次性奖励；
- 多午夜穿越或 TF 分段边界不重复结算；
- 关键事件没有退出/恢复路径时导入被拒绝。
---
## 12. 实施顺序：优先验证端到端玩法
**M0 现状盘点（文档，不改代码）**：读取 Work 最新工程、原 v3.0、Claude v0.1、本 v0.2。做功能矩阵（真实完成/部分/硬编码/缺失）与迁移清单；不能假装已见最新源码。
**M1 可跑的纵向切片（优先）**：最小 Registry、Condition/Effect、动作事务、世界时钟、基础存档、一个人类 BodyGraph 模板 + 一个拓扑改造、一个 PoseScene、4–6 地点、1 核心成年 NPC、1 路人模板 + 持久化、Storylet + 一条完整 EventGraph、自由 TF 与剧情 TF、合法失败后续。重点是**从开局到退出事件、保存再读档全链路可玩**，不能只交 UI 和假按钮。
**M2 协议冻结**：用 M1 暴露出的真实问题补齐 v0.2 Schema、可枚举 opcode 与 pack-lint、测试 fixtures；确认才做版本化冻结。冻结后禁止为了某个 NPC 任意更改核心字段。
**M3 多 AI 内容包验收**：让 A 做一个 NPC+地区 TF/事件内容包，B 不修改 A 或 engine 文件，只通过 Hook 扩展 A 的 NPC 与地点；交换包加载顺序，已加载同组内容的输出一致、存档兼容；新增内容不改 UI 代码。
**M4 丰富内容与演出**：批量 NPC 事件、更多 TF、探索经济与战斗系统拓展、文本质量打磨、图鉴与标签索引、移动端界面。没有通过 M3 前不要一次生成几百段故事作为完成度。
### 每阶段交付标准
- 产物：代码、数据、schema、变更说明、测试命令及实际输出；
- 未完成：清楚列出，不可把未来按钮当作已实现；
- Gate：用自动测试 + 手动可复验流程说明通过与否；
- 不重写用户确认的世界观，不为应付测试乱造正史；
- 连续补丁出现新冲突时依确认的 v0.2 重建对应模块，而非无限包裹兼容逻辑。
---
## 13. 仍需和玩家确认（不要让 AI 替玩家拍板）
1. 自由塑形的开放范围：普通合法结构默认全开，还是以图鉴解锁为主？可以先做可配置测试，不锁产品方向。
2. 用户对姿态系统的粒度、一次场景的回合节奏与跳过规则有哪些优先玩法。
3. 核心 NPC/地图的权威数据版本：需要对照 Work 最新工程，明确哪些是用户确认、哪些是 Claude/Gemini 擅自添加。
4. 项目发布时存档与内容包文件的存储方案（纯离线单页还是本地桥接服务）。
5. UI 视觉风格和表现素材（图鉴插画、CG、美术形式）后置，但数据引用接口保留。
6. v0.2 **当前仍然是框架提案**，Claude 接手前先提交冲突清单及其推荐修改，不得声称已经开发完成。
## 14. 对 Claude v0.1 的迁移说明
- **保留**：命名空间、只读 Registry、统一事务、pack-lint、跨包追加、Storylet、状态效果、NPC 偏好与世界事实 ID、可重复检验 Gate。
- **替换**：SlotType 不再支配场景、日程、Hook 与文本；身体拓扑由 BodyGraph 掌握，槽只负责局部占用；姿势接触由 InteractionScene 管理。
- **修复**：core:nara 错误归属，迁入 aetheria 世界包；跳过规则从单一“无条件结算”调整为四种操作；玩家自由 TF 与剧情 TF 不再互斥；默认两只手不再是引擎硬规则。
- **新增**：正式的 schemaVersion/pack migration、全局与存档发现图鉴、AI 文本事实校验、跨 AI 作者内容质量检查、动态身体图的稳定拓扑约束。
- **不强行兼容**：旧 Demo 的硬编码 Passage、互相矛盾的器官布尔、只靠文字假装变化、孤立终局页面。保留可靠文字和设定即可。
**本页不等于用户对每项提案的最终确认。请优先验证身体图 + 姿势 + 事件 + 内容包的真实联通性，而非继续扩写说明书。**
<page url="https://app.notion.com/p/3f5498122a02817ca926c49672d75250">Claude 接续说明｜v0.1 → v0.2 迁移与 M0 开工指令</page>
<page url="https://app.notion.com/p/3f6498122a02810fabc8de0afb3cbab2">内容生产流水线 v0.1｜GPT 基础剧情 × 可选成人文本扩展</page>
</content>
</page>
