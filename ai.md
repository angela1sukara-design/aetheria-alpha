> 协作阶段说明（2026-10-15）：已完成 C 的首批 NPC 服务与地点设施机制，以及 [模块 D 实装](docs/module-d-implementation.md)，当前生成器为 0.11.0。A/B/E 与 C 的任务链、技能教学等补充仍待开发。分发任务请使用 deliverables/ai-tasks/ 中按优先级生成的自包含任务文件，内含完整需求和当前相关文件全文。正文保留原方案；旧年龄、功能展示、性格接口与兼容描述，以 [核对说明](docs/ai-collaboration-review.md)、当前实现和最新用户决策为准。

> 姓名契约：新世界已实装 personalName 姓/名结构、文化顺序与保存校验，0.10.0 旧档不补姓。动态人名/地名用 opponentForm/place 槽中的 displayRef 读取绑定对象；禁止写死示例名。子代命名纯接口已提供，明确亲代/家庭姓/双姓政策；后代实体生成与出生玩法仍待实施，必须保存亲代ID与继承选择，不凭正文冒充。完整 [姓名与继承规范](docs/names-and-inheritance.md)、源码和测试已收入每份协作任务。

# 《以太都市 / 墨卷》中世纪异世界多区域与深度互动系统 · AI 协作开发规范与任务拆分方案

> 文字制作契约更新（2026-10-15）：默认交有序 proseTemplate，整段 prose 仅作普通回退；冻结八类槽，词条明确入槽/优先级/绑定/互斥，矩阵只引用独立 assemblyRuleId。禁止笛卡尔写作穷举，拼装前后复核 T32/T34。完整要求见 [槽位拼装规范](docs/prose-slot-assembly-standard.md)，其全文与独立规则已附在重新导出的每类任务内。离线拼装器已提供，游戏引擎接入仍待完成；下文旧整段稿要求不再作为默认交付格式。

版本：`v1.0-spec` · 基准工程：`aetheria-clean (Generator v0.8.0 / Schema v2 / Save v4)`  
适用场景：将「中世纪异世界（`worlds:setting.fantasy`）多区域动态生成、地点属性选敌/选人、功能型/非功能型 NPC 打工重构、性格差异化分支互动、NPC/敌人双向攻略与恶堕系统」拆分为标准化的模块任务，分发给多个 AI 并行或流水线开发。

---

## 一、 全局工程铁律与防崩坏红线（所有接手 AI 必须遵守）

本工程拥有极其严格的编译期类型检查、运行时 Schema 白名单校验、确定性 RNG 流校验与存档 SHA-256 完整性校验。**任何分包 AI 在编写代码或 JSON 时，必须无条件遵守以下 6 条红线：**

### 1. 严格字段白名单（禁止未登记字段）
- 引擎中的 `src/content/schema.ts`、`src/content/district-schema.ts`、`src/content/foundation-schema.ts`、`src/world/schema.ts` 以及 `src/persistence/*-validation.ts` 均采用**精确键集合校验（`shape(v, required, optional)` / `object(v, keys)`）**。
- **红线**：绝不能只在 JSON 或某一个运行函数中塞入自定义字段（如随意在 `Resident` 上加 `corruption: 10` 或在 `Location` 上加 `regionType: 'town'`）。任何新增字段必须**四处同步**：
  1. `src/core/*.ts` 或 `src/world/types.ts`（TypeScript 接口定义）
  2. `src/content/*-schema.ts` 或 `src/world/schema.ts`（加载/生成时字段白名单）
  3. `src/engine/*.ts`（初始化与事务状态迁移）
  4. `src/persistence/*-validation.ts` 或 `src/world/validation.ts`（存档读取与保存校验）

### 2. 单一写入权威与纯函数条件求值
- 游戏唯一合法的状态修改入口是 `ActionExecutor.performAction(intent, expectedRevision, requestId)`（位于 `src/engine/executor.ts`）。
- **红线**：
  - `src/engine/conditions.ts`（`evaluate`）、`src/engine/selectors.ts`（`actionOptions` / `selectGameView`）和所有 `src/ui/*.ts` **必须是 100% 纯只读函数**。
  - 严禁在 UI 渲染或条件判断中调用 `draw(state, streamKey)` 抽取随机数、推进时钟或修改 `state` 字段（否则会导致存档 `draws` 次数校验不匹配而隔离损坏）。

### 3. Tag 字典注册与显式依赖规范
- 所有规则引用的 Tag ID（格式 `namespace:category.name`）必须在对应包的 `tags` 数组中正式注册为 `TagDef`，且：
  - `label` **必须包含至少一个中文字符**（`foundation-schema.ts` 强制校验 `/[\u3400-\u9fff]/`）。
  - 跨包引用 Tag、Action、Event、Enemy、BodyPart 时，消费方包的 `manifest.dependencies` **必须显式声明定义方包的 `id` 和精确 `version`**（`loader.ts` 会拦截 `UNDECLARED_DEPENDENCY`）。
  - 任何 Choice 的 `setTags` / `unsetTags` **严禁写入 `body` 维度的 Tag 或 `derivedTags` 派生 Tag**（身体与环境派生 Tag 只能通过真实 `BodyGraph` 或环境状态查询派生）。

### 4. 节点安全退出铁律（Anti-Softlock）
- **EventDef 铁律**：每一个 `type: "choice"` 的事件节点，其 `actionIds` 中必须至少有一个**无任何前置 `conditions`** 且直通 `type: "exit"` 节点（或直接 `event.exit`）的合法动作（否则触发 `NO_SAFE_EXIT` 错误）。
- **NarrativeNode 铁律**：`narrativeNodes` 中的每一个节点，其 `choices` 数组（上限 4 个选项）必须至少包含一个 `next: null`、`conditions: []`、且不扣减任何资源（无负数 `var.change`、无 `progression.act`）的免费退出选项（`adventure-schema.ts` 强制校验）。

