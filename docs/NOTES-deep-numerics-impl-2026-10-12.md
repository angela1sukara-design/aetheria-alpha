# 数值深设计实装笔记 — 2026-10-12

> 对照：`docs/DESIGN-deep-numerics-2026-10-12.md`  
> 分支：`codex/tag-effect-preview`  
> 字段 ID **未改名**（以 VariableDef 为准）。

## 已接线

### 1. 理智（`core:sanity`）
- 纯函数 `sanityGain` / `sanityRestDelta`（`src/engine/numerics.ts`）
- 战败：base=6 + 乘区（arousal / submissionTendency / transformProgress），**取代**固定 +10
- 休息 / waitday（actionId 含 rest|waitday 且 clock≥30）：−8；≥360min：−15
- ≥100：置 `core:flag.sanity_break`，并优先启动 `district:event.sanity_break`（若内容包已装）

### 2. stamina
- `location.move`：邻接 −2（远路标签未接）
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

## 未做 / 需用户拍

1. 多卡同回（轻击/重击/技能击手牌经济）——现一动一回合过渡
2. route 远路标签（−5）与跨区判定
3. Boss 内容包（独立遭遇 + 专属败北事件）
4. 场景内 arousal/restraint 写入拍点（现仅结构与 exit 余韵）
5. 安全区治疗 +100 是否改为 +40（设计另议）
6. world 包 `aetheria:action.rest` 未加 stamina（避免 core/world 指纹大面积失效）；公寓休息靠 district waitday/rest

## 关键文件

- `src/engine/numerics.ts`（新）
- `src/engine/district-effects.ts` / `effects.ts` / `selectors.ts` / `resource-check.ts` / `district.ts` / `writing-context.ts` / `transform-perception.ts`
- `src/core/district-types.ts` / `src/content/district-schema.ts` / `src/persistence/district-validation.ts`
- `content/district/pack.json` / `scripts/create-district-b.mjs`
- `tests/numerics.test.ts`（新）
- `docs/NOTES-vars-engine.md`（摘要更新）
