# 数值深设计（可执行）— 理智 / 体力 / 八维 / 倾向文风 / 战斗平衡

> 日期：2026-10-12（Asia/Singapore）  
> 对照提交：`b2eea4662e55ac21c79a931a2beb0e29d8207e32`（分支 `codex/tag-effect-preview`）  
> 状态：**设计交付**；引擎实装 agent 按本文接公式，勿改 VariableDef ID（除非「字段映射」节另注）。  
> 原则：玩法硬数字尽量少；倾向只喂文风；数值在 GameState，不进 Tag；TF 走 BodyGraph；抗性不在范围。  
>  
> **⚠ 理智语义已翻转（2026-10-13）**：`core:sanity` 改为清醒条（满=清醒、空=崩坏）。  
> **§0.3 表中 sanity 行、§0.5 理智行、§0.6 sinking 行、整节 §A、§F 第 4 步、§G 理智验收** 均被  
> [`docs/DESIGN-sanity-drain-2026-10-13.md`](DESIGN-sanity-drain-2026-10-13.md) **取代**。引擎勿再按「涨到 100 Bad End」实装。

---

## 0. 仓库现状盘点（实装对照）

### 0.1 Git

| 项 | 值 |
|----|-----|
| 当前检出 | `codex/tag-effect-preview` @ `b2eea46` |
| 数值扩表提交 | `feat(vars): 统一 HP 与扩表 sanity/stamina/skillResource、倾向与战斗属性` |
| 默认分支 `main` | 远端 tip 仍是旧快照（`f221ce4` backup），**数值提交尚未合入 main** |
| 说明 | 用户说「刚 push」指本 feature 分支；深设计以本分支为准 |

### 0.2 数值相关变更文件（该提交）

`content/core/pack.json` · `content/district/pack.json` · `docs/NOTES-vars-engine.md` · `scripts/create-district-b.mjs` · `src/content/foundation-schema.ts` · `src/content/schema.ts` · `src/core/district-types.ts` · `src/engine/district-effects.ts` · `src/engine/transform-perception.ts` · `src/persistence/codec.ts` · `src/persistence/district-validation.ts` · `src/persistence/foundation-migration.ts` · `src/persistence/stage3-packs.ts` · `src/persistence/vars-migration.ts` · `src/ui/render.ts` · `src/world/generator.ts` · 若干 tests/fixtures

### 0.3 VariableDef 全表（仅 `content/core/pack.json`；其他 pack 无 variables）

#### A 硬核心（HUD）

| ID | label | initial | min–max | 现状 |
|----|-------|---------|---------|------|
| `core:money` | 零钱 | 60 | 0–999999 | 已用 |
| `core:energy` | 精力 | 70 | 0–100 | 社交/脑力/旧战斗扣费仍走它 |
| `core:health` | 生命 | 100 | 0–100 | **统一 HP**；归零战败 |
| `core:stamina` | 体力 | 100 | 0–100 | **仅入库，无扣点** |
| `core:sanity` | 理智 | ~~0~~ → **100** | 0–100 | **已被 sanity-drain 取代**：满=清醒；≤0 Bad End + flag |
| `core:skillResource` | 技能资源 | 100 | 0–100 | **仅入库** |

#### B 战斗八维

| ID | label | initial | min–max |
|----|-------|---------|---------|
| `core:attack` | 攻击 | 10 | 0–999 |
| `core:defense` | 防御 | 10 | 0–999 |
| `core:speed` | 速度 | 10 | 0–999 |
| `core:skillPower` | 技能强度 | 10 | 0–999 |
| `core:crit` | 暴击 | 5 | 0–100（%） |
| `core:hit` | 命中 | 80 | 0–100（%） |
| `core:evasion` | 闪避 | 10 | 0–100（%） |

#### C 行动点

| ID | label | initial | min–max |
|----|-------|---------|---------|
| `core:actionPoints` | 行动点 | 3 | 0–10 |

#### D 倾向（约定 text-only）

| ID | label | initial | min–max |
|----|-------|---------|---------|
| `core:desire` | 欲望 | 0 | 0–100 |
| `core:submissionTendency` | 顺从倾向 | 0 | 0–100 |
| `core:stress` | 压力 | 0 | 0–100 |
| `core:confidence` | 自信 | 50 | 0–100 |
| `core:affection` | 爱意 | 0 | 0–100 |
| `core:trust` | 信任倾向 | 0 | 0–100 |
| `core:aftertaste` | 余韵 | 0 | 0–100 |

