# NSFW v1→v2 映射草稿（待审定 / 未实装）

由 `scripts/lexicon/map-nsfw-v1-to-v2.mjs` 从同级 `../nsfw-*.json`（`aetheria-nsfw-lexicon-batch` v1）显式转换而来。

| 项 | 说明 |
|---|---|
| 目标格式 | `aetheria-lexicon-materials` schemaVersion **2** |
| 校验 | `node scripts/lexicon/cli.mjs validate-v2 <file.v2.json>`（只验收，不导入） |
| 审定 | **待审定**；description 仍含「待审定」字样 |
| 实装 | **未实装**；不进 `content/index.json` / Registry / 存档 |
| tags[] | **空**；v1 中文自由标签不能冒充 `foundation:*`，见 `*.tag-notes.json` |
| 用途 | 给工程侧验收路径与后续审稿；**不能**当 ContentPack / ReferencePack 加载 |

重新生成（例：仅 b0017）：

```bash
node scripts/lexicon/map-nsfw-v1-to-v2.mjs b0017
```

收录 ≠ 审定 ≠ 已实装。
