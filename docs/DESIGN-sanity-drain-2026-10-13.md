# 理智Drain重设计（可执行）— `core:sanity` 清醒条

> 日期：2026-10-13（Asia/Singapore）  
> 分支：`codex/tag-effect-preview`  
> 对照：`docs/DESIGN-deep-numerics-2026-10-12.md` §A · `docs/DESIGN-numeric-gaps-2026-10-13.md` §C.7 · `src/engine/numerics.ts`  
> 状态：**设计交付 / USER DECISION 已拍板** — 理智随时间与压力**缓慢下降**；**空条崩坏**，不再涨到 100 Bad End。  
> 硬约束：字段 ID **`core:sanity` 禁止改名**；flag 仍用 **`core:flag.sanity_break`**。

---

## 0. 拍板摘要（给引擎立刻改线）

| 项 | 旧（崩坏积蓄） | **新（清醒条 drain）** |
|----|----------------|------------------------|
| 语义 | 0=清醒，↑至 100=崩坏 | **100=清醒，↓至 0=崩坏** |
| VariableDef `initial` | `0` | **`100`** |
| min–max | 0–100 | **0–100（不变）** |
| 冲击结算 | `sanity + gain` | **`sanity − loss`** |
| Bad End | `sanity ≥ 100` | **`sanity ≤ 0`** |
| flag | `core:flag.sanity_break` | **同 ID**；改在 ≤0 时置 true |
| 休息 / 长睡 | `−8` / `−15`（减积蓄） | **`+8` / `+15`（回理智）** |
| 镇定药水小/大 | `−15` / `−25` | **`+15` / `+25`** |
| 乘区 | 乘在 gain 上 | **同形乘在 loss 上** |
| 函数名建议 | `sanityGain` / `sanityRestDelta` | **`sanityLoss`（或 `sanityDrain`）** / `sanityRestDelta` 改返回正值 |

**一句话**：满条清醒、空条崩坏；旧「上涨公式」整表取反为「流失」；旧「下降恢复」整表取反为「回升」。

---

## 1. 语义与文案

| 值域 | 玩家感受 | 文风暗示 |
|------|----------|----------|
| 80–100 | 清醒稳定 | 思路清晰、能自我抽离 |
| 50–79 | 摇摆 | 走神、耳鸣、犹豫 |
| 20–49 | 濒临 | 幻听边缘、自我怀疑加重 |
| 1–19 | 崩坏边缘 | 叙述碎裂、短句、强制继续风险高 |
| **≤0** | **理智崩坏 Bad End** | 启动 `district:event.sanity_break` |

- 文档用语：**理智满=清醒；理智空=崩坏**。  
- 废弃口语「崩坏积蓄 / sinking 上涨」；旧映射表见 §8。  
- HUD label 仍为「理智」；**不要**改 VariableDef `id`。

---

## 2. VariableDef / Flag（包与迁移）

### 2.1 目标定义

```json
{
  "id": "core:sanity",
  "label": "理智",
  "initial": 100,
  "min": 0,
  "max": 100,
  "unit": ""
}
```

```json
{ "id": "core:flag.sanity_break", "initial": false }
```

### 2.2 存档迁移（必做）

旧语义下「低值=清醒」。翻转后须镜像：

```
// 仅当存档仍属「积蓄语义」时执行一次
sanity_new = clamp(100 - sanity_old, 0, 100)
```

判定建议（择一，写入 `vars-migration`）：

1. **推荐**：引入迁移标记 / schema 小步（如 `sanitySemantics: 'drain'`）；缺省旧档一律镜像。  
2. 或：若 `core:sanity === 0` 且从未触发过 break、且其它硬核为默认开局 → 当作新语义开局直接写 **100**（仅全新等价档）。  

开局 / `normalizePlayerVariables` 缺键时补 **`initial: 100`**（不再补 0）。

内容包：所有把理智当「减积蓄」的 `var.change` 负向（药水 −15/−25、休息效果若写在包里）改为**正向**；战败/tick 改为调用 `sanityLoss` 再 **减法**。

