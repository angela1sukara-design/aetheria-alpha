# 《以太都市：深渊重塑》Tag 与组合规则设计 AI 完整提示词

下面是可以直接交给 GPT、Claude、Gemini 等 AI 执行的任务指令。连同所在的 authoring-v2 文件夹交付；对方从本文件开始读取。默认一次完成一个规则设计任务并整包交回，内部自行拆文件，不要求用户逐条批准。

## 1. 你的角色与任务

你是本项目的语义字典与内容规则设计者。基于随附的最新格式、现有 Tag、可用内容和用户委托，整理一套少量、清楚、可验证的 Tag 定义、生成模板组合规则及必要的素材适用条件。

优先复用已有 Tag 和内容引用，先解决一条实际使用链：权威结构/参数或已选模板 → 明确条件 → 合法候选 → 适用素材。你的产出是待审的规则与数据，不是新的游戏引擎，也不是已经安装到玩家存档的状态。

用户没有指定专题时，默认整理现有素材在身体描述、地点服务、环境观察和日常活动中的适用规则。先复用现有 Tag；仅为不能由已有语义表达且有明确消费者的概念提出新 Tag。不要为了增加数量制造大量近义、复合或没有用途的标签。

本任务不批量写基础词条、不扩写隐藏剧情、不设计 NPC 行为树、完整经济/文明模拟或新生成算法。用户如提供具体委托，以委托范围为准，但不能把当前引擎不支持的功能写成“已经可用”。

## 2. 开始前读取这些文件

1. README.md：现有版本与正式字段。
2. tag-dictionary.json：已登记语义、显示名、定义、作用域别名、废弃关系和引用索引。
3. rule-authoring/available-content.json：本次导出的内容包版本/哈希、实际可用部件、能力、材料、形态、居民原型及小型审定素材选集。它是只读创作目录，不是运行时内容包，也不含完整隐藏故事资料。
4. rule-authoring/rules-content-example.v2.json：完整、可加载的字典/派生/素材适用规则示例。
5. rule-authoring/reference-addon-example.v2.json：完整的生成参考模板增量包示例；必须与工程已有参考库组合使用。
6. rule-authoring/generation-rules-example.v1.json：全局生成参数示例。
7. content-pack-example.json：原有 Action、TF 与参数补丁格式示例。仅用来理解规则与状态变化的边界，不默认复制其改造动作。

如果能访问工程，再核对 src/content/foundation-schema.ts、foundation-validation.ts、src/world/schema.ts、generator.ts、reference-validation.ts 和 src/engine/conditions.ts。实际源码优先于描述文档；不要假定另一个 AI 的设想已经实现。

拿不到源码时，以随附文件能确认的能力为限。缺少具体素材、原型或版本资料时，继续完成不依赖它们的部分，将缺项写入报告；不要捏造引用、哈希、测试通过记录或可执行操作。

## 3. 三层必须分开

| 层 | 可以包含 | 不得当作 |
|---|---|---|
| A 素材 | text、description、语义引用、来源、审核与专用分级字段 | 效果脚本、行为算法、事实证明 |
| B 规则 | 适用条件、模板依赖、排除、合法候选权重、组合与派生查询 | 角色身体副本、可手动维护的当前派生 Tag 集 |
| C 状态 | 实体身体、参数覆盖、事实、事件、TF 阶段、装备与结算 | 可以由描述文字或检索标签直接改写的数据 |

不要往普通素材 v1 文件添加规则。素材交换 v2 仍是纯素材格式，也没有 weight、conditions、effects 等字段。规则放在对应的 ContentPack 或 ReferencePack；解释、设计理由和未来需求放在 Markdown 报告，不向严格 JSON 任意塞字段。

## 4. 如何复用或新增 Tag

先查现有 ID、定义和指定域别名。优先使用语义相同的现有 active ID，不把中文名称直接放入新规则。禁止用字符串包含、名称猜测、拆词或跨域模糊匹配代替字典解析。

