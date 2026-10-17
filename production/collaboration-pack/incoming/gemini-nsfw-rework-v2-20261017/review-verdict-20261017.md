# Gemini NSFW 返修交付审读结论（2026-10-17 SGT）

来源：附件 zip `01M54950PSW1MK0XWGTGP3Y7Q5.zip`（已拷贝为 `delivery.zip`）  
解压：`extracted/`（外层 8 文件）+ `extracted/inner/`（内层 `aetheria-nsfw-rework-v2-20261017.zip`）  
对照：`给Gemini-轻量返修包/01–03`；上次失败：`Gemini-Drive交付审读/审读结论.md`  
GitHub main tip：**`6e7e950b42b18d3131bb50efba7a38d8a1434c34`**（与交付头 base **一致**）  
本地复核：Node 24.10；跳过坏 hunk 后 typecheck 0；关键测 78/78 pass（含旧档升级）

---

## 总判断

**partial（产品基本可合，交付补丁不能原样 `git apply`）**

- 机制/产品口径相对上次大幅修好；在「去掉 stale `profiles.ts` hunk + 丢弃 `pack.json` 改由 `build-adventure-content.mjs` 重生」后，可过 typecheck 与关键测试。
- **原样三份 diff `git apply --check` 失败**：mechanism → `src/world/profiles.ts`；content → `content/adventure/pack.json`（2 hunks）。words 单独可过。
- 未改 `ai-install-spec.md`（红线守住）。未再交全量 core 快照 / 改写规范。

建议合入路径：mechanism（跳过 profiles）→ content 的 build/candidates/draws → `node scripts/build-adventure-content.mjs` → words.diff + `words-b1-b2-b3/` 进审定。或要求 Gemini 重出能干净 apply 的 diff。

---

## 1. 库存

| 项 | 结果 |
|---|---|
| 外层 | `nsfw-mechanism/content/words.diff` + 对应 docx + summary.docx + 内层 zip |
| 车道 | **已拆三份** mechanism / content / words |
| 交付头 | 在 `summary` 与各 B1/B2/B3 `*.md`；**不在 diff 文件第一段** |
| `spec` 字段 | 写成 `"format": "aetheria-install/1"`（非规范字面 `spec`）；另用 `touched` 而非 `files`；缺 `summary` 一句话字段 |
| status | **`authored`** ✅（未再自封 checked） |
| base | `6e7e950…` = 当前 main tip ✅ |
| 规范改写 | **无**（diffs 未触 `docs/reference/ai-install-spec.md`）✅ |
| verify | 头里列命令、无实测输出；notDone 承认未在目标机跑全量；**未再依赖 `/tmp/ts-loader.mjs`** ✅ |
| words 批 | 内层 `words-b1-b2-b3/` 35 份 JSON+MD（1830 条）；**不在** `nsfw-words.diff` 内（diff 只有 b0018 + atoms） |

### `git apply --check`（对 tip=`6e7e950`）

| 补丁 | 结果 |
|---|---|
| mechanism | ❌ `src/world/profiles.ts`（欲删的 `extraParagraphs` 行已是 main 旧形态；main 现用 `scopedDetails` 且**仍在使用**该变量，hunk 过时且不该再删） |
| content | ❌ `pack.json` 2 hunks（与 NPC/对话节点锚点错位）；`build-adventure-content.mjs` + candidates/draws **可过** |
| words | ✅ |
| 三份连打 | ❌（同上） |
| 模式噪声 | 大量 100755↔100644 warning（与上次同类） |

复核捷径（本机已跑）：`mech-noprofiles.diff` + `content-nopack.diff` + words → rebuild → **typecheck 0**；defeat-play/adventure/nsfw/save 等 **78 pass / 0 fail**（旧档 `pre-adventure fixed saves…` ✅）。日志：`verify-logs/`。

---

## 2. 轻量包 §0–§3 勾选

### §0 先处理

| 项 | 判定 |
|---|---|
| 撤回改写规范 | ✅ 已守 |
| 基于当天 main HEAD | ✅ base=tip；⚠️ 但 patch 上下文仍有 2 处对不上 |
| 三车道拆分 | ✅ |
| status=`authored` | ✅ |
| verify 不用私有 loader | ✅ |
| 文件名对得上 | ✅（mechanism/content/words） |
| 不写「主线已完成」 | ✅ |
| 不重发已装件 | ✅ |

