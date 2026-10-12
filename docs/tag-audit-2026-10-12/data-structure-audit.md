# 当前数据结构与调用关系审计

审计日期：2026-10-12。范围：当前工作树，包含审计开始前已有的未提交内容；不是仅审查 Git HEAD。基准提交：`51404a5c0400018d592052465148fd63217930c2`。本轮只新增本目录报告；没有实施下文方案。外部设计文档与旧验收报告不作为功能已实现的证明。

## 1. 结论与实物规模

现有工程已经把身体结构、数值、剧情事实、变化过程、内容规则分开。主要问题不是“全用 Tag 表达状态”，而是 Tag 尚无统一字典、人物模型不一致、部件参数不足，以及部分生成元数据缺少交叉校验。

| 实物 | 当前工作树结果 |
|---|---|
| 默认固定内容 | 6 个包；10 地点、3 固定 NPC、1 Species、3 居民原型、30 Storylet |
| 身体与变化 | 13 部件定义、9 Patch、9 TF；不是 13 种完整身体 |
| 文本与状态 | 3 TextSlot、89 Flag、4 Variable |
| 默认生成入口 | 固定包 + neighborhood-content + lexicon-content；采用 lexicon-reference 的 150 模板 |
| 另一份参考库 | reference.json 有 152 模板，是另一来源，不与默认 150 自动相加 |
| 生成边界 | 地点 5–20、居民 3–40；参考包至多 20、展开模板合计至多 2,000 |
| 基础词库 | 58 分类、214 批、10,700 条；108 approved、12 hold、10,580 unreviewed；使用绑定 882、去重使用词条 108 |
| Tag | 23 个生成语义字符串；33 个固定 Storylet 标签，生成器另写入 neighborhood；词条 tags/synonyms 当前均未填写 |

入口证据：[content/index.json](D:/desktop/nsfw/aetheria-alpha-0.1/content/index.json)、[UI 默认来源](D:/desktop/nsfw/aetheria-alpha-0.1/src/ui/main.ts:50)、[生成器边界](D:/desktop/nsfw/aetheria-alpha-0.1/src/world/generator.ts:17)。逐文件哈希、Tag 全部出现路径及 JSON Pointer、包计数、探针结果见 [audit-evidence.json](D:/desktop/nsfw/aetheria-alpha-0.1/docs/tag-audit-2026-10-12/audit-evidence.json)。

## 2. 数据权威与真实读写

