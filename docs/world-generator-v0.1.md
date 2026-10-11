# 世界生成器 v0.1

本模块继续 Alpha 0.2。固定以太都市是框架测试世界；随机街区是独立测试模式。两者都通过 `Registry → GameState → ActionExecutor → SaveCodec` 运行。没有第二套战斗、身体、TF、人物行动或事件引擎。

## 进入试玩

直接打开 `dist/Aetheria-Alpha-0.2.html`，在「世界」中输入种子、地点与居民数量，点击「生成并进入街区」。默认7个地点、9名居民；可选5–20个地点、3–40名居民。

两份已经生成的独立版本：`dist/WorldGenerator-Seed-7.html` 与 `dist/WorldGenerator-Seed-42.html`。它们分别从晴砾和雾潮生态开始，各有独立手动槽，不覆盖主版本的原存档。全程不调用 AI、账号服务或网络 API。模块版继续支持 `start_game.bat` 与 `localhost:4173`。

地点提供旅行、工作、免费恢复、等候与遭遇入口。在市场、工坊和公共空间留意居民；事件可完成或退出，然后与居民交谈/协助。认识后人物册显示真实日程、当前位置与已经发生的经历。诊所提供已有机械改造，身体面板继续原自由塑形。地图只显示当前世界。

进入新世界会替换当前未保存进度；手动槽直到点击保存才被覆盖。示例原始存档在 `dist/worlds/seed-7.json` 和 `seed-42.json`，可通过存档菜单导入。导入也不自动覆盖手动槽。

## 源码与所有权

| 文件 | 职责 |
| --- | --- |
| `src/world/types.ts` | WorldDef、WorldInstance、生成参数与参考模板契约 |
| `src/world/generator.ts` | 有界、确定性的初始生成与既有 DSL 编译 |
| `src/world/schema.ts` | 参考/规则 JSON 结构、引用与范围校验 |
| `src/world/simulation.ts` | 随时间更新已有居民的活动位置 |
| `src/world/validation.ts` | 快照、连通性、日程、职业/身体能力、关系与来源验证 |
| `src/ui/world-panel.ts` | 世界创建及只影响未来新世界的参考库导入 |
| `tests/worldgen.test.ts` | 生成、复现、存档、兼容、失败事务与扩展测试 |
| `tests/worldgen-browser.mjs` | 实际浏览器与离线版本验收 |

`generate` 返回 `{ world, state, registry }`。`world` 是版本化的世界定义/生成来源/组织/居民日程与基础关系网络；`state` 是完整可进入游戏的权威状态。居民的身体、职业、性格、对玩家的关系和记忆仍由原 `state.district.residents` 持有，`world.agents` 用稳定 ID 引用它们，避免复制两份人物权威。原固定 NPC 则继续原 `state.npcs`。

```ts
const source = await loadPacks(loadedContentPacks);
const generated = await new WorldGenerator().generate({
  seed: 42, registry: source,
  rules: generationRuleJSON,
  references: [referencePackJSON],
  parameters: { locationCount: 7, npcCount: 9 },
});
const engine = new ActionExecutor(generated.registry, generated.state);
const save = await new SaveCodec(generated.registry).encode(engine.snapshot());
```

生成器复用原命名 RNG 流，但生成与运行事件使用不同流。没有当前时间、`Math.random` 或实时 AI 参与抽样。候选按稳定 ID 排序；包顺序不控制抽样结果。地图先构造双向生成树，再添加不重复捷径；旅行不扣钱/精力，所有地点可免费恢复，避免资源耗尽死锁。原型身体通过原图校验器和补丁生成，外观中的部件名称从真实身体图取得。首版工作居民需要移动与抓握能力，不推定固定肢体数量。

生成完成后，模拟器只根据保存的日程推进位置，不重抽身份、地图、故事或职业。跨日和跨多个日程边界可直接计算最终位置；不由重绘结算。失败行动保留时钟、人物位置、RNG 和事务状态。NPC 间有最低限度的同事/邻里/相识关系网络；玩家关系继续原信任、交谈次数及事实记忆。

## 参考包格式

可编辑示例：`content/generation/reference.json`。规则示例：`content/generation/rules.json`。JSON 必须通过结构和跨内容引用校验；未知字段、错误引用、超限数据、不兼容组合会拒绝导入/生成并保留当前世界。

ReferencePack 外层包含 `format: "aetheria-reference"`、`schemaVersion: 1`、稳定 `id`、三段 `version` 和 `templates`。每个模板必须含下列字段，空条件使用空数组：

| 字段 | 含义 |
| --- | --- |
| `id`, `kind`, `data` | 唯一模板 ID；environment/place/npc/faction/event 及对应结构数据 |
| `environmentTags` | 非空时至少匹配一个世界环境标签 |
| `weight` | 1–1000 的整数基础权重 |
| `requiresTags`, `excludesTags` | 当前上下文必须全部具备/必须不具备的标签 |
| `compatibleTags` | 非空时至少匹配一个当前上下文标签 |
| `requiresPacks` | 模板所需的内容包；缺包的模板不进入候选池 |
| `combination.requiresTemplates` | 必须已经选中这些模板 |
| `combination.excludesTemplates` | 与这些模板互斥，双向检查 |
| `combination.boosts` | 匹配标签时用整数 multiplier（1–10）增加权重 |
| `contributes.tags` | 可贡献世界/地点标签 |
| `contributes.npcTemplateIds` | 贡献已加载内容包的居民原型；沿用父模板条件并检查职业适配 |
| `contributes.eventIds` | 贡献已有通用评级、自足事件，必须无固定人物/地图依赖并有免费退出路径，登记到 Storylet 池 |
| `contributes.tfIds` | 在适用地点暴露已有 TF 入口，调用原变形管线 |