### 5. 成年资格与分级隔离门控
- 所有涉及 `adult_optional`（战败调教、恶堕、亲密接触、NSFW 组合）的文本槽、事件与互动：
  - 必须通过 `adultEntityEligibility(state, registry, ref)` 校验（物种 `intelligent: true` 且 `ageYears >= Math.max(18, species.adultAgeYears)`，禁止 `ageYears: null`）。
  - 必须在条件中检查 `{ "op": "preference.adultOptional", "value": true }`，且在关闭成人偏好时提供完整的通用级（`general`）回退正文或分支，确保关闭成人开关时游戏 100% 可正常推进。

### 6. 核心包哈希同步
- 若修改了 `content/core/pack.json`、`content/adventure/pack.json` 等基础包，必须执行构建脚本并检查 `src/persistence/stage3-packs.ts`、`src/persistence/vars-migration.ts`（`LEGACY_CORE_HASHES`）及 `src/persistence/ux-predecessor.ts`，保证 `npm test` 全部通过。

---

## 二、 整体架构演进与 5 大模块总览

我们将用户的完整需求拆解为 **5 个低耦合、边界清晰的开发模块**。每个模块可交由一个独立 AI 完成（或按 `模块 A → 模块 B/C → 模块 D/E` 的顺序集成）：

| 模块编号 | 模块名称 | 核心职责 | 主要修改文件范围 |
| :--- | :--- | :--- | :--- |
| **模块 A** | **中世纪异世界 3 大区域与动态地点/特殊地点生成系统** | 将单一区域扩展为「城镇核心区 / 领地边境区 / 野外危险区」3 大区域；引入区域三维属性（发展度/治安/魔力），动态计算各区域地点容量并按条件随机生成特殊地点（酒馆、铁匠铺、大圣堂、下水道、黑市、魔物巢穴、古代遗迹等） | `src/world/types.ts`<br>`src/world/schema.ts`<br>`src/world/generator.ts`<br>`src/world/validation.ts`<br>`content/generation/fantasy-reference.json` |
| **模块 B** | **地点属性驱动的 NPC 与敌人动态生成系统** | 根据地点类型、所属区域属性（治安/魔力）及地点 Tag，驱动各具体地点的驻留 NPC 抽取权重与专属敌群生成（城镇暗巷/领地盗匪/野外魔物与史莱姆巢穴） | `src/engine/environment-enemies.ts`<br>`src/world/combat-encounters.ts`<br>`scripts/build-adventure-content.mjs`<br>`content/adventure/pack.json` |
| **模块 C** | **NPC 职业分类重构与打工/协助门控系统** | 将 NPC 明确划分为 `functional`（功能型：铁匠/酒馆老板/炼金师/公会执事等）与 `non_functional`（非功能型：流浪骑士/修女/贵族/吟游诗人/魔物娘旅人等）；仅功能型 NPC 开放打工协助（`resident.help`）与经营交互 | `src/core/district-types.ts`<br>`src/content/district-schema.ts`<br>`src/engine/district.ts`<br>`src/engine/selectors.ts`<br>`content/generation/fantasy-content.json` |
| **模块 D** | **基于 NPC 性格差异的动态互动分支系统** | 为 NPC 引入结构化性格标签（`traitTags`：高傲/羞怯/贪婪/虔诚/强势/温顺等）；玩家发起交谈、馈赠、调情、威慑时，根据性格标签进入不同反馈分支与数值结算 | `src/core/district-types.ts`<br>`src/engine/district.ts`<br>`src/engine/narrative.ts`<br>`content/adventure/pack.json` |
| **模块 E** | **NPC 与敌人双向攻略（纯爱/臣服）与恶堕（腐蚀/调教）系统** | 建立可攻略/可恶堕实体状态机（好感度 `affection`、顺从度 `submission`、恶堕值 `corruption` 0–100 及关系阶段 `stage`）；实现纯爱攻略、强势征服、NPC 恶堕转化及特殊敌人收服/反调教完整交互链与 UI 面板展示 | `src/core/npc-types.ts`<br>`src/core/district-types.ts`<br>`src/engine/npc.ts`<br>`src/engine/district-effects.ts`<br>`src/persistence/*-validation.ts`<br>`src/ui/npc-panel.ts`<br>`src/ui/district-panel.ts` |

---

## 三、 各模块详细技术规范与接口定义

---

### 模块 A：中世纪异世界 3 大区域体系与动态地点/特殊地点生成系统

#### A.1 设计目标
在生成中世纪异世界（`worlds:setting.fantasy`）及通用随机世界时，打破原先所有地点平铺在 `region-0` 的单一结构，构建 **3 大固定层级区域（Regions）**，并由区域三维属性动态决定该区域的**地点容量**与**特殊地点（Special Places）**生成。

#### A.2 数据结构扩展规范（`src/world/types.ts` & `src/world/schema.ts`）

1. **区域定义扩展（`WorldRegionDef`）**：
   在 `WorldDef.regions` 元素中增加可选结构化字段（保持对旧版存档向后兼容）：
   ```ts
   export type RegionKind = 'town' | 'domain' | 'wilds';
   export interface RegionStats {
     /** 发展度 (0-100)：决定商业、工坊、高阶设施与特殊市政地点上限 */
     development: number;
     /** 治安度 (0-100)：决定守卫巡逻密度、暗巷/黑市概率及敌对遭遇率 */
     security: number;
     /** 魔力/生态浓度 (0-100)：决定神殿/秘境/魔物巢穴/特殊转化点生成权重 */
     mana: number;
   }
   export interface WorldRegionDef {
     id: string;
     name: string;
     kind?: RegionKind;
     stats?: RegionStats;
     environmentTags: string[];
     ecologyTags: string[];
   }
   ```

