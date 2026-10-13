# 数值缺口设计（可执行）— 移动时间 / 装备 / 其余桩表

> 日期：2026-10-13（Asia/Singapore）  
> 分支：`codex/tag-effect-preview`  
> 对照：`docs/DESIGN-deep-numerics-2026-10-12.md` · `docs/NOTES-deep-numerics-impl-2026-10-12.md` · **`docs/DESIGN-sanity-drain-2026-10-13.md`**  
> 状态：**设计交付**；引擎实装按本文接表。  
> **硬约束**：VariableDef ID **禁止改名**（`core:attack` / `core:defense` / `core:evasion` / `core:stamina` / `core:sanity` / `core:money` / `core:trust` 等一律保持）。  
> 原则：玩法硬数字少；倾向只文风；数值在 GameState；装备加成运行时叠加、不写回 VariableDef。  
> **理智**：§3 药水符号、§C.7、文中「恢复 −15/−25」均以 **DESIGN-sanity-drain** 为准（恢复改为 **+15/+25**；tick 为 **loss**；Bad End **≤0**）。

---

## 0. 仓库现状（本稿相关）

| 项 | 现状 |
|----|------|
| `RouteDef` | 仅 `{ id, from, to }`；无时长/距离 |
| 赶路时钟 | 旅行 Action 一律 `clock.advance` **10**；worldgen 同 |
| 赶路体力 | `location.move` **固定** `STAMINA_COST.moveShort`(=2)；`moveFar`(=5) 已定义未接 |
| `staminaGate.allowFarMove` | 已有；远路未标则永不触发 |
| `EquipmentDef` | `{ id, name, requires, description }`；仅 wear/remove + body 兼容 |
| 装备槽 | `district.equipped: Id \| null`（**单槽**） |
| 现有装备 | `raincoat` / `tailcoat`：身体适配服，无战斗字段 |
| 战斗八维 | 已读 `player.variables`；**不**读装备 |
| 安全区治疗 | `district:action.heal.*` → `core:health` **+100**（拉满） |

---

## 1. 区域移动时间（完整可执行）

### 1.1 产品目标

- 邻接快走、同区远路更久、跨包/跨街区更久。  
- **同一 `distanceTier` 同时驱动**：`clock.advance` 分钟数 + `core:stamina` 扣点 + `staminaGate` 远路门槛。  
- 内容作者填 Route；旅行 Action **不再**各自写死 10 分钟（避免双源）。

### 1.2 Route 字段提案（扩展 `RouteDef`，不改 ID）

```ts
// src/core/types.ts — RouteDef 扩展（新增可选字段；旧包缺省 = adjacent）
export type RouteDistanceTier = 'adjacent' | 'far' | 'cross';
export interface RouteDef {
  id: Id;
  from: Id;
  to: Id;
  /** 距离档；缺省 adjacent */
  distanceTier?: RouteDistanceTier;
  /** 推进分钟；缺省见 §1.3 默认表（按 tier） */
  durationMinutes?: number;
}
```

| 字段 | 类型 | 必填 | 语义 |
|------|------|------|------|
| `distanceTier` | `adjacent` \| `far` \| `cross` | 否（默认 `adjacent`） | 体力档 + 闸门 |
| `durationMinutes` | int 1–240 | 否 | 实际 `clock.advance`；缺省用默认表 |

**不**新增 VariableDef。**不**把距离塞进 Tag。

### 1.3 默认时间表（可执行）

| `distanceTier` | 默认 `durationMinutes` | 文案暗示 | 典型用途 |
|-----------------|------------------------|----------|----------|
| `adjacent` | **10** | 几步路 / 同街邻铺 | 现有全区旅行默认；公寓↔主街、主街↔集市 |
| `far` | **25** | 绕路 / 同区远端 | 同包内非邻接捷径（如茶馆→检查站若直连） |
| `cross` | **45** | 出街区 / 跨包通道 | `from`/`to` 分属不同内容包命名空间（如 `aetheria:` ↔ `district:`）且设计上标跨区 |

**权威规则**：实际推进分钟 =

