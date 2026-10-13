# outbox 索引

跨 bot 交付只写这里，再 **告知 path**；不整包互发。推仓：`codex/tag-effect-preview`。

大批量正文交付（清单 dump / tar）见 [`production/tag-deliveries/2026-10-12/`](../../../production/tag-deliveries/2026-10-12/)，不在本 outbox 重复存放。

| 时间 (SGT) | 文件 | 来源 | 用途 |
|---|---|---|---|
| 2026-10-12 15:19 | [共存互斥分维度规则摘要-v0.13-对照库存.md](./共存互斥分维度规则摘要-v0.13-对照库存.md) | Tag共存规则 | foundation-tag-mapping + v0.13 共存/互斥/分维度；已回 Angela（rules/ 有归档副本） |
| 2026-10-12 15:20 | [2026-10-12-故事试写-研究员触手黏液黑胶.md](./2026-10-12-故事试写-研究员触手黏液黑胶.md) | 故事试写 | tag→短篇样例；配对 `inventory/seeds/2026-10-12-接tag试跑-研究员触手黏液黑胶.md` |
| 2026-10-12 18:01 | [2026-10-12-tag-rules-delivery-coexistence/](./2026-10-12-tag-rules-delivery-coexistence/) | Tag共存规则 | TAG-RULES 交付包首版（后由 18:17 行升级为 v1.1.0 试跑切片） |
| 2026-10-12 18:17 | [2026-10-12-tag-rules-delivery-coexistence/](./2026-10-12-tag-rules-delivery-coexistence/) **v1.1.0 试跑切片** | Tag共存规则 | 补 generation-rules（夜间开局）、gel/night when、clinic 昼夜模板互斥、PLAYTEST-SLICE；全库矩阵仍 TBD |
| 2026-10-13 11:10 | [2026-10-13-nsfw-b0017-ingest.md](./2026-10-13-nsfw-b0017-ingest.md) | 引擎接入 | b0017→tag-hub 收录 + v1→v2 草稿（validate-v2）；待审定未实装 |
| 2026-10-13 15:02 | [2026-10-13-故事试写-proposed-nodes-NSFW自动组合制作卡.md](./2026-10-13-故事试写-proposed-nodes-NSFW自动组合制作卡.md) | 故事试写 | proposed-nodes：定词材质×部位×动作自动组合；已合载见 `docs/nsfw-auto-combo.md` |
| 2026-10-13 15:25 | [2026-10-13-故事试写-nsfwcombo-P0-成人遭遇回填-标注版.md](./2026-10-13-故事试写-nsfwcombo-P0-成人遭遇回填-标注版.md) | 故事试写 | existing-prose：C8/C9/C4/C10/C11/C12 成人遭遇回填（标注+中性回退+可粘贴） |
| 2026-10-13 15:25 | [2026-10-13-故事试写-nsfwcombo-P1-组合遭遇回填-标注版.md](./2026-10-13-故事试写-nsfwcombo-P1-组合遭遇回填-标注版.md) | 故事试写 | existing-prose：C1/C2/C3/C5/C6/C7 组合遭遇回填 |
| 2026-10-13 15:25 | [2026-10-13-故事试写-nsfwcombo-可粘贴正文.md](./2026-10-13-故事试写-nsfwcombo-可粘贴正文.md) | 故事试写 | P0+P1 textKey⇒纯正文对照，便于 pack 回填 |
| 2026-10-13 15:09 | [2026-10-13-NSFW-auto-combo-可填槽清单.md](./2026-10-13-NSFW-auto-combo-可填槽清单.md) | 引擎接入 | NSFW combo 已合载可填槽（节点/textKey/adult） |
