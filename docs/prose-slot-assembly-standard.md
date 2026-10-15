# 槽位模板、词条入槽与拼装校验规范

版本 1.0.0，2026-10-15。适用于九类矩阵及 A–E 协作任务。与旧稿“默认整段写死正文”的交付要求冲突时，以本规范为准。

这次已提供独立制作格式、离线拼装器与验收；游戏 `NarrativeNode.textKey`、文本包和存档尚未接入此格式。不能把下文的制作字段直接加到现有 ContentPack，严格 Schema 会拒绝。引擎接入需另行实现适配器、正文显示和存档契约。

## 一、交付必须包含什么

交付 `assembly-rules.json`、词条入槽数据、矩阵、整段回退 `prose`、拼装预览与正反例报告。默认正文载体是 `proseTemplate`，其中数组顺序就是最终句子顺序。整段 `prose` 只在拼装失败时使用，不能省略模板后宣称已经支持可组合正文。

每个矩阵 cell 仅以 `assemblyRuleId` 引用拼装规则，不内联 `proseTemplate`、`prose`、词池、定词规则或拼装限制。cell 仍可有来源、覆盖状态与任务前置；这些是业务条件，不是拼装规则。结构/词典审计项引用 `assembly.reference-only`，不伪造可玩的正文。

禁止按题材 × 地点 × 身体 × 材质 × 对手 × 动作做笛卡尔写作穷举。矩阵覆盖真实来源、明确规则职责及边界。多个对象共享规则，通过当前事实绑定与词池选择产生差异。测试中的有限布尔真值表不是写作任务，不导出成每格一篇正文。

## 二、冻结八类槽

| 槽名 | 职责 | 事实权威与禁止事项 |
| --- | --- | --- |
| place | 当前地点名称/空间短语 | 真实 location；题材名称不能证明地点设施 |
| propEnv | 道具、设施、环境对象 | 已绑定物件/环境；不凭词条创造量杯、墙面或装备 |
| bodyPart | 身体部位短语 | 绑定实体的实际部件实例；不可把 A 的部位写给 B |
| senseMod | 感官修饰短语 | 实际感官条件与在场对象；未知气味/声音不强填 |
| actionCore | 动作核心短语 | 已批准或已发生的真实动作；拼文字不执行行动或发奖励 |
| materialFluid | 材料、流体主名及挂前定词 | 材料/流体实例；不得混入器具、转化结果或偏好 |
| opponentForm | 当前对象称谓/形态短语 | 已绑定 NPC/居民/敌人；外形不证明智慧或意愿 |
| exitChoice | 免费退出的显示文字与真实 actionId | 使用当前可执行免费出口；文案不能新造动作 |

八类是类型集合，不要求每段八类全用。模板可重复用同类型，但每个出现位必须有唯一 `key`。不增加 clothing、kink、qualifier 等第九类槽；衣物是已确认物件时进入 propEnv，定词是 materialFluid 槽内部的 qualifier。

`place/opponentForm/actionCore/exitChoice` 是给人看的槽顺序简写。`parseSlotOrder` 只接受八种槽名，拒绝空段、未知名称和“手/爪/触手”式多选词。自然语言正文、文件路径和文字中的斜杠不参与这种拆分。正式稿必须展开成有序 token，不靠字符串猜槽。

## 三、模板字段（完整契约）

规则字段：`id`、`domain`、`mode`、`contentTier`、`fallbackTier`、`checks`、`proseTemplate`、`prose`。`mode=prose` 必须有非空模板与完整回退正文；`auditOnly` 只做覆盖账目，无正文。生产规则文件的 `runtimeIntegrated=false` 不能私自改为 true。

每个 token 含 `key / slot / poolId / bindTo / required / prefix / suffix`。`bindTo` 指向适配器提供的当前实例，不指向词条本身。`prefix`、`suffix` 只放必要连接文字和标点，不能夹带未校验的身体、对象或行动。可选槽无词时，连同其连接文字一起删除，防止留下“在，”“带着。”。

`sameAs` 可引用模板内另一个出现位，要求二者的 subject 与 instanceId 完全相同。`subjectAs` 只要求同一主体，适合检查部件属于已绑定人物，允许人物实例与部件实例不同。两者都不是按文字建立身体关系。不同对象间包含、持有等关系用事实条件表达，不能用 sameAs 冒充。

`prefixPools` 只允许出现在 materialFluid token，至多两组；每组有 `poolId / required / separator`。数组顺序就是定词顺序，连接符只能为空或“的”。完整可运行的八槽中性例子在 `production/tag-matrices/assembly-example.json`。

## 四、每条词条的完整入槽资料

词条必须声明以下字段，不能只交“词名 + Tag”：

- `id` 与 `text` 或 `displayRef`：稳定词条 ID；普通词用已审定 text，动态人物名/地名使用 `displayRef:{field:'name'}`，与 text 严格二选一。引用仅允许 core 的 opponentForm/place 槽，不新增姓名槽。
- `allowedSlots / poolIds`：可进槽及具体词池。未适配条目可保留空列表，不能因分类相近就自动开放全部槽。
- `priority`：−1000 至 1000 的整数；硬条件失败时，优先级再高也不入候选。
- `review / status`：approved/hold 与 active/inactive 分账；只有 approved + active 可入候选。
- `role`：core 或 qualifier。qualifier 仅供 materialFluid 内部挂前。
- `binding`：`{subject, instanceId}`，与 token 指向的当前绑定实例一致。
- `requires`：事实条件，包含 fact、comparison 与必要 value；支持 eq/gte/lte/exists。未知不通过。
- `excludes`：与本条不能同时选择的词条 ID；任一方向声明都生效。
- `exclusive`：`{group,value}` 列表。同一实体同一实例的同组异值冲突，跨对象可以并存。
- `contentTier / tagIds`：general/adult_optional 和登记引用；不能由普通槽偷偷混入其他分级。Tag 须已注册且 active。
- exitChoice 另有 `actionId`，文字和 ID 均须匹配当前已验证的免费出口。