```
duration = route.durationMinutes ?? DEFAULT_DURATION[route.distanceTier ?? 'adjacent']
```

| tier | `DEFAULT_DURATION` |
|------|-------------------|
| adjacent | 10 |
| far | 25 |
| cross | 45 |

内容可覆盖（例：运河夜路 `far` + `durationMinutes: 35`）。校验：`1 ≤ durationMinutes ≤ 240`。

### 1.4 体力与闸门（与 tier 绑定，复用现常量）

| `distanceTier` | stamina 扣点 | 常量 | `staminaGate` |
|-----------------|-------------|------|---------------|
| `adjacent` | **−2** | `STAMINA_COST.moveShort` | 仅需 `stamina ≥ 2`（短移允许到 1–19 档仍可走） |
| `far` | **−5** | `STAMINA_COST.moveFar` | 需 `allowFarMove`（`stamina ≥ 40`）且 `stamina ≥ 5` |
| `cross` | **−5** | `STAMINA_COST.moveFar` | 同 `far`（跨区与远路同耗；时间更长） |

> 注：深设计口语「跨区/远路 −5」保持；**不**另开 `moveCross` 常量，避免散落。若日后要区分，再加 `moveCross: 6` 并标 USER DECISION。

公式（`location.move` 内）：

```
tier = route.distanceTier ?? 'adjacent'
cost = tier === 'adjacent' ? STAMINA_COST.moveShort : STAMINA_COST.moveFar
duration = route.durationMinutes ?? DEFAULT_DURATION[tier]

if tier !== 'adjacent' && !staminaGate(stamina).allowFarMove:
  → RuleError EXHAUSTED / 选项预检失败「体力不足，无法走远路/跨区」
if stamina < cost:
  → INSUFFICIENT_RESOURCE
stamina' = stamina - cost
clock += duration
location = route.to
```

### 1.5 与旅行 Action / worldgen 的接线

| 点 | 规则 |
|----|------|
| **时钟单一来源** | `location.move` **负责**按 Route 推进 `duration` 分钟；旅行 Action **删除**或改 `clock.advance` 为 **0**（避免 10+duration 双计）。 |
| 预览文案 | UI `action-preview`：若 effects 含 `location.move`，显示时间取 Route `duration`，勿只扫 Action 上的 `clock.advance`。 |
| worldgen | `pack.routes.push({ id, from, to, distanceTier, durationMinutes? })`；同命名空间邻接 → `adjacent`；同包远端 → `far`；跨包 → `cross`。生成的 travel Action **勿**再写死 10。 |
| 旧存档/旧包 | 缺字段 → 全按 `adjacent` / 10 / −2（行为与现行一致）。 |

### 1.6 现有 district 路线标注建议（内容填表，引擎不猜）

人工标注原则（给内容包，非自动）：

| 路线模式 | 建议 tier |
|----------|-----------|
| `*.out` / `*.back` 邻接店铺（cafe/workshop/archive 进出） | `adjacent` |
| canal ↔ workshop（同区步道） | `adjacent`（保持 10）或 `far`（若要「更远」感）— **默认 adjacent** |
| station ↔ street（检查站↔主街，偏通道） | `far`，`durationMinutes: 25` |
| station ↔ canal | `adjacent` 或 `far`；建议 **`far`** |
| 任意 `aetheria:location.*` ↔ `district:location.*` | **`cross`**，45min |

> 首包可先只标 station 相关为 `far`，跨命名空间为 `cross`，其余保持缺省 `adjacent`，降低内容工作量。

### 1.7 验收

- [ ] 无 `distanceTier` 的旧 Route：仍 10min / −2 stamina  
- [ ] `far` Route：25min（或覆盖值）/ −5；`stamina=39` 时选项不可点  
- [ ] `cross` Route：45min / −5；闸门同 far  
- [ ] 旅行 Action 无双倍时钟  
- [ ] VariableDef ID 未改

---

## 2. 装备属性（完整可执行）

### 2.0 DEFAULT 推荐（产品默认；备选见 §2.7）

