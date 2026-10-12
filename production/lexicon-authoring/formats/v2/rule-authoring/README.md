# 规则设计 AI 随附示例

从上级 TAG-RULES-AI-PROMPT.md 开始。以下文件均为教学示例，未加入 content/index.json，也没有修改游戏存档。

- available-content.json：只读的当前内容目录，记录导出时的源提交及包指纹；不作为新的运行时注册表。没有输出完整隐藏剧情、人物秘密或记忆正文。
- rules-content-example.v2.json：完整 ContentPack v2。定义一个演示用“长尾结构”语义，派生条件查询同一尾部至少 600 毫米；三条独立的素材适用规则引用现有审定素材。manifest.status=draft，示例能加载不等于已审核发布。
- reference-addon-example.v2.json：一个工坊日常活动增量模板；服务为必要条件，炉巷环境只增加合法候选权重。需要与工程已有 reference.json 或 lexicon-reference.json 及对应源内容组合，不能单独生成一个完整街区。
- generation-rules-example.v1.json：全局参数示例，沿用现有五种必需服务与时间范围。

示例使用 rulesdemo 命名空间。新交付应分配自己的唯一命名空间，不能重复装载本示例后再复用其 ID。规则作者只复用已审定正文，没有自产新的 approved 素材。

素材适用示例演示各条条件的写法；增量加载不会覆盖 foundation 包原有的同素材选择规则。同一素材任一规则通过就可进入候选，新增更严格条件不等于收紧旧规则。示例的新增长尾派生语义有独立 ID，可直接验证未知和尺寸边界。

`npm run check:foundation` 通过原 Loader 和 parser 验证上述三个正式包，并检查示例参考包与原始参考库的模板依赖。已额外使用原生成器对种子 7、42 验证生成与存读，并检查机械手加有机尾的反例、长度未知及 599/600 毫米边界。验证不要求示例活动一定被每个种子抽中，合法候选权重不等于必选。