**无** `transformPerception` / `transformProgress` VariableDef（正确：派生）。

#### Flag

| ID | initial |
|----|---------|
| `core:flag.sanity_break` | false |

### 0.4 非 VariableDef 运行时字段

| 位置 | 字段 | 范围 | 现状 |
|------|------|------|------|
| `DistrictState.scene` | `arousal` | 0–100 | 进场 0；exit 清零；**无衰减/无写入余韵** |
| `DistrictState.scene` | `restraint` | 0–100 | 同上 |
| `DistrictState.combat` | `hp` / `turn` / `log` | 敌方当前 HP | 仍按旧意图表结算 |
| `Resident.trust` | NPC 关系 | — | **≠** `core:trust` |
| `transformPerception()` | 派生 | 应 0–100 | stub **恒 0** |

### 0.5 现行战斗（占位，与深设计冲突）

| 项 | 现行代码 |
|----|----------|
| 玩家伤害 | `max(1, 12 + (tailGrip?3:0) - intent.guard)`，**不读八维** |
| 玩家承伤 | `intent.damage`（guard 时 −8） |
| 资源 | attack −3 `energy`；recover −6 `energy` +10 HP；guard +4 `energy` |
| 敌方 | 仅 `hp` + intents.`damage/guard/drain`；无八维 |
| 现有三敌 HP | scavenger 30 / collector 38 / gel 26（**旧 0–40 玩家条尺度**） |
| 理智 | ~~战败固定 +10~~ → 现公式流失；**语义见 DESIGN-sanity-drain** |

### 0.6 字段映射（旧名 → 现 ID）

| 旧/口语 | 仓库 ID | 备注 |
|---------|---------|------|
| sinking | `core:sanity` | ~~上升至 100 崩坏~~ → **2026-10-13 改为下降至 0 崩坏**（见 DESIGN-sanity-drain） |
| HP / 体况 / district:health | `core:health` | 旧 0–40 读档 ×(100/40) 迁入 |
| MP | **禁止**；用 `core:skillResource` | label 可后改世界观名 |
| transformPerception 标量 | **不存**；`transformPerception(state)` | |
| transformProgress | **不存**；见 §A.2 派生 | |

---

## A. 理智正式公式（`core:sanity`）

> **【已取代 2026-10-13】** 本节（A.1–A.6）描述的「崩坏积蓄 / 涨到 100」方案**作废**。  
> 现行可执行设计：[`DESIGN-sanity-drain-2026-10-13.md`](DESIGN-sanity-drain-2026-10-13.md)
> （initial=100；loss 公式同形；休息/药水改加；≤0 → `core:flag.sanity_break`）。  
> 以下原文仅供考古，**勿实装**。

### A.1 语义

- ~~**理智是「崩坏积蓄」**：0 = 清醒，100 = Bad End 门槛。~~ **已废**  
- ~~增加 = 受冲击/沉沦加深；减少 = 药水/休息等恢复。~~ **已废**  
- ~~**不要**做成传统「理智条扣光」语义~~ → **已改为扣光语义**（见 sanity-drain）。

### A.2 派生输入

```
transformProgress = clamp( round( 100 * tfFilledSlots / tfRelevantSlots ), 0, 100 )
```

- `tfRelevantSlots`：BodyGraph 上标记为可 TF 的部位槽位数（内容约定；无槽则 0）。  
- `tfFilledSlots`：其中已处于非基线 TF 阶段的槽位数。  
- **不写** `player.variables`。  
- `transformPerception(state)` 可先返回与 `transformProgress` 相同，或另表「观感」；文风用 perception，理智公式用 progress。

场景临时：

| 键 | 来源 |
|----|------|
| `scene.arousal` | 互动场景内引擎维护 |
| `scene.restraint` | 同上；无场景时按 0 |

倾向：`core:submissionTendency`。

### A.3 上涨公式（单次结算）

```
base ∈ 整数区间（见表）
statusMod = 1.0
  + (若有「压抑/束缚」类 status：+0.15)
  + (若有「镇定」类 status：−0.20)
  （可叠加，最终 clamp 到 [0.5, 1.5]）

gain = round(
  base
  × (1 + arousal/200 + submissionTendency/150 + transformProgress/250)
  × statusMod
)
sanity' = min(100, sanity + max(0, gain))
```

无场景时 `arousal = 0`。`submissionTendency` / `transformProgress` 始终可读。