2. **地点定义扩展（`WorldLocationDef`）**：
   在 `WorldDef.locations` 元素中增加可选字段 `placeArchetype` 与 `isSpecial`：
   ```ts
   export type PlaceArchetype =
     | 'inn'           // 旅馆/宿屋 (home)
     | 'tavern'        // 酒馆/冒险者集会所 (commons/market)
     | 'blacksmith'    // 铁匠铺/附魔锻造坊 (workshop)
     | 'alchemy'       // 炼金工坊/魔药店 (clinic/workshop)
     | 'guild'         // 冒险者公会/王城公议厅 (commons)
     | 'temple'        // 神殿疗养所/大圣堂 (clinic)
     | 'market_square' // 集市广场 (market)
     | 'sewer'         // 下水道/暗巷黑市 (commons - 特殊低治安)
     | 'manor'         // 领主庄园/哨所堡垒 (home/commons - 领地特殊)
     | 'farm_mill'     // 农庄/磨坊/采石场 (workshop/market - 领地)
     | 'monster_lair'  // 魔物巢穴/史莱姆湿地 (commons - 野外特殊)
     | 'ancient_ruins' // 古代遗迹/地下城入口 (commons/workshop - 野外特殊);
   ```
   在 `ReferenceTemplate`（`kind: 'place'`）的 `data` 中允许可选字段：
   - `regionKinds?: RegionKind[]`（限定该地点模板只能生成在哪些区域类型中）
   - `archetype?: PlaceArchetype`
   - `special?: boolean`（是否为特殊地点）
   - `minStats?: Partial<RegionStats>` / `maxStats?: Partial<RegionStats>`（区域属性门槛，如 `sewer` 要求 `maxStats: { security: 55 }`，`ancient_ruins` 要求 `minStats: { mana: 60 }`）

#### A.3 三大区域属性与地点数量动态分配算法（`src/world/generator.ts`）

当生成世界（特别是 `worlds:setting.fantasy`）时，使用确定性 RNG 流 `generation:regions` 生成三大区域：

| 区域 ID | 区域名称（Fantasy） | `kind` | 默认属性基准（随 Seed 浮动 ±15） | 必保基础地点服务 (`Service`) | 可随机刷出的特殊地点 (`isSpecial: true`) |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `region-town` | 王城内环与街市 | `town` | `development: 75`<br>`security: 75`<br>`mana: 45` | `home`（城门旅馆）<br>`market`（公会交易广场）<br>`workshop`（铁匠锻造坊）<br>`clinic`（神殿疗养所） | **夜莺酒馆**（`tavern`）<br>**炼金魔药铺**（`alchemy`）<br>**地下排水渠/黑市暗巷**（`sewer`，当 `security <= 65` 或随机命中时解锁） |
| `region-domain` | 领地农庄与边境哨所 | `domain` | `development: 50`<br>`security: 55`<br>`mana: 50` | `commons`（边境哨所/公议厅）<br>外加 1–2 个农庄/驿站 | **领主庄园/骑士驻地**（`manor`，`development >= 50`）<br>**荒废祠堂/林间圣泉**（`temple`，`mana >= 50`） |
| `region-wilds` | 魔物荒野与古老遗迹 | `wilds` | `development: 20`<br>`security: 25`<br>`mana: 80` | `commons`（荒野营地/探索前哨） | **腐化魔物巢穴/史莱姆湿地**（`monster_lair`，`mana >= 60`）<br>**古代迷宫遗迹**（`ancient_ruins`，`mana >= 70`） |

- **区域地点数量计算公式**：
  - 若总地点数 `N = parameters.locationCount`（允许范围扩展为 `6–20`，默认建议异世界使用 `8–12`）：
  - 先保底分配 5 个核心 `requiredServices`（确保原有任务和救护绝对不报错）。
  - 剩余 `N - 5` 个地点槽位按区域权重分配：
    - `townWeight = 1.0 + regionTown.stats.development / 100`
    - `domainWeight = 0.8 + (100 - Math.abs(50 - regionDomain.stats.security)) / 120`
    - `wildsWeight = 0.8 + regionWilds.stats.mana / 100`
  - 在每个区域内，优先从满足 `regionKinds` 与 `minStats/maxStats` 的特殊地点模板池中抽取 1–2 个特殊地点（不重复），其余由该区域常规地点填充。
- **跨区域路线连通拓扑**：
  - 区域内部地点使用 `distanceTier: 'adjacent'`（10 分钟，体力 −2）。
  - 区域与区域之间的主干连接（如 `王城城门旅馆 ↔ 边境哨所`、`边境哨所 ↔ 荒野前哨`）使用 `distanceTier: 'cross'` 或 `'far'`（25–45 分钟，体力 −5），并在 2D 网格地图上按区域分列排布（城镇在左/上、领地在中、野外在右/下）。

---

### 模块 B：地点属性驱动的 NPC 与敌人生成系统

#### B.1 设计目标
解决「所有地点刷出的 NPC 和敌人千篇一律」的问题，让**地点的 `archetype`、所属区域的 `stats`（发展度/治安/魔力）以及地点 `tags`** 直接决定该地点会生成什么类型的 NPC 和什么类型的敌人。

#### B.2 地点属性 → 敌人生成映射规则（`src/world/combat-encounters.ts` & `EnvironmentEnemyRule`）

1. **所有危险地点与普通探索地点的选敌池差异化**：
   - **王城内环（`region-town`）**：
     - 普通商业/居住地点（`security >= 60`）：不刷高危魔物；仅在夜间或低治安区刷出 `district:enemy.collector`（暗巷收债人/扒手，人类对手，`tier: 'S' | 'M'`）。
     - 特殊地点「地下排水渠/暗巷（`sewer`）」：刷出 `district:enemy.gel`（下水道黑胶/史莱姆群落）与劫掠者（`progression:enemy.raider`）。
   - **领地边境（`region-domain`）**：
     - 刷出流窜盗匪、狼群/野兽（新增或映射 `fantasy:enemy.wolf_pack` / `progression:enemy.raider`，携带 `beast` 或 `human` 对手标签）。
   - **野外荒野与遗迹（`region-wilds`）**：
     - **魔物巢穴/史莱姆湿地（`monster_lair`）**：高权重刷出触手魔物、虫巢掠食者、大型史莱姆母体（注入 `defeatTags: [progression:tag.coat.stuck, progression:tag.nsfwcombo.active]`，战败直接衔接覆层转化/束缚产卵玩法）。
     - **古代遗迹（`ancient_ruins`）**：刷出遗迹魔像/封锁哨卫（`progression:enemy.sentinel`，`tier: 'L'`）与失控监理/魅魔领主（`progression:enemy.overseer`，`tier: 'boss'`）。