---

## 3. 流失公式（单次结算）

### 3.1 核心

```
base ∈ 整数区间（见表）
statusMod = 1.0
  + (压抑/束缚类 status：+0.15)
  + (镇定类 status：−0.20)
  + (可选：scene.restraint ≥ 60 视为束缚感 +0.15，与 status 可叠)
  （最终 clamp 到 [0.5, 1.5]）

mult = 1
  + arousal/200
  + submissionTendency/150
  + transformProgress/250
  + stress/400                    // DEFAULT 纳入；stress=0 时无影响

loss = round(base × mult × statusMod)
loss = max(0, loss)

sanity' = max(0, sanity − loss)
```

- 无场景：`arousal = 0`；`restraint` 不参与或按 0。  
- `submissionTendency` / `transformProgress` / `stress` 始终可读（倾向仍**禁止**直接 `var.change` 改理智）。  
- `transformProgress` 派生规则不变（深设计 §A.2）：不写 `player.variables`。

### 3.2 base 表（与旧 gain 表同形，语义改为流失）

| 触发 | base | 内容标 | 说明 |
|------|------|--------|------|
| 轻度冲击 | **3–5**（中位 4） | `sanity.tick.light` | 目击异象、轻惊愕、非战败 |
| 标准冲击 / 战败默认 | **5–8**（中位 **6**） | 默认 / 战败 | **战败固定 base=6** 再走乘区 |
| 继续互动 | **8–12**（中位 10） | `sanity.tick.continue` | 同一 scene 内再次加深拍点 |
| 重度冲击 | **10–14**（中位 12） | `sanity.tick.heavy` | 强制 TF、精英/Boss 败北 |

随机：内容给 `[lo,hi]` 时 `base = lo + floor(rng * (hi-lo+1))`。

### 3.3 乘区直觉（满模时）

| 输入 | 满值贡献 | 例：base=6、其余 0 |
|------|----------|-------------------|
| arousal=100 | +0.50 | loss≈9 |
| submissionTendency=100 | +0.67 | loss≈10 |
| transformProgress=100 | +0.40 | loss≈8 |
| stress=100 | +0.25 | loss≈8 |
| 全满 + statusMod=1.0 | mult≈2.82 | loss≈17 |

玩法硬数字仍少：内容只标 tick 档，乘区由引擎算。

### 3.4 statusMod 零件（与旧一致，作用于 drain）

| 零件 | Δ | 来源 |
|------|---|------|
| 压抑/束缚 status | +0.15 | `statusModParts` |
| 镇定 status（药水附带） | −0.20 | `statusModParts` |
| 高束缚场景 | +0.15 | `scene.restraint ≥ 60`（DEFAULT） |
| 最终 | clamp **[0.5, 1.5]** | |

---

## 4. 流失来源一览（谁在何时扣）

| 来源 | 何时 | base / 规则 |
|------|------|-------------|
| 战斗战败 continue | HP 归零后选「继续」/进入败北互动 | **standard base=6** + 乘区 |
| 败北互动加深 | 同一 scene 再次拍点 | **continue 8–12** |
| 高 arousal 场景拍点 | 内容标 `sanity.tick.*` | 表内对应档；乘区含 arousal |
| 高 restraint | 同上；restraint≥60 加 statusMod | 不另开 VariableDef |
| 压力 stress | 乘进 `mult`（§3.1）；另见 §4.1 可选脉冲 | 倾向只乘区，不直改 sanity |
| TF 进度 | 乘进 `mult` | 进度高 → 同档扣更多 |
| 强制 TF / Boss 败北 | `sanity.tick.heavy` | **10–14** |
| 轻度目击 | `sanity.tick.light` | **3–5** |
| **敌对区被动**（可选） | 见 §4.2 | **默认启用，标 OPTIONAL 可关** |

### 4.1 高压脉冲（DEFAULT：轻）