#### base 表

| 触发 | base | 说明 |
|------|------|------|
| 普通回合冲击（战败外的轻度惊愕/目击） | 3–5 | 内容标 `sanity.tick.light` |
| 标准回合（常规互动拍点 / 战败） | 5–8 | 默认；**取代**现行固定 +10 |
| 继续互动（同一 scene 内再次加深拍点） | 8–12 | `sanity.tick.continue`；高于普通 |
| 重度冲击（强制 TF 节点、精英战败） | 10–14 | 稀有；玩法硬数字仍少 |

随机：若内容给 `[lo,hi]`，`base = lo + floor(rng * (hi-lo+1))`。

**战败默认**：`base = 6`（区间 5–8 的中位），再走乘区；约等于中等冲击，不再写死 +10。

### A.4 下降（恢复）

| 来源 | 公式 | 备注 |
|------|------|------|
| 休息（公寓/安全座，时钟 ≥30min） | `sanity' = max(0, sanity − 8)` | 与 `energy`/`stamina` 恢复可同动作，但分字段 |
| 镇定药水 / 护理 | 内容 `var.change` 负向；建议 −15 / −25 | 走现有 `var.change` |
| 长睡（≥6h 片段） | `−15` | worldgen/事件标注 |

**禁止**倾向字段直接减理智（倾向只文风）。

### A.5 ≥100 Bad End

```
if sanity' >= 100:
  flags[core:flag.sanity_break] = true
  → 启动 Bad End 事件（建议 ID：core:event.sanity_break 或 district 等价；待内容包）
```

现行仅 flag + 占位文案；实装时：置 flag 后 `event.start`，不要只打 log。

### A.6 与 git 上传的差异

| 点 | 上传现状 | 本设计 |
|----|----------|--------|
| 战败增量 | 固定 +10 | 公式 + base 5–8 |
| 继续互动 | 无 | base 8–12 |
| 恢复 | 无 | 休息/药水表 |
| Bad End | flag stub | flag + 事件入口 |

---

## B. stamina 扣点（`core:stamina`）

### B.1 三分法（硬区分）

| 资源 | ID | 用途 |
|------|-----|------|
| 生命 | `core:health` | 战斗/伤害；归零战败 |
| 体力 | `core:stamina` | 赶路、体力劳动、挣扎、交锋肢体负荷 |
| 精力 | `core:energy` | 社交、脑力、谈判、观察、**旧战斗扣费迁出后不再用于攻击** |

### B.2 消耗表（建议整数）

| 行动 | stamina | 备注 |
|------|---------|------|
| 同区短移动 `location.move`（邻接） | −2 | |
| 跨区/远路 | −5 | 可由 route 标签区分 |
| 体力劳动（搬运/维修/worldgen work） | −8 | 现行多扣 energy −5：改为 stamina，energy −2（脑力疲劳）可选 |
| 挣扎（束缚脱离/场景 force） | −10 | |
| 战斗：普通攻击结算后 | −3 | 「交锋肢体负荷」；**另计** AP/技能资源 |
| 战斗：防守成功 | −1 | |
| 战斗：逃跑检定 | −4 | |
| 场景：建立/维持高强度接触每回合 | −2 | 可选，默认关 |

不足时：`directResourceCheck` 同 `var.change` 预检失败，给出「体力不足」。

### B.3 低阈值

| stamina | 规则 |
|---------|------|
| ≥40 | 正常 |
| 20–39 | 禁止「跨区远路」「体力劳动」；短移动允许 |
| 1–19 | 仅允许休息/社交低耗；禁止挣扎、战斗攻击、逃跑外的高耗 |
| 0 | 强制进入「就地撑着」：只能 rest / 求助；若在战斗中则下回合只能 guard 或 flee |

实现：在 `actionOptions` / `selectors` 加 stamina 门槛，**不要**用 Tag。

### B.4 恢复（对 energy）

| 动作 | stamina | energy |
|------|---------|--------|
| 短休息 30min | +12 | +12（可保持现行 energy） |
| 安全区护理座 | +20 | +6 |
| 长睡片段 | +50（clamp 100） | +40 |
| 战斗 guard | **不**回 stamina（只回 energy 旧逻辑删除后：改为 +0 stamina，或 +2 轻喘） | |

原则：**体力靠歇与睡；精力靠歇、社交缓冲与低强度活动**。二者可同动作双回，但不要互相替代扣减。

