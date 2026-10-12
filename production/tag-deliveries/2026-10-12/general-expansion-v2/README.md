# 第二轮通用词条扩充

本轮新增 787 条，覆盖 41 组常用概念。累计 12542 条素材、1932 个编辑概念。33 个同名候选未重复添加，详见 label-collisions.json；这里不自动判定同义。NSFW 原件保持不变。

- [新增词条和定义](新增通用词条.md)：按用途阅读，不用翻全部主表。
- common-additions.json / new-entries.jsonl：仅本轮新增。
- entries.jsonl / taxonomy.json：合并主表与编辑字典；上一版数据逐条保留，不重新自动拆分。
- groups.json / rule-hints.json：适用主体、对象绑定、参数单位、事实来源与未知值策略。
- [规则用途说明](规则用途说明.md)：说明这些元数据如何供后续规则开发使用。
- v2-material-batches：30 个正式 v2 纯文字交换批次，ID 使用 b9201 起的独立命名空间。

状态：GPT 已主写定义，审稿状态 authored-proposed；纯文字格式和引用已校验。素材尚未安装到游戏；编辑概念不是运行 TagDef，交换批次 tags 留空。rule-hints 也不是可执行的条件或效果。

累计数量不等于规则覆盖率。上一轮 3064 条核心拆分待审仍然保留。本轮没有以补词替代这项复核，也不宣称已实现通用规则模板编译器。

重建：node scripts/lexicon/build-general-expansion-v2.mjs。冻结版本只允许一致重建，不能向旧批次继续追加词条。原始交付 31 个文件校验哈希；前一版全目录保存规范化指纹。
