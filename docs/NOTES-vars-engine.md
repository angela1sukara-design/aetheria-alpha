# 数值属性实装说明（vars / engine）

> 日期：2026-10-12 · 仓库：aetheria-alpha  
> 状态：VariableDef 已入库；深设计公式已接线（见 DESIGN-deep-numerics + NOTES-deep-numerics-impl-2026-10-12）。

## 1. 拍板摘要

| 决策 | 实装 |
|------|------|
| 统一玩家 HP | 事件与战斗均读写 `core:health`（标签「生命」，0–100，归零战败） |
| 日常赶路/挣扎 | 新开 `core:stamina`（标签「体力」）；**不**与战斗 HP 混用 |
| 废弃分轨 | `district:health` 已从 VariableDef 与内容效果中移除；读档时按 0–40→0–100 比例迁入 `core:health` |
| 精力 | `core:energy` 保留不变 |
| 理智 | `core:sanity`（不用 sinking）；满值打 `core:flag.sanity_break`（Bad End 入口 stub） |
| 技能资源 | 代码 ID 固定 `core:skillResource`，显示名暂「技能资源」 |
| 倾向值 | `core:` 前缀；不覆盖 NPC `relationship.trust` |
| transformPerception | **不**存标量；见 `src/engine/transform-perception.ts` TODO |
| 数值位置 | GameState `player.variables` / 场景临时挂 `district.scene`；不进 Tag |

## 2. 字段表

### A 硬核心（HUD 展示）

| ID | label | initial | min–max | 备注 |
|----|-------|---------|---------|------|
| `core:money` | 零钱 | 60 | 0–999999 | 已有 |
| `core:energy` | 精力 | 70 | 0–100 | 已有 |
| `core:health` | 生命 | 100 | 0–100 | **统一 HP**；原「体况」改名 |
| `core:stamina` | 体力 | 100 | 0–100 | 赶路/劳动/战斗负荷；低体力门槛已接 |
| `core:sanity` | 理智 | 0 | 0–100 | 正式公式；满值 flag + district:event.sanity_break |
| `core:skillResource` | 技能资源 | 100 | 0–100 | 战斗回合+5；喘息+8；出战斗每30min+10 |

### B 战斗八维（VariableDef 已入库，命中/伤害/暴击已接）

`core:attack` / `defense` / `speed` / `skillPower` / `crit` / `hit` / `evasion`

### C 行动点

`core:actionPoints`（initial 3，0–10）

### D 倾向值（text-only 约定，不硬锁玩法）

`core:desire` / `submissionTendency` / `stress` / `confidence` / `affection` / `trust` / `aftertaste`  
注意：`core:trust` ≠ NPC `relationship.trust`。

### E 场景临时（非 VariableDef）

挂在 `DistrictState.scene`：

- `arousal` / `restraint`：进场 0；exit 前写入 `core:aftertaste`，再随 scene 清零  
- 余韵自然衰减：时钟每 60min −5

### Flag

- `core:flag.sanity_break`：理智满值时置 true（Bad End 事件入口待接）

## 3. 迁移说明

### 内容包

- `content/core/pack.json`：扩表上述 VariableDef + sanity_break flag；`core:health` label →「生命」
- `content/district/pack.json`：删除 `district:health`；所有 `var.change` 改为 `core:health`；安全区治疗 `+40`→`+100`（拉满）
- `scripts/create-district-b.mjs`：同步，避免日后重生写回旧 ID

### 引擎

- `src/engine/district-effects.ts`：战斗读写 `core:health`；战败调用理智增量；场景写入 `arousal`/`restraint`
- `src/persistence/vars-migration.ts`：`normalizePlayerVariables` / Flags / SceneTemps；识别历史 `engine/core` hash
- `src/persistence/codec.ts`：官方存档升级路径允许 core 扩表换 hash，并补齐变量
- `src/ui/render.ts`：HUD 仅显示 A 硬核心，避免八维/倾向刷屏
- `src/world/generator.ts`：诊所文案「体况」→「生命」（仍写 `core:health`）

### 存档兼容

- **新开档 / 本分支内重存**：正常
- **含旧 `district:health` 的存档**：读档时缩放迁入 `core:health` 并删除旧键（需能通过包指纹升级路径）
- **仅 engine/core 因变量扩表而 hash 变化**：`isCoreExpandUpgradeTarget` 允许从 STAGE3 / STAGE3_FIX1 历史指纹升级
- **已改过其他包内容的存档**：仍按原 PACK_MISMATCH 隔离，不静默吞

## 4. 未完成 / 需用户拍板

详见 `NOTES-deep-numerics-impl-2026-10-12.md`。摘要：

1. 多卡同回 AP 手牌经济（现一动一回合）
2. 远路 route 标签（−5）
3. Boss 内容遭遇
4. 场景 arousal/restraint 拍点写入
5. **skillResource 显示名** / HUD 可配置
6. **治疗量**：安全区 `+100` 是否改 `+40`

## 5. 原则备忘

数值在 GameState/variables（或 scene 临时），**不进 Tag**；词条 ≠ 玩法 ≠ 数值字段。

## 6. 变更文件清单

- `content/core/pack.json` — VariableDef / flag 扩表
- `content/district/pack.json` — 移除 `district:health`，效果改写 `core:health`
- `scripts/create-district-b.mjs` — 与上同步
- `src/engine/district-effects.ts` — 统一 HP + 战败理智挂钩
- `src/engine/transform-perception.ts` — TF 派生 stub
- `src/core/district-types.ts` — scene.arousal / restraint
- `src/persistence/vars-migration.ts` — 新建
- `src/persistence/codec.ts` / `foundation-migration.ts` / `district-validation.ts` / `stage3-packs.ts`
- `src/content/schema.ts` / `foundation-schema.ts` — ID 允许 camelCase（`skillResource` 等）
- `src/ui/render.ts` — HUD 过滤
- `src/world/generator.ts` — 文案
- `tests/district-b.test.ts` / `npc.test.ts` / `body-tf.test.ts` / `alpha02-browser.mjs`
- `tests/fixtures/stage3-*.json` — core hash + 变量扩表
- `docs/NOTES-vars-engine.md` — 本说明

## 7. Schema 备注

定稿字段使用 camelCase 局部 ID（如 `core:skillResource`）。原先 `namespace:id` 正则只允许小写；已放宽局部段为 `[a-z][a-zA-Z0-9_.-]*`。