### B.5 与 git 差异

- `core:stamina` 已入库；**全库无扣点**（worldgen/战斗仍扣 `energy`）。  
- 实装：迁移战斗 attack/recover 的 energy 门槛 → stamina（或 AP，见 C）；劳动类改 stamina。

---

## C. 八维 / 技能结算

### C.1 参战属性读取

**玩家**：`player.variables` 八维 + `core:actionPoints` + `core:skillResource`。  
**敌人**：内容模板字段（见 E）；战斗开始时拷入 `district.combat` 运行时（建议扩展，不写玩家 variables）。

建议扩展运行时（设计；schema 随后）：

```
combat: {
  enemyId, turn, log,
  enemy: { hp, hpMax, attack, defense, speed, skillPower, crit, hit, evasion, apPerTurn, skillResource },
  playerAp: number,          // 本回合剩余 AP；开回合 = min(10, core:actionPoints)
  ...
}
```

`core:actionPoints` = **每回合 AP 上限**（initial 3）；回合开始 `playerAp = actionPoints`。

### C.2 命中 / 闪避 / 暴击

一律百分比整数，先算后掷 `draw(state, salt)` ∈ [0,1)。

```
hitChance = clamp( 50 + atk.hit - def.evasion + floor((atk.speed - def.speed)/5) , 5, 95 )
// 命中成功后：
critChance = clamp( atk.crit , 0, 100 )
```

- miss：伤害 0，仍耗 AP/资源。  
- crit：伤害 ×1.5，向下取整，至少 +1。

### C.3 伤害

```
// 物理卡
raw = atk.attack * powerMult - def.defense * 0.5
// 技能卡
raw = atk.skillPower * powerMult - def.defense * 0.35

damage = max(1, floor(raw))
if crit: damage = max(damage + 1, floor(damage * 1.5))
```

`powerMult`：卡面系数，普通 1.0、重击 1.4、轻击 0.7。  
**文本游戏**：不做复杂抗性（本范围外）。

### C.4 AP 与卡组合（每回合）

默认手牌语义（引擎可先写死 4 张基础卡，内容后换）：

| 卡 | AP | skillResource | powerMult | 额外 |
|----|-----|---------------|-----------|------|
| 轻击 | 1 | 0 | 0.7 | |
| 标准击 | 2 | 0 | 1.0 | |
| 重击 | 3 | 0 | 1.4 | |
| 技能击 | 2 | 15 | 1.2（用 skillPower） | |
| 防守 | 1 | 0 | — | 本回合承伤 ×0.5；可 +2 energy |
| 喘息 | 1 | 0 | — | +8 skillResource；不可与重击同回 |
| 逃离 | 2 | 0 | — | 检定：`40 + speed - enemy.speed`% |

**回合行动经济**：AP=3 时典型组合：

- 标准击 + 轻击（2+1）  
- 轻击 ×3  
- 技能击 + 轻击（2+1）  
- 防守 + 喘息 + 轻击  

开回合回复 AP；未用完的 AP **不**跨回合（简单）。

### C.5 skillResource

| 规则 | 值 |
|------|-----|
| 上限 | 100（VariableDef） |
| 技能击消耗 | 15（精英技可 25） |
| 回合末自然回复 | +5（战斗中） |
| 喘息卡 | +8 |
| 出战斗后每 30min | +10 |
| 归零 | 只能物理卡 / 喘息 |

显示名保持「技能资源」直至世界观定稿；**代码 ID 不变**。

### C.6 速度与先手

```
if player.speed >= enemy.speed: 玩家先手
else: 敌方先手
```

平局玩家先。不做多段速度条，保持文本可读。

### C.7 与 git 差异

八维/AP/skillResource **仅 VariableDef**；现行 `combat.turn` 四移仍绑 energy。实装路径：用卡/AP 替换 move 枚举或映射 `attack→标准击` 过渡。

---

## D. 倾向文风挂钩（永不硬锁）

### D.1 字段与职责

| ID | 文风作用（仅） |
|----|----------------|
| `core:desire` | 措辞热度、身体描写密度 |
| `core:submissionTendency` | 选项口吻偏顺从/抗拒（**选项仍全可见**） |
| `core:stress` | 短句、喘息、注意力涣散 |
| `core:confidence` | 主动/试探语气 |
| `core:affection` | 亲密称呼、柔软用词 |
| `core:trust` | 对 NPC 的叙述信任感（≠ Resident.trust） |
| `core:aftertaste` | 离场后余韵、下一场景开场残留 |
| `transformPerception()` | TF 观感描写强度 |
| `scene.arousal` / `restraint` | 场景内即时基调 |