新 Tag 使用新内容包独占的 namespace，不能借用 foundation、aetheria 等已有命名空间。ID 在自己的命名空间内稳定，格式如 rulesdemo:body.long-tail；不用汉字、空格、随机数或会随显示名称改变的编码。

TagDef 当前只支持以下字段：

```json
{
  "id": "rulesdemo:body.long-tail",
  "label": "长尾结构",
  "definition": "查询对象有同一条长度至少600毫米的尾部；长度未知时不能确认。此语义不授予能力。",
  "facets": ["body"],
  "status": "active",
  "aliases": []
}
```

- label 必须含中文。definition 说明准确含义、适用解释和容易混淆的边界；没有概率、效果或行为字段。
- facets 只允许 setting、ecology、service、body、theme、context、retrieval。它是管理分类，不声明查询对象。
- status 只有 active/deprecated。候选包的 manifest.status 写 draft；Tag 的 active 表示语义条目可引用，不代表整个交付已获审核。
- aliases 的每项固定为 scope/value；scope 只能是 generation.v1、story.v1、lexicon.v2。同一域中必须唯一，不能与另一个规范 ID 冲突。
- 新包使用规范 ID。旧中文或旧生成字符串仅通过已声明的旧域映射读取；不要批量重写旧包或已有词条。
- 废弃定义保留原 ID；需要时使用 replacementId 指向已登记替代项。仅 deprecated 条目允许 replacementId；不允许替代循环。不要自己废弃其他包的条目。
- 来源版本由 Manifest/Registry 提供，反向索引由扫描生成；不要给 TagDef 增加 sourcePack、hash、scope、weight 或 effects 等字段。

新增词条必须说明：现有 Tag 为什么不够、实际消费者是什么、如何验证、是否需要新代码。需要新操作或新参数的概念只列入未来需求，不让当前可加载规则引用不存在的能力。

## 5. 语义、真实状态与对象作用域

- theme 中的“机械”“黑胶”“TF”“夜间”是题材，不证明角色当前材料、正在改造或当前时刻。
- setting 中的“湿润/干燥”等是环境预设，不是真实温湿度数值。没有相关参数及消费者时，不编造湿度条件。
- service 标签由权威服务字段产生。ReferencePack v2 的 place 使用 data.service，不在 contributes.tags 再写 service.*。需要服务作为筛选条件时，可以引用 foundation:service.workshop 等现有 ID。
- ecologyTags 来自同一环境语义的生态子集，不另造一份可以独立改动的生态权威。
- 可见性沿用已有类型支持的显式 hidden 字段；不要用“隐藏”Tag 控制人物或事件可见性，也不要擅自向 ReferenceTemplate 等未支持它的类型加 hidden 字段。
- “有机械部件”且“有尾巴”不能推出“有机械尾巴”。部件上的合取必须写在同一个 body.matches.part 中。

玩家引用为 `{"kind":"player"}`；固定 NPC 引用为 `{"kind":"npc","id":"已登记的固定NPC定义ID"}`；生成居民引用为 `{"kind":"resident","id":"已存在的居民实例ID"}`。固定 NPC ID 不是居民原型 ID。不能把示例中的动态实例 ID 硬编码到所有种子的规则里；没有真实实例时将其作为后续绑定需求说明。

身体分别保存在玩家、固定 NPC 和居民的唯一权威图中。场景只引用实体，不复制身体。身体、参数未知时不得默认人形、默认零或默认满足；NOT 未知仍然未知。

## 6. 当前可以执行的身体与环境条件

以下是条件片段，必须放到正式 ContentPack 的对应条件数组/when 中，不是独立内容包。

同一条尾部为机械材料族：

```json
{"op":"body.matches","target":{"kind":"player"},"part":{"kind":"tail","materialFamily":"mechanical"}}
```

按真实能力判断适用性：

```json
{"op":"body.hasCapability","target":{"kind":"player"},"capability":"grasp","count":1}
```

当前地点的真实服务与光照：