> **DEFAULT**：轻量加法加成，仅 **武器/护甲** 槽可改战斗数；加成字段限 **`core:attack` / `core:defense` / `core:evasion` 对应三维**；化妆/适配服 = 0。  
> **备选（USER DECISION）**：`equip.bonuses.enabled = false` →「装备永不改战斗数值」，仅 flavor / `requires` / 文风。

本稿按 DEFAULT 写满公式；引擎应用开关位，默认 **true**。

### 2.1 设计原则

| 原则 | 说明 |
|------|------|
| 不写回 VariableDef | 穿戴 **不** `var.change` 八维；卸下无需回滚 |
| 结算时读取 | 战斗命中/伤害用 `effectiveStat = base + bonus` |
| 文本向、非 MMO | 单件小数字；总加成有硬顶 |
| 现有单槽兼容 | 现行 `equipped: Id \| null` 仍可用；扩展多槽见下 |

### 2.2 EquipmentDef 扩展（不改现有 ID）

```ts
export type EquipmentSlot = 'weapon' | 'armor' | 'cosmetic';

export interface EquipmentBonuses {
  /** 对应 VariableDef core:attack，加法整数 */
  attack?: number;
  /** core:defense */
  defense?: number;
  /** core:evasion（百分点） */
  evasion?: number;
}

export interface EquipmentDef {
  id: Id;
  name: string;
  requires: Condition[];
  description: string;
  /** 缺省 cosmetic（兼容雨衣/尾衣） */
  slot?: EquipmentSlot;
  /** 缺省 {}；cosmetic 必须全 0 / 省略 */
  bonuses?: EquipmentBonuses;
}
```

| `slot` | 可否非零 bonuses | 说明 |
|--------|------------------|------|
| `weapon` | 仅建议填 `attack`（可附带极小 hit **本版不开放**） | 攻击向 |
| `armor` | 仅建议 `defense` / `evasion` | 防护向 |
| `cosmetic` | **必须 0**；schema 校验拒绝非 0 | 雨衣/尾衣/时装 |

**本版开放加成维**：`attack` / `defense` / `evasion` 三键 only。  
**本版不开放**：`speed` / `skillPower` / `crit` / `hit` / HP / stamina（保持轻量）。

### 2.3 数值表（单件上限 + 内容样例）

#### 单件硬顶（schema / 校验）

| 键 | 单件 min–max | 说明 |
|----|--------------|------|
| `attack` | 0–4 | 武器 |
| `defense` | 0–4 | 护甲 |
| `evasion` | 0–6 | 护甲/轻装；百分点 |

#### 推荐掉落/商店档（内容填）

| 档 | slot | attack | defense | evasion | 例 |
|----|------|--------|---------|---------|-----|
| 无 | cosmetic | 0 | 0 | 0 | `raincoat` / `tailcoat`（**保持 0**） |
| 粗 | weapon | +2 | 0 | 0 | 工坊撬棍 |
| 常 | weapon | +3 | 0 | 0 | 制式短刃 |
| 粗 | armor | 0 | +2 | +2 | 垫肩雨披 |
| 常 | armor | 0 | +3 | +3 | 巡逻背心 |
| 稀 | armor | 0 | +4 | +4 | 精英外骨骼片（慎放） |

### 2.4 叠加上限（防滚雪球）

现行运行时 **单 `equipped`**：天然无叠。扩展多槽时：

```ts
// 建议运行时（向前兼容）
equippedBySlot: { weapon?: Id; armor?: Id; cosmetic?: Id }
// 旧字段 equipped 迁移：若 slot=cosmetic → cosmetic；否则按 slot 写入；读档兼容
```

| 规则 | 值 |
|------|-----|
| 每槽至多 1 件 | 新穿替换旧件回 inventory |
| **全局装备加成帽** | `attack ≤ +4`；`defense ≤ +4`；`evasion ≤ +8`（多槽求和后再 clamp） |
| 同维只加不乘 | `bonus = clamp(sum(items.bonuses.X), 0, CAP_X)` |

```
CAP = { attack: 4, defense: 4, evasion: 8 }
```

