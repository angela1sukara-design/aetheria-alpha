# 模块 D 实装说明

日期：2026-10-15；生成器 0.10.0。当前实现接替外部 D 草稿，使用当前 C 功能契约。

共享包 `content/personality/pack.json` 只定义六个 `personality:trait.*`，不依赖 district/adventure。独立 `personality-dialogue-content.json` 显式依赖共享包、adventure 与 fantasy-residents，提供六类性格各两个开场和一个深入节点，共 18 个已完成节点。`build-adventure-content.mjs` 调用独立构建模块生成它们，原固定都市内容包字节保持不变。

来源模板通过 `traitVariants` 明确关联性格描述与 1–2 个标准 Tag，新世界在既有确定性随机流内选择并写入生成模板和 Resident.traitTags。不存在字符哈希或按职业强塞性格的逻辑。未知来源保存空集合，继续普通短对话。旧存档和固定都市不启用新分支，也不重新生成身份、地点或进度。

模板加载检查标准集合、active、单一 context facet、显式依赖与文本映射。居民存档另检查合法集合与生成模板对应关系。新字段不会把身体或场景 Tag 注入性格；原 services、roleName、设施与真实商品数据保留。

正常居民交谈动作在存在适用节点时被统一替换为叙事入口，仍只有一个交谈按钮。进入时记录一次既有每日 talk 记忆、visits 和 trust；同日反复开始不会重复发放。没有合适性格或节点时保留原短对话。交易、工作和教学继续由 C 的能力判断。

只在 conversation 中从已锁定 story.actor 读取性格。条件、效果和右侧人物栏使用绑定对象，不能改选中人物后串线。性格 Tag 参与软权重，调试解释记录绑定居民来源及实际加成。查询与调试不改变状态或随机流。

正向选择获得当次明确继续意愿并进入深入阶段；中性选择正常结束；冒犯选择降低信任、记录当日拒绝并结束，同日不再进入性格深入分支。日程离场若发生在动作中，则完成已绑定当次收尾并结束；若发生在入口的五分钟中，则只剩免费退出。零资源仍可退出。

赠礼使用真实黑麦干粮：物品数量检查、item.consume 扣除一份、信任增加一，以及每人每日一次的持久 gift 记忆。再次尝试或存档恢复不会重复领取。新内容没有无上限的公共声望、影响或安全奖励。可选亲近分支采用非露骨表达，要求偏好、绑定人物在场、成年智慧资格、已有信任和本次明确继续意愿；后续回应明确表达是否愿意，性格本身不代表同意。

新增 DSL：conversation.present、conversation.adultEligible、conversation.giftAvailable、conversation.trust；conversation.respond（welcomed/offended/gift）；item.consume。类型、解析、依赖、执行、资源展示与存档记忆校验同步。内部记忆格式为 conversation:welcomed|declined|gift:day，仅新版本世界认可。

验证入口：

```sh
node --test tests/personality.test.ts
node --test tests/*.test.ts
node node_modules/typescript/bin/tsc --noEmit
npm run build
node tests/personality-browser.mjs
node tests/entity-functions-browser.mjs
```

浏览器检查需先运行 `node scripts/build-function-example.mjs` 生成示例及导航元数据。旧 0.9 世界的压缩测试夹具位于 tests/fixtures/module-d-world-0.9.json.gz。完整验证记录在 artifacts/module-d/，最终统计以 verification.json 为准。
