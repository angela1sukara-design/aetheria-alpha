# 底层增量 v0.4：版本与权威来源

实施基线：51404a5，188 项自动化测试通过。原工作树改动另存 artifacts/foundation-v04/preexisting.patch；不覆盖导航、整理脚本及原词库批次。

## 已实施的格式决定

- ContentPack v1 保持严格字段验收；新增功能使用 manifest.schemaVersion=2 并声明 foundation.v2。两种格式共用 Loader、Registry、依赖及哈希设施。
- 增量包 aetheria/foundation@1.0.0 使用 namespace=foundation。审计拟定的 aetheria:* ID 改为 foundation:*，因为 aetheria 命名空间已由世界包独占。旧域 23 个生成值和 34 个故事主题精确映射，不跨域猜同义词；隐藏标记仅保留废弃别名，显示策略由 hidden 控制。
- 部件定义 defaults 或唯一 partProfile 提供默认值，实例仅保存 overrides；旧 organic/mechanical 保留，详细 materialId 不授予能力。仅尾部支持 lengthMm（1–5000 毫米），用于适配和文本阈值。未声明参数为未知。
- 新状态为存档 v4 / 0.2-foundation，增加 environment 覆盖、固定 NPC 身体及场景实体引用。旧 v3 仍按其严格规则读取；新增增量包时逐个核对旧包原版本和哈希，显式加入新包哈希后升级，绝不冒用旧哈希。
- 原 v1/v2 官方存档继续走原精确迁移。生成世界从自己的完整包快照恢复；不使用最新参考库重抽。
- 普通词库批次 v1 保留；新语义和分级扩展另行版本化，不能向 v1 偷加字段。

## 唯一权威

| 数据 | 保存位置 | 查询 |
|---|---|---|
| 玩家身体 | player.body | entityBody(player) |
| 固定 NPC 身体 | npcs[].body；由显式 npcBodies 声明初始化 | entityBody(npc ID) |
| 生成居民身体 | district.residents[].body | entityBody(resident ID) |
| 参数默认值 | 不可变内容定义 defaults 或唯一 partProfile | effectivePart |
| 参数变化 | 所属图的部件 overrides | effectivePart |
| 地点参数 | 不可变 locationProfile + environment 唯一状态覆盖 | environment |
| 派生 Tag | 不保存 | derivedSemantics → evaluate → 共享查询 |
| Tag 来源与反向引用 | Manifest / Registry 自动扫描 | tags / tagReferences |

查询不抽随机、不推进时间、不重选正文。缺身体或参数为未知；条件取反仍未知。场景只引用实体，旧场景副本不得成为固定 NPC 身体；没有显式声明时暂停并释放接触，保留事件和场景进度。不能迁移的文件由现有隔离流程保留原文及原因。

## 已完成的闭环

- 固定 NPC 通过增量包中的三个显式身体声明初始化；未声明的 NPC 查询为未知。生成居民仍使用自己的持久图，社会数据没有强制合并。
- TF 的 apply/enqueue/pause/resume/cancel 共用原阶段和事务机制，支持 player、npc、resident 三种目标。来源行动、目标、幂等键和已完成阶段一起保存。目标不同不共享部件预约；重复请求返回原事务结果，失败回滚全部状态及随机流。
- attributes 补丁验证类型、单位、范围、材料和形态引用；set 保存覆盖，unset 恢复定义默认值或未知。TF 记录最近一次部件改造来源，完整阶段历史仍在 tfQueues。
- 身体变化后重新检查现有玩家装备、双方接触、玩家姿势及带对象条件的场景资格。不合法装备卸下但保留物品；接触失效则释放。被接触占用的结构修改会阻塞，释放后可恢复原阶段。
- 生成器升级为 0.3.0。生成和存档对初始职业身体使用同一个适配函数；新包可声明 workCapabilities 和 assisted 移动，旧包保留明确的 v1 劳动约定。后续 TF 不因改变身体而破坏初始生成快照；当前帮助资格按当前图重新判断。
- 61 个字典定义覆盖 57 个旧域别名及必要派生语义。来源查询复用 Manifest，内容引用索引由 Registry 扫描；外部参考库引用另由格式工具扫描导出。新故事及参考包使用规范 ID；旧包只在查询视图映射。
- 派生规则验证有尾部、同一尾部的机械材料族、真实 grasp 能力、地点服务和夜间时段。没有保存可编辑的派生集。
- 五条审定的中性素材接入身体面板和地点正文，适用条件存放在独立 proseSelections 中。先满足条件，再按稳定 ID 选择正文；读取不重抽。650 毫米尾部实际触发尺寸文本。
- 生成地点光照采用 locationProfile 默认值和 environment 唯一覆盖。开关工作灯改变候选正文和需要照明的活动资格；不推进时间或随机流。普通恢复、移动等基础出口仍可用。
- 规则拒绝未知或歧义 Tag、直接要求/排除矛盾、兼容项全被排除、错误对象/部件范围、无效属性/引用、未知操作、依赖循环和静态可证明的顺序不可达。地点/活动/事件交错阶段保留实际可能的依赖；环境组合无法静态确定时，由生成器明确报告无合法候选。

