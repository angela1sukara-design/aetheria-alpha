# 内容创作与底层格式契约 v2

适用于当前 Alpha 0.2 的 foundation 增量接口。素材、规则、状态分离：写作 AI 只交付素材；审核和规则作者另行决定使用方式；状态只由现有事务、事件与 TF 系统改变。收录一条材料不代表已实现相应器官或玩法。

## 交给写作 AI 的正式指令

按委托的词库、子类和数量生产可重复利用的纯素材。使用本目录 general-example.json 的结构；需要专用分级的素材沿用 nsfw-example.json 的元数据结构。一次交付可以是一个压缩包，内部放多个 JSON 文件，每文件 1–50 条。内部文件分块用于稳定 ID、校验和去重，不要求逐次询问用户。

开始前读取 tag-dictionary.json。dictionary 原样填写其 source 对象。可用 Tag 必须是字典中 status=active 的完整稳定 ID；不认识或不需要时填写空 tags 数组，不自造 ID，不把中文显示名当 ID。Tag 只是检索语义，不是角色身体、成年证明或剧情事实。

每条只写名称或短句 text、简短 description、subcategory 和必要语义引用；确有必要时写 synonyms。不要写概率、权重、条件、互斥规则、效果、脚本、行动数值、NPC 行为树或 BodyGraph。不要声称文本能够安装器官、产生能力或结算事件。完整事件、任务和固定故事另交事件创作流程。

避免仅换人名、颜色、形容词或语序的重复。围绕具体外观、姿态、职业物件、语言习惯、感官角度和生活情境形成变化；各条独立可读，不引用前后条目，不写隐藏剧情事实。检查错字、同义重复、ID 连续性、双引号、逗号和 JSON 格式。最终交付 UTF-8 JSON 文件和文件清单。

## 素材交换格式

根字段严格为 format、schemaVersion、batchId、library、domain、source、dictionary、entries。不能任意增加字段。

| 字段 | 约束 |
|---|---|
| format / schemaVersion | aetheria-lexicon-materials / 2 |
| library | 2–64 字符，小写字母开头，后续小写字母、数字或连字符；adult 域必须以 nsfw- 开头 |
| batchId | library.bNNNN，编号从 0001 开始；分派前预留批次，不让多个 AI 共用同一个批次 |
| domain | general 或 nsfw |
| source | producer、model、theme 三个非空文本字段；不知道模型时填 unknown，不捏造来源 |
| dictionary | 字典来源包 id、version、hash，必须与验收时已安装字典一致 |
| entries | 每文件 1–50 条；整包可以包含大量文件 |
| entry.id | lx.library.bNNNN.0001，文件内从 0001 连续编号；归档后稳定不重排 |
| category | 必须等于 library；仅管理分类 |
| subcategory | 非空，最多 80 字符 |
| text / description | 非空，分别最多 400 / 240 字符，去除首尾空白 |
| tags | 0–6 个不重复、已登记且未废弃的稳定 ID |
| synonyms | 可选，最多 6 条，每条非空且最多 40 字符 |
| classification | tier、preferenceKey、eligibility，详见下文 |

普通域固定为 `{"tier":"general","preferenceKey":null,"eligibility":"general"}`。专用域固定为 `{"tier":"adult_optional","preferenceKey":"adultOptional","eligibility":"verified-adults"}`。它们是接口元数据，不代表已审核、已符合参与者资格或已启用正文。年龄未知时回退；任何种族都不能绕过统一成年门槛。偏好开关、参与者资格与内容审核必须分别检查。

这份 v2 不等同于此前外部 NSFW 十四分类格式；旧格式应保留原文件，待明确映射后转换，不可只改版本号。旧普通批次 v1 继续通过原 parser 管理，不能向 v1 直接增加这些字段。新 v2 的命令仅验收，不自动合并到原库，不覆盖原 ID，不自批 approved。

## 校验和交付

