# 世界题材与任务作者源

编辑 `themes.mjs` 中的 17 组题材、地点、资源、组织和终局名称；共享的主线阶段、支线互动与明确行动效果在 `scripts/build-world-profiles.mjs`。运行 `npm run quests:build` 生成运行时 JSON。

各题材子目录的 `quest-tree.json`、`execution.json` 是导出的审阅文件，重新构建会覆盖。游戏只加载打包 JSON，运行时不调用制作脚本或 AI。

每世界两条四阶段主线，18 条支线配置；部分故事共享，再由题材参数绑定具体资源与组织。数量代表可选任务条目，不代表 306 篇独立故事。完整格式、世界与生态的区别、兼容性见[世界配置说明](../../../docs/world-profiles.md)。
