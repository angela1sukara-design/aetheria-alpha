# v2纯素材交换批次

共 35 批，已用仓库 validateSemanticBatch 校验格式、分级、ID与字典引用。只含新增常用词条和世界候选，原10700条ID保持在主表中。

运行：node scripts/lexicon/cli.mjs validate-v2 <文件路径>。单批最多50条。b9001起为GPT新增，b9101起为世界候选；这些ID只为本次交付固定，后续增补另开批次，不能重新排序覆盖已发布ID。export-links.json保留回溯关系。

这是待审文字素材，未安装到游戏。tags为空数组：general-taxonomy编辑概念还不是运行字典ID，不能假装已注册。检索与审稿使用外侧taxonomy.json和entries.jsonl中的编辑标签。批次没有奖励、关系或身体状态效果字段。

字典：aetheria/foundation 1.0.0，hash=c24574c91b1d70f584eb79be4c4758b57a04252ead0d2cd0c94c95a31871b959。字典升级时须重新校验；不得直接替换引用字符串。
