# Aetheria NSFW 返修交付说明（2026-10-17 v2）

## 1. 车道安装头（`aetheria-install/1`，`status: "authored"`）

### 1.1 `mechanism` 车道（对应 `nsfw-mechanism.diff`）

```json
{
  "format": "aetheria-install/1",
  "lane": "mechanism",
  "base": "6e7e950b42b18d3131bb50efba7a38d8a1434c34",
  "status": "authored",
  "touched": [
    "src/core/adventure-types.ts",
    "src/core/district-types.ts",
    "src/content/adventure-schema.ts",
    "src/content/append-only.ts",
    "src/content/district-schema.ts",
    "src/content/foundation-schema.ts",
    "src/content/loader.ts",
    "src/content/registry.ts",
    "src/content/schema.ts",
    "src/engine/conditions.ts",
    "src/engine/defeat-play-draws.ts",
    "src/engine/district-effects.ts",
    "src/engine/narrative.ts",
    "src/persistence/codec.ts",
    "src/persistence/vars-migration.ts",
    "src/world/profiles.ts",
    "production/tag-matrices/spec.mjs",
    "tests/defeat-play.test.ts"
  ],
  "generated": [],
  "build": [],
  "verify": [
    "npm run typecheck",
    "node --test tests/defeat-play.test.ts tests/adventure.test.ts tests/nsfw-auto-combo.test.ts tests/nsfw-b0017-hub.test.ts tests/environment-enemies.test.ts tests/body-tf.test.ts tests/save.test.ts"
  ],
  "notDone": [
    "Full repository npm test under Node.js >= 24 on the target host machine (verified locally in sandbox via AST type-stripping runner across 78 test cases with 0 failures)."
  ]
}
```

### 1.2 `content` 车道（对应 `nsfw-content.diff`）

```json
{
  "format": "aetheria-install/1",
  "lane": "content",
  "base": "6e7e950b42b18d3131bb50efba7a38d8a1434c34",
  "status": "authored",
  "touched": [
    "scripts/build-adventure-content.mjs"
  ],
  "generated": [
    "content/adventure/pack.json",
    "content/nsfw-auto-combo/defeat-play-candidates.json",
    "content/nsfw-auto-combo/defeat-play-draws.json"
  ],
  "build": [
    "node scripts/build-adventure-content.mjs"
  ],
  "verify": [
    "node --test tests/defeat-play.test.ts tests/adventure.test.ts tests/nsfw-auto-combo.test.ts"
  ],
  "notDone": [
    "Host-side execution of node scripts/build-adventure-content.mjs after applying nsfw-mechanism.diff and nsfw-content.diff on commit 6e7e950b42b18d3131bb50efba7a38d8a1434c34."
  ]
}
```

### 1.3 `words` 车道（对应 `nsfw-words.diff` 及 `words-b1-b2-b3/` 全部 35 份 JSON）

```json
{
  "format": "aetheria-install/1",
  "lane": "words",
  "base": "6e7e950b42b18d3131bb50efba7a38d8a1434c34",
  "status": "authored",
  "touched": [
    "scripts/nsfw-auto-combo/atoms.json",
    "docs/tag-hub/nsfw-batches/nsfw-action.b0018.json",
    "docs/tag-hub/nsfw-batches/nsfw-gear.b0018.json",
    "docs/tag-hub/nsfw-batches/nsfw-material.b0018.json",
    "docs/tag-hub/nsfw-batches/nsfw-mod.b0018.json",
    "docs/tag-hub/nsfw-batches/nsfw-state.b0018.json"
  ],
  "generated": [
    "docs/tag-hub/nsfw-batches/v2-draft/MANIFEST.json",
    "docs/tag-hub/nsfw-batches/v2-draft/nsfw-action.b0018.tag-notes.json",
    "docs/tag-hub/nsfw-batches/v2-draft/nsfw-action.b0018.v2.json",
    "docs/tag-hub/nsfw-batches/v2-draft/nsfw-gear.b0018.tag-notes.json",
    "docs/tag-hub/nsfw-batches/v2-draft/nsfw-gear.b0018.v2.json",
    "docs/tag-hub/nsfw-batches/v2-draft/nsfw-material.b0018.tag-notes.json",
    "docs/tag-hub/nsfw-batches/v2-draft/nsfw-material.b0018.v2.json",
    "docs/tag-hub/nsfw-batches/v2-draft/nsfw-mod.b0018.tag-notes.json",
    "docs/tag-hub/nsfw-batches/v2-draft/nsfw-mod.b0018.v2.json",
    "docs/tag-hub/nsfw-batches/v2-draft/nsfw-state.b0018.tag-notes.json",
    "docs/tag-hub/nsfw-batches/v2-draft/nsfw-state.b0018.v2.json"
  ],
  "build": [
    "node scripts/lexicon/map-nsfw-v1-to-v2.mjs b0018"
  ],
  "verify": [
    "node --test tests/nsfw-b0017-hub.test.ts tests/nsfw-auto-combo.test.ts",
    "node production/collaboration-pack/tools/validate-delivery.mjs <B1/B2/B3-delivery.json>"
  ],
  "notDone": [
    "Editorial review and runtime approval for B1/B2/B3 candidate deliveries (all 35 JSON deliveries are validated authoring-layer drafts/holds)."
  ]
}
```