2. **区域属性对敌人数值的动态修正**：
   - 在 `compileCombatEncounters` 生成地点的 `EnvironmentEnemyRule` 时，根据所属区域的 `security` 与 `mana` 计算小幅动态加成（并固化到生成的 `EnvironmentEnemyRule.hp` / `combat` 中，确保完全通过存档校验）：
     - `hpBonus = Math.round(baseHp * ((100 - region.stats.security) * 0.002 + region.stats.mana * 0.002))`
     - `atkBonus = Math.floor((100 - region.stats.security) / 35)`

#### B.3 地点属性 → NPC 分布映射规则
- 每个生成的地点根据其 `archetype` 与 `service` 决定驻留(`work`)与到访(`leisure`)的 NPC 构成：
  - **铁匠铺 (`blacksmith`)**：必配 1 名功能型「铁匠/附魔技师」；高频到访非功能型「重装骑士/佣兵」。
  - **酒馆 (`tavern`) / 旅馆 (`inn`)**：必配 1 名功能型「酒馆老板/旅店掌柜」；高频聚集非功能型「吟游诗人、流浪冒险者、情报贩子、异族旅人」。
  - **神殿 (`temple`)**：必配 1 名功能型「神殿司祭/治疗师」；高频到访非功能型「见习修女、圣殿侍从」。
  - **炼金铺 (`alchemy`)**：必配 1 名功能型「炼金术士/魔药师」；到访「史莱姆娘样本员、魔法学徒」。
  - **野外营地/遗迹周边 (`monster_lair` / `ancient_ruins`)**：无普通市民，仅出现非功能型「遗迹猎人、半兽人斥候、友好的魔物娘/史莱姆体」。

---

### 模块 C：NPC 职业分类重构与打工/协助门控系统

#### C.1 设计目标
在现有代码中，只要在场有任意 `Resident`，玩家都可以点击「帮居民处理手边的事（`resident.help`）」扣除体力直接领钱。这导致对路人、贵族、冒险者、魔物娘也能“打工领工资”，违背角色扮演常识。
本模块将 NPC 严格拆分为 **`functional`（功能型/经营型）** 与 **`non_functional`（非功能型/社交剧情型）**。

#### C.2 Schema 与类型扩展规范（`src/core/district-types.ts` & `src/content/district-schema.ts`）

1. 在 `ResidentTemplate` 与 `Resident` 接口中新增可选字段 `roleKind`（为兼容旧包，缺省值视为 `'functional'`）：
   ```ts
   export type ResidentRoleKind = 'functional' | 'non_functional';
   ```
   - `ResidentTemplate` 新增 `roleKind?: ResidentRoleKind;`
   - `Resident` 新增 `roleKind?: ResidentRoleKind;`
   - **重要校验同步**：
     - 在 `src/content/district-schema.ts` 的 `residentTemplates` 白名单数组中加入 `'roleKind'`，并用 `choice(x.roleKind, p + '/roleKind', ['functional', 'non_functional'])` 校验。
     - 在 `src/persistence/district-validation.ts` 的 `d.residents` 循环中，允许 `n.roleKind === undefined || n.roleKind === (t.roleKind ?? 'functional')`。

#### C.3 功能型 vs 非功能型职业划分表（中世纪异世界）

| 类别 (`roleKind`) | 包含职业 (`profession`) | 允许的互动行为 | 禁止的互动行为 |
| :--- | :--- | :--- | :--- |
| **`functional`（功能型）** | 铁匠、酒馆老板、旅店管事、商会经纪、药剂炼金师、神殿医师、公会执事 | 日常交谈 (`resident.talk`)、**打工协助 (`resident.help`)**、商品/装备交易、主支线公共委托、好感培养 | — |
| **`non_functional`（非功能型）** | 流浪骑士、见习修女、吟游诗人、落魄贵族、半兽人猎手、遗迹学者、史莱姆旅人/魔物娘 | 日常交谈 (`resident.talk`)、性格专属互动、切磋/同行、赠礼、**双向攻略（恋爱/臣服）与恶堕调教** | **禁止打工协助 (`resident.help`)** |

#### C.4 引擎门控实现（`src/engine/selectors.ts` & `src/engine/district.ts`）

1. **`src/engine/selectors.ts` 预检拦截**：
   在遍历 `effects` 检查 `e.op === 'resident.help'` 时，增加判断：
   ```ts
   const roleKind = resident?.roleKind ?? t?.roleKind ?? 'functional';
   if (roleKind !== 'functional') {
     checks.push({
       pass: false,
       reason: `${resident?.name ?? '对方'}（${resident?.profession ?? '非经营者'}）不提供打工或雇佣差事，可尝试交谈或深层互动。`
     });
   }
   ```
2. **`src/engine/district.ts` 事务兜底拦截**：
   在 `residentInteraction(state, registry, help)` 中，当 `help === true` 时：
   ```ts
   const roleKind = r.roleKind ?? t.roleKind ?? 'functional';
   if (roleKind !== 'functional') {
     throw new RuleError('RESIDENT_NOT_EMPLOYER', `${r.name}不是店铺或工坊经营者，无法在此打工。`);
   }
   ```
3. **UI 显示优化（`src/ui/render.ts`）**：
   当在场居民为 `non_functional` 时，将不可用的「帮居民处理手边的事」自动归入底部折叠的 `暂不可用` 或直接由性格专属互动按钮替代，保持主界面清爽。

---

### 模块 D：基于 NPC 性格差异的动态互动分支系统

#### D.1 设计目标
让不同性格的 NPC 在面对玩家互动时，不再返回千篇一律的通用文本和固定 `+1` 信任，而是根据性格标签展现**专属互动选项、差异化对白反馈、不同的好感/顺从度增减幅度与前置门槛**。

#### D.2 性格维度标准词表（6 大核心性格原型）

在 `aetheria/adventure`（或新增 `aetheria/fantasy-social` 包）中注册以下 6 个标准性格 Tag（`facets: ['context']`）：

