# 可玩示例

本目录用于按需生成专项试玩；正式游戏使用根目录“启动游戏-双击直接运行.html”。先执行npm run build，再按需要生成：

- npm run examples:a-content：A模板的三个实际入口。
- npm run examples:b-content：五题材B素材及现代街区。
- node scripts/build-function-example.mjs：NPC服务与地点设施。
- npm run examples:worldgen：固定种子的世界生成示例（输出到dist）。

Git只跟踪本说明。2026-10-17之前生成的试玩页已移到工程旁的aetheria-history，保留备份；默认构建不会重新生成本目录的试玩页。