| 结构／类型 | 定义与入口 | 写入／保存 | 读取／实际边界 |
|---|---|---|---|
| GameState | [types.ts:73](D:/desktop/nsfw/aetheria-alpha-0.1/src/core/types.ts:73) | createGameState 初始；ActionExecutor 提交克隆后的事务；SaveCodec 保存 | schemaVersion=3；带 revision、包哈希、时钟、玩家、NPC、TF、事件、RNG、账本；district/worldInstance 可选 |
| world | 同上内联字段 | location.move、发现地点 | 仅 locationId/knownLocationIds；没有独立命名的 WorldState 类型 |
| WorldDef | [world/types.ts:26](D:/desktop/nsfw/aetheria-alpha-0.1/src/world/types.ts:26) | WorldGenerator 创建并纳入存档快照 | 地区、地点服务与 tags、经济／职业、组织、事件池、完整内容包；不是实时环境模拟状态 |
| WorldInstance | [world/types.ts:40](D:/desktop/nsfw/aetheria-alpha-0.1/src/world/types.ts:40) | 生成来源、种子、规则哈希、模板选择、agents；simulation 推进位置 | 载入恢复快照，不按最新词库重新生成旧世界 |
| 固定 NPC | [npc-types.ts](D:/desktop/nsfw/aetheria-alpha-0.1/src/core/npc-types.ts:5) | NPCDef 不可变；NPCState 保存发现、关系和有来源的记忆 | npcLocation 用时间表／事件参与者求位置；没有真实 body、结构化情绪／性格／目标 |
| 生成居民 Resident | [district-types.ts:7](D:/desktop/nsfw/aetheria-alpha-0.1/src/core/district-types.ts:7) | 原型抽样后保存 name/appearance/personality/profession/body/信任/记忆等；simulation 更新地点 | 有真实 BodyGraph，但性格、职业主要为字符串；不是固定 NPCState 的另一实例 |
| SpeciesDef | [npc-types.ts:4](D:/desktop/nsfw/aetheria-alpha-0.1/src/core/npc-types.ts:4) | 内容定义 | intelligent、adultAgeYears；没有身体继承树；默认“智慧人物来源与具体形态未定”不约束解剖 |
| BodyGraph | [body-types.ts:6](D:/desktop/nsfw/aetheria-alpha-0.1/src/core/body-types.ts:6) | instantiateBody、patchedBody；玩家与居民各自保存图 | bodyTraits 从实际部件定义计算能力；部件实例只有 instanceId/definitionId |
| BodyNode／Slot | [module-boundaries.ts](D:/desktop/nsfw/aetheria-alpha-0.1/src/engine/module-boundaries.ts) | 未有通用运行时 BodyNode/Slot 系统 | 已有 parts/edges/anchor 与 capacity；LocalSlot 等是预留模块契约，不能当成已完成玩法 |
| TF／BodyPatch | [transformations.ts](D:/desktop/nsfw/aetheria-alpha-0.1/src/engine/transformations.ts)、[body.ts](D:/desktop/nsfw/aetheria-alpha-0.1/src/engine/body.ts) | 真正 replace/attach/remove；队列保存阶段、时间、状态、幂等来源；取消保留已应用变化 | 当前 TF 操作对象为玩家；没有通用 NPC-targeted TF 或属性修改 Patch |
| Location／时间 | [types.ts:35](D:/desktop/nsfw/aetheria-alpha-0.1/src/core/types.ts:35)、[clock.ts](D:/desktop/nsfw/aetheria-alpha-0.1/src/engine/clock.ts) | 定义存地点文案／坐标／Hook；状态存总分钟及跨日 | 未有温湿度、污染或设施工作状态；地图坐标不是环境参数 |
| Variable／Flag | [effects.ts](D:/desktop/nsfw/aetheria-alpha-0.1/src/engine/effects.ts) | var.change、flag.set；factsAt 记录首次置真时间 | 数值、当前事实与发生时间已有独立结构；无需改造成 Tag |
| Registry／Loader | [registry.ts](D:/desktop/nsfw/aetheria-alpha-0.1/src/content/registry.ts:8)、[loader.ts](D:/desktop/nsfw/aetheria-alpha-0.1/src/content/loader.ts) | parsePack、依赖排序、定义归属／引用／能力检查、整体包哈希后冻结 | 没有 TagDef 注册项；Manifest.migrations 仍只接受空数组，不是现成通用迁移引擎 |
| Condition／Effect | [types.ts:6](D:/desktop/nsfw/aetheria-alpha-0.1/src/core/types.ts:6)、[conditions.ts](D:/desktop/nsfw/aetheria-alpha-0.1/src/engine/conditions.ts) | 条件纯读；Effect 经执行器写状态 | 已支持布尔组合、数值、事实、时段、事件、身体能力、TF、NPC、街区条件；身体查询主要针对玩家，没有任意实体属性查询或通用 tag.has |
| Selector／Executor | [selectors.ts](D:/desktop/nsfw/aetheria-alpha-0.1/src/engine/selectors.ts)、[executor.ts](D:/desktop/nsfw/aetheria-alpha-0.1/src/engine/executor.ts) | performAction 检查版本／幂等／可用性，克隆执行、再校验、提交或回滚 | actionOptions 统一 UI 与授权；view 不推进时间、不抽样、不写状态；新属性与规则应接入这条链 |
| Storylet | [district.ts](D:/desktop/nsfw/aetheria-alpha-0.1/src/engine/district.ts) | 定义条件／权重／冷却；选中时记录 history 与 discovered | 同地点、evaluate 条件、重复与冷却过滤，最高优先级中加权；tags 当前不参与选择；选中过不等于完成 |
| EventGraph | [types.ts:43](D:/desktop/nsfw/aetheria-alpha-0.1/src/core/types.ts:43)、[effects.ts](D:/desktop/nsfw/aetheria-alpha-0.1/src/engine/effects.ts) | event.start/advance/exit；进入节点选定文本并存 textByNode；onEnter 每节点首次执行 | 仅 choice/exit 节点；completed 表示退出事件，不自动证明任务成功；EventInstance.locals 有字段但没有完整条件／Effect 接口 |
| TextSlot／SceneText | [district-types.ts:28](D:/desktop/nsfw/aetheria-alpha-0.1/src/core/district-types.ts:28)、[text-variants.ts](D:/desktop/nsfw/aetheria-alpha-0.1/src/content/text-variants.ts) | 玩法包定义槽与事实；审定文本库只替换 prose | SceneText 用既有条件；变量白名单目前 player.name/npc.displayName；正文不能授予能力或补写剧情结算 |
| 素材词库 | [library.mjs](D:/desktop/nsfw/aetheria-alpha-0.1/scripts/lexicon/library.mjs)、[neighborhood.mjs](D:/desktop/nsfw/aetheria-alpha-0.1/scripts/lexicon/neighborhood.mjs) | 离线收录、审稿、选集、使用登记、编译为既有内容包 | 原词库不直接作为运行时状态或整个存档的一部分；目前适配器不读取词条 tags 来做动态检索 |