单槽时期：帽 ≈ 单件顶，行为相同。

### 2.5 战斗结算读取（可执行）

```
baseAtk = player.variables['core:attack']
baseDef = player.variables['core:defense']
baseEva = player.variables['core:evasion']
// …其余八维仍只读 VariableDef

gear = sumBonuses(equippedItems)  // 按 slot 解析；cosmetic 贡献 0
effAtk = baseAtk + clamp(gear.attack, 0, CAP.attack)
effDef = baseDef + clamp(gear.defense, 0, CAP.defense)
effEva = clamp(baseEva + clamp(gear.evasion, 0, CAP.evasion), 0, 100)

// 代入既有公式（DESIGN-deep-numerics §C）：
hitChance = clamp(50 + atk.hit - def.effEva + floor((atk.speed-def.speed)/5), 5, 95)
raw = atk.effAtk * powerMult - def.effDef * 0.5
```

- 敌方 **无** 装备槽；只用 EnemyCombatStats。  
- HUD：可显示 `攻击 10(+2)`；**条上基数仍是 VariableDef**，括号为装备。  
- `equipment.wear` / `remove`：只改 `equipped*` + inventory；**零**八维写入。

### 2.6 现有两件装备标注

| ID | slot | bonuses |
|----|------|---------|
| `district:equipment.raincoat` | `cosmetic` | 省略 / 全 0 |
| `district:equipment.tailcoat` | `cosmetic` | 省略 / 全 0 |

行为与现行一致（仅 body `requires`）。

### 2.7 备选：「装备永不改数值」

| 开关 | 行为 |
|------|------|
| `equip.bonuses.enabled = false`（**USER DECISION**） | 忽略所有 `bonuses`；slot 仅分类/UI；战斗只读 VariableDef |
| `true`（**DEFAULT**） | 按 §2.3–2.5 |

文档/设置里保留该叉，便于用户一票否决。

### 2.8 验收

- [ ] 穿武器 +3 ATK：伤害公式用 13，`core:attack` 变量仍为 10  
- [ ] 卸下后立刻回 10  
- [ ] cosmetic 非 0 bonuses → 包校验失败  
- [ ] 总和超 CAP → clamp  
- [ ] 开关 false 时雨衣/未来武器均不改数

---

## 3. 经济/物价（短桩）

| 键 | 建议初值 | 备注 |
|----|----------|------|
| 基准工资（劳动 30min） | `core:money` **+5**（现行 worldgen） | 保持 |
| 小吃/茶 | 3–8 | 恢复 energy 小幅 |
| 镇定药水（小/大） | 15 / 35 | 见 sanity-drain：理智恢复 **+15/+25**（§C.7 旧符号作废） |
| 粗武器 / 常武器 | 25 / 60 | 对应 §2.3 |
| 粗护甲 / 常护甲 | 30 / 70 | |
| 诊所点滴 `core:health +8` | 免费或 5 | worldgen clinic |
| 安全区处理伤势 | 0（服务） | 治疗量见 §C USER DECISION |
| 日耗参考 | 起步 `core:money=60` ≈ 数次茶+1 件粗装 | 勿通胀 |

> 完整物价表后期按分区倍率填；本桩只钉锚点。ID 仅用 `core:money`。

---

## 4. 敌成长 / 分区难度（短桩）

| 区带 | 遇敌权重 | 档位池 | 奖励钱倍率 |
|------|----------|--------|------------|
| 安全/主街 | 低 | 80% S / 20% M | ×1.0 |
| 工坊/运河 | 中 | 50% S / 40% M / 10% L | ×1.2 |
| 检查站外 | 高 | 30% S / 45% M / 25% L | ×1.5 |
| Boss 房 | 脚本 | **仅** `tier: boss` 专表 | 剧情 |

敌数值锚点仍用深设计 S/M/L/Boss 表；分区只改 **刷取权重与钱**，不另开玩家 VariableDef。

---

## 5. 玩家八维成长（短桩）