在工程根目录执行：

```text
npm run lexicon -- validate-v2 production/lexicon-authoring/formats/v2/general-example.json
npm run lexicon -- validate-v2 production/lexicon-authoring/formats/v2/nsfw-example.json
npm run check:foundation
```

前两条返回已验收但未审核/未安装。最后一条还验证完整内容包示例和两份现有参考库。字典有更新时不要冒用旧 hash；重新导出字典，为新的交付声明正确指纹。已有存档读取其快照，不用更新后的词库重抽。

多个 AI 的整包先按批次号检查冲突，再做原文和规范化文本去重；近义内容人工或审定流程复核。审核结果与引用记录存放在管理侧，正文不夹带效果。基础 v1 批次管理、去重和 TextSlot 适配仍沿用上层词库工具包；v2 的实际合并适配另行建立明确版本步骤。

## 规则作者的完整内容包示例

content-pack-example.json 是实际通过 Loader 验证的 ContentPack v2，未加入游戏内容索引。其素材在 proseMaterials，适用条件在 proseSelections，身体变化在 bodyPatches → transformations → actions。可用它核对正式字段；不要把这部分交给纯词条生产 AI。

- manifest.schemaVersion=2，并声明 foundation.v2；依赖版本写实，来源和哈希由既有 Manifest/Registry 追踪。
- `body.matches` 必须显式 target。kind=player 不带 id；kind=npc 带固定定义 ID；kind=resident 带已生成居民实例 ID。旧 body.hasPart、body.hasCapability、tf.state 无 target 时仍查询玩家。
- 同一个 part 对象中的 kind、materialFamily、materialId、morphologyId、color、instanceId、minLengthMm 为同一部件上的合取。机械手加有机尾不能满足机械尾。lengthMm/minLengthMm 必须限定 kind=tail，毫米整数范围 1–5000。
- 部件声明 defaults；旧部件可用唯一 partProfiles 提供默认值。实例只写 overrides。材料保留 organic/mechanical 家族，局部 morphology 与角色 species 来源身份独立。缺失参数为未知，不能填 0 代替未知。
- attributes 补丁固定含 type、partId、set、unset。unset 删除覆盖以恢复默认值；set 与 unset 不能同时操作同一字段。修改来源由 TF 执行器写入，作者不能伪造 provenance。
- 新固定 NPC 应在其内容包提供 npcBodies 声明，含 id、npcId、bodyTemplateId、patchIds。当前已声明的三个 NPC 不能再重复绑定；未声明的保持未知。scene actor 只存 entity 引用。
- residentAdaptations 含 id、templateId、workCapabilities、mobility（walk/assisted）。新职业按明确身体能力声明；生成器和存档检查共用规则。assisted 目前表示抽象日程允许辅助移动，没有额外物理模拟。
- locationProfiles 提供静态 service/light；生成地点的 service 以 WorldDef 的 service 字段为准。唯一可变光照在 state.environment，变更走 environment.setLight。预设“湿润”不是真实湿度数值。
- derivedTags 首版仅接受对应作用域的原子共享条件：entity 为身体条件，location 为服务/光照，world 为时间窗口。不能让 Tag 直接授予能力或循环引用派生结果。
- requiresTags 全命中，excludesTags 均不命中，compatibleTags 非空时至少命中一个；boost 只改变已合法候选的权重。普通素材文件没有这些字段。

固定故事继续按 EventGraph、明确事实、Action/Effect 与 TextSlot 流水线编写。正文替换只能换文本；新增剧情效果必须另做受校验的规则及事务适配。

## 版本范围

ContentPack v2、ReferencePack v2、素材交换 v2 为新增接口；GenerationRulePack 仍为 v1。游戏对外仍为 Alpha 0.2，生成器为 0.3.0，基础包为 aetheria/foundation@1.0.0；“底层 v0.4”是本轮交付里程碑名。没有把这些不同层的版本混成同一格式。
