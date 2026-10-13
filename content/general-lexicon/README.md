# 通用词条运行装载包

日期：2026-10-13（SGT）。源：`production/tag-deliveries/2026-10-12/general-expansion-v2/taxonomy.json`。

## 装了什么

- **1932** 条通用编辑概念 → 运行 `TagDef`（`general-taxonomy:*`）
- 来源状态：`authored-proposed` / `proposed-editorial`（= candidate / 已交付整理，**不是**逐条人工 approved）
- 接入路径：`content/index.json` 默认加载（含 fantasy 试玩；小范围世界生成仍只开放 `worlds:setting.fantasy`）
- **未动 NSFW**：不写入 NSFW 批次、不把未审定 NSFW 标成 `approved`

## 刻意不做

- 不把 10,700 条素材正文批量写成 `proseMaterials.review=approved`
- 不授予身体能力、事件效果或数值字段
- Tag 仅供检索 / 调试下划线点击溯源；词条 ≠ 玩法

## 重建

```text
node scripts/lexicon/install-general-lexicon-runtime.mjs
```

收据见同目录 `INSTALL-RECEIPT.json`。
