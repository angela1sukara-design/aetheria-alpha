# NSFW 定词材质×部位×动作 自动组合（合载说明）

日期：2026-10-13。分支：`codex/tag-effect-preview`。  
制作卡：`docs/tag-hub/outbox/2026-10-13-故事试写-proposed-nodes-NSFW自动组合制作卡.md`。

## 公式

```
ComboKey = Material(定词+材质 L) × Part|Locus(L) × Action(L)
         → [DefeatStage] → [TF通用 黏液化|黑胶化]
```

- **定词挂前**：触手/蛞蝓/虫巢/史莱姆…挂在材质前；定词 ≠ creature。
- **转化**：只用通用 `黏液化` / `黑胶化`；**禁止**物种 TF 专条。
- **词条 ≠ 玩法 ≠ 数值**：hub 原子是 L 素材；运行用 `progression:tag.*`；不改词库审定。
- **成人门**：完整成人正文须 `profile.created` 且年龄≥18 且 `adultOptional`；不合格仅中性回退。阶段 A 遭遇反馈可先跑通。

## 文件

| 路径 | 作用 |
|---|---|
| `scripts/nsfw-auto-combo/atoms.json` | 制作卡原子池 + C1–C6 样例（真实 lx.* ID） |
| `scripts/nsfw-auto-combo/combiner.mjs` | 组合器：`combine` / `sampleCombos` / `enumerateCombos` / `toEncounterCandidate` |
| `scripts/build-adventure-content.mjs` | 构建时合载：tag + profile + encounter 节点 + 行动 |
| `content/adventure/pack.json` | 生成结果（勿手改；改源后 `node scripts/build-adventure-content.mjs`） |
| `content/nsfw-auto-combo/candidates.json` | 候选片段清单（编辑/对照用） |
| `content/nsfw-auto-combo/prose-fills.json` | existing-prose 回填（P0+P1 start/adult；构建覆盖 `pack.texts`） |

## 如何挂进游戏

### 1. 已合载的可触发路径（最小）

1. 确保 adventure 已重建：`node scripts/build-adventure-content.mjs`
2. 主索引已含 `./adventure/pack.json`（默认 `content/index.json`）
3. 游戏内行动：**试跑 NSFW 材质组合遭遇**  
   - ID：`progression:action.nsfwcombo.encounter`  
   - 效果：`narrative.start` · `kind=encounter` · `profileId=progression:profile.nsfwcombo.matrix`
4. Profile 写入对手侧运行 tag：`progression:tag.nsfwcombo.active`
5. 抽取 `priority=5` 且要求该 tag 的样例节点（C1–C6 之一）
6. 可选「核对组合原子与挂接提示」→ stage `nsfwcombo-detail`（列出 lexiconRefs / 战败挂接提示）
7. 每节点有免费无条件退出

### 2. 挂到既有战败 assess（阶段 B，差异槽）

- **不改** `progression:node.defeat.coat` 选择契约。
- 描写差异用组合器 `slots`：`{材质}` 替换「低处黏附物」；`{部位}` 替换接触点。
- gel 路径：`profile.gel` + `environmentEnemyRules.defeatTags`（含 `coat.stuck`）仍按 `docs/environment-enemy-selection.md`。
- 通用战败 `adult_optional` TextSlot **尚未实装**（制作卡 U1）→ 勿用 `riker/nara.quiet` 冒充。

### 3. 扩展组合

```js
import { loadAtoms, combine, enumerateCombos } from './scripts/nsfw-auto-combo/combiner.mjs';
const atoms = await loadAtoms();
const one = combine(atoms, { material: 'M2', targets: ['Pt5'], action: 'A1' });
const many = enumerateCombos(atoms, { limit: 12 });
```

把新样例写入 `atoms.json` 的 `samples`，再跑 adventure 构建即可合载新节点。

### 4. 明确不做

- 不改 `docs/tag-hub/nsfw-batches` 审定状态；不把 L 写成已写入的 foundation/progression 假已有（除本卡声明的 `progression:tag.nsfwcombo.active`）。
- 长文回填经 `content/nsfw-auto-combo/prose-fills.json` 合载（P0+P1）；不直接手改 `pack.json`。
- 不写物种黏液化专条；不写 NPC24。

## 自检

| 项 | 结果 |
|---|---|
| 组合器可读制作卡原子 | `atoms.json` + hub ID 校验（测试） |
| 合载可触发 | `progression:action.nsfwcombo.encounter`（样例 C1–C12） |
| 成人优先补槽 | C8–C12（胯下/指令/封口/黏液化入口等） |
| 未改 approved 词库 | 是 |
| 无物种 TF 专条 | 是 |

## 可填槽清单

见 `docs/tag-hub/outbox/2026-10-13-NSFW-auto-combo-可填槽清单.md`（C1–C12 节点 / textKey / adult 槽与 U1–U8 缺口）。
