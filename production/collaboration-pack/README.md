# 通用协作包制作源

这是用户协作包的v1.3修订制作源，不是游戏内容包。

在工程根目录运行 `node scripts/build-collaboration-pack.mjs`，从当前真实Tag定义、离线拼装器与本目录规范生成 `deliverables/协作包-通用版-v1.3-已修订.zip`。原用户压缩包不覆盖。

包内包含全部规范、独立发卡全文、全量注册Tag快照、作者JSON Schema、中性fixture转换和失败案例检查，不携带完整游戏源码或依赖。构建时运行检查并逐ZIP条目读回核对，报告在 artifacts/collaboration-pack-v1.3/。

`docs`为规范全文，`catalog/schema/fixture/tasks`分别定义词池、Schema、样例和卡片；`tools`为离线参考转换/验证。`tag-reference-ids.json`只冻结已审的538个参考ID，标签与定义每次由工程重导出，完整快照不手抄。

游戏实际查询/Tag资格、模板轮换、UI/存档接入和持久审批仍待ENG实施；本包不改变游戏玩法，不把hold或离线样例计为生产完成。