**禁止**：用倾向做 `conditions` 硬锁剧情分支、锁地点、锁战斗胜负。最多影响 **文本槽 prompt / 选项 label 措辞 / 叙述修饰**。

### D.2 分档（统一 0–30 / 31–70 / 71–100）

| 档 | 区间 | prompt 后缀 |
|----|------|-------------|
| low | 0–30 | `_low` |
| mid | 31–70 | `_mid` |
| high | 71–100 | `_high` |

```
band(x) = x<=30 ? 'low' : x<=70 ? 'mid' : 'high'
```

### D.3 叙事层 context keys（写入 writingContext 扩表）

```
tone: {
  desire: band(desire),
  submission: band(submissionTendency),
  stress: band(stress),
  confidence: band(confidence),
  affection: band(affection),
  trust: band(trust),
  aftertaste: band(aftertaste),
  transformPerception: band(transformPerception(state)),
  scene: { arousal, restraint, arousalBand, restraintBand } | null
}
```

示例 prompt 指示（给文案/模型，非玩法）：

| key | low | high |
|-----|-----|------|
| desire | 克制、疏离感官 | 感官词增加，仍不破内容分级 |
| submission | 选项措辞偏自主 | 同一选项改写为更软口吻 |
| stress | 句式平稳 | 短句、重复、走神 |
| confidence | 试探、留余地 | 明确提出、少道歉 |
| aftertaste | 无残留 | 开场带未褪触感/情绪 |

### D.4 场景 → 余韵（离场）

在 `scene.act exit` **清零 scene 之前**：

```
delta = round( scene.arousal * 0.4 + scene.restraint * 0.2 )
aftertaste' = clamp( aftertaste + delta − 10 , 0, 100 )
// −10：离开时的「抽离」；无互动余味则略降
```

然后 `scene = null`（arousal/restraint 随场景丢弃）。  
余韵自然衰减：每推进 60min `aftertaste' = max(0, aftertaste − 5)`。

### D.5 与 git 差异

倾向已入库；`writingContext` **未**注入 tone；exit **未**写 aftertaste。

---

## E. 战斗上限 100 + 敌方模板（小 / 中 / 大精英 + Boss 专表）

### E.1 玩家锚点

| 项 | 值 |
|----|-----|
| HP | 0–100（保持 VariableDef） |
| 基准八维 | ATK/DEF/SPD/SKP 10；hit 80；eva 10；crit 5 |
| 每回合 AP | 3 |
| 期望输出 / 回（标准击+轻击，无暴） | ≈ `floor(10*1.0- def*0.5) + floor(10*0.7- def*0.5)` |

对 DEF=4 小怪：≈ 8 + 5 = **13**；对 DEF=8：≈ 6 + 3 = **9**；对 DEF=12：≈ 4 + 2 = **6**。

### E.2 三类模板（非 Boss）

倍率相对「玩家基准 10」。敌人不使用玩家 VariableDef，用 EnemyTemplate。

| 档 | 代号 | HP | ATK | DEF | SPD | SKP | hit | eva | crit | 每回动作数 | 敌方 SR | 期望回合 | 设计意图 |
|----|------|----|-----|-----|-----|-----|-----|-----|------|------------|---------|----------|----------|
| 小 | S | 35 | 8 | 4 | 8 | 6 | 70 | 5 | 3 | 1 | 0（无技能） | **2–3** | 教学/路障 |
| 中 | M | 60 | 12 | 8 | 10 | 10 | 75 | 10 | 5 | 1（20% 再轻击） | 30 | **3–5** | 常规 |
| 大/精英 | L | 90 | 16 | 12 | 12 | 14 | 80 | 15 | 8 | 2 | 60 | **5–7** | 资源检查 |

敌方单次伤害（对玩家 DEF=10）：

```
enemyDamage = max(1, floor(enemy.ATK * mult - 10*0.5))
```

| 档 | 普通击 mult=1 | 期望玩家承伤/回 | 备注 |
|----|---------------|-----------------|------|
| S | max(1,8−5)=**3** | ~3 | 可多场不修 |
| M | max(1,12−5)=**7** | ~7–10 | 需防守穿插 |
| L | 两下：7+4 或 11 | ~12–16 | 逼药用技能/防 |

