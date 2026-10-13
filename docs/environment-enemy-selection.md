# 地点层：环境 → 选敌

日期：2026-10-13。分支：`codex/tag-effect-preview`。  
层级约定：世界 → 大型区域 → **小地点** → NPC → 行为；**选敌挂在地点层**。

## 边界

| 层 | 本功能做什么 | 不做什么 |
|---|---|---|
| 词条（TagDef） | 只提供稳定 ID / 中文名；可被 `requiresTags` 引用 | 不改词库审定状态；Tag 本身不含数值或战败结果 |
| 玩法（规则） | `environmentEnemyRules`：环境 tag 组合 → 候选 `EnemyDef` | 不把正文或词条当结算 |
| 数值（战斗） | 规则可覆盖 `hp` / `reward` / `combat.*`，开打时写入 `CombatState` | 不改写 `EnemyDef` 权威模板字节 |

成人向内容可走既有战败故事；不涉及未成年人。

## 环境 tag 从哪里来

`locationEnvironmentTags(state, registry)` 合并（去重、且须已注册 Tag）：

1. `locationProfiles.service` → `foundation:service.*`
2. `locationProfiles.tags`（地点层挂接的环境语义；在 adventure 内容生成里为 canal / station / workshop / market 等填写）
3. 生成世界 `WorldDef.locations[].tags` 与所属 `regions[].environmentTags`
4. 世界派生语义（如夜间等）

词条≠地点已具备该语义：没有 profile / 世界标签时，不会凭空匹配。

## 如何挂环境条件

在 `adventure.v1` 包中声明 `environmentEnemyRules`（生成源：`scripts/build-adventure-content.mjs`）：

```json
{
  "id": "progression:env-enemy.gel.canal",
  "enemyId": "district:enemy.gel",
  "requiresTags": [
    "foundation:service.commons",
    "foundation:context.waterways",
    "foundation:theme.gel"
  ],
  "excludesTags": [],
  "weight": 20,
  "priority": 0,
  "name": "渠底黑胶群落（湿滑）",
  "hp": 38,
  "combat": { "defense": 6, "speed": 7, "attack": 8 },
  "defeatTags": [
    { "role": "player", "tagId": "progression:tag.clear" },
    { "role": "player", "tagId": "progression:tag.injured" },
    { "role": "player", "tagId": "progression:tag.coat.stuck" }
  ]
}
```

字段说明：

- `requiresTags`：当前地点环境 tag **全部**具备才进入候选
- `excludesTags`：任一命中则排除
- `priority`：先取最高优先级，再在同级按 `weight` 加权抽取
- `hp` / `reward` / `combat` / `name`：开打时覆盖运行时；不修改内容包里的 `EnemyDef`
- `defeatTags`：若填写，战败写入 `lastCombat.tags`（可进不同战败节点）；若省略，仍用对应 `NarrativeProfile.defeatTags`

若地点已有其他包的 `locationProfiles`（例如 foundation 工坊），在**该 profile 源包**上补 `tags`，adventure 不会覆盖已有 profile。

地点 profile 挂 tag 示例（adventure 生成源，仅新建 profile）：

```js
{ id: 'progression:location-profile.canal', locationId: 'district:location.canal',
  service: 'commons', light: 'lit',
  tags: ['foundation:context.waterways', 'foundation:theme.gel', 'foundation:theme.risk'] }
```

## 开战入口

| 效果 | 行为 |
|---|---|
| `combat.encounter` | 按当前地点匹配规则并抽一条，再开战；无候选则失败 |
| `combat.start` + 固定 `id` | 仍开指定敌人；若存在匹配该 `enemyId` 的环境规则，则注入覆盖 |

内置行动：`progression:action.encounter.env`（调查危险环境）。无匹配规则的地点不会露出该行动。

现成最小集合：`district:enemy.gel` / `scavenger` / `collector`，分别挂在渠步道、工坊、检查站/市集等环境组合上。工坊 scavenger 规则额外写入 `hands.restricted`，可与 gel 的 `coat.stuck` 分流到不同战败节点。

## 代码路径

| 路径 | 职责 |
|---|---|
| `src/core/adventure-types.ts` | `EnvironmentEnemyRule` |
| `src/engine/environment-enemies.ts` | 收集环境 tag、匹配、抽取、覆盖 |
| `src/engine/district-effects.ts` | `combat.start` / `combat.encounter` 接线；战败 tag / 报酬 |
| `scripts/build-adventure-content.mjs` | 地点 tags + 规则 + 行动 |
| `docs/environment-enemy-selection.md` | 本文 |

## 验证

`npm run typecheck`；`node --test tests/environment-enemies.test.ts`；必要时 `npm run test` / adventure 相关测试。
