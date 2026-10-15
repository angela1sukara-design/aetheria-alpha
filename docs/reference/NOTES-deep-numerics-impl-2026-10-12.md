# 数值深设计实装笔记 — 2026-10-12

> 对照：`docs/DESIGN-deep-numerics-2026-10-12.md`  
> 分支：`codex/tag-effect-preview`  
> 字段 ID **未改名**（以 VariableDef 为准）。

## 已接线

### 1. 理智（`core:sanity`）— 2026-10-13 drain（权威 DESIGN-sanity-drain）
- 纯函数 **`sanityLoss`**（`sanityGain` 为别名）/ `sanityRestDelta`（`src/engine/numerics.ts`）
- 公式：`loss = round(base × (1 + arousal/200 + submission/150 + tf/250 + stress/400) × statusMod)`；stress≥80 且非 light 额外 +1
- initial **100**；战败 base=6：`sanity = max(0, sanity − loss)`
- 休息 / waitday：≥30 **+8**；≥360 **+15**；药水 +15/+25；安全区 heal 安抚 **+10**
- 被动：hostile（canal）**−1/90min**（`SANITY_PASSIVE_DRAIN_ENABLED`）；安全区不漏
- **≤0**：置 `core:flag.sanity_break`，并优先启动 `district:event.sanity_break`
- 旧积蓄存档：缺 `core:flag.sanity_remaining` 时读档一次性 `100 − old`

### 2. stamina
- `location.move`：按 Route `distanceTier`（邻接 −2 / 远·跨 −5）+ `durationMinutes` 推进时钟
- 居民协助劳动：−8 stamina（可选 −2 energy），不再主扣 energy−5
- 战斗：attack−3 / guard−1 / recover−4 / flee−4；**攻击不再耗 energy**
- selectors：`staminaGate` 低体力限制（远路/劳动/攻击等）
- district 短休息：+12 stamina（energy 对齐 +12）；waitday：+50 stamina

### 3. 八维 / AP / skillResource
- 命中 / 伤害 / 暴击纯函数；战斗读写玩家八维与敌方运行时快照
- 开打拷贝 `EnemyDef.combat` → `district.combat.enemy`
- 现行四移映射：attack=标准击(AP2) / guard / recover(+8HP+8SR) / flee
- 回合末 skillResource +5；出战斗每 30min +10
- 多卡同回 AP 组合：**未做**（仍每回合一动；AP 上限已读 `core:actionPoints`）

### 4. 倾向文风
- `writingContext.tone`：三档 band + scene arousal/restraint
- `scene.act exit`：先 `aftertasteOnExit` 再清 scene
- 时钟推进：aftertaste 每 60min −5
- **未**把倾向写入 conditions DSL

### 5. 敌模板
- gel S35 / scavenger S40 / collector M60 + `tier`/`combat` 字段
- Boss：`BOSS_TEMPLATE` + `phases[]` 类型与 schema 已就绪；**尚无内容遭遇**

### transformProgress
- 非 root 部位为相关槽；带 `provenance` 为已填；perception 暂等同 progress

## 2026-10-13 已补（对照 DESIGN-numeric-gaps）

1. **Route**：`distanceTier` / `durationMinutes`；`location.move` 统一 clock+stamina；远/跨 −5 与 `allowFarMove`；同批 `clock.advance` 跳过以免双计（world/social/reshaping 指纹保留）
2. **装备 U1**：`slot`/`bonuses`；战斗 `eff=base+bonus`；`equipBonusesConfig.enabled`；cosmetic=0
3. **安全区治疗 U2**：district heal `core:health` **+40**
4. **U3**：不动 world rest/labor；district 短休 +12 / waitday +50 / help −8 已就绪
5. **U4**：多卡同回仍缓做（四移映射）
6. **U5**：cross 与 far 同耗 5

## 未做 / 后续

1. 多卡同回（轻击/重击/技能击手牌经济）——现一动一回合过渡（U4 缓做）
2. Boss 内容包（独立遭遇 + 专属败北事件）
3. 场景内 arousal/restraint 写入拍点（现仅结构与 exit 余韵）
4. world 包 `aetheria:action.rest` 未加 stamina（U3：仅 district）

## 关键文件

- `src/engine/numerics.ts`（新）
- `src/engine/district-effects.ts` / `effects.ts` / `selectors.ts` / `resource-check.ts` / `district.ts` / `writing-context.ts` / `transform-perception.ts`
- `src/core/district-types.ts` / `src/content/district-schema.ts` / `src/persistence/district-validation.ts`
- `content/district/pack.json` / `scripts/create-district-b.mjs`
- `tests/numerics.test.ts`（新）
- `docs/NOTES-vars-engine.md`（摘要更新）