| Tag ID | 中文标签 (`label`) | 性格表现与说话风格 | 偏好互动（高收益） | 排斥互动（负收益/需高属性） |
| :--- | :--- | :--- | :--- | :--- |
| `progression:trait.noble` | `高傲矜持` | 言辞讲究礼数与身份，起初冷淡，看重实力与体面 | 展示声望/战绩、礼貌请教、赠送精致饰品 | 粗鲁搭讪（好感 −2）、低声望强行套近乎 |
| `progression:trait.shy` | `羞怯敏感` | 说话轻声细语，目光容易闪躲，害怕成为焦点 | 安静倾听、温和鼓励、私下独处交谈 | 当众调戏（压力剧增）、强势逼问（好感 −2，但若玩家强势度高则顺从 +3） |
| `progression:trait.forthright` | `直率豪爽` | 快人快语，重义气与当面约定，讨厌拐弯抹角 | 痛快共饮、切磋武艺、直接谈正事 | 含糊试探、违背承诺 |
| `progression:trait.calculating` | `精明务实` | 习惯先算清利益与代价，无利不起早 | 利益交换、赠送金钱/稀有材料、契约合作 | 空口白话、无偿索取帮助 |
| `progression:trait.devout` | `虔诚克制` | 严守戒律与边界，压抑个人欲望，富有同情心 | 探讨信仰/秩序、协助救护；**恶堕线高反差目标**（高欲望/低理智下触发破戒分支） | 初期直接色诱（遭严词拒绝） |
| `progression:trait.playful` | `狡黠魅惑` | 喜欢主动试探与调侃玩家，享受暧昧拉扯 | 顺势接梗、大胆调情、接受恶作剧挑战 | 一本正经说教 |

#### D.3 数据结构与触发机制

1. **`ResidentTemplate` 与 `Resident` 扩展**：
   - 增加可选字段 `traitTags?: Id[]`（每个居民生成时根据其抽中的 `personality` 绑定 1–2 个对应的 `progression:trait.*` Tag）。
2. **将在场居民的 `traitTags` 注入叙事上下文（`src/engine/narrative.ts`）**：
   - 在 `startNarrative` 与 `narrativeTags(s, r)` 中，若当前存在在场交互居民（`story.actor?.kind === 'resident'` 或 `currentResidentId`），自动将该居民的 `traitTags` 作为 `{ role: 'opponent', tagId }` 注入激活 Tag 集合！
   - **架构优势**：无需发明新引擎！直接复用现有的 `NarrativeNode.requiresTags: [{ role: 'opponent', tagId: 'progression:trait.shy' }]` 与 `priority` 机制，即可在点击「与在场居民深入交谈（`progression:action.narrative.conversation`）」时，自动按 NPC 性格路由到对应的专属对话树与选项分支！

---

### 模块 E：部分 NPC 与敌人的双向攻略（好感/臣服）与恶堕（腐蚀/调教）系统

#### E.1 设计目标
构建一套完整、自洽、可通过存档校验的**深度关系与身心转化系统**，支持：
1. **玩家 → NPC 双向攻略与恶堕**：
   - **纯爱攻略线（Romance）**：提升 `affection`（爱意）与 `trust`（信任），解锁恋人日常、专属援助与纯爱私密互动。
   - **支配臣服线（Domination）**：提升对 NPC 的 `submission`（屈服度），让高傲或强势的 NPC 逐渐对玩家顺从听命。
   - **恶堕调教线（Corruption）**：针对具有「可恶堕潜质」的 NPC（如虔诚修女、高傲女骑士、冷酷执事），通过特定道具/共生材质/私密调教累积其 `corruption`（恶堕度 0–100），分阶段改变其心态、台词、着装描述甚至身体部位（利用引擎已有的 `tf.apply` / `tf.enqueue` 支持 `target: { kind: 'resident', id }` 或 `{ kind: 'npc', id }` 的跨实体变形能力！）。
2. **特殊敌人 ↔ 玩家双向攻略与恶堕**：
   - **玩家被敌人恶堕**：战败于特殊魔物/Boss 时，除常规脱困外，玩家可选择「屈服迎合 / 接受共生洗礼」，推进玩家自身的 `core:desire`、`core:submissionTendency` 与身体黑胶化/黏液化/兽化，解锁魔物阵营亲和或堕落结局。
   - **玩家收服/攻略特殊敌人**：在战胜或满足特定条件（如携带信物、展示高技能强度或共生身体）时，可对特殊敌人（如「渠底史莱姆母体」「迷宫魅魔」「堕落游侠」）触发**收服/契约分支**，将其转化为可反复互动的特殊驻留角色或召唤伙伴。

#### E.2 核心状态模型与数值维度扩展（`Resident` & `NPCState`）

为了保持存档结构清晰且完全受控，在 `Resident`（`src/core/district-types.ts`）与 `NPCState`（`src/core/npc-types.ts`）中扩展可选的 `affinity` 对象（或在 `RELATION_FIELDS` 中扩展）：

```ts
export type RelationshipRouteStage =
  | 'stranger'     // 陌生 (默认)
  | 'acquaintance' // 相识
  | 'close'        // 亲近/暧昧
  | 'lover'        // 恋人 (纯爱达成)
  | 'submissive'   // 臣服 (支配达成)
  | 'corrupted'    // 恶堕 (堕落达成);

export interface EntityAffinityState {
  /** 爱意/好感 (0-100) */
  affection: number;
  /** 屈服/顺从度 (0-100) */
  submission: number;
  /** 恶堕/腐蚀度 (0-100) */
  corruption: number;
  /** 当前所处关系主路线阶段 */
  stage: RelationshipRouteStage;
}
```

#### E.3 四阶段状态机转化阈值表