| 来源 | 规则（建议） |
|------|--------------|
| 战斗胜利 | 不直接加八维；走奖励事件 / 稀有训练 |
| 训练 Action（时钟 ≥45min） | 选一维 `var.change` **+1**；每维日上限 +2；总八维日上限 +3 |
| 装备 | **不**永久加；见 §2 |
| 硬顶 | ATK/DEF/SPD/SKP 单维软顶 40（内容再开放）；hit≤95；eva≤40；crit≤30 |
| 禁止 | 倾向字段加八维；Tag 加八维 |

ID：`core:attack` 等，禁止改名。

---

## 6. Resident.trust vs `core:trust`（短桩）

| 字段 | 位置 | 范围 | 用途 |
|------|------|------|------|
| `Resident.trust` | `district.residents[]` | 建议 0–100 整数 | **该 NPC** 关系；talk +1/日、help +2；持久化/记忆门槛 |
| `core:trust` | `player.variables` | 0–100 VariableDef | **玩家信任倾向**；只进 `writingContext.tone.trust` 文风 |
| NPC `relationship.trust` | 固定 NPC 系统 | 独立 | 与 Resident 并行，勿混写 |

**禁止**：用 `core:trust` 替代 `Resident.trust` 做帮助检定；**禁止**反写。  
阈值建议（Resident）：0–2 初识 / 3–7 熟悉 / ≥8 可托事（内容条件用 `resident` 运行时，不进倾向 DSL）。

---

## 7. Status 数值体系（短桩）

> 现行无独立 Status 运行时；理智公式已留 `statusModParts`。本桩定最小表供后装。

| statusId（建议） | 类 | duration | stacks | 对理智 `statusMod` | 其他 |
|------------------|----|----------|--------|---------------------|------|
| `status.calmed` | 镇定 | 120min | 1（刷新） | **−0.20** | 与药水叠加规则：同 id 刷新 |
| `status.bound` | 压抑/束缚 | 随 scene 或 30min | 1–3 | **+0.15** / 层？→ **建议固定 +0.15 不叠乘** | stacks 只影响文风 |
| `status.fatigued` | 虚弱 | 60min | 1 | 0 | 可选：远路闸门上移 |
| `status.wounded` | 轻伤 | 至安全区 | 1 | 0 | 文风；非 DOT |

汇总（照抄深设计）：

```
statusMod = clamp(1 + Σ parts, 0.5, 1.5)
```

未实装 Status 前：`statusModParts = []` → 1.0。

---

## C. Class-2 未完项 — 决策表（设计出数）

下列补齐 `NOTES-deep-numerics-impl`「未做 / 需用户拍」。标 **USER DECISION** 的才需要用户二选一；其余可直接实装。

### C.1 远路 stamina −5（route far tag）

| 项 | 决策 |
|----|------|
| 触发 | `Route.distanceTier ∈ {far, cross}` |
| 扣点 | `STAMINA_COST.moveFar` = **5** |
| 闸门 | `staminaGate.allowFarMove`（≥40） |
| 时钟 | 见 §1.3 |
| 实装点 | `effects.ts` `location.move`；selectors 旅行预检读 Route |
| 状态 | **可直接实装**（依赖 §1 字段） |

### C.2 多卡同回 + 技能 SR−15

| 卡 | AP | `core:skillResource` | powerMult | 备注 |
|----|-----|----------------------|-----------|------|
| 轻击 | 1 | 0 | 0.7 | |
| 标准击 | 2 | 0 | 1.0 | 现行 attack 映射 |
| 重击 | 3 | 0 | 1.4 | AP=3 时独占整回 |
| 技能击 | 2 | **−15** | 1.2（用 skillPower） | SR&lt;15 不可选 |
| 防守 | 1 | 0 | — | 承伤 ×0.5 |
| 喘息 | 1 | +8 | — | 不可与重击同回 |
| 逃离 | 2 | 0 | — | 检定见深设计 |

| 回合经济 | 值 |
|----------|-----|
| 开回 AP | `min(10, core:actionPoints)`（默认 3） |
| 未用 AP | **不**跨回 |
| 回末 SR | +5（战斗中） |
| 同回组合例 | 标准+轻；轻×3；技能+轻；防+喘+轻 |

