# 给 Gemini：NSFW 自动组合战败 · 还缺什么 v2（转发用）

日期：2026-10-17（SGT）
对照：你 10-16 晚上传 Drive 的 `aetheria-nsfw-tf-update.zip` / `aetheria-p0-fixes.patch` 等
结论：机制方向对了，6 项基本到位；**这次不能合**，原因在下面 §0 和 §1。

规范只有一份：GitHub main 的 `docs/reference/ai-install-spec.md`（`aetheria-install/1`）。

---

## 0. 先处理（不改完不收）

- [ ] **撤回改写的规范**。Drive 的 `ai-install-spec.md`、p0 zip 和 core zip 里那份「四层安装规范」都不要再交。你不能改规范。你删掉了交付头、status 三值、硬规则和装入标准，这在 10-16 已经被拒过一次。有建议就另写 `proposal-*.md`
- [ ] **重新基于 main `0579634` 出补丁**。`403e5a5` 在仓库里不存在。现在的 patch 打到 main 上有 4 个文件冲突：pack.json、build-adventure-content.mjs、loader.ts、conditions.ts
- [ ] **按车道拆成三份 diff**，每份配自己的交付头：
  - mechanism：types、schema、conditions、narrative、registry、codec、validation、DefeatReactionRule、测试
  - content：build-adventure-content.mjs 产出的节点、规则、pack.json
  - words：b0018 词批、atoms.json
  - 只交一个混合 patch 的话，按规范整份算 mechanism
- [ ] **status 只写 `authored`**。`checked` 要整合方跑过命令才能写，你不能自己封
- [ ] **verify 不要依赖 `/tmp/ts-loader.mjs`**。用 Node ≥24 直接跑 `npm run typecheck` 和 `npm test`，把实际输出贴上
- [ ] **文件名要对得上内容**。`aetheria-p0-fixes.patch` 和 NSFW gap patch 字节完全相同，别再这样命名。不要再交全量快照 zip
- [ ] **说明文档不要写"主线已完成"**。main 没有这些改动
- [ ] **已装的不要重发**：P0 已在 `fd384da` 装入，CONTENT-NPC/JOBS 已在 `0579634` 装入

---

## 1. 必须修的回归和假实装

- [ ] **旧档回归**：`tests/adventure.test.ts:126`（pre-adventure fixed saves upgrade additively）失败，旧档升级后多出 `progression:flag.aftermath.mark: false`。新旗标不能写进旧档初始 flags。按规范 §3.8 处理：只在新世界出现，或者写明迁移规则，并且让测试通过
- [ ] **现场态要真的挂上去**。9 个 `progression:tag.state.*` 只注册了没用上，全 pack 只有 `state.coated` 被 set。`bound`、`suspended`、`gagged`、`blindfolded`、`ear-sealed`、`sensory-deprived`、`cocooned`、`exposed` 都要在对应 G 拍的 setTags 里挂上，在出口处清掉，再加测试断言能挂能清
- [ ] **typecheck 要过**：`src/world/profiles.ts(88,13)` 的 `extraParagraphs` 没被使用。改完以 main 版为准
- [ ] **DefeatReactionRule 要有实际意义**：
  - `vine-slip` 的 `core:speed gte 10` 等于初始值，相当于没设条件，阈值要调
  - 至少补 2 条敌方反应，比如藤收紧、黏液再涂覆，别只写玩家脱身

---

## 2. 产品口径没对齐

- [ ] **TF 只保留通用「黏液化 / 黑胶化」**：
  - 删除或改成 hold：`tf.chitin-carapace`、`tf.vine-symbiosis`、`tf.beast-tail-growth`
  - B1 余韵链只剩这两种覆层，外加洗净
- [ ] **恶堕和 TF 彻底分开**：
  - `node.transformation.corruption.start` 里"将余韵导向体表，转入形态转化支线"这一项去掉
  - 恶堕入口只做心性和叙事，玩家自选才改心性。这一点现在做对了，保持住
- [ ] **E2 兽径触手藤**：
  - `tfs` 还是 `黏液化`，改成不带 TF，或者只带 marked
  - 补「倒挂」「勒紧」原子
  - G 拍里要真实挂上 `state.suspended`（倒挂固定）和 `state.bound`（被束缚）
  - marked 正文对藤类不要再写"温热湿滑"，按 materialKey 换描写
- [ ] **E4 虫巢爬者**：结茧拍里要挂 `state.cocooned`

---

## 3. 正文（去 AI 腔和元说明）

- [ ] corruption.start 删掉「这段回顾完全取决于你此刻的心意：你可以……也可以……」，选项交给按钮
- [ ] resolve.marked ×8：正文不要出现玩法内部名，比如「口封感官剥夺」；删掉工程解释「这股残迹尚未立刻引发身体转化」
- [ ] 选项不要夹元说明：
  - 「保留体表残迹退回安全处（解锁事后余韵入口）」×8
  - 「应对主导压制（束缚制服）」「转入次生纠缠（产卵灌注）」等 12 处
  - 改成场景动作，例如「护住手腕先退开」
- [ ] 继续保持：不写未成年人；NSFW 节点的 NPC 必须走成年资格检查

---

## 4. 仍未做（写进 notDone，别写成已完成）

- [ ] Phase C 词池：定词+材质 / 部位触感 / 双方对抗动作，用组合方式扩，不要手写笛卡尔死文
- [ ] 性暴力轴正文和封装（T33）、人兽轴正文和封装（T34）：单独一个 content 包
- [ ] 对话色气 / 关系恶堕：另开包
- [ ] b0017 / b0018 维持 pending-review，作者不改成 approved
- [x] 吞噬拟态 / 附体寄生 = hold（已守住）

## 5. words 车道（可先收）

- B1/B2/B3 共 810 条，`validate-delivery` 全部通过，可以进审定。下一批请补：
  - [ ] 每份 JSON 配 `aetheria-install/1` 交付头（lane `words`，status `authored`）
  - [ ] 去掉 12 条重复文本
  - [ ] 十二新题材（desert…western）B1/B2 成品，现在只有任务卡
  - [ ] B2 actor.form 每题材只有 2 条 draft，补到能用的量

---

## 6. 回传格式

每份 diff 第一段写交付头：

```json
{
  "spec": "aetheria-install/1",
  "lane": "mechanism",
  "base": "0579634…（main 实际 tip）",
  "summary": "一句话",
  "status": "authored",
  "files": ["..."],
  "verify": ["npm run typecheck → 输出", "npm test → N pass / 0 fail"],
  "notDone": ["上面没勾的项原文"]
}
```

目标：战斗战败 → 按敌人抽选 → escape / marked / tf 三结局，现场态真实挂上和清掉 → 残迹旗标 → 可选的事后恶堕入口，与 TF 分开 → 旧档不变，全量测试通过。
