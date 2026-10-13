# NSFW lexicon batches（原始 JSON）

来源：`/workspace/nsfw-lexicon/batches/`（本机镜像）。

可读 NSFW 词条清单已在 `production/tag-deliveries/2026-10-12/readable/.../02-NSFW已有/`；此处为机读 batch 片段，供对照与后续导入审稿，**不等于已审定入库**。

收录时点约 **109** 个 `nsfw-*.json`（b0001–**b0017** 各库不等；本目录不含子目录内草稿）。

## b0017（2026-10-13）

- 7 文件 · 54 条 · 状态 **待审定** · 未改玩法/数值
- 摘要：`/workspace/NSFW扩缺-b0017-摘要.md`
- 报告：`/workspace/nsfw-lexicon/b0017-production-report.md`
- 工程 v2 草稿：[`v2-draft/`](./v2-draft/)（`map-nsfw-v1-to-v2.mjs` 显式转换，已 `validate-v2`；**未实装**）

## 格式边界

- 本目录原始文件：`aetheria-nsfw-lexicon-batch` **v1**（与通用 `aetheria-lexicon-batch` **互斥**，禁止混装）
- 工程语义交换：`aetheria-lexicon-materials` **v2**（需显式转换；见 `scripts/lexicon/semantic-format.mjs`）
- 词库 JSON **不**进入 ContentPack；审定后另走适配/登记