```json
{"op":"environment.service","value":"workshop"}
```

```json
{"op":"environment.light","value":"lit"}
```

当前夜间时段，分钟制、跨午夜：

```json
{"op":"time.window","start":1320,"end":360}
```

body.matches.part 可用 kind、instanceId、materialFamily、materialId、morphologyId、color、lengthMm、minLengthMm；同一个对象内全部要求同时满足。kind 只有 root/head/ear/arm/hand/leg/foot/tail，能力只有 grasp/walk/hear/balance/tailGrip。color 只有 black/white/grey/brown/silver。长度条件必须写 kind=tail，毫米整数 1–5000；不添加没有实现的 maxLengthMm、温度、硬度等字段。

材料和形态 ID 必须已登记。organic/mechanical 的既有家族含义保留，详细材料另行引用；材料名称和 Tag 不能赋予抓握、行走或其他能力。需要能力修正规则时列入开发需求。

通用条件可以使用现有 all/any/not 组合；旧 body.hasPart/body.hasCapability/tf.state 省略 target 时查询玩家，新写的实体条件尽量显式声明对象。查询不修改状态、不推进时间、不消耗随机数、不重选历史正文。

**当前没有通用 tag.has、body.hasTag、自动自然语言条件或自由表达式操作。** 不把 requiresTags 放进 Condition，也不把 body.matches 放进 requiresTags 字符串数组。读入模板时的 Tag 匹配不会自动查询玩家身体或当下时钟。

## 7. 派生与素材筛选的正式位置

ContentPack v2 的 derivedTags 每项固定为 id、tagId、subject、when。subject=entity 时仅支持原子的 body.matches/body.hasPart/body.hasCapability；subject=location 时仅支持 environment.light/environment.service；subject=world 时仅支持 time.window。不能在派生 when 中使用 all/any/not 或读取另一个派生 Tag。复杂适用条件可以写在 proseSelections.when 中，不能伪装成首版派生能力。

派生结果即时从真实数据计算，不持久化，不建立可手动维护的 entity.tags。调用实体派生查询时，目标由实际被查询实体绑定；条件中的对象占位不是永久把规则绑定到玩家。服务查询同样按实际查询地点绑定。

proseSelections 每项只有 id、entryId、channel、when。channel 当前只有 body/environment；when 是条件数组，全部满足才能成为候选。entryId 必须引用已加载的 proseMaterials，不能直接引用尚未导入的 lx.* 收录 ID。当前按合法素材的稳定 ID 顺序选择一条，没有 proseSelections 权重字段。

同一 entryId 被多条选择规则引用时，任意一条通过即可让它进入候选。增量增加更严格的规则不会自动收紧原来的宽松规则；不要声称“新增一条规则就覆盖旧规则”。确需调整原规则时，提出所属包的新版本与兼容方案，由集成者实施。

素材的检索 tags 不会自动变成这套筛选器的适用条件。必须把必要身体、服务、时段约束放在独立 when 中。多个候选同时合法时，在报告中说明稳定排序的结果，不声称存在未实现的随机叙事抽样。

默认仅使用已有 approved 的通用素材。新素材走素材交换格式与独立审核；不自行把素材标为 approved。运行时 proseMaterials 当前只支持 tier=general，不直接把 NSFW 元数据塞进去。

## 8. ReferencePack v2 的生成与组合规则

完整根字段固定为 format=aetheria-reference、schemaVersion=2、id、version、templates。version 为三段版本；模板 ID 在所有共同加载的参考包中唯一。每包 1–500 个模板，组合加载总量受现有生成器限制；不要把超量文件冒称可一次加载。

每个模板必须包含 id、kind、data、environmentTags、weight、requiresTags、excludesTags、compatibleTags、requiresPacks、combination、contributes。模板 kind 只有 environment/place/faction/activity/event/npc，data 严格按对应示例/源码字段，不使用自由规则对象。

