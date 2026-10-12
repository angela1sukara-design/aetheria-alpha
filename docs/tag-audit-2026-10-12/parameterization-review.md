# 角色、身体与环境参数化评估

下文“拟新增”均未实现。本轮保留 BodyGraph；把参数放在其所属实体，Tag 只是查询结果或素材语义。

## 1. 身体现状：结构已经真实，属性仍很薄

依据：[body-types.ts](D:/desktop/nsfw/aetheria-alpha-0.1/src/core/body-types.ts)、[body.ts](D:/desktop/nsfw/aetheria-alpha-0.1/src/engine/body.ts)、[transformations.ts](D:/desktop/nsfw/aetheria-alpha-0.1/src/engine/transformations.ts)。

| 需求 | 当前能力 | 最小调整 |
|---|---|---|
| 独立部位／自由组合 | parts + edges + anchor；不是固定种族的整体形态枚举 | 保留图与锚点验证；已有树形物理连接不是物种继承树 |
| 不同部位来自不同形态 | 按部件 definitionId 组合；耳和尾已有不同定义 | 添加明确部件原型，不新增“混合狼人”整体种族；来源元数据按部件记录 |
| 有机／机械混合 | 部件 material 只有 organic/mechanical，已可混合 | 保留旧字段含义；增加独立的详细材料引用，不把颜色／外形塞进 material |
| 黑胶 | district:part.hand.gel 已存在，但 material=organic | 描述能说“黑胶”，当前机制只能知道 organic；需明确细材料与通用材料族的区别，禁止仅凭名字自动推断属性 |
| 颜色／尺寸／个体差异 | 实例只有 instanceId/definitionId，没有实例属性 | 拟新增受 Schema 限定的属性默认值与实例覆盖 |
| 能力汇总 | bodyTraits 由定义 capabilities 求计数 | 继续按图计算；能力计数不是力学模型，也不是动物物种结论 |
| TF 真改身体 | replace/attach/remove 经完整图校验，真实修改玩家图 | 增加受验证的属性 Patch，沿用 TF 阶段、事务、占用冲突与幂等处理 |
| NPC 改造 | 生成居民有图但无通用 TF 目标；固定 NPC 无图 | 先统一实体身体查询与所有权，再提供 NPC TF，不复制玩家状态做长期替身 |

用户例子“狼耳、蜥蜴尾、机械左臂、黑胶双腿”：架构不要求创造整体混合物种，但当前内容缺蜥蜴尾、机械臂、黑胶腿原型及部分属性／目标接口，不能声称现在已经完整可用。左右身份应依锚点或部位定位；新增形态仍须满足 PART_KINDS、锚点接受类型与容量，现有 root/head/ear/arm/hand/leg/foot/tail 枚举也不是任意器官扩展系统。

## 2. 拟新增的最小部件属性

推荐“定义给默认值，实例仅存覆盖”，由一个 resolver 求有效属性。不保存另一份可修改的整套 resolvedAttributes；继承是同一部件定义的默认值合成，不是物种树推导身体。

| 字段建议 | 类型／归属 | 必要性和约束 |
|---|---|---|
| materialId | 部件定义默认，可被实例覆盖的稳定引用 | 区分黑胶等详细材料；保留 organic/mechanical 作为旧通用族。材料是否复合、如何影响能力在规则层决定，先不构造无用的百分比配方 |
| morphologyId | 可选稳定原型引用 | 表达狼耳等局部形态；不等于角色 speciesId，不保证某种能力 |
| colorId／外观修饰 | 可选离散颜色词引用／受控多值 | 精确颜色不必全转 RGB。只在玩法需要渐变或测色时加数值；同一词条描述不能直接写入状态 |
| lengthMm／sizeClass | 按部件允许的数值或枚举，按需要选一套 | 有实际空间／装备阈值才加长度与单位；纯文案大小优先枚举。禁止为每 1mm 建 Tag |
| provenance | 可选来源事件／改造记录引用 | “来自狼形原型”与“曾由某次 TF 获得”语义不同；实际记录由可信事务写入，不能由正文猜测 |
| capability modifiers | 拟新增独立规则，不先给每实例自由 JSON | 材料或尺寸确需改变能力时，统一计算有效能力；结构和 Tag 都不能绕过规则直接授能 |

属性键、单位、上下界、缺省与未知含义、可修改范围先定义为版本化 Schema。旧存档缺省“未知”必须与“无／零”区别；不能替旧人物捏造颜色或器官长度。材料字典与 Tag 字典可共享稳定引用机制，但材料是参数定义，不因为“材料词能检索”就只留下一个 Tag。

## 3. 人物参数归类与权威来源