### §1 回归与假实装

| 项 | 判定 |
|---|---|
| 旧档 aftermath 污染 | ✅ `vars-migration` 跳过注入 `progression:` 旗标；`flag.has` 用 `?? false`；关键测旧档升级通过 |
| 9 现场态真 set/unset | ✅ setTags：bound36 / coated58 / suspended10 / exposed14 / gagged13 / blindfolded10 / cocooned10 / ear-sealed7 / sensory-deprived7；出口 unset 齐全；测试「G1–G8 mounts and clear all 9」过 |
| typecheck / profiles | ✅ main 已自洽；其 profiles hunk **应丢弃**（强行打会错） |
| DefeatReactionRule | ✅ vine-slip/cocoon-guard → `gte 12`；+敌方 `enemy-vine-tighten` / `enemy-mucus-recoat` / `enemy-cocoon-wrap`（共 7 条） |

### §2 产品口径

| 项 | 判定 |
|---|---|
| TF 仅黏液化/黑胶化 | ✅ 仅 `tf.slime-coating` / `tf.latex-coating` / `tf.cleanse-coatings`（+既有 tail-maintenance）；物种 TF 三词条 **0** |
| 恶堕≠TF | ✅ `corruption.start` 两选项均 `next: null`，只改心性/清理；**不再**进 `residue-deepen` |
| E2 藤 | ✅ `tfs: []`；M7/M8/M9；开场 set `bound`+`suspended`；有倒挂/勒紧原子；藤 intro 非「温热湿滑」（该词仅唾狼） |
| E4 茧 | ✅ 开场 set `cocooned`（+bound） |

### §3 正文元说明

| 项 | 判定 |
|---|---|
| corruption「这段回顾…」 | ✅ 已删 |
| resolve.marked 内部名/工程解释 | ✅ 「口封感官剥夺」「尚未立刻引发」等已从 resolve 正文清掉 |
| 选项括号元说明 | ✅ 选项 label 基本干净；⚠️ **nsfwcombo 遭遇 title** 仍有 ×12「（束缚制服/产卵灌注/口封感官剥夺…）」；玩法 tag 的 label/definition 仍用内部大类名（可接受为 tag，不必当选项元说明） |
| 未成年人 | 抽查未见新增；未全量扫 Folio |

### §5 words（可先收）

| 项 | 判定 |
|---|---|
| 交付头 | ✅ 每份 `*-delivery.md` 有 `aetheria-install/1` + `authored`；JSON 本身仍是 `aetheria-authoring-delivery`（协作包格式） |
| 重复文本 | ✅ 跨 35 份扫描 **0** 重复 |
| 十二新题材 B1/B2 | ✅ 已交成品（非仅任务卡） |
| B2 actor.form draft 量 | 声称 MVP 扩到 10 draft；未逐题材复核数量 |
| 与 words.diff 关系 | ⚠️ 1830 条在内层目录，不在 diff；合 words 车道时勿只打 diff |

---

## 3. 红线与仍开项

**红线（本次未踩）**
- 改写 `ai-install-spec.md`
- 自封 `checked` / 空 notDone
- 混合单 patch（已拆分）
- `/tmp/ts-loader.mjs`

**仍开 / 合入前必处理**
1. **mechanism `profiles.ts` hunk 必须丢掉**（与 main 冲突且方向错误）
2. **content `pack.json` 不要 apply**；以 build 脚本重生为准（交付头 notDone 已写，但仍把打不上的 pack diff 塞进包）
3. diff 内嵌交付头 / 字段名对齐规范（`spec`/`files`/`summary`）
4. nsfwcombo title 括号玩法名（小）
5. 全量 `npm test` 未在交付机贴出；本机只跑了声明的关键子集（78）——整合后方可标 checked
6. Phase C 词池 / T33–T34 等 §4 仍属 notDone（诚实）

---

## 4. 一句话

相对 Drive 上版：方向对且口径大多落地；**不能当「直接 apply 即合」**，需整合方剪 hunk + rebuild，或让对方重出干净 diff。words 1830 条可并行进审定。