| 阶段 (`stage`) | 触发条件 | 解锁表现与玩法变化 |
| :--- | :--- | :--- |
| **Stage 0：初识 (`stranger` / `acquaintance`)** | 初始状态 / `visits >= 1` | 仅开放基础交谈、打听消息、普通委托。 |
| **Stage 1：动摇与亲近 (`close`)** | `affection >= 30` 或 `submission >= 30` 或 `corruption >= 30` | 对白态度软化或出现动摇；解锁「赠送贴身礼物」「邀请私下茶叙」「试探身体边界」选项。 |
| **Stage 2：深度分流（三选一或复合）** | 见下表三分支条件 | 解锁专属剧情事件与私密互动场景（`InteractionDef`）。 |
| ├─ **纯爱分支 (`lover`)** | `affection >= 70` 且 `trust >= 10` 且 `corruption < 50` | 成为伴侣；每日可领取伴侣补给、免费恢复理智与精力，解锁纯爱合意互动 (`adult_optional`)。 |
| ├─ **臣服分支 (`submissive`)** | `submission >= 70` | 对玩家唯命是从；可要求其上交部分收入、执行高危跑腿或进入主从调教互动。 |
| └─ **恶堕分支 (`corrupted`)** | `corruption >= 70` | 彻底沉沦；改变角色外观描述与性格表现（如虔诚修女变为渴望共生触感的堕落信徒），可对其使用 `target` 指向该 NPC 的 `tf.apply` 安装狼耳/生物尾/黑胶共生手部！ |

#### E.4 新增 DSL 条件与效果操作符规范（供模块 E 实现）

为了在 JSON 内容包中安全读写上述关系维度，在 `src/core/district-types.ts`、`src/content/schema.ts`、`src/engine/conditions.ts`、`src/engine/effects.ts` 中标准新增以下两个操作符：

1. **条件操作符 `affinity.compare`**：
   ```json
   {
     "op": "affinity.compare",
     "target": { "kind": "resident", "id": "current" },
     "field": "corruption",
     "comparison": "gte",
     "value": 30
   }
   ```
   - 支持 `target`: `{ kind: 'npc', id: Id }` 或 `{ kind: 'resident', id: string | 'current' }`（`'current'` 表示当前选中的在场居民 `state.district.currentResidentId`）。
   - 支持 `field`: `'affection' | 'submission' | 'corruption' | 'trust'`。
2. **效果操作符 `affinity.change`**：
   ```json
   {
     "op": "affinity.change",
     "target": { "kind": "resident", "id": "current" },
     "affection": 5,
     "submission": 0,
     "corruption": 10
   }
   ```
   - 在 `applyDistrictEffect` 中执行，自动将数值限制在 `0–100`，根据阈值自动更新 `stage`，并将变化写入 `context.changes`（如 `「Elena·恶堕度 20 → 30」`）供 UI 顶部/底部反馈展示。

---

## 四、 分发给其他 AI 的标准任务卡（可直接复制发送）

> **使用说明**：你可以将本工程压缩包发给不同的 AI，然后把下方对应的【AI 任务卡】连同【第一节：全局工程铁律】一起复制发给它。每个任务卡都已经限定了文件修改边界与自测命令，方便最后合并。

---

### 📋 任务卡 1（发给 AI-1）：实现中世纪异世界 3 大区域与动态地点/特殊地点生成系统

```markdown
【任务目标】
在当前《以太都市 / 墨卷》代码库上，为世界生成器（特别是 `worlds:setting.fantasy` 中世纪异世界）实现「城镇/领地/野外」3 大区域体系、区域三维属性（发展度/治安/魔力），以及基于区域属性的地点数量动态分配与特殊地点随机生成。

【必须遵守的工程红线】
1. 严禁破坏现有 Schema 白名单校验。任何新增字段必须同步更新 `src/world/types.ts`、`src/world/schema.ts`、`src/world/generator.ts` 和 `src/world/validation.ts`。
2. 所有随机抽取必须使用 `draw(randomState, 'generation:...')` 确定性流，严禁使用 `Math.random()`。
3. 必须保留 5 种基础服务（`home`, `market`, `workshop`, `clinic`, `commons`）的生成保底，确保主支线任务绑定（`compileWorldQuests`）100% 正常工作。

【具体实现要求】
1. 扩展 `src/world/types.ts` 与 `src/world/schema.ts`：
   - 在 `WorldDef.regions` 元素中支持可选 `kind: 'town' | 'domain' | 'wilds'` 与 `stats: { development: number; security: number; mana: number }`（0–100 整数）。
   - 在 `WorldDef.locations` 元素中支持可选 `archetype` 与 `isSpecial: boolean`。
   - 在 `ReferenceTemplate`（`kind: 'place'`）的 `data` 中支持可选 `regionKinds`、`archetype`、`special`、`minStats`、`maxStats`。
2. 升级 `src/world/generator.ts`：
   - 生成 `region-town`（王城街市）、`region-domain`（领地边境）、`region-wilds`（魔物荒野）三个区域，并按种子生成各自的 `stats`。
   - 根据 `parameters.locationCount`（支持 5–20）和各区域的 `stats` 动态计算三个区域的地点配额。
   - 在 `content/generation/fantasy-reference.json`（或 `lexicon-reference.json`）中补充特殊地点模板（酒馆 `tavern`、铁匠铺 `blacksmith`、炼金铺 `alchemy`、大圣堂 `temple`、下水道黑市 `sewer`、领主庄园 `manor`、魔物巢穴 `monster_lair`、古代遗迹 `ancient_ruins`），按区域属性门槛随机抽选合入。
   - 同一区域内地点路线设为 `adjacent`，跨区域主干路线设为 `cross` 或 `far`。
3. 升级 `src/world/validation.ts`：
   - 支持多区域（1–5 个区域）及新增可选字段的存档校验。

【交付与自测要求】
完成后必须运行以下命令并确保 0 报错：
- `npm run typecheck`
- `node --test tests/worldgen.test.ts tests/worldgen-v02.test.ts tests/world-profiles.test.ts`
- `npm run build`
```

---

### 📋 任务卡 2（发给 AI-2）：实现地点属性驱动的敌人与 NPC 生成规则系统