## 迁移与兼容

ContentPack v1、普通词库批次 v1、ReferencePack v1、GenerationRulePack v1 保留各自严格读取。ReferencePack v2 要求规范且未废弃的 Tag；service 从地点 service 字段生成，v2 不允许重复编辑服务 Tag。新状态/新包字段不能塞入 v3/v1。

固定世界的 v3 升级先用原包集合验证完整旧状态，再加入 aetheria/foundation 的真实版本和哈希。既有官方 v1/v2/v3 原指纹迁移继续工作。正文追加包仍走原有受限路径；参数或规则包不能冒充正文追加包。任何旧包版本或哈希改变都不能被这条升级路径掩盖。

旧生成世界恢复自身保存的内容和规则快照，保留生成版本、规则哈希及参考包信息，不用最新库重新生成。无旧场景副本的历史生成快照可保持原状态版本；存在旧场景时，移除副本并绑定实体，身体未知则暂停并释放接触。已有事件抽样、账本、记忆、TF 阶段、暂停及进度均保留，不重跑结算。封装版本与状态版本不同、未知版本或不可迁移的内容会隔离原文件并说明原因。

新增字段缺失不会凭名称推断材料、形态或尺寸。例：旧狼尾没有保存 lengthMm 时仍为未知，不补造一个长度。声明的默认值可通过 effectivePart 读取，但不会复制一份最终属性到存档。

## 内容作者入口

正式格式、完整可校验示例及命令见 `production/lexicon-authoring/formats/v2/README.md`。Tag 域映射见 `docs/foundation-tag-mapping.md`。一般素材、成人素材的分级、偏好与资格为专用字段；adult Tag 不证明年龄，未知年龄不合格，统一下限为 18 岁与种族声明门槛的较大值。

当前 v2 是严格的素材交换验收入口，不自动审核、导入或启用玩法。原有 10,700 条素材批次没有重写，原审定选集和 TextSlot 适配流程继续运行。完整固定故事仍需 EventGraph、事实和 Action/Effect；纯正文不能证明剧情事实或改变身体。

## 验证与运行

执行 `npm run check` 可复跑类型检查、全部自动化测试、离线构建、旧存档构建校验和正式格式验收。单独格式验收为 `npm run check:foundation`；修改字典后显式运行 `node scripts/check-foundation.mjs --write-examples` 更新导出及示例指纹。

可运行版本：`dist/Aetheria-Alpha-0.2.html`；独立随机世界：`dist/WorldGenerator-Seed-7.html` 和 `dist/WorldGenerator-Seed-42.html`。直接打开 HTML 可离线运行，不需要 AI API。完整验证记录见 `docs/foundation-v0.4-validation.md`。

## 尚未实现的边界

- 没有完整经济、政治、社会发展、迁徙、天气、温湿度、污染或物理模拟。日程仍为已有的抽象地点切换；assisted 是作者明确声明的资格规则，尚无运输设施或逐段移动模拟。
- 部件种类沿用现有八类；颜色限五种；尺寸首版仅尾部 lengthMm。新增器官描述可先进入素材库，不能冒称引擎已经支持该器官。
- 材料和尺寸不会改变能力；能力仍来自真实部件定义。尚无独立材料能力修正规则，未知数值/自由属性/效果字段会拒绝。
- 装备系统仍是现有玩家装备系统，没有另造 NPC 装备栏。固定 NPC 和居民已有真实身体及 TF 路由，但未批量制作其改造 UI 或剧情。
- 派生首版为原子查询，不支持派生 Tag 链、缓存、向量检索或通用逻辑求解。未知部件实例的属性补丁只能在实际事务校验其目标，不能静态保证任何身体均可应用。
- 外部此前 NSFW 分类规范没有整体接入旧 parser。v2 仅验收中性示例和专用元数据，不生成成人正文，不自动转换旧分类，也没有开放未经审核的文本修改状态。
- 第三方旧包任意哈希变化不自动迁移；无法确定的兼容性明确隔离，保留原文。