## 3. 实际调用链

1. 启动：UI 读取内容索引 → loadPacks → 严格 Schema、依赖与引用、正文／身体／NPC 检查 → immutable Registry → createGameState 或 SaveCodec.decode。
2. 生成：默认参考与规则 → parseReference/parseRules → WorldGenerator 选模板 → 生成标准 ContentPack → 同一个 loadPacks → 实例化居民 BodyGraph → 创建 WorldInstance 快照。
3. 操作：UI ActionIntent → ActionExecutor.performAction → actionOptions/evaluate 授权 → 克隆状态 → Effect → TF／时钟／街区和场景再校验 → 提交 revision 与 ledger。失败不提交。
4. 展示：selectGameView → actionOptions／districtText／TextSlot resolve；由状态求表现。已经锁定的事件文本不在每次重绘重抽。
5. 素材：批次 JSON → validateBatch／归属与重复检查 → collections + reviews → approved 选集且检查审定哈希 → compileNeighborhood → lexicon-content/reference。该路径有人工编译选择，不是 10,700 条全部进入生成池。
6. 存档：4 MiB 上限；包版本与完整内容哈希必须匹配，生成世界恢复其已存包快照。已有有限官方旧版本升级，不支持任意新字段自动兼容。

## 4. Tag 的定义、保存与查询位置

| 位置 | 写入和保存 | 实际消费 |
|---|---|---|
| ReferenceTemplate.environmentTags | 参考 JSON 编写；规则来源保存哈希 | 对生成器全局已选 tags 的 any 匹配 |
| requiresTags / excludesTags / compatibleTags | 参考 JSON | 本次候选上下文 all / none / 非空时 any；compatibleTags 是硬筛选，不是软加分 |
| combination.boosts[].tag | 参考 JSON | 命中时乘权重；requiresTemplates/excludesTemplates 是模板 ID，不是 Tag |
| environment.data.tags、contributes.tags | 参考 JSON → 生成过程 Set | 影响后续候选；结果保存到地区／地点；不是运行时动态环境观测 |
| WorldDef 地区／地点 tags | 生成器写快照，存档校验器读 | 当前主要为元数据；地理与组织上下文有生成顺序差别，地区环境快照早于组织贡献 |
| StoryletDef.tags | district 包；生成器固定写 neighborhood；包／世界快照保存 | 发现列表展示主题；无剧情调度消费。构建脚本还用“隐藏”标签生成 hidden，迁移需同时改脚本 |
| lexicon entries.tags/synonyms | validateBatch 可选字段、收录时保存 | 仅字符串格式限制；无 Tag 引用存在检查；管理 index 未保留 tags/synonyms，适配器未使用 |
| 分级、偏好、事实、能力 | rating/contentTier/adultOptional、flags、capabilities 专用字段 | 由专用条件与文本资格检查消费，不是现有 Tag |