```markdown
【任务目标】
在当前代码库上，实现「根据地点类型、所属区域属性（治安/魔力）与地点 Tag 动态生成对应敌人（`EnvironmentEnemyRule`）与驻留 NPC」的系统。

【必须遵守的工程红线】
1. 选敌规则必须通过 `EnvironmentEnemyRule`（见 `src/core/adventure-types.ts` 与 `src/engine/environment-enemies.ts`）实现，严禁硬编码改写 `EnemyDef` 原始模板字节。
2. 新增 Tag 必须在对应包的 `tags` 中注册且包含中文 `label`，新增敌人必须在 `enemies` 与 `narrativeProfiles` 中配对登记。

【具体实现要求】
1. 扩充中世纪异世界敌人池（在 `scripts/build-adventure-content.mjs` 或 `content/generation/fantasy-content.json` 中）：
   - 城镇暗巷/下水道敌人：暗巷劫掠者、下水道黑胶怪（战败附加 `progression:tag.coat.stuck`）。
   - 领地边境敌人：流窜盗匪、荒原座狼群（`beast` 标签）。
   - 野外巢穴/古代遗迹敌人：史莱姆母体/触手魔物（战败附加 `progression:tag.nsfwcombo.active`）、遗迹重装魔像（`tier: 'L'`）、堕落监理/魅魔领主（`tier: 'boss'`）。
2. 升级 `src/world/combat-encounters.ts`：
   - 不再只对 `service === 'commons'` 生成单一敌人，而是根据地点的 `tags`、所属区域的 `security` / `mana`（若存在）以及地点类型，为危险地点（下水道、边境、野外巢穴、遗迹）编译对应的 `EnvironmentEnemyRule` 与拦路事件。
   - 根据区域危险度（`100 - security` 与 `mana`）在生成的 `EnvironmentEnemyRule` 上动态覆盖敌人的 `hp`、`reward` 与 `combat` 数值。
3. 升级 `src/world/generator.ts` 中的 NPC 分配逻辑：
   - 让不同 `service` / `archetype` 的地点优先匹配符合该场所特征的 `ResidentTemplate`（如铁匠铺匹配铁匠/重装佣兵，神殿匹配司祭/修女，酒馆匹配酒保/吟游诗人/冒险者）。

【交付与自测要求】
完成后必须运行以下命令并确保 0 报错：
- `npm run typecheck`
- `node --test tests/environment-enemies.test.ts tests/adventure.test.ts tests/worldgen.test.ts`
- `npm run build`
```

---

### 📋 任务卡 3（发给 AI-3）：重构 NPC 职业分类与打工/协助门控系统

```markdown
【任务目标】
重构 NPC（`ResidentTemplate` 与 `Resident`）的职业分类，将其划分为 `functional`（功能型）与 `non_functional`（非功能型），限制只有功能型 NPC（如铁匠、酒馆老板、炼金术士、公会接待员、商队账房等）可以打工协助（`resident.help`），非功能型 NPC（流浪骑士、修女、贵族、普通冒险者、魔物娘旅人等）不可打工。

【必须遵守的工程红线】
1. `src/content/district-schema.ts` 和 `src/persistence/district-validation.ts` 对 `ResidentTemplate` 和 `Resident` 有严格的字段校验，新增字段必须同步更新这两处校验器，且对未填该字段的旧存档默认按 `'functional'` 兼容。
2. 不可打工的 NPC 必须在 `selectors.ts` 中使 `resident.help` 动作变为 `available: false` 并给出清晰中文原因，同时在 `district.ts` 的 `residentInteraction` 中做服务端兜底拦截。

【具体实现要求】
1. 在 `src/core/district-types.ts` 中定义 `export type ResidentRoleKind = 'functional' | 'non_functional';`，并在 `ResidentTemplate` 与 `Resident` 接口中增加可选字段 `roleKind?: ResidentRoleKind;`。
2. 在 `src/content/district-schema.ts` 与 `src/persistence/district-validation.ts` 中加入对 `roleKind` 的合法性校验。
3. 在 `src/world/generator.ts` 实例化 `Resident` 时，将模板的 `roleKind` 拷贝到生成的 `Resident` 实例上；并在 `content/generation/fantasy-content.json` 与 `fantasy-reference.json` 中扩充中世纪异世界的功能型与非功能型居民模板。
4. 在 `src/engine/selectors.ts` 与 `src/engine/district.ts` 中实现 `resident.help` 的 `roleKind === 'functional'` 门控。

【交付与自测要求】
完成后必须运行以下命令并确保 0 报错：
- `npm run typecheck`
- `node --test tests/district.test.ts tests/save.test.ts tests/worldgen.test.ts`
- `npm run build`
```

---

### 📋 任务卡 4（发给 AI-4）：实现基于 NPC 性格差异的动态互动分支系统

```markdown
【任务目标】
让 NPC 的性格（`personality`）不再只是静态描述文本，而是通过结构化性格标签（`traitTags`）驱动差异化的互动选项分支、对话反馈以及不同的好感/顺从度变化。

【必须遵守的工程红线】
1. 所有性格 Tag 必须在内容包的 `tags` 数组中正式注册（含中文 `label`），且状态为 `active`。
2. 严禁在 `evaluate` 或 UI 中使用随机数；性格分支通过 `NarrativeNode` 的 `requiresTags`、`tendencies` 与 `priority` 机制实现。
3. 每个新增的 `NarrativeNode` 必须至少包含一个 `next: null`、`conditions: []` 且不扣资源的免费退出选项。

【具体实现要求】
1. 在 `src/core/district-types.ts`、`src/content/district-schema.ts`、`src/persistence/district-validation.ts` 中为 `ResidentTemplate` 与 `Resident` 增加可选字段 `traitTags?: Id[]`。
2. 在 `content/adventure/pack.json`（及生成脚本 `scripts/build-adventure-content.mjs`）中注册 6 类核心性格 Tag：
   - `progression:trait.noble`（高傲矜持）
   - `progression:trait.shy`（羞怯敏感）
   - `progression:trait.forthright`（直率豪爽）
   - `progression:trait.calculating`（精明务实）
   - `progression:trait.devout`（虔诚克制）
   - `progression:trait.playful`（狡黠魅惑）
3. 在 `src/world/generator.ts` 与 `src/engine/district.ts` 生成居民时，根据抽中的性格描述自动绑定 1–2 个对应的 `traitTags`。
4. 在 `src/engine/narrative.ts` 的 `narrativeTags(s, r)` 与 `startNarrative` 中，当存在当前交互居民时，将其 `traitTags` 作为 `{ role: 'opponent', tagId }` 注入激活标签集合。
5. 在 `scripts/build-adventure-content.mjs` 中编写针对上述 6 种性格的 `kind: 'conversation'` 专属叙事节点与选项（例如：对高傲者可选择「礼貌请教 / 展示实力 / 强行调侃」，对羞怯者可选择「温和安抚 / 贴近耳语 / 强势壁咚」），产生不同的资源/好感/顺从度变化。

【交付与自测要求】
完成后必须运行以下命令并确保 0 报错：
- `npm run typecheck`
- `node --test tests/adventure.test.ts tests/district.test.ts`
- `npm run build`
```

