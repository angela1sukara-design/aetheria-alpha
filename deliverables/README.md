# 交付目录

主工程在上一级根目录；不要在交付快照中继续开发。

| 分组 | 内容 |
| --- | --- |
| [current/](current/README.md) | 最新已交付试玩、完整源码包及版本元数据 |
| [archive/](archive/README.md) | Alpha 0.2 阶段、世界生成器 v0.1／v0.2 旧版本 |
| [tools/](tools/README.md) | 独立外发的词条生产、文本槽接口压缩包 |
| [checkpoints/](checkpoints/README.md) | Git bundle 检查点 |

本次搬移未重打包已有 ZIP，也未改写包内 README 和历史验收记录。包内路径均相对其解压目录理解。`current/SHA256SUMS.json` 是整理后的便携交付校验表；`organization-2026-10-11.json` 保存搬移前后全部文件的核验依据。

后续阶段检查点由 `scripts/checkpoint.ps1` 输出到 `archive/alpha02/`；新增正式交付应放在 `current/`，被替换的交付先移入对应版本的 `archive/`，不要直接覆盖归档。
