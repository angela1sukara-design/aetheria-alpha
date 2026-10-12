# NSFW b0010–b0016 生产报告

| 项 | 值 |
|---|---|
| 状态 | **待审定** |
| 合计新增 | **296** 条 |
| 跳过（tf专条/共存规则） | **4** 条 |
| 跳过（同库已有） | **0** 条 |
| 规范 | NSFWtag；定词挂前 v0.2；黑胶/goo v0.2；Tag共存规则 |
| format | `aetheria-nsfw-lexicon-batch` |
| source.producer / model | `ai-nsfw` / `Grok Bot` |
| 未覆盖 b0001–b0009 | 是 |
| 校验 JSON/id/pose.precise/kink.tier | 通过 |

## 分批条数

### b0010 · 定词材质 · b0010 · **34** 条

- `nsfw-fluid`: 17
- `nsfw-material`: 17

### b0011 · 气味声音 · b0011 · **31** 条

- `nsfw-action`: 2
- `nsfw-kink`: 1
- `nsfw-mod`: 3
- `nsfw-sensation`: 25

### b0012 · 服装半脱 · b0012 · **33** 条

- `nsfw-action`: 17
- `nsfw-gear`: 7
- `nsfw-kink`: 3
- `nsfw-mod`: 4
- `nsfw-state`: 2

### b0013 · 兽龙触手机械互动 · b0013 · **56** 条

- `nsfw-action`: 27
- `nsfw-creature`: 4
- `nsfw-genitals`: 5
- `nsfw-kink`: 3
- `nsfw-mod`: 1
- `nsfw-part`: 16

### b0014 · 边控寸止 · b0014 · **22** 条

- `nsfw-action`: 8
- `nsfw-kink`: 3
- `nsfw-mod`: 2
- `nsfw-state`: 9

### b0015 · 展示公开多人+pose/locus · b0015 · **82** 条

- `nsfw-action`: 5
- `nsfw-kink`: 1
- `nsfw-locus`: 26
- `nsfw-mod`: 3
- `nsfw-pose`: 24
- `nsfw-state`: 23

### b0016 · 器具收口及其他剩余 · b0016 · **38** 条

- `nsfw-action`: 9
- `nsfw-gear`: 25
- `nsfw-kink`: 1
- `nsfw-mod`: 3

## 跳过项

| 候选名 | 原拟库 | 原因 |
|---|---|---|
| 水生黏液化 | nsfw-tf | 用通用黏液化+水生黏液定词材质组合；勿另开专条 |
| 油脂覆膜化 | nsfw-tf | 用通用黏液化/覆膜过程+油脂材质组合；勿另开专条 |
| 蜡封表层 | nsfw-tf | 用通用覆膜过程+蜡材质组合；勿另开专条 |
| 泡沫裹覆化 | nsfw-tf | 用通用裹覆过程+泡沫材质组合；勿另开专条 |
| （无） | — | 同库主名无碰撞 |

## 共存规则落实

1. **定词材质 material∥fluid 双挂**：水生/藻/水母/两栖/鱼黏液等同名分挂；**未**另开水生黏液化/油脂覆膜化/蜡封表层/泡沫裹覆化 tf 专条（通用黏液化+定词材质组合）。
2. **寸止/延长边缘=action** ≠ 边控 kink ≠ 寸止临界等 state。
3. **撕裂衣料等=action** ≠ 半脱 gear/state。
4. **嗅闻体味=action** ≠ 嗅闻/气味偏好 kink。
5. **黑胶密区不堆**、无物种 goo 专条。

## 文件清单

- `/workspace/nsfw-lexicon/batches/nsfw-action.b0011.json`
- `/workspace/nsfw-lexicon/batches/nsfw-action.b0012.json`
- `/workspace/nsfw-lexicon/batches/nsfw-action.b0013.json`
- `/workspace/nsfw-lexicon/batches/nsfw-action.b0014.json`
- `/workspace/nsfw-lexicon/batches/nsfw-action.b0015.json`
- `/workspace/nsfw-lexicon/batches/nsfw-action.b0016.json`
- `/workspace/nsfw-lexicon/batches/nsfw-creature.b0013.json`
- `/workspace/nsfw-lexicon/batches/nsfw-fluid.b0010.json`
- `/workspace/nsfw-lexicon/batches/nsfw-gear.b0012.json`
- `/workspace/nsfw-lexicon/batches/nsfw-gear.b0016.json`
- `/workspace/nsfw-lexicon/batches/nsfw-genitals.b0013.json`
- `/workspace/nsfw-lexicon/batches/nsfw-kink.b0011.json`
- `/workspace/nsfw-lexicon/batches/nsfw-kink.b0012.json`
- `/workspace/nsfw-lexicon/batches/nsfw-kink.b0013.json`
- `/workspace/nsfw-lexicon/batches/nsfw-kink.b0014.json`
- `/workspace/nsfw-lexicon/batches/nsfw-kink.b0015.json`
- `/workspace/nsfw-lexicon/batches/nsfw-kink.b0016.json`
- `/workspace/nsfw-lexicon/batches/nsfw-locus.b0015.json`
- `/workspace/nsfw-lexicon/batches/nsfw-material.b0010.json`
- `/workspace/nsfw-lexicon/batches/nsfw-mod.b0011.json`
- `/workspace/nsfw-lexicon/batches/nsfw-mod.b0012.json`
- `/workspace/nsfw-lexicon/batches/nsfw-mod.b0013.json`
- `/workspace/nsfw-lexicon/batches/nsfw-mod.b0014.json`
- `/workspace/nsfw-lexicon/batches/nsfw-mod.b0015.json`
- `/workspace/nsfw-lexicon/batches/nsfw-mod.b0016.json`
- `/workspace/nsfw-lexicon/batches/nsfw-part.b0013.json`
- `/workspace/nsfw-lexicon/batches/nsfw-pose.b0015.json`
- `/workspace/nsfw-lexicon/batches/nsfw-sensation.b0011.json`
- `/workspace/nsfw-lexicon/batches/nsfw-state.b0012.json`
- `/workspace/nsfw-lexicon/batches/nsfw-state.b0014.json`
- `/workspace/nsfw-lexicon/batches/nsfw-state.b0015.json`

## 交付物

- 报告：`/workspace/nsfw-lexicon/b0010-b0016-production-report.md`
- 报告副本：`/workspace/b0010-b0016-production-report.md`
- zip：`/workspace/nsfw-lexicon/nsfw-lexicon-b0010-b0016.zip`