---

### 📋 任务卡 5（发给 AI-5）：实现 NPC 与敌人的双向攻略（纯爱/臣服）与恶堕（腐蚀/调教）系统

```markdown
【任务目标】
实现可攻略/可恶堕 NPC 与特殊敌人的双向深度关系系统，支持「纯爱攻略 (`lover`)」「支配臣服 (`submissive`)」「恶堕调教 (`corrupted`)」三条路线，以及战败/战胜特殊敌人时的双向恶堕与收服交互。

【必须遵守的工程红线】
1. 所有新增状态字段、Condition（`affinity.compare`）与 Effect（`affinity.change`）必须完整接入 `src/core/types.ts`、`src/content/schema.ts`、`src/engine/conditions.ts`、`src/engine/effects.ts` 与 `src/persistence/*-validation.ts`。
2. 任何涉及成人描写的分支必须配置 `{ "op": "preference.adultOptional", "value": true }` 条件门控，并提供通用级（`general`）回退分支，确保未开启成人偏好时流程不断裂。
3. 对 NPC 施加身体改造（如恶堕后长出狼耳、生物尾、黑胶共生手部）必须调用引擎已有的 `tf.apply` / `tf.enqueue` 并传入 `target: { kind: 'resident', id }` 或 `{ kind: 'npc', id }`，严禁伪造非法 `BodyGraph`。

【具体实现要求】
1. 状态模型扩展：
   - 在 `Resident`（`src/core/district-types.ts`）与 `NPCState`（`src/core/npc-types.ts`）中增加可选字段 `affinity?: { affection: number; submission: number; corruption: number; stage: 'stranger' | 'acquaintance' | 'close' | 'lover' | 'submissive' | 'corrupted' }`。
   - 同步更新 `src/persistence/district-validation.ts` 与 `src/persistence/npc-validation.ts` 校验 `0–100` 整数范围与合法枚举值。
2. 新增 DSL 操作符：
   - Condition：`{ op: 'affinity.compare', target, field: 'affection' | 'submission' | 'corruption' | 'trust', comparison: 'eq' | 'gte' | 'lte', value: number }`
   - Effect：`{ op: 'affinity.change', target, affection?: number, submission?: number, corruption?: number }`（自动夹紧 0–100，并根据阈值 `>= 30` 进入 `close`、`affection >= 70` 进入 `lover`、`submission >= 70` 进入 `submissive`、`corruption >= 70` 进入 `corrupted`）。
3. 编写双向攻略与恶堕内容链（`scripts/build-adventure-content.mjs` & `content/district/pack.json`）：
   - **NPC 攻略/恶堕互动链**：在 `close` 阶段开放「约会倾诉（+affection）」「威压训诫（+submission）」「暗中施加共生/催眠诱导（+corruption）」；达到 70 阈值后分别解锁伴侣援助、主从调教、恶堕身体重塑（触发目标 NPC 的 `tf.apply`）与专属私密场景。
   - **特殊敌人双向交互**：在击败或战败于特殊敌人（如渠底黑胶/史莱姆、魅魔/堕落骑士）时，增加「顺从迎合（玩家自身 desire/submission 上升并触发 TF）」与「以契约/魔力收服对方（将特殊敌人转化为当前地点可互动的持久 Resident）」分支。
4. UI 展示升级（`src/ui/npc-panel.ts`、`src/ui/district-panel.ts`、`src/ui/folio.ts`）：
   - 在右侧「对面的人」面板、人物档案与 NPC 图鉴中，直观展示已结识角色的 `爱意 / 顺从 / 恶堕` 进度条与当前关系阶段徽章（如 `【恋人】`、`【臣服】`、`【恶堕】`）。

【交付与自测要求】
完成后必须运行以下命令并确保 0 报错：
- `npm run typecheck`
- `node --test tests/npc.test.ts tests/district.test.ts tests/adventure.test.ts tests/save.test.ts`
- `npm run build`
```

---

## 五、 主控合并顺序与集成验收清单

当你从各个 AI 收回修改后的文件时，建议按以下顺序合并与验收：

1. **第一波合并（底层数据结构与世界生成）**：先合并 **模块 A** 与 **模块 C**（因为它们修改了 `WorldDef` 与 `Resident` 的基础结构）。
   - 运行：`npm run typecheck && node --test tests/worldgen.test.ts tests/district.test.ts`
2. **第二波合并（地点选敌与性格分支）**：再合并 **模块 B** 与 **模块 D**。
   - 运行：`node --test tests/environment-enemies.test.ts tests/adventure.test.ts`
3. **第三波合并（攻略/恶堕状态机与 UI 面板）**：最后合并 **模块 E**。
   - 运行全量构建与测试：
     ```bash
     node scripts/build-adventure-content.mjs
     node scripts/build-world-profiles.mjs
     npm run build
     npm test
     ```
4. **一键生成单文件离线版**：
   - 运行 `node scripts/build-standalone.mjs`，即可自动生成包含所有最新内容与代码的 `dist/Aetheria-Folio.html` 与根目录 `启动游戏-双击直接运行.html`。