**逃离**：S 容易（+10%）、L −10%。

### E.3 现有三敌映射（内容改数，ID 可保留）

| 现有 ID | 现 HP | 建议档 | 新 HP | 意图改写 |
|---------|-------|--------|-------|----------|
| `district:enemy.gel` | 26 | S | 35 | 低伤害纠缠 + drain→改扣 stamina 1–2 |
| `district:enemy.scavenger` | 30 | S/M 偏 S | 40 | 横扫偏物理 |
| `district:enemy.collector` | 38 | M | 60 | 耗精力改为耗 stamina/SR |

旧 intent.`guard` 改为提高该回合 DEF 或降玩家 hit；`drain` 改 stamina（或 skillResource），**不再主扣 energy**。

### E.4 Boss 专表（不要并进三类）

Boss 单独：更高 HP、阶段、专属技能资源与行动模式。

| 项 | Boss 建议 |
|----|-----------|
| HP | **160**（可 140–180；勿用三类倍率公式生成） |
| ATK / DEF / SPD / SKP | 18 / 14 / 11 / 16 |
| hit / eva / crit | 85 / 12 / 10 |
| 每回动作 | 2；阶段 2+ 可 3 |
| 专属 SR | 100；大招 −40 SR，冷却 2 回 |
| 阶段 | HP≤50% 时 DEF+4、增加 1 控制意图 |
| 期望回合 | **8–12**（文本战上限，避免碾字） |
| 败北 | 走事件，不公用小怪 defeat；可加 sanity base 10–14 |
| 奖励 | 远高于 L；剧情旗标 |

Boss **禁止**只调三类倍率；必须独立 `tier: "boss"` + `phases[]`。

### E.5 行动经济总览

| 对局 | 玩家目标 | 失败线 |
|------|----------|--------|
| S | 2–3 回打死；可无技能 | 磨太久仅浪费 stamina |
| M | 4 回左右；至少 1 次防/喘息 | HP 掉过半需恢复 |
| L | 耗 SR 与 AP；允许中途 recover 映射为「喘息+小治」 | 连续硬钢易死 |
| Boss | 学意图、存 SR 打阶段 | 专属 Bad 分支可选 |

Recover 旧：「−6 energy +10 HP」→ 改为 **AP 2 + stamina 4，+8 HP**（战斗内紧急）；大战场外用安全区。

安全区 `+100` HP 拉满：保留为「安全锚点」；诊所 `+8` 保持点滴感。若偏强，可改安全区 `+40`（另议，非阻塞）。

### E.6 与 git 差异（平衡）

| 点 | 上传 | 本设计 |
|----|------|--------|
| 玩家 HP 上限 | 100 | 保持 100 |
| 敌 HP | 26–38 | S35 / M60 / L90 / Boss160 |
| 伤害 | 固定 12−guard | 八维公式 |
| 资源 | energy | stamina + AP + skillResource |
| 敌分类 | 无 | S/M/L + Boss 专表 |

---

## F. 实装顺序建议（给引擎 agent）

1. **公式纯函数**落地：`sanityLoss`（取代 `sanityGain`）/ `combatHit` / `combatDamage` / `aftertasteOnExit` / `transformProgress`（测单测）。  
2. 战斗运行时扩字段；三敌改模板数；Boss 先占位结构。  
3. stamina 扣点接 `location.move` + labor；selectors 门槛。  
4. 理智：~~休息减 / 满值事件~~ → 按 **DESIGN-sanity-drain**：`sanityLoss` 减法；休息/药水加；**≤0** `event.start`。  
5. writingContext 注入 `tone`；exit 写 aftertaste。  
6. **不**把倾向写入条件 DSL；**不**把数值塞 Tag。

---

## G. 验收清单

- [ ] 理智：~~gain / ≥100~~ → 见 sanity-drain：`sanityLoss` 一致；**≤0** 置 flag 并进事件  
- [ ] stamina：赶路/劳动/挣扎有扣；低阈值限制可测  
- [ ] 八维：miss/crit/伤害样本对表；AP=3 组合合法  
- [ ] skillResource：技能扣 15、回合 +5  
- [ ] 倾向：只出现在 writing context；条件引擎测「无倾向硬锁」  
- [ ] 余韵：exit 后 aftertaste 增加，scene 临时清零  
- [ ] S/M/L 期望回合在模拟器落在区间；Boss 不走三类倍率  