全部 23+34 个值及每个出现位置由 evidence 中 generationTags/storyTags 完整列出；具体修改建议见迁移清单。普通词条 category/subcategory 是管理分类，不应与以上字符串混算 Tag 数量。

补充排除项：[action-preview.ts](D:/desktop/nsfw/aetheria-alpha-0.1/src/ui/action-preview.ts) 的局部 tags 变量只承载时间／数值变化的界面徽章，不是持久语义 Tag。neighborhood-catalog 与 create-district-content 是现有参考／剧情标签的生成源，迁移应同步源脚本和产物。可选 addon-reference 没有额外非空标签；历史构建／验收快照不作为新的标签权威。

## 5. 一致性与扩展阻碍

| 优先级 | 发现与证据 | 判断 |
|---|---|---|
| P0（生产规范） | 未注册语义字符串仍能通过 parseReference；词库 tags 同样不检查字典 | 多 AI 会产生拼写、同义与未定义引用；先补字典与离线检查 |
| P1 | [scene.start](D:/desktop/nsfw/aetheria-alpha-0.1/src/engine/district-effects.ts:18) 将 NPC 身体建成默认初始身体模板 | 不是 NPC 真实身体来源。扩展 NPC 改造前必须解决，不能据场景副本宣称 NPC 已具备自由 TF |
| P1 | 地点 service 与 service.* 两份值不交叉验证；ecologyTags 与 environmentTags 不交叉验证 | 内存探针已证明矛盾快照仍通过 validateState。当前样本未据此发现已经矛盾；应取消自由写重复值或加载时验证 |
| P1 | player.body 与 scene.actors[0].body 是两份图 | 运行时 revalidateDistrict 同步玩家；将来扩展 actor 身体应改为解析权威实体，不能让场景副本成为独立可改身体 |
| P1 | 固定 NPC 没有 body；生成居民却有 body；TF 只有玩家目标 | 实体访问接口与固定 NPC 身体能力是实际缺口，不必全面替换两套人物结构 |
| P1 | 居民生成／存档要求 grasp≥1 且 walk≥1；职业用显示字符串匹配 | 是当前居民 MVP 的硬约束；开放无足、无手等形态时要改职业适配规则，并同步载入校验 |
| P1（新来源接入前） | [adultNPCEligibility](D:/desktop/nsfw/aetheria-alpha-0.1/src/engine/npc.ts:74) 仅检查已知年龄、intelligent 与 species.adultAgeYears；没有额外统一的 NPC 18 岁下限 | 当前默认种族阈值为18，不据此判定现有文本有问题；允许新来源时，应将统一年龄门槛与种族门槛同时检查。玩家文本资格已有18岁下限，不能用Tag替代 |
| P2 | 居民 appearance 为保存的字符串，body 为真实图 | 当前初始化会用真实部件生成部分描述；将来身体变化可能导致旧文案失真，应区分固定背景与动态身体描写 |
| P2 | core:health 与 district:health 两个数值并存 | 前者生活／恢复、后者战斗；目前不能直接认定是重复错误。先明确定义与显示标签，禁止未经设计自动合并 |
| 保留 | flags 与 factsAt | 分别为当前真值与首次发生时间，不是简单重复；day.after 的历史时间条件若要求“仍为真”，应再组合 flag.has |
| 保留 | speciesId 与 body；记忆阶段与关系数值；agent 关系与玩家 trust | 语义不同；身体不决定来源身份，玩家关系不等于居民间关系；不合并成 Tag |

## 6. 已执行验证与限制

- `npm run typecheck` 通过；`node --test tests/*.test.ts`：188 通过、0 失败、0 跳过。
- 额外探针仅操作内存副本：未知生成 Tag、冲突 service Tag、冲突生态子集均通过当前校验；结果记录在 evidence。
- 没有运行 build：它会重写词库适配产物及 dist，超出本轮只读代码审计边界。没有把历史浏览器验收当作本轮浏览器测试。
- 未做十万条素材或数千实体的性能基准；后文容量判断是根据真实实现和上限分析，不是吞吐量测量。
- 报告末次复核的源码／内容哈希变化见 evidence 的 verification 字段；不审读固定故事成人正文，也不把未注册的故事文档计入游戏 EventDef。