`environment.data`：name、description、tags；`place.data`：service、names、description、economy、professions；`npc.data`：residentTemplateId；`faction.data`：name、activities；`event.data`：label、prompt、completeText、minutes、reward。事件模板编译成原选择节点、合法退出与公开行动 Hook。没有脚本、任意 opcode 或自由文本写状态入口。

选择顺序为环境→组织→地点及地点事件→居民。组合依赖必须指向先前已选择模板；首版不做约束回溯求解。场景标签按世界环境及当地用途匹配，居民职业必须出现在工作地点的职业列表里。导入库不保证任意配置都可生成；缺少必需用途或合法职业时给出明确错误，不填充空名字占位物。

GenerationRulePack 的 `format` 为 `aetheria-generation-rules`，包含 schemaVersion/id/version、requiredServices、locationCount、npcCount、extraConnections、startMinutes、workStart、workEnd、leisureEnd。首版 requiredServices 必须各包含 home/market/workshop/clinic/commons 一次，顺序决定先生成哪些用途。日程连续覆盖全天，时间为一天内分钟。

## 添加自己的内容

界面「世界→管理生成参考库」可分别导入参考包、生成规则和生成用内容包。新增种族、部件、身体、TF、人物原型或 DSL 事件时先按原 ContentPack 格式提供定义，再由 ReferencePack 引用。生成器没有取代内容包或写作流水线。

实际扩展示例：先导入 `addon-content.json`，再导入 `addon-reference.json`，用种子42创建新街区，可以看到新职业及其工作场所参与生成。旧世界和旧档不变。缺少所需包时对应模板不会参与生成。库可恢复默认；当前世界继续保留自己的快照。

模板库可逐步增加，不需要用户逐名编写 NPC 剧情。未来 AI 转换自然语言、图片和设定资料应输出待审核 JSON，再走内容与参考校验。此次未接入 AI 转换服务，也不接纳自由文本直接修改世界。

## 存档与复现

生成记录保存 generatorVersion、seed、完整规则与 rulesHash、参考包 ID/版本/SHA-256、生成时内容包 ID/版本/SHA-256、规模参数和已选择模板 ID。WorldDef 保存所有运行定义的完整内容快照。存档只保存实例，不在读取时运行生成器。

生成存档由当时快照重新建立 Registry，再通过既有身体、TF、NPC、事件、RNG、账本和新增世界校验。外部参考库变化、删除或新增内容不会重抽旧世界。运行中允许的追加事件包进入运行快照及存档 meta，但不改写生成时原始内容来源。

同种子、同规则、同版本内容和同参考库保证初态一致；输入包集合、模板文件内容或生成器版本改变时允许产生不同新世界。不能把单独一个 seed 当成跨版本世界标识。

新增 worldInstance 是 schema3 的可选版本化模块，固定世界旧档保持原路径与原精确迁移。旧引擎不保证读取生成存档。内容快照仍受原4 MiB存档上限约束；长期账本接近上限时明确拒绝保存，不删经历。

## 验证和构建

Node.js 24+，依赖沿用工程现有 TypeScript/Playwright。

```text
npm run check
npm run test:worldgen
npm run test:worldgen:browser
```

浏览器测试默认使用本机 Edge；其他安装可用 BROWSER_EXECUTABLE_PATH 指定。`npm run build` 同时生成模块版、通用离线 HTML、两个独立示例 HTML、初始存档和来源 manifest。`scripts/create-world-reference.mjs` 可重建首版示例 JSON，日常用户编辑 JSON 不需运行它。

32 个种子测试覆盖5/20地点与3/40居民边界。测试包含全地图可达和双向返回、真实身体/职业/日程、身份/记忆跨日稳定、同种子完整复现、添加内容参与生成、旧档快照恢复、现有TF与事件行动、无效输入和重算checksum后的非法状态拒绝。浏览器另验实际生成、人物册、参考库更新、存档刷新、固定/生成切换、窄屏与离线零网络运行。

## 未实现及限制

- 单街区、单主生态；没有大陆、多区域气候、文明演化或地图坐标避碰求解。
- 日程边界直接更新位置；没有逐边通勤、NPC主动剧情、换职业、迁徙、NPC自身TF/机械改装。
- 基础关系网络与组织分布可以保存；没有自主关系演化、组织竞争、政治或完整经济。
- 地点和事件主要按结构模板组合；没有自动长篇个人攻略、自动编写秘密/谜题或实时AI。
- 不提供任意旧包版本迁移；固定世界仍沿用原兼容协议。生成旧档使用自身快照。
- 不承诺任意参考库组合都有解；约束不满足会拒绝生成。所有必需用途要有合法候选。
- 动态居民继续原轻量交谈/协助系统；没有把其伪装成原核心人物完整攻略线。

隐藏事件池不在玩家世界菜单中展示。生成 manifest 只汇报种子、生态、规模与来源，不向玩家列出秘密或特殊剧情。