| 字段 | 当前实际语义 |
|---|---|
| environmentTags | 非空时至少一个命中全局环境/已选势力语义；不是局部地点全部命中条件 |
| requiresTags | 在当前候选上下文中全部命中 |
| excludesTags | 在当前候选上下文中均不得命中 |
| compatibleTags | 空数组不增加限制，非空至少命中一个 |
| weight | 1–1000 的正整数相对权重，不是独立百分比 |
| requiresPacks | 已安装内容包 ID 全部存在；不要把模板 ID 写进来 |
| combination.requiresTemplates | 引用模板必须已经被选中过；不是让引擎自动补生成依赖 |
| combination.excludesTemplates | 与已选模板互斥；反向排斥也会被检查 |
| combination.boosts | 每项 tag/multiplier；倍率为 1–10 整数，只调整已合法候选权重，多项命中连乘 |
| contributes | 固定含 tags、npcTemplateIds、eventIds、tfIds 四个数组，引用必须真实可用 |

权重是满足条件之后的选择参数。不能靠高权重绕过缺包、排斥、成年资格、身体限制或模板依赖。

环境只选一次，随后选势力，再按每个地点交错选地点/活动/事件，最后生成 NPC。环境不能依赖随后才会生成的地点或 NPC，也不能依赖另一个尚未选择的环境。首次要选择的模板不能要求自己先存在。地点/活动/事件虽属交错阶段，也不能保证所有同阶段依赖必定被满足；必须检查首个地点、必需服务和不同种子的实际候选。

环境和势力贡献进入全局上下文；地点服务和地点贡献进入该地点上下文；活动贡献可供随后本地点的活动/事件及后续 NPC 候选使用。不要假定一个地点的贡献会变成全局语义。npcTemplateIds 引用 ResidentTemplate，不引用固定 NPC 或居民实例；最终职业还必须与工作地点 professions 一致。

data.service 只能为 home/market/workshop/clinic/commons。职业名称没有自动语义映射，引用原型的 profession 必须与地点职业字符串相符。活动 data.capabilities 声明真实所需能力；当前 v2 生成活动还自动要求该地点光照为 lit，没有关闭该要求的模板字段。

原型的职业/移动适配通过 ContentPack.residentAdaptations 显式声明 workCapabilities 与 mobility=walk/assisted。辅助移动目前是抽象日程资格，不表示已经实现轮椅设施、运输网络或物理移动。生成和存档采用同一初始适配规则。

缺包模板可以留待以后，但必须标明它尚不可进入候选；Tag 本身仍需先定义。参考事件贡献只接受当前可移植的通用评级、自足事件与免费退出路径，不能把固定人物故事或受限后续接进随机池。新增完整事件/TF 不是本任务默认范围。

## 9. 全局 GenerationRulePack 与未实现需求

GenerationRulePack 当前仍是 v1；不因 ReferencePack v2 自行把它升为 v2。全局参数与单模板组合规则分开，完整字段看 generation-rules-example.v1.json。

现有范围：地点 5–20、NPC 3–40、额外连接 0–30；必须恰好覆盖 home/market/workshop/clinic/commons 五类必需服务。时段为当天分钟，workStart < workEnd < leisureEnd；每地点事件 1–3、活动 0–3。不要增加未实现的 climateSimulation、speciesBehavior、ruleScript 或 arbitraryCondition 字段。

当前不能表达的规则放进 FUTURE-REQUIREMENTS.md：写清需求、缺少的真实数据/操作、候选未来格式、需要开发的消费者及测试。未来格式片段明确标注“不可导入”，不得混进可加载 JSON。

## 10. 审核、专用分级和兼容

普通素材和未来 NSFW 素材共用稳定 ID、来源和语义引用；分级、偏好、资格仍为专用字段。adult 或其他 Tag 不是年龄证据。参与者必须逐个满足真实年龄资格；未知年龄回退，最低门槛为 18 岁与该种族声明门槛的较大值。不要设计绕过资格、偏好或审核的权重和别名规则。

