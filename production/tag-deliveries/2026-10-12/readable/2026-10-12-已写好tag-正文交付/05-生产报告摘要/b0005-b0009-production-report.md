# NSFW b0005–b0009 生产报告

| 项 | 值 |
|---|---|
| 状态 | **待审定** |
| 合计新增 | **119** 条（跨库同名定词黏液 material∥fluid 分挂计为各 1 条） |
| 唯一主名 | 116（含定词挂前增补：触手黏液、史莱姆黏液） |
| 规范 | NSFWtag v1.0.1；定词挂前-材质规则 v0.2；黑胶/goo 定义 v0.2 |
| format | `aetheria-nsfw-lexicon-batch` |
| 未覆盖 b0001–b0004 | 是（未改写既有文件） |

## 分批条数

### b0005 · 虫寄生+触手寄生 · b0005 · **18** 条

- `nsfw-action`: 4
- `nsfw-creature`: 4
- `nsfw-fluid`: 2
- `nsfw-kink`: 2
- `nsfw-material`: 4
- `nsfw-state`: 2

### b0006 · 束缚载体 · b0006 · **14** 条

- `nsfw-action`: 2
- `nsfw-fluid`: 1
- `nsfw-gear`: 7
- `nsfw-material`: 1
- `nsfw-pose`: 3

### b0007 · 性器窄原子+动作补缺 · b0007 · **32** 条

- `nsfw-action`: 12
- `nsfw-genitals`: 1
- `nsfw-locus`: 5
- `nsfw-mod`: 8
- `nsfw-part`: 3
- `nsfw-state`: 3

### b0008 · 群P+露出+机械奸+史莱姆+杂项 · b0008 · **46** 条

- `nsfw-action`: 8
- `nsfw-creature`: 1
- `nsfw-fluid`: 3
- `nsfw-gear`: 6
- `nsfw-genitals`: 1
- `nsfw-kink`: 2
- `nsfw-material`: 4
- `nsfw-part`: 1
- `nsfw-pose`: 9
- `nsfw-sensation`: 6
- `nsfw-state`: 5

### b0009 · goo范式缺口 · b0009 · **9** 条

- `nsfw-action`: 2
- `nsfw-kink`: 2
- `nsfw-state`: 2
- `nsfw-tf`: 3

## 跳过项

| 候选名 | 原拟库 | 原因 |
|---|---|---|
| 虫卵着床 | action | b0004 已有「着卵」；候选注明可审稿合并，跳过主条 |
| 孕肚 | part | b0004 已有「孕腹」；跳过主条，建议 synonyms 待审 |
| goo转化 | tf | 已有「黑胶化」；勿双主定义，建议 synonyms/tags 待审，本批不新建 |
| 黑胶化 | tf | b0001 已有，跳过 |

（107 候选中其余 105 均已建主条；另按定词挂前补「触手黏液」「史莱姆黏液」。）

## goo / 定词挂前说明

1. **转化不按物种/物件枚举**：本批仅补通用范式缺口（物化黑胶化、局部黑胶化、可逆黑胶化等）；未建「××黑胶化」专条。
2. **goo转化**：已有 `黑胶化`(nsfw-tf.b0001)；本批**不**双主定义；建议审定后把 `goo转化`/`goo transformation` 写入其 synonyms 或 tags。
3. **定词挂前窄条**（material ∥ fluid）：
   - b0005：`虫巢黏液`、`触手黏液`（各 material + fluid）
   - b0008：`史莱姆黏液`（material + fluid）
   - 定词 ≠ creature；黑胶 ⊄ 蛞蝓黏液 ⊄ 凝胶，勿 synonyms 互充。
4. **史莱姆体** ≠ 凝胶体 / 黑胶生物 / 蛞蝓（已写入 description）。
5. **虫巢黏液** ≠ 蛞蝓黏液 / 黑胶（已写入 description）。
6. b0009 kink 均 `tier=non-gore`；tf 均带 `phase=rising`。

## 校验

- JSON 可解析：通过
- id 连续（每库每批自 `.0001`）：通过
- pose 均有 `precise`：通过
- kink 均有 `tier`（均为 non-gore）：通过
- 与 b0001–b0004 主名去重：通过（无重复主条）

## 分账自检摘要

- kink ≠ state：群交偏好 / 被寄生偏好 / 公共场合使用偏好 ≠ 被围用中 / 寄生共生中 / 当众露出
- creature ≠ part：虫体/寄生虫体/史莱姆体 ≠ 产卵管/尿道口
- material ∥ fluid：定词黏液双挂；usage 仅提示
- pose 均含 precise；动作补缺与姿势粗类分立
- 产卵：跳过已有 action/state；本批收卵具/材质/部位/体感窄条

## 路径

- batches：`/workspace/nsfw-lexicon/batches/*.{b0005,b0006,b0007,b0008,b0009}.json`（32 个文件）
- 本报告：`/workspace/nsfw-lexicon/b0005-b0009-production-report.md`
- 副本：`/workspace/b0005-b0009-production-report.md`
- zip：`/workspace/nsfw-lexicon/nsfw-lexicon-b0005-b0009.zip`