不可把全部 13,786 条素材自动标 approved 或推成可入槽。原始批次与语义库保留，先由作者/审稿方提交入槽适配，再通过校验。原条目 ID 保留；当前实例绑定由引擎适配器根据快照提供。

动态名称从 `context.displayValues` 读取。每条记录完整声明 binding、name、revision、source；只认与词条 subject+instanceId 完全相同的唯一记录、同一 revision、snapshot/engine-query 来源。缺失、重复、过期、非法文字均不入候选；不借用 currentResidentId、不查询任意属性路径、不再次展开名字里的模板标记。示例中的“阿洛·灰谷”“工坊”只在测试快照中，换人物/地点记录即可换名。

人物 name 来自已保存的姓与名结构；正文拼装不重新取名或推断姓氏。姓名生成、文化顺序和子代继承的完整接口见 `docs/names-and-inheritance.md`，协作包包含该文与源码全文。出生玩法尚未实装，不得由命名接口宣称已有后代生成。

## 五、定词挂前

以一般的“过滤水”为例：core 是“水”，qualifier 是“过滤”，二者都绑定同一水实例；`water.filtered=true` 必须来自实际记录。结果按 `定词1 + 连接符 + 定词2 + 连接符 + 主名` 输出，不能输出“水过滤”，也不能把定词移到 bodyPart/opponentForm。

定词无合法候选且 required=false 时，仅输出主名；required=true 时整次拼装失败并回退。若主名缺失，定词不能独自留下。已经完整收录的“过滤水”也可作为 core 直接使用，但不能再挂同义定词形成“过滤过滤水”；此类重复由词池互斥/审稿拒绝。

材料、流体、器具、转化仍分别保留来源身份，不因为合成显示短语就注册一个新 Tag，也不执行 TF。黑胶、黏液、凝胶不自动视为同义。

## 六、拼装顺序与失败处理

1. 严格校验文件格式、规则 ID、冻结槽、词条资料和回退正文。
2. 取一个稳定快照：seed、revision、对象绑定、真实事实、当前免费退出。查询不改状态或游戏 RNG。
3. 先复核 T32/T34，再按槽名、词池、审核状态、实例、事实、登记 Tag 和分级过滤。
4. 候选按 priority 和 seed+entryId 的稳定次序选择。每槽至多 4 个候选，缺省最多 64 次搜索；格式上限为每槽 8 个、总计 128 次。
5. 有限惰性回溯检查双向 excludes、同实例 exclusive、sameAs、挂前定词与可选槽。禁止先生成全组合数组。
6. 输出之前再查 T32/T34、空槽、未填字段、制作标记、对象一致性和免费退出。
7. 缺必需词、条件未知、互斥无解、预算耗尽或最终正文不合法，都回退到规则的完整 general prose；不显示半句、斜杠候选或“暂无素材”。

输出是普通文字，显示端须按文本显示或转义，不能作为 HTML/脚本执行。拼装器不执行词条携带的代码；词条格式也没有代码或效果字段。

回退不能绕过分级：成人规则未过门控时只使用 general 回退，不用其成人正文。若连真实免费退出都没有提供，返回 blocked 给整合层修复，不能凭空创建按钮。输出 text 与 exitChoice 均属展示结果，不能扣物品、推进任务、修改关系或应用身体补丁。

## 七、T32 与 T34 复核

T32：保留实际存在的内容偏好开关；当次意愿收据须对应绑定主体及当前 revision，来源为 event-choice，且对象在场。性格、关系、倾向和词条不可替代。制作规范不新增年龄属性；现有引擎的资格门控仍由后续适配器复核，不能因本规范而删除。

T34：普通动物、智慧类人和未知对象分开。外形与种族名称不能推定智慧。普通动物可以出现在普通非色情探索/战斗，不能进入成人可选互动；未知分类同样拒绝。这里提供的是资格与排除检查，不是性行为文案或人兽内容组合制作许可。

T32/T34 在选词前和最终拼装后都检查。正文回退、同义词、另一个词池和换 actor 均不能绕过。

## 八、九类协作如何交差

每类交：矩阵及 assemblyRuleId 引用、独立规则文件的新增/修改规则、词条适配资料、完整 general prose 回退、正常拼装预览与失败回退报告。不要求每个组合写一篇长文。跨类复用同一规则，确有语法/职责变化才新增规则，不以角色姓名复制规则。

必须验证：八槽合法、斜杠顺序、错槽、未审定、未知 Tag、不同对象部件串线、事实未知、双方互斥、定词方向/缺失/孤立、可选槽标点、预算耗尽、同 seed 稳定/换 seed 多样、T32/T34、退出资格、失败整段回退及原状态不变。不能只展示成功拼装一次就验收。

离线验收：`node --test tests/prose-assembly.test.mjs`。九类完整包：先 `node scripts/build-tag-matrices.mjs`，再 `node --test tests/tag-matrices.test.mjs tests/prose-assembly.test.mjs`。