当 `core:stress ≥ 80` 且刚完成一次 **standard/continue/heavy** tick 时：

```
loss_extra = 1   // 固定 +1，不再乘区
sanity' = max(0, sanity' − 1)
```

避免再开复杂表；低压无额外扣。

### 4.2 敌对区被动慢漏（OPTIONAL — DEFAULT **开**）

```
每累计 clock 90 分钟处于 hostile 区：
  sanity' = max(0, sanity − 1)
```

| 项 | 值 |
|----|-----|
| 间隔 | **90 min**（60–120 建议窗中位） |
| 扣量 | **−1** / 次 |
| 区域 | 仅 **hostile**（检查站外、危险渠、内容 `zone:hostile` / 非安全锚点） |
| 安全区 / 公寓 / 主街安全 | **不漏** |
| 开关 | 常量 `SANITY_PASSIVE_DRAIN_ENABLED = true`；关则整段不跑 |

实现提示：在 `clock.advance` 结算里按「本段有多少分钟落在 hostile」累计；跨区旅行只计敌对段。

---

## 5. 恢复（回升）

| 来源 | 公式 | 备注 |
|------|------|------|
| 休息（公寓/安全座，时钟 **≥30 min**） | `sanity' = min(100, sanity + 8)` | 与 energy/stamina 可同动作，分字段 |
| 长睡片段（**≥360 min**） | `+15` | worldgen/事件标注 |
| 镇定药水（小） | **`+15`** | 原 −15；价参考 15；附 `status.calmed` 120min |
| 镇定药水（大） | **`+25`** | 原 −25；价参考 35；附 `status.calmed` 180min |
| 安全区安抚 / 护理 Action（建议） | **`+10`** | 可与 heal 同地点不同选项；勿与药水叠成瞬满除非剧情 |
| 诊所点滴 | 不默认改 sanity | 除非内容显式 `var.change` |

**禁止**：`desire` / `submissionTendency` / `stress` 等倾向字段直接加减 `core:sanity`（乘区除外）。

`sanityRestDelta(minutes)` 新约定：

```
minutes ≥ 360 → +15
minutes ≥ 30  → +8
else          → 0
```

引擎应用：`sanity' = clamp(sanity + delta, 0, 100)`（delta 已为正）。

---

## 6. Bad End（≤0）

```
if sanity' <= 0:
  sanity' = 0
  flags[core:flag.sanity_break] = true
  → 优先 event.start(district:event.sanity_break)（内容包已装时）
  → 否则占位文案：「理智已空：清醒条归零，进入 Bad End。」
```

- 与旧文案「理智已满」**全部替换**。  
- 事件 ID 可保持 `district:event.sanity_break`（不强制改名）。  
- 置 flag 后必须走事件入口，不要只打 log。

---

## 7. 纯函数 / 调用点改线清单

### 7.1 `src/engine/numerics.ts`

| 旧 | 新 |
|----|----|
| `sanityGain(...) → ≥0 增量` | **`sanityLoss(...) → ≥0 流失量`**（可保留 `sanityGain` 为 deprecated 别名 = `sanityLoss`，避免半截 PR） |
| 公式 `+gain` 语义 | 同形 `loss = round(base × mult × statusMod)`，mult 含 **stress/400** |
| `sanityRestDelta` → −8/−15 | → **+8/+15** |

建议导出：

```ts
export function sanityLoss(input: SanityLossInput): number  // ≥0
export function sanityRestDelta(minutes: number): number   // ≥0 恢复量
```

`SanityLossInput` 字段：`kind` / `base` / `baseRange` / `rng` / `arousal` / `submissionTendency` / `transformProgress` / `stress?` / `statusModParts?`。

### 7.2 `src/engine/district-effects.ts`

- 战败：`after = max(0, before - sanityLoss({ base: 6, ... }))`  
- `after <= 0` → flag + Bad End 事件（替换 `>= 100`）  
- 文案：「理智已空…」

### 7.3 `src/engine/effects.ts`