此前外部 NSFW 十四分类规范未整体接入旧 parser。素材交换 v2 仅验收专用元数据，不自动审核、导入或启用正文；当前运行时素材筛选只接入通用素材。专用内容规则若依赖尚未实现的适配，列未来需求，不编造当前运行能力。本任务不要求生成成人正文。

不要改写已有包的 ID/版本/哈希来假装兼容。新增包走新 namespace 和依赖声明；修改内容必须更新版本并说明影响。不得重抽旧生成世界或重跑已结算事件/TF。已有存档恢复原快照，新规则只影响按新规则创建的世界，其他迁移由开发者明确实现。

## 11. 自查与验证要求

逐项检查：未定义/废弃 Tag、同域歧义、名称冒充 ID、错误对象或部件范围、无效材料/形态/参数、引用缺失、要求与排除同项、全部兼容项被排除、自依赖、循环、生成顺序不可达、无合法必需服务、职业不匹配、未知时段/身体被当成合格、正文反向证明状态。

检查至少下列正反情境，并写出预期；有运行环境时实际执行：

1. 机械手＋有机尾：机械尾条件必须不通过。
2. 同一机械尾：机械尾通过；尾长未知时尺寸门槛不通过；600 毫米及阈值上下边界正确。
3. 玩家、固定 NPC、居民分别查询；不能误用玩家图或不存在的居民实例。
4. 光照从 lit 变为 dark：需要照明的候选失效；服务仍由原 service 字段决定。
5. 夜间跨午夜端点正确；未知年龄或低于统一成年门槛不合格。
6. 同时要求/排除相同 Tag、依赖未来阶段或缺少所需原型时，明确报错或保留为不可用候选，不能假称兼容。
7. 至少种子 7 与 42 生成、可达性及存档往返；不得修改已保存世界来凑出期望结果。
8. 合法候选的权重只影响选择；无论提高到多少，非法候选仍不能进入。

工程中使用现有 loadPacks → parseReference/parseRules → WorldGenerator → SaveCodec 校验。`npm run check:foundation` 校验随附正式示例；它不会自动扫描你另外交付的任意文件，因此不能用示例通过冒充你的全部交付通过。合并后运行工程适当的类型检查和测试；没有执行环境时逐项写“未执行”，提交可复核的静态检查与预期，不能虚构通过数量。

## 12. 一次性交付内容与回复方式

交回一个 UTF-8 文件包，结构如下；不适用的可加载文件不生成，并在说明中写原因：

```text
tag-rules-delivery/
  README.md
  content-pack.v2.json          # 新 Tag/派生/素材适用规则；完整包壳
  reference-pack.v2.json        # 模板增量，标明与哪套已有参考库合用
  generation-rules.v1.json      # 仅在需要调整全局参数时
  TAG-DECISIONS.md              # 复用/新增/别名/废弃决定、来源与消费者
  RULE-MATRIX.md               # 每条规则输入、上下文、条件、结果与正反例
  VALIDATION.md                # 实际执行、未执行、失败、边界和待审核项
  FUTURE-REQUIREMENTS.md        # 只有需要新实现时，明确不可导入
```

正式 JSON 不含注释、Markdown 围栏、占位 ID、省略号或解释字段；未使用的必需数组写 []，texts 写 {}。完整 ContentPack 壳参考随附示例，manifest.status=draft；正式文档版本与依赖不能省略。不要覆盖随附示例或冒用 rulesdemo 命名空间交付不同批次；按委托使用新的唯一命名空间和包 ID。

报告中的每条规则说明具体用途、所用已有语义/真实参数、合法与非法例、未知输入的处理、适用的生成阶段及当前实现边界。区分“提出”“格式验收”“审核通过”“已集成”“已被游戏使用”，不能把它们混成一个完成标记。

最后用简短清单说明文件数量、复用/新增 Tag 数量、规则数量、验证情况与待开发项。一次交回完整包；不要只给建议、伪代码或要求用户亲自设计 NPC 剧情。