| 项 | 决策 |
|----|------|
| 过渡策略 | 可先保留四移 UI，内部映射标准击；再开多卡 |
| 状态 | 设计数已定；**引擎可分期**。是否首期上多卡 = **USER DECISION**（玩法节奏） |

### C.3 Boss / L 内容钩子（非全文）

| 钩子 | 设计要求 |
|------|----------|
| L 精英遭遇 | `tier: "L"`；HP90 八维按深设计；defeat → 普通败北事件 |
| Boss | `tier: "boss"` + `phases[]`；**禁止** S/M/L 倍率生成 |
| Boss 败北 | 独立 `defeatEventId`；sanity **loss** base **10–14**（drain 语义） |
| Boss 胜利 | 剧情旗 + 高奖励；可解锁区带 |
| 内容包 | 尚无遭遇实体 — 只预留 ID 槽，如 `district:enemy.boss.*` |
| 状态 | **设计钩子 only**；正文另议 |

### C.4 scene arousal / restraint 写入；struggle −10

| `scene.act` move | arousal Δ | restraint Δ | stamina |
|------------------|-----------|--------------|---------|
| `pose`（靠近 face/balance） | +4 | 0 | 0 |
| `pose`（across/turn） | +1 | 0 | 0 |
| `contact` | +8 | +5 | 0 |
| `release` | −6 | −10 | 0 |
| `pause` | −3 | 0 | 0 |
| `resume` | +2 | 0 | 0 |
| `exit` | （先 aftertaste 公式，再清零） | — | 0 |
| **struggle**（新 move 或事件效果） | +5 | −15 | **`STAMINA_COST.struggle` = −10** |

钳制：`arousal/restraint` 均 `clamp(0,100)`。  
低体力：`stamina≤19` 禁止 struggle（`allowStruggle=false`）。

| 状态 | **可直接实装**写入表；struggle 需内容加 action |

### C.5 worldgen labor→stamina；rest +stamina；指纹风险

| 项 | 决策 |
|----|------|
| 劳动 | 已：`resident.help` −8 stamina；worldgen `work` 应从 `core:energy −5` 迁到 **stamina −8**（+可选 energy −2） |
| `aetheria:action.rest` | 建议 **+12 `core:stamina`**（与短休息对齐），保留 energy +25 |
| 指纹 | 改 world/core 包 effects → 存档指纹变化，需迁移/版本 bump |
| 状态 | 数已定；**是否改 world 包** = **USER DECISION**（指纹/迁移成本）。替代：仅 district waitday/rest 回 stamina（现行 NOTES 路径） |

### C.6 安全区治疗 +100 vs +40 — **USER DECISION**

| 方案 | `core:health` | 体验 |
|------|---------------|------|
| A 现行 | **+100** | 安全锚点一键拉满；诊所 +8 无感 |
| B 推荐 | **+40** | 仍显著；保留资源紧张与再访诊所/休息动机 |

**设计推荐：B = +40**。

理由：

1. 玩家 HP 上限 100；+100 使安全区 = 满血按钮，削弱 M/L 战后的恢复决策。  
2. 深设计已给战斗内 recover +8、诊所 +8、休息分轨；安全区 +40 ≈ 半管，与「安全但仍需经营」一致。  
3. 时钟仍 60min + energy +25，时间成本保留。

| 标记 | **USER DECISION**：采用 +40（推荐）还是维持 +100 |
|------|--------------------------------------------------|

实装时改 `district:action.heal.*` 五处 `amount`。

### C.7 理智触发表 + 倾向增量 + 镇定药水

> **【已取代 2026-10-13】** tick 为 **loss（减法）**；恢复为 **加**；Bad End **≤0**。  
> 权威：[`DESIGN-sanity-drain-2026-10-13.md`](./DESIGN-sanity-drain-2026-10-13.md)。下列 base 区间仍有效，但接入 `sanityLoss` 而非 `sanityGain`。

#### C.7.1 sanity tick 触发（内容标标签 → 引擎 `sanityLoss`）