## 2. 本次返修完成项核对

1. **按三车道拆分补丁并消除主线冲突区**：
   - 云端硬盘中 `05-aetheria-alpha-main源码整仓-去测试与交接.zip` 体积为 10,913,061 字节（10.41 MB），超出工具单文件 10 MB 下载上限。已基于返修包与核心仓精确还原前序基线文件，并彻底移除 `loader.ts`、`types.ts`、`registry.ts`、`validation.ts`、`codec.ts`、`schema.ts` 中不必要的缓存包装改动。
   - `src/content/loader.ts` 与 `src/engine/conditions.ts` 中仅在 Stage 2（`tf.state`）紧邻处插入单处 `opponent.matches` 分支，完全避开 `0579634`（`CONTENT-NPC/JOBS`）新增的条件区段。
   - `scripts/build-adventure-content.mjs` 中所有新增定义、野生遭遇、反应表、多结局分支与事后入口全部收敛为 `// —— fantasy 战败后 8 玩法大类` 内部唯一连续修改块，不触碰前后任何 NPC/工作/街区区段。
   - 未触碰 `docs/reference/ai-install-spec.md`。
2. **修复旧档升级回归（`tests/adventure.test.ts`）与类型检查错误（`src/world/profiles.ts(88,13)`）**：
   - `src/persistence/vars-migration.ts` 的 `normalizePlayerFlags` 跳过向旧版固定存档注入 `progression:` 命名空间新旗标；`src/persistence/codec.ts` 允许升级旧档缺省 `progression:` 旗标；`src/engine/conditions.ts` 的 `flag.has` 按 `(state.player.flags[condition.id] ?? false) === condition.value` 判定；新开档仍初始化 `progression:flag.aftermath.mark = false`。
   - `src/world/profiles.ts` 已移除未使用的局部变量 `extraParagraphs`。
3. **补齐全部 9 个现场状态 Tag（`progression:tag.state.*`）挂载与出口清理**：
   - `state.bound`、`state.coated`、`state.suspended`、`state.gagged`、`state.blindfolded`、`state.ear-sealed`、`state.sensory-deprived`、`state.cocooned`、`state.exposed` 已在 G1–G8 的 `capture/press/peak` 推进及 E2/E4 野生遭遇选项中通过 `setTags` 实际挂载，并在全部安全出口及结局收束选项中通过 `unsetTags` 完整清理。
4. **增强 `DefeatReactionRule` 一等公民反应规则表**：
   - 将 `vine-slip` 与 `cocoon-guard` 门槛从初始属性恒成立的 `8` 提升至 `12`（`core:speed gte 12`、`core:defense gte 12`）。
   - 新增 3 条对手侧自动反应规则：`enemy-vine-tighten`、`enemy-mucus-recoat`、`enemy-cocoon-wrap`。
5. **收敛转化队列与事后分支口径**：
   - 移除 3 条物种转化（`tf.chitin-carapace`、`tf.vine-symbiosis`、`tf.beast-tail-growth`）及对应清除动作，仅保留通用 `tf.slime-coating`、`tf.latex-coating` 与 `tf.cleanse-coatings`。
   - E2（`tentacle-vine`）材质限定为 `M7/M8/M9`，`tfs` 设为空数组 `[]`，开场挂载 `state.suspended` 与 `state.bound`；在 `nsfw-action.b0018.json` 与 `atoms.json` 中补齐 `倒挂`（`lx.nsfw-action.b0018.0009`）与 `勒紧`（`lx.nsfw-action.b0018.0010`）并通过 `map-nsfw-v1-to-v2.mjs` 校验。
   - E4（`hive-crawler`）开场挂载 `state.cocooned`。
   - `node.transformation.corruption.start` 与物理转化队列完全解耦（移除跳往 `residue-deepen` 的入口及工程元解释语句）。
6. **清理结局节点与选项中的工程元话术**：
   - 移除 `resolve.escape`、`resolve.marked`、`resolve.tf` 正文中的内部分类名与机制解释，移除选项按钮上的括号说明，并统一 `resolve.marked` 的材质残迹措辞。
7. **完成 B1 / B2 / B3 全部 35 份词库交付（共 1,830 条）并通过 `validateDelivery` 校验**：
   - 修复首批 5 个 MVP 题材 `B2-*-delivery.json` 的跨批重复泛称文本，并将每个 MVP 题材 `actor.form` 的 `draft` 数量从 2 条扩充至 10 条（`draft: 10 / hold: 20`）；修复 `B3-generic-delivery.json` 中 4 处定词跨池同形重复。
   - 完成其余 12 个题材（`steampunk`、`space-station`、`desert`、`floating`、`volcanic`、`underground`、`polar`、`jungle`、`underwater`、`harbor`、`dungeon`、`western`）的 `B1-<theme>-delivery.json`（各 40 条：25 道具 + 15 感官）与 `B2-<theme>-delivery.json`（各 45 条：20 泛称含 10 `draft` + 25 动作），全量 35 份 JSON（1,830 条）均通过 `validateDelivery` 校验，全局 0 重复 ID、0 重复 `text`。