| 数据 | 现有来源 | 类型 | 建议 |
|---|---|---|---|
| 金钱、精力、健康、信任、熟悉度 | variables、NPCState.relationship、Resident.trust | 连续／有界数值 | 保留数值；条件直接比较；“高信任”只在复用检索需要时派生 |
| 年龄、物种资格 | NPCDef／Resident + SpeciesDef | 数值与身份引用 | 资格直接校验；成年资格不能用 adult Tag 替代 |
| 职业、行为模板 | Resident.profession 字符串、behavior 枚举 | 身份与行为引用 | 逐步拆稳定 professionId 与显示名；behavior 在规则层，不能从“修理师”词条自动授予修理行动 |
| 来源／社群／社会身份 | speciesId、factionId、originLocationId | 稳定引用／持久身份 | 不由身体反推。可多值身份需独立 memberships；无消费前暂不开发完整身份系统 |
| 性格 | Resident.personality 文本，固定 NPC 无独立结构 | 持久描述 | 继续允许文字素材；要影响决策时再添加少量明确特征，不把每个形容词变成 AI 行为参数 |
| 情绪 | 未有通用结构 | 临时状态 | 暂缓情绪模拟。明确行为需求出现后加状态与开始／结束时间，不能用永久 Tag 记“生气” |
| NPC 记忆 | 固定记忆含行动／事件来源；居民 memories 文本数组 | 持久事实记录 | 保留；居民记忆后续需要追踪事件时补结构化来源，不由语义 Tag 判断事件已发生 |
| 剧情成功与承诺 | flags／事件状态／factsAt | 持久事实和历史 | 单独权威；退出 Event 不自动算成功，原文叙述也不直接落事实 |
| TF 阶段、接触、姿势、战斗轮次 | TFInstance、district.scene/combat | 可存档的临时过程状态 | “临时”不等于不保存；刷新和加载后须续接。派生标签不代替过程数据 |
| 能力、尾巴存在、是否机械尾 | BodyGraph + 有效部件数据 | 派生结果 | 按需计算；按同一部件匹配机械与尾巴，避免“机械手+有机尾”误判机械尾 |
| 固定 NPC 关系阶段 | NPCMemoryDef.relationshipStage 与已获记忆 | 派生摘要 | 保留单一推导，不再增加可手改 stage Tag |

固定 NPC 查询应返回 `body=unknown` 或显式身体，而不是默认人形。推荐新增一个实体解析接口，适配 player.body、Resident.body、将来的 NPCState.body；各身体仍只保存在原所属状态中。先统一读取与写入路由，不全面合并 NPC 和 Resident 的社会数据。

## 4. 环境：先补有消费者的数据

证据：[LocationDef](D:/desktop/nsfw/aetheria-alpha-0.1/src/core/types.ts:35)、[WorldDef](D:/desktop/nsfw/aetheria-alpha-0.1/src/world/types.ts:26)、[simulation.ts](D:/desktop/nsfw/aetheria-alpha-0.1/src/world/simulation.ts)。目前的 wet/forge/garden 等是生成主题，没有实际温度或湿度测量，也没有设施维修状态模拟。

| 候选 | 推荐阶段 | 来源与作用 |
|---|---|---|
| service | 保留现有枚举，先取消重复权威 | 真实地点服务；service.* 是计算输出或生成局部上下文，不单独编辑 |
| 室内／室外、遮蔽等空间性质 | 有文本／装备需求时少量加入 | 定义默认值，状态只存改变后的覆盖；多值特征不必全部 numeric |
| 光照 | 先复用时钟求昼夜；有独立需求再加灯光／遮蔽 | night 不能当作永久地点特性；地下／人工照明不能仅靠时钟判断 |
| 设施可用性 | 最值得在首个相关玩法一起补 | 明确 facilityId、operational／故障状态；规则据此开放行动，正文只描述结果 |
| 温度／湿度／污染 | 后置，先确认玩法消费者和单位 | 文案检索可使用环境主题；需要防护／腐蚀等结算时才加真实值。climate.wet 不自动换算 80% 湿度 |
| 经济、职业、组织 | 保留现有多值与引用 | 当前是生成世界定义／关系，不是空气或环境生理参数 |

推荐静态 LocationDef 参数 + 唯一 LocationState 覆盖（拟新增）；有效环境由同一查询计算。WorldDef 继续保存生成背景，不能让三处均可改同一湿度。动态变更必须通过 Effect/ActionExecutor；环境主题素材允许先收录而没有动态模拟。

## 5. 实时性与保存

真实图、属性覆盖、固定来源身份、过程状态和环境覆盖保存；能力汇总、派生 Tag、检索候选与反向引用索引不保存为可修改状态。TF 每个已提交阶段后从新图求结果；场景和装备重新校验继续沿用现有事务。读视图不触发变更或随机重选。

存档加载先校验版本／内容依赖／图／参数，再建立查询上下文。默认按需计算：当前至多 40 生成居民、每图至多 128 部件，未测量前没必要加入全世界脏标记网络。确有热点后用实体身体版本、环境版本、规则版本作为缓存键；时段查询还必须依时钟变化失效，不能只用身体版本。缓存丢失不影响正确性。
