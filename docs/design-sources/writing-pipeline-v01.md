# ✍️ 内容生产流水线 v0.1｜GPT 基础剧情 × 可选成人文本扩展

来源：https://app.notion.com/p/3f6498122a02810fabc8de0afb3cbab2?pvs=204

Here is the result of "fetch" for the Page with URL https://app.notion.com/p/3f6498122a02810fabc8de0afb3cbab2 as of 2026-10-11T04:12:50.341Z:
<page url="https://app.notion.com/p/3f6498122a02810fabc8de0afb3cbab2" icon="✍️">
<ancestor-path>
<parent-page url="https://app.notion.com/p/3f5498122a0281a48989f06a23e7ecad" title="以太都市：深渊重塑｜架构修订 v0.2（BodyGraph × 内容包）"/>
<ancestor-2-page url="https://app.notion.com/p/3e3498122a0281a08375ebf2e9f0d0f7" title="游戏"/>
<ancestor-3-page url="https://app.notion.com/p/3e5498122a0280cfa6d4fd4c2f83d3ba" title="工作台"/>
</ancestor-path>
<properties>
{"title":"内容生产流水线 v0.1｜GPT 基础剧情 × 可选成人文本扩展"}
</properties>
<iconMetadata>{"type":"emoji","emoji":"✍️"}</iconMetadata>
<content>
> 版本：v0.1（2026-10-11）｜状态：**PROPOSED 内容生产协议候选稿**。配合 <mention-page url="https://app.notion.com/p/3f5498122a0281a48989f06a23e7ecad">以太都市：深渊重塑｜架构修订 v0.2（BodyGraph × 内容包）</mention-page> 使用。
>
> **目标：GPT 负责绝大多数正式游戏剧情与对白；其他写作模型根据 GPT 输出的独立任务卡，补充指定的成人向可选文本。** 任何写作模型不得擅自改动角色正史、游戏条件、动作、身体结构或结算结果。
<table_of_contents/>
## 0. 最重要的设计原则
不能把游戏剧本写完后简单插入“此处交由另一个 AI 续写”。那样遇到动态 NPC、TF、多姿态、多分支事件时无法准确定位内容，也无法验证文本是否与游戏状态一致。
要分开四层：
1. **规则层**：谁能执行哪些动作；身体图、关系、任务、背包、RNG、时间、战斗和失败后续由 Engine 执行。
2. **剧情层**：EventGraph/Storylet 的节点、选项、条件、分支、退出和回归。
3. **基础文本层**：GPT 完成所有普通文本、台词、环境、TF 感知、NPC 反应、非露骨的剧情转场。基础文本可独立游玩。
4. **可选文本扩展层**：外部模型仅给已经登记的 textSlotId 填不同版本的文本；扩展包不替代规则层。
**无扩展包不应露出 TODO 或空白按钮。** 每个槽必须预置正式的非露骨 fallback，使整条事件能正常完成。
## 1. 内容生产的角色分工
<table header-row="true">
<tr>
<td>参与方</td>
<td>负责</td>
<td>不能擅自做</td>
</tr>
<tr>
<td>GPT 主编剧</td>
<td>世界资料对齐；地图氛围、NPC 个性与对话、普通事件、主/支线、战斗、战败非露骨后续、TF 描述和系统间反应；可选桥段任务卡</td>
<td>不把建议冒充正史；不把系统动作写成纯文字假变化</td>
</tr>
<tr>
<td>Work 开发</td>
<td>内容包接口、TextSlot、节点分级、条件与事务、姿势接触、存档兼容、校验与 UI</td>
<td>不为每个 NPC 单独硬写一套事件处理</td>
</tr>
<tr>
<td>外部文本作者/模型</td>
<td>严格按任务卡填指定文本槽，遵守人物、剧情、状态与篇幅</td>
<td>不改 EventGraph、effect、数值、年龄、长期关系、永久 TF 或动作</td>
</tr>
<tr>
<td>GPT 审稿</td>
<td>校验交接数据、变量、事实、角色语气与前后衔接；输出报告</td>
<td>不让不可信文案直接影响状态结算</td>
</tr>
<tr>
<td>用户</td>
<td>审定正史、体验、角色路线与最终质量</td>
<td>不必手动排查所有机器可发现的 ID 错误</td>
</tr>
</table>
成人向互动仅针对符合规则的成年智慧角色，并依其参与资格、内容开关、交互条件与边界判断。不能通过删除年龄验证绕过内容层。战败可单独有败北、拘束、恢复或长期影响，但**战败不自动等于亲密行为获得许可**。
## 2. 三个独立包：基础故事、任务卡、可选文本
- **aetheria-world**：所有玩家都需要的主世界包。含 World/Canon/NPC/TF/Storylet/EventGraph、普通文本、CG 资源键和 TextSlotDef。离线不接任何 AI 也能正常玩。
- **aetheria-author-briefs**：只供作者读的制作资料，不装载进玩家存档。记录每个 slot 的任务卡、角色口吻示例、剧情事实、质量要求、测试场景与分工。
- **author-adult-texts**：其他 AI/作者提交的可选内容包，仅追加 TextVariant 或演出素材引用，通过已经注册的槽覆盖某段表现；不能覆盖原始事件定义。
主要目录建议：
```plain text
content/
  aetheria-world/
    manifest.json
    canon/facts.json
    npcs/
    storylets/
    events/
    tf/
    text/general.zh-CN.json
    text-slots/optional-slots.json
  author-adult-texts/
    manifest.json
    contributions/text-variants.json
    text/zh-CN.json
production/
  briefs/
  style-guides/
  review-reports/
```
通用名字空间和版本必须稳定。游戏状态记录基础世界包与扩展包的版本/哈希，但单纯更新文字不应因此破坏角色状态。内容包缺失时退回 fallback，正常场景不能发生状态重算。
## 3. 文本槽 TextSlotDef 的契约
**TextSlotDef 不是留一块空白；它是 EventGraph 某个节点允许替换哪段正文的声明。**
最少包含：
- **slotId**：全局唯一、稳定。示例 aetheria:text.velvet.private_talk.transition_01；
- **owner**：eventId、nodeId、branchId；此槽处于哪条事件分支；
- **contentTier**：general / mature_fade / adult_optional；分级按节点而非全局强制关闭整条普通任务；
- **fallbackTextKey**：正式的非露骨正文键，外部内容缺失/关闭时使用；
- **participants**：谁参与，必须经 Engine 的资格与信息可见性判定；
- **allowedVariables**：允许哪些玩家姓名/身体特征/NPC 称呼插值；
- **requiredFacts / sceneRequirements**：进入节点时已经明确为真的身体、关系、姿态、地点事实；
- **stateContract**：这个节点入场和离场的状态不变量；允许描写发生过的结果，但不允许在文章里再次结算；
- **nextNodeId、exit/skip**：槽结束后由 EventGraph 决定转移；skipText 仅跳过文本而非新增效果；
- **priority 与审核状态**：多人扩展如何避免重复/冲突；只加载通过校验的条目。
声明示例（只是协议草图，最终字段名由可运行 Schema 冻结）：
```json
{
  "id": "aetheria:text.velvet.private_talk.transition_01",
  "owner": {
    "eventId": "aetheria:event.velvet.private_talk",
    "nodeId": "transition_01"
  },
  "contentTier": "adult_optional",
  "fallbackTextKey": "aetheria:txt.velvet.private_talk.fade",
  "participants": ["player", "aetheria:npc.velvet"],
  "allowedVariables": ["player.name", "npc.displayName"],
  "requiredFacts": ["aetheria:fact.velvet.private_talk_agreed"],
  "allowedReplacement": "prose_only",
  "nextNodeId": "after_talk",
  "skipMode": "skipText"
}
```
这些人物、地点、剧情和事实键只作例子，不能自动变成官方正史。导入工具必须验证引用是否存在。
**特别说明**：若另一个作者认为需要新的互动动作、专属路线、额外分支，不得只靠替换文字虚构它已发生。应该单独交 mechanicProposal（所需 actionId、conditions、effects、事件节点与 UI 入口），由规则作者审核后实现。
## 4. WritingBrief：交给其他 AI 的逐槽任务卡
不能只写“请写这位 NPC 的成人剧情”。每一个任务卡都要告诉作者**在哪里、为什么、是谁、当前有什么身体、已经发生什么、接下来要发生什么**。
必填字段：
1. briefId、targetSlotId、eventId/nodeId、版本和负责作者。
2. 入场条件：地区/时间、人物关系、事件阶段、场景发生原因，已发生的决定性事实。
3. 参与角色：稳定 ID、成年条件已通过、个性、职业、目标、对玩家已知的信息、角色讲话风格。
4. 当前玩家身体：可断言的部件/数量/材质，已发生的 TF、义体、服装、状态；没有条件保证时不得默认人类两臂两足。
5. InteractionScene：角色相对位置、朝向、姿势、可用身体锚点、占用资源、现有 ContactGraph；未建立的接触不能在文字中假装存在。
6. **叙事功能**：表现信任变化、回顾旧经历、展示人物私人一面、推进关系、情绪转折、进入下一事件等。
7. **叙事节拍**：用非露骨语言逐条说明必须承接哪些对话、允许的互动氛围、何时转向后续。
8. 文风：叙事人称、角色话术样例、篇幅范围、可自由发挥的部分与明确的禁用写法。
9. 只允许用哪些动态变量和事实 ID，禁止作者自行创造哪些内容。
10. 结束条件：后续 event/node、可用选择、合法退出/跳过；不能改变既定结果。
11. JSON 输出样式、质量自查要求、fallback 的位置。
示例 WritingBrief（非露骨、供后续填词使用）：
```json
{
  "briefId": "aetheria:brief.velvet.private_talk.transition_01",
  "targetSlotId": "aetheria:text.velvet.private_talk.transition_01",
  "task": "依据本卡补充指定节点的可选成人向文本表现",
  "context": {
    "locationId": "aetheria:location.clinic_private_room",
    "before": "双方已进行私人谈话，并明确愿意继续相处",
    "after": "回到日常对话，进入 after_talk 节点"
  },
  "npc": {
    "id": "aetheria:npc.velvet",
    "voiceGuide": "平时克制，重视职业分寸；熟悉后表现更自然"
  },
  "requiredBeats": [
    "承接刚才的对话，而非重写前情",
    "表现角色特有的回应和态度",
    "遵守当前身体、姿态和已经发生的事实",
    "自然转向下一节点，不产生额外永久后果"
  ],
  "conditionalNotes": [
    "仅当玩家确有尾部时，才可引用尾部相关描写",
    "不得默认玩家必定为普通人形"
  ],
  "forbidInventing": [
    "身体永久变异",
    "未登记的道具或奖励",
    "新的剧情分支",
    "关系阶段自动跨越",
    "人物不可能知道的秘密"
  ],
  "allowedVariables": ["player.name", "npc.displayName"],
  "lengthChineseChars": {"min": 350, "max": 800},
  "outputTextKey": "author:txt.velvet.private_talk.transition_01"
}
```
## 5. 外部作者只能按这个格式交付
**输出为可导入 JSON，不是聊天里的整篇故事。** 每个槽的结构至少为：
```json
{
  "briefId": "aetheria:brief.velvet.private_talk.transition_01",
  "slotId": "aetheria:text.velvet.private_talk.transition_01",
  "textKey": "author:txt.velvet.private_talk.transition_01",
  "locale": "zh-CN",
  "text": "【提交指定文本】",
  "usedVariables": ["npc.displayName"],
  "usedFactIds": ["aetheria:fact.velvet.private_talk_agreed"],
  "proposedRuleChanges": [],
  "reviewStatus": "draft"
}
```
### 5.1 可交给外部文本模型的通用指令
```plain text
你是《以太都市：深渊重塑》的可选文本扩展作者。

请读取随附的 WritingBrief、角色风格样本及允许引用的世界事实，为指定 textSlotId 填写唯一对应的文本，并按指定 JSON 格式返回。

你的工作仅限叙事表达。不可重写事件节点、动作 ID、奖励、人物年龄、已有关系、装备、永久身体变化和任务状态；不能用文本宣称发生了引擎未执行的效果。

要尊重角色独特的说话方式、上个节点的对话、当前身体与姿态事实、已建立接触关系，以及接下来的事件分支。对身体结构不明的部分使用安全的通用描写，不得默认每位角色都是标准人形。

需要新的玩法动作或状态变化时，请在 issues/mechanicProposal 中提出需求，不要直接写入正文。

如果任务卡出现事实冲突、缺少必要锚点、无法得知该角色是否符合参与条件，请报告问题，不要擅自补造设定。

最后返回：textVariant JSON、usedFactIds、usedVariables、issues（如有）、selfCheck。不要输出任何可执行脚本。
```
## 6. GPT 普通内容先怎么填
按照**角色/事件链为单位**生产，不要漫无目标地一次生成几百个分散片段：
1. 写 ContentOutline：本条任务/人物线的作用、入口条件、节点图、至少两个会留下不同后续的选择、退出条件。
2. 审核 canon：把 CONFIRMED 与 PROPOSED 的世界信息分开；先修矛盾。
3. 写 EventGraph/Storylet 数据：条件和 effect 交给 DSL，不在文本里直接发钱或变形。
4. 写完整普通剧情与角色台词：环境、NPC 性格、TF 各阶段变化与生活反应、战斗/失败非露骨后续、关系发展、第二天再见面的变化。
5. 登记待补 TextSlotDef，并写正式的淡出/转场 fallback；避免可选内容包缺失时剧情断档。
6. 自动生成对应 WritingBrief；不得让外部模型只凭 NPC 名字和几句标签推测整个世界。
7. pack-lint + 模拟多种 body/关系/时间状态 + 用户试玩，再决定放大批次。
### 6.1 可交给 GPT 内容作者的统一指令
```plain text
你负责《以太都市：深渊重塑》基础世界内容包的创作。

先读取最新世界正史、游戏架构 v0.2、已经实现的内容 Schema、NPC 索引、事件图与词表。先写事件大纲和规则所需条件、后果，再生成正式中文正文，避免文本与状态不一致。

请完成非露骨但可直接进入正式游戏的剧情、NPC 台词、环境和身体变化反馈。任何可选成人桥段都必须拥有合法 TextSlotDef、完整 fallback 和独立 WritingBrief，交付给后续文本扩展作者。

不要虚构新的永久状态；不能让没有对应 BodyGraph/InteractionScene 数据的文字冒充真实系统。NPC 的个性、已知事实和记忆要前后一致；普通路人依条件标签生成，不要都写成一样的口气。

每批交付：ContentOutline、可导入内容包、TextSlot 索引、WritingBrief、pack-lint 报告和仍需确认的事实。一个模块缺少引擎能力时，用明确的技术需求单指出，而不是新增硬编码特殊处理。
```
## 7. DoL 风格文字组合，不能硬拼随机词条
推荐分成：
- **剧情主干**：描述事件的实际转折，至少是一句完整可读的文本；
- **身体条件变体**：机械义体、兽耳、尾巴、黑胶覆盖、额外肢体等；只在确定存在时出现；
- **NPC 语气变体**：核心人物个人风格；路人按职业、性格及生活背景组合；
- **情境变体**：时段、地点、天气、职业、关系阶段、之前发生过的事情；
- **特殊整段分支**：当差异影响行为和后续时写独立 EventGraph，而不是仅换几个形容词。
**例子**：机械尾可以解锁机器维护谈话；没有尾巴则不能引用相关动作。薇尔维特对完成委托的玩家应有所记忆；刚认识不能引用尚未发生的亲密经历。跨天重逢可以使用新的开场话题。多变量冲突时必须有稳定优先级和通用 fallback，防止拼出来的句子语法不通。
## 8. 内容类型与写作任务卡的不同要求
<table header-row="true">
<tr>
<td>类型</td>
<td>GPT 应完成</td>
<td>必须固定的机械契约</td>
</tr>
<tr>
<td>城市地点</td>
<td>昼夜变化、环境、地区文化、职业和危险气氛</td>
<td>地点 ID、时段、路线与地区事件 Hook</td>
</tr>
<tr>
<td>固定 NPC</td>
<td>性格语气、日常交流、任务、关系发展和旧事回应</td>
<td>关系阶段、事实记忆、事件解锁、成年身份</td>
</tr>
<tr>
<td>动态路人</td>
<td>职业/性格/外观分层的短文本变体</td>
<td>标签范围、生成权重、持久实例 ID</td>
</tr>
<tr>
<td>TF</td>
<td>前兆→发生→适应→后续反应和物品适配</td>
<td>BodyGraphPatch、队列与冲突规则</td>
</tr>
<tr>
<td>战斗及战败</td>
<td>攻击意图、受击反馈、败北后续与可恢复路径</td>
<td>combatResult、aftermathEventId、退出规则</td>
</tr>
<tr>
<td>私人互动</td>
<td>关系、沟通、剧情转场、非露骨文本与任务卡</td>
<td>成年资格、人物意愿、姿态/接触、退出、文本槽</td>
</tr>
<tr>
<td>CG 与演出</td>
<td>资源缺失时的正式文字回退</td>
<td>assetKey、条件变体和不重复结算</td>
</tr>
</table>
## 9. 验收：文本替换不能改变玩法规则
**机器层**：任务卡与 textSlotId 一一匹配；键唯一；允许变量可解析；facts 存在；扩展包依赖、内容分级、事件节点存在；未授权字段/规则修改被拒绝。
**叙事层**：没有越界知识、违背人物性格、凭空出现肢体或装备、提前发生 TF；角色间说话不全是同一种模板。事件要真正因世界条件和选择产生差异。
**游戏层**：同一存档在无扩展包、安装并启用、安装但禁用、删除/升级扩展包四种状态下，**经济、身体图、NPC 关系、事件节点、奖励和存档结果完全一致**；可变的只有获得许可的表现文本与素材。skipText 不触发新的 effect。
**不能**把“写了 200 个事件”视作完成；必须检查实际差异化体验和后续。
## 10. Work 的先决实现任务（现在仍然是待做）
当前 Alpha 0.1.3.1 既没有完整的战败、攻略 NPC 或互动场景系统，成人标签事件加载也还未打通。因此要先实现：
1. TextSlotDef / TextVariant / fallback / pack contribution 的 Schema、Registry 和 UI 渲染选择；
2. 节点级分级与成年参与资格、安全的内容偏好过滤；不可直接删除加载器里的年龄拒绝检查；
3. 关键 NPC 的长期关系阶段、偏好与边界；路人动态生成与持久记忆；
4. InteractionScene 的人物相对位置、姿态、接触、占用与退出；与 BodyGraph 联动；
5. 真实 Storylet/多节点 EventGraph/败北后续；可合法退出，不是一个 UI 说明页；
6. XP/互动索引页只展示已经发现的合法内容，隐藏特殊触发信息；
7. pack-lint 校验文本包、变量、版本和非法修改；存档缺包时回退而不删数据。
**第一轮验证包只需要三个端到端内容例子：**
- 一个核心 NPC 的多节点关系事件；
- 一条可恢复的战败后续；
- 一条带 TF 条件、姿态与可选文本槽的互动事件。
每条都要有完整基础文案、2–4 个动态变体和 1–3 张待补写任务卡。模拟安装一个只有中性文字的作者扩展包验证兼容性后，再正式扩大创作数量。
## 11. 生产状态与三条最终 Gate
条目状态建议：outlined → base_written → linked_to_engine → brief_ready → external_draft → reviewed → lint_passed → playtested → approved。
1. **即使永远没有外部成人文本包，基础世界与人物路线也应该完整可玩。**
2. **外部作者拿到一张任务卡，能定位精确场景，知道怎么衔接、哪些状态不能碰、交到哪个文件，而不必重新读整个项目。**
3. **插拔文字包不能改变角色关系、身体、战斗、事件后续与存档，只改变被授权的表现内容。**
以上是内容协议候选，不代表对应引擎功能已经实现。
</content>
</page>
