# 六类街区任务作者源

2026-10-13：本目录保留旧六类生态任务，用于兼容和回归；不再是默认世界配置。当前默认入口使用相邻的 `world-settings`，说明见[世界 Tag 与任务配置](../../../docs/world-profiles.md)。本目录每类有两条四阶段主线及 18 条支线。

编辑 `worlds.mjs` 中的阶段与终局、`sides.mjs` 中的故事和选择，再运行 `npm run quests:build`。这两个文件仅在离线制作阶段执行；游戏读取打包 JSON，不调用 AI，也不从自然语言推断规则。

`wet / dry / garden / frost / forge / tidal` 子目录中的 `quest-tree.json` 和 `execution.json` 是制作脚本导出的审阅文件，重新构建时会覆盖。玩家选择都有明确的旗标、耗时与记忆；主线相关支线只有可选作用。

完整称号表、数量口径、绑定、存档兼容与验收入口见[六类街区任务说明](../../../docs/neighborhood-quests.md)。原赛博作者源在相邻 `cyber-apex` 目录保留为独立示例。
