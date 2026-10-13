# VALIDATION · 共存规则交付（试跑 1.1.0）

| 项 | 值 |
|---|---|
| 时间 | 2026-10-12 18:17 SGT |
| 包 | content/reference 1.1.0 + generation-rules 1.0.0 |
| 总状态 | draft；静态形状通过；引擎合载因 Node 版本未执行 |

## 1. 已执行（静态）

| 检查 | 结果 |
|---|---|
| 三份 JSON 可解析 | 通过 |
| generation-rules：五服务、workStart<workEnd<leisureEnd、范围整数 | 通过 |
| content-pack namespace=tagcoexist；version 1.1.0；status=draft | 通过 |
| 新 Tag 2；derived 2；proseMaterials 3 tier=general；selections 9 | 通过 |
| when 中 **无** theme.gel/mechanical/night/transformation 作为材料/时钟替代 | 通过 |
| gel when 使用 materialId=foundation:material.gel | 通过 |
| night when 使用 time.window 1320–360（与 foundation:derive.night 一致） | 通过 |
| Reference 模板 ID 唯一；clinic-night ↔ day-shift 互斥成对 | 通过 |
| theme.* 仅出现在 boosts，不在 requiresTags | 通过 |
| 未写 suggestive / lexiconClassMutexMatrix / 全库检测器字段 | 通过 |
| 未把 NSFW batch 导入 proseMaterials | 通过 |

## 2. 未执行

| 检查 | 状态 |
|---|---|
| `loadPacks` / `parseReference` / `parseRules` 实跑 | **未执行**：box Node v20.19.2 < engines `>=24` |
| `npm run check:foundation` 覆盖本包 | 不会自动扫描 docs/tag-hub |
| WorldGenerator 种子 7/42 + 本 generation-rules | 未执行 |
| 足/腿 gel 材料实机查询 | 未执行（期望见 RULE-MATRIX） |
| 把 playtest prose 的 approved 当作词库审定 | **禁止**；仅 loader 可选中 |

## 3. 预期（集成者 Node≥24）

1. startMinutes=1320 → `lab-night-by-clock` 通过。  
2. foot materialId=gel → gel-foot 文；theme.gel  alone → 不通过。  
3. clinic-night 与 day-shift 不能同时入选。  
4. boost theme.gel 不绕过缺 clinic 服务。  
5. 机械尾选择在有机/gel 尾上失败。

## 4. 运行环境阻点

| 项 | 值 |
|---|---|
| 工程 engines.node | >=24 |
| 本 box | v20.19.2 |
| 影响 | 无法在此实跑 loadPacks / check:foundation |