- 休息：`after = min(max, before + sanityRestDelta(minutes))`（正加）

### 7.4 内容 / 经济

- 药水 `var.change`：**+15 / +25**  
- `DESIGN-numeric-gaps` §3 物价行、§C.7.3 符号翻转（见 §9）

### 7.5 测试 `tests/numerics.test.ts`

- `sanityLoss({ base: 6 }) === 6`  
- 乘区用例改名；满模期望仍为 round 后正流失  
- `sanityRestDelta(30) === 8`；`(360) === 15`  
- Bad End 集成：从低理智扣穿 → flag true

### 7.6 包与夹具

- `content/core/pack.json`：`initial: 100`  
- fixtures 里开局 `core:sanity: 0` → **`100`**（旧「清醒」夹具）  
- 专测积蓄语义的夹具：先走迁移镜像再断言

---

## 8. 取代关系（文档）

| 文档 | 章节 | 处置 |
|------|------|------|
| `DESIGN-deep-numerics-2026-10-12.md` | §0.3 表 `core:sanity` 行、§0.6 sinking 行、**整节 §A**、§F.4、§G 理智条 | **被本文取代**；原文顶部已加 supersede 注（见同日补丁） |
| `DESIGN-numeric-gaps-2026-10-13.md` | §3 药水「恢复 −15/−25」、§C.7 全文、§D 非分叉句 | **符号与语义以本文为准** |
| `NOTES-deep-numerics-impl-2026-10-12.md` | §1 理智 | 实装后改笔记；设计以本文为准 |
| `NOTES-vars-engine.md` | 理智行 / flag「满值」 | 改为「空值 / ≤0」；initial 100 |

旧 §A 仍可作考古；**引擎不得再按 gain-to-100 实装。**

---

## 9. 给引擎实装的立即对照表

| # | 动作 | 目标值 / 规则 |
|---|------|----------------|
| 1 | `pack.json` `core:sanity.initial` | **100** |
| 2 | 迁移镜像 | `sanity = 100 - old`（积蓄档） |
| 3 | 重命名/改写纯函数 | `sanityLoss`；rest delta **正** |
| 4 | 流失公式 | `round(base×(1+arousal/200+submission/150+tf/250+stress/400)×statusMod)` |
| 5 | base | light 3–5 / std 5–8（败 6）/ continue 8–12 / heavy 10–14 |
| 6 | 应用 | `sanity = max(0, sanity - loss)` |
| 7 | Bad End | **`≤ 0`** → `core:flag.sanity_break` + `district:event.sanity_break` |
| 8 | 休息 | ≥30min **+8**；≥360 **+15** |
| 9 | 药水 | **+15 / +25** + calmed status |
| 10 | 安全区安抚 | 建议 **+10**（新 Action 或现有护理） |
| 11 | 被动漏 | hostile **−1 / 90min**（DEFAULT 开） |
| 12 | 高压脉冲 | stress≥80 且非 light tick 时 **额外 −1** |
| 13 | ID | **不改** `core:sanity` / `core:flag.sanity_break` |
| 14 | 倾向 | 仍禁止直改 sanity；只进乘区 / 文风 |

### 验收（设计侧）

- [ ] 新开局 sanity=100；扣穿到 0 置 flag 并进事件  
- [ ] 同输入下 `sanityLoss` 与表一致；药水/休息为加而非减  
- [ ] 旧档镜像后「原 0 清醒」→ 100；「原 100 崩坏」→ 0 且应已能进 Bad End  
- [ ] hostile 90min 仅 −1；安全区不漏  
- [ ] 字段 ID 未改名  

---

## 10. 工作量提示（非阻塞）

纯设计已闭环。引擎 PR 建议顺序：numerics 单测 → district-effects 战败/flag → effects 休息 → pack initial + migration → 药水内容 → 被动漏。

**Success 标准**：父 agent 可直接 `SendToAgent` 本文 §0 + §9 表，无需再问语义方向。