| 内容标 | base 区间 | 典型场景 |
|--------|-----------|----------|
| `sanity.tick.light` | **3–5** | 目击异象、轻惊愕、非战败 |
| （默认/战败） | **5–8**（战败固定 base=6） | 常规拍点、战斗失败 |
| `sanity.tick.continue` | **8–12** | 同一 scene 内再次加深 |
| `sanity.tick.heavy` | **10–14** | 强制 TF、精英/Boss 败北 |

乘区：`arousal` / `submissionTendency` / `transformProgress` / `stress/400` / `statusMod` → **乘在 loss 上**。  
应用：`sanity' = max(0, sanity − loss)`；`≤0` → flag。ID：只写 `core:sanity`。

#### C.7.2 倾向增量（文风 only；不锁分支）

| 触发 | 字段 | Δ | 备注 |
|------|------|---|------|
| scene exit（已有 aftertaste 公式） | `core:aftertaste` | 见深设计 | |
| contact 成功 | `core:desire` | +2 | clamp 100 |
| struggle 失败仍束缚 | `core:stress` | +3 | |
| struggle 成功脱离 | `core:confidence` | +2 | |
| 帮助居民 | `core:affection` | +1 | **同时** `Resident.trust+2`（分轨） |
| 战败 | `core:stress` | +4 | 另算 sanity |
| 每 60min 时钟 | `core:aftertaste` | −5 | 已有 |
| 禁止 | 任何倾向 | 直接改 sanity/HP/八维 | |

#### C.7.3 镇定药水

| 物品档 | `core:sanity` | `core:money` 参考价 | 附带 status |
|--------|---------------|---------------------|-------------|
| 小 | **+15**（原 −15） | 15 | `status.calmed` 120min |
| 大 | **+25**（原 −25） | 35 | `status.calmed` 180min |

走 `var.change`；不改 VariableDef 边界（0–100）。initial 现为 **100**。

| 状态 | 触发表/药水数 **可直接实装**；倾向增量可分期 |

---

## D. USER DECISION 清单（仅真分叉）

父 agent / 用户只需拍下列项；其余按 DEFAULT 交引擎：

| # | 议题 | 选项 | 设计推荐 |
|---|------|------|----------|
| U1 | 装备是否改战斗数 | A 轻量 ATK/DEF/EVA 加成（§2 DEFAULT） / B 永不改数值 | **A** |
| U2 | 安全区治疗量 | +40 / +100 | **+40** |
| U3 | 是否改 world 包 rest/labor（指纹） | 改 world + 迁移 / 仅 district 回 stamina | **仅 district**（稳）除非接受指纹升级 |
| U4 | 首期是否上多卡同回 | 上 / 暂映射四移 | **暂映射**（降低实装面） |
| U5 | cross 是否与 far 同耗 5 | 同 5 / cross 另耗 6 | **同 5** |

非分叉（直接做）：§1 全表、远路 −5、arousal 写入表、struggle −10、sanity tick 表（**loss**）、药水 **+15/+25**、桩 §3–7；理智语义见 DESIGN-sanity-drain。

---

## E. 给引擎实装的顺序建议

1. 扩展 `RouteDef` + `location.move` 读 tier/duration/stamina（§1）  
2. 旅行 Action 去重 `clock.advance`；标几条 `far`/`cross` 样例  
3. 装备 `slot`/`bonuses` + 结算 `eff*`（§2）；开关默认开  
4. scene 写入表 + struggle（§C.4）  
5. heal 改 +40 **仅当 U2 确认**；未确认前保持 +100 并留 TODO  
6. 多卡/SR−15 按 U4  
7. 桩 §3–7 不阻塞战斗

---

## F. 验收总表

- [ ] 移动：三档时间与体力与闸门一致；无双计时钟  
- [ ] 装备：DEFAULT 下 ATK/DEF/EVA 生效且不写回变量；cosmetic=0  
- [ ] U1–U5 未决项不静默改用户预期  
- [ ] 无 VariableDef 重命名  
- [ ] Class-2 数字与本文表一致可单测

