# 制作卡：NSFW 定词材质×部位×动作 自动组合（proposed-nodes）

> 编辑文档，**不是**可导入 JSON / 长耦合散文。对照 SPEC v1.1 §3 T/L/E/F/P、§8–§9、§11；模式 **proposed-nodes**。  
> 口径：**收录 ≠ 审定 ≠ 已实装**。不改词库审定；不改 `pack.json`；不 commit；不做 NPC24；**禁止物种 TF 专条**（如「蛞蝓黏液化」专条故事）——定词挂前材质 + 通用 `黏液化`。

---

## 1. 元信息

| 项 | 值 |
|---|---|
| 基线 tip | `codex/tag-effect-preview@d93b81d`（含地点层环境选敌） |
| 规范 | `production/TAG-STORY-WRITING-SPEC.md` v1.1 |
| 定词挂前 | `/workspace/定词挂前-材质规则-v0.2.md`（定词+黏液/黑胶；通用 TF；禁 synonyms 互充） |
| 环境选敌 | `docs/environment-enemy-selection.md`（`environmentEnemyRules.defeatTags`） |
| adult 门 | `production/text-slot-integration/01-当前接口.md`（偏好 `adultOptional` + 成年资格；现有 quiet 槽） |
| 状态 | **draft** |
| 模式 | **proposed-nodes**（组合公式卡；非 gel 闭环散文） |
| 不做 | 不改审定；不伪造 `foundation:*`；不写物种专条；不写 NPC24；不谎称已过游戏测试 |

**成人内容门（全文适用）**：任何 adult 片段须同时满足（现有 text-variants 逻辑）——① 玩家 `created` 且年龄≥18；② `profile.adultOptional` 开启；③ 非玩家参与者通过成年资格检查。关闭/不合格 → 仅显示中性 fallback，不得用偏好或战败结果替代同意（SPEC §8）。

---

## 2. 组合公式（一句话 + 公式）

**定词挂前材质 × 目标部位/locus × 动作原子 →（可选）战败情境阶段 →（可选）转化/精神恶堕阶段。**

```
ComboKey = Material(定词+材质 L) × Part|Locus(L) × Action(L)
         → [DefeatStage F|P] → [TF通用 L|P | MentalChain L|P]
```

说明：

- 差异靠 **原子替换**；颜色/光泽用 **mod 变体槽**，不另开节点。
- 转化只用通用 `黏液化` / `黑胶化`（L 素材）；**不写**「蛞蝓黏液化」「史莱姆黏液化」等物种专条。
- 定词（触手/蛞蝓/虫巢/史莱姆…）挂在 **材质** 前，≠ creature 本身。
- 黑胶 ⊄ 蛞蝓黏液 ⊄ 凝胶（可并存，勿 synonyms 互充）。

---

## 3. 原子池（抽样可组合，附真实 ID + 标记类型）

> **L = 素材**（收录≠运行状态）；**T = 运行 TagDef**；**F = 战败/故事情境**；**P = 提案**（缺则待封装，勿伪造 foundation ID）。

| # | 类 | 中文 | 真实 ID | T/L/E/F/P | 来源路径 | 状态备注 |
|---|---|---|---|---|---|---|
| M1 | material | 黏液（蛞蝓定词主定义） | `lx.nsfw-material.b0002.0001` | L | `nsfw-batches/nsfw-material.b0002.json` | tags 含「蛞蝓定词」；≠ creature |
| M2 | material | 触手黏液 | `lx.nsfw-material.b0005.0004` | L | `nsfw-material.b0005.json` | 定词挂前；≠ 黑胶 |
| M3 | material | 虫巢黏液 | `lx.nsfw-material.b0005.0003` | L | 同上 | 定词挂前 |
| M4 | material | 史莱姆黏液 | `lx.nsfw-material.b0008.0002` | L | `nsfw-material.b0008.json` | 定词挂前 |
| M5 | material | 活体黑胶 | `lx.nsfw-material.b0001.0001` | L | `nsfw-material.b0001.json` | 与 gel 题材可并存 |
| M6 | material | 凝胶膜 | `lx.nsfw-material.b0001.0006` | L | 同上 | 可兼容 gel profile 描写变体 |
| M7 | fluid | 黏液（蛞蝓液态分账） | `lx.nsfw-fluid.b0002.0001` | L | `nsfw-fluid.b0002.json` | material∥fluid 分账；用法提示 |
| T1 | theme | 黑胶题材 | `foundation:theme.gel` | T | `tag-dictionary.json` | active；≠ 身体已黑胶化 |
| P1 | material(运行) | （提案）材料.gel | — | **P** | 词典查无 `foundation:material.gel` | **勿伪造**；描写用 L+M6 或主题 T1 |
| A1 | action | 缠绕 | `lx.nsfw-action.b0002.0001` | L | `nsfw-action.b0002.json` | ≠ 已被缠绕状态 |
| A2 | action | 涂覆 | `lx.nsfw-action.b0002.0002` | L | 同上 | |
| A3 | action | 滴落包覆 | `lx.nsfw-action.b0002.0003` | L | 同上 | |
| A4 | action | 封口包覆 | `lx.nsfw-action.b0002.0004` | L | 同上 | adult 门必开 |
| A5 | action | 丝状滴落 | `lx.nsfw-action.b0002.0005` | L | 同上 | |
| A6 | action | 倒挂 | `lx.nsfw-action.b0002.0006` | L | 同上 | |
| A7 | action | 指令触发 | `lx.nsfw-action.b0003.0001` | L | `nsfw-action.b0003.json` | 精神链入口；≠ 催眠态已成立 |
| Pt1 | part | 嘴唇 | `lx.nsfw-part.b0001.0001` | L | `nsfw-part.b0001.json` | |
| Pt2 | part | 脖颈 | `lx.nsfw-part.b0001.0007` | L | 同上 | |
| Pt3 | part | 锁骨窝 | `lx.nsfw-part.b0001.0008` | L | 同上 | |
| Pt4 | part | 腰侧 | `lx.nsfw-part.b0001.0016` | L | 同上 | |
| Pt5 | part | 手腕 | `lx.nsfw-part.b0001.0028` | L | 同上 | |
| Pt6 | part | 大腿内侧 | `lx.nsfw-part.b0001.0021` | L | 同上 | 小腿无独立 part → 用脚踝/大腿或 P |
| Pt7 | part | 脚踝 | `lx.nsfw-part.b0001.0023` | L | 同上 | 腿部下段近似 |
| Lc1 | locus | 胯下 | `lx.nsfw-locus.b0001.0001` | L | `nsfw-locus.b0001.json` | |
| Lc2 | locus | 身后 | `lx.nsfw-locus.b0001.0005` | L | 同上 | |
| S1 | state | 被黏液束缚 | `lx.nsfw-state.b0002.0001` | L | `nsfw-state.b0002.json` | 素材态；≠ 已写入 story.tags |
| S2 | state | 整身被涂覆 | `lx.nsfw-state.b0002.0002` | L | 同上 | |
| S3 | state | 倒挂固定 | `lx.nsfw-state.b0002.0003` | L | 同上 | |
| S4 | state | 性器外露 | `lx.nsfw-state.b0002.0007` | L | 同上 | adult 门 |
| S5 | state | 催眠中 | `lx.nsfw-state.b0003.0001` | L | `nsfw-state.b0003.json` | 精神链；无运行 tag → P |
| S6 | state | 恍惚服从 | `lx.nsfw-state.b0003.0002` | L | 同上 | |
| Tf1 | tf | 黏液化 | `lx.nsfw-tf.b0002.0001` | L | `nsfw-tf.b0002.json` | **通用**；禁物种专条 |
| Po1 | pose | 倒挂拱身 | `lx.nsfw-pose.b0002.0002` | L | `nsfw-pose.b0002.json` | |
| F1 | defeat | 外衣黏附 | `progression:tag.coat.stuck` | F | adventure pack | gel 等 defeatTags 可写 |
| F2 | defeat | 清空/伤势/限制 | `…clear` / `…injured` / `…hands.restricted` | F | 同上 | |
| F3 | defeat | 已检查/求助 | `…assessed` / `…signal` | F | 选项写入 | |
| K1 | kink | 精神操控/洗脑偏好 | `lx.nsfw-kink.b0003.0004` / `…0005` | L | `nsfw-kink.b0003.json` | 偏好素材≠自动触发非自愿 |

---

## 4. 阶段模板（可复用节点骨架，非散文）

每阶段字段：进入条件｜允许事实｜禁止提前事实｜差异片段槽位｜挂接 existing ID｜T/L/E/F/P。

### 阶段 A — 遭遇/战时动作反馈

| 字段 | 内容 |
|---|---|
| 用途 | 材质×部位×动作的即时反馈；可挂战斗外遭遇叙述 |
| 进入条件 | 遭遇成立 **或** 战斗回合已结算（本卡战斗内标 **未模拟**）；ComboKey 已选定 |
| 允许事实 | 可见材质接触目标部位/locus；动作发生（缠绕/涂覆/…）；未写入战败 tag |
| 禁止提前事实 | coat.stuck / hands.restricted / assessed / 黏液化完成 / 催眠态 / 性器外露（除非本回合结算已证） |
| 差异片段槽 | `{材质}` `{部位\|locus}` `{动作}` `{mod色泽}` |
| 挂接 | 战斗外：`kind=encounter` 节点（proposed）；战斗内：SPEC 三列「未模拟」 |
| 依据 | T1（若 gel 环境）；L=M\*+Pt\*/Lc\*+A\*；F=本场在场；P=无通用 encounter NSFW 节点 |

### 阶段 B — 战败 assess（扩差异槽，守现有契约）

| 字段 | 内容 |
|---|---|
| 用途 | 挂现有 defeat assess；只扩 **差异片段**，不改选择契约 |
| 进入条件 | `kind=defeat` + stage `assess`；player 有匹配 `defeatTags`（如 F1 coat.stuck）；抓握等条件按节点 |
| 允许事实 | 外衣/肢体被材质牵住或限制；已进入战败叙事；可检查处境 |
| 禁止提前事实 | 松开已成功（unset 前）；求助已发出（无 signal 前）；TF 完成；精神服从 |
| 差异片段槽 | `{材质}` 替换「低处黏附物」描写；`{部位}` 替换接触点；`{动作痕迹}` |
| 挂接 **existing** | `progression:node.defeat.coat` / `…hands` / `…assess`；profile 如 `progression:profile.gel`；env 规则 `defeatTags`（d93b81d） |
| 依据 | F1–F3；T1；L=M6/M5 等作描写；**不**把 L 写成已写入的 progression tag |

### 阶段 C — 战后涂覆/束缚推进（proposed）

| 字段 | 内容 |
|---|---|
| 用途 | assess 后可选推进：涂覆进度 / 束缚加深；需新情境则 **待封装** |
| 进入条件 | 战败 assess 已走过；adult 门通过（若内容 adult）；偏好允许黏液/束缚类 |
| 允许事实 | 材质沿部位扩散；束缚感增强；对应 L-state 作描写目标 |
| 禁止提前事实 | 整身涂覆完成（未进度）；黏液化；指令服从；呼救已被封死（除非选了封口线） |
| 差异片段槽 | `{材质}` `{部位序列}` `{动作:涂覆\|缠绕\|滴落}` `{进度:局部→大片}` |
| 挂接 | **无**现成通用 NSFW defeat 节点 → proposed `edit:node.defeat.coat.advance`（编辑编号）；setTags 新情境 → §7 |
| 依据 | L=S1/S2 + A1/A2/A3；F=仍处 defeat 实例；P=运行 tag / setTags |

### 阶段 D — 可选转化入口（通用 TF；仅战败后；adult_optional）

| 字段 | 内容 |
|---|---|
| 用途 | 通用 `黏液化` 入口；**禁止**「蛞蝓/触手/史莱姆黏液化」专条节点 |
| 进入条件 | 战败后；adult 门；偏好含转化类（K1 相关仅作选材）；阶段 C 或明确同意选项 |
| 允许事实 | 局部材质置换**开始**；感受变化；能力影响须另有查询/任务确认 |
| 禁止提前事实 | 全身体材料已置换；物种身份已变；能力已授予 |
| 差异片段槽 | `{定词材质}` 仅改触感/气味描写；TF 名固定「黏液化」；`{部位}` |
| 挂接 | NarrativeKind 含 `transformation`（类型已有）；**无**现成战败→黏液 TF 节点 → proposed；诊所 gel TF 非本卡 |
| 依据 | L=Tf1 + M\*；F=战败后；P=progression TF 情境 tag |

### 阶段 E — 可选精神链（指令触发→催眠态）

| 字段 | 内容 |
|---|---|
| 用途 | A7 指令触发 → S5/S6 描写；缺运行 tag → P + 待封装 |
| 进入条件 | 战败后或同意场景；adult 门；精神类偏好开启；**不得**仅凭偏好自动非自愿 |
| 允许事实 | 指令被发出；短暂恍惚；可拒绝/中断的选项仍在 |
| 禁止提前事实 | 永久洗脑；无退出的服从锁；未触发指令却已「催眠中」 |
| 差异片段槽 | `{指令内容短句}` `{材质声线/触感}` `{服从程度:恍惚→可拒}` |
| 挂接 | 无运行 `progression:tag.hypnosis.*` → **P**；textSlot 通用战败 adult → 待封装 |
| 依据 | L=A7+S5/S6+K1；P=运行 tag + 槽 |

---

## 5. 组合样例矩阵（6 个；只填表不写长文）

| # | 组合键 | 进入条件 | 允许 | 禁止提前 | 片段槽 | 挂接 defeat / textSlot | 缺口 |
|---|---|---|---|---|---|---|---|
| C1 | 触手黏液×腕/腰×缠绕 → 束缚 | 战败或遭遇；M2+Pt5/Pt4+A1 | 缠绕感、局部束缚描写 | 整身涂覆完成；TF；催眠 | `{M2}` `{腕\|腰}` `{缠绕}` | B→`defeat.coat`/`hands`（若写入对应 F）；adult 通用槽 **无** | 运行态「被黏液束缚」tag；hands 需 defeatTags 写入 |
| C2 | 蛞蝓定词黏液×腿下段×涂覆 → 涂覆进度 | 战败后 C；M1+Pt7/Pt6+A2 | 小片→大片涂覆进度；S2 作目标描写 | 黏液化完成；物种 TF 专条 | `{M1蛞蝓定词}` `{脚踝\|大腿}` `{涂覆}` `{进度}` | 无 existing 推进节点 | 小腿无独立 part（用 Pt7 或 P）；涂覆进度 flag |
| C3 | 凝胶膜×外衣下摆×滴落包覆 → gel 兼容 | gel 战败；coat.stuck；M6+A3 | 下摆被膜状滴落黏住；与 gel profile 一致 | 身体已 gel 材料化；material.gel（查无） | `{凝胶膜}` `{下摆}` `{滴落包覆}` | **existing** `profile.gel` + `node.defeat.coat`；env `defeatTags` coat.stuck | 外衣下摆非 part ID→F/场景事实；P1 勿伪造 |
| C4 | 活体黑胶×口周×封口包覆 → 呼救受阻 | 战败 assess+；adult 门；M5+Pt1+A4 | 口周被封；发声求助困难（叙事） | 未封口却已「叫不出声」结算；无退出 | `{活体黑胶}` `{嘴唇/口周}` `{封口包覆}` | signal/help 契约仍在；adult 片段待封装槽 | 封口是否硬改 help 条件→待封装；勿用 quiet 槽冒充 |
| C5 | 虫巢黏液×身后 locus×丝状滴落 | 遭遇/战后；M3+Lc2+A5 | 身后丝状滴落触感 | 插入/腔内事实未成立时写入 | `{虫巢黏液}` `{身后}` `{丝状滴落}` | proposed encounter/defeat 片段 | 无通用 adult 战败槽 |
| C6 | 史莱姆黏液×倒挂动作+拱身 pose → 倒挂固定 | 战后；M4+A6+Po1→S3 | 倒挂固定姿态；可挣 | TF；永久固定 | `{史莱姆黏液}` `{倒挂}` `{倒挂拱身}` | proposed；hands/coat 不自动覆盖 | 倒挂运行 tag；姿态查询 |

**样例组合数：6。**

---

## 6. 挂接现有接口

| 接口 | 现状 | 本卡用法 |
|---|---|---|
| adventure `kind=defeat` | `progression:node.defeat.*` 已有；`NarrativeKind` 含 defeat / transformation | B 阶段只扩片段；C–E 为 proposed |
| `NarrativeProfile.defeatTags` | 如 `profile.gel`：clear / injured / coat.stuck | 组合差异优先靠 **描写槽**；新情境 tag 进待封装 |
| `environmentEnemyRules.defeatTags` | tip d93b81d；可覆盖 profile | 地点层选敌后写入；本卡不改规则 JSON |
| textSlot `adult_optional` | **仅** `district:textslot.riker.quiet` / `nara.quiet` | NPC 私密事件槽；**不能**冒充通用战败 NSFW 槽已实装 |
| `district:textslot.velvet.quiet` | `mature_fade`（非 adult_optional） | 不走 adult 替换门槛 |
| 战败通用 adult 槽 | **无** | → 待封装；提案 slotId 用编辑编号，如 `edit:textslot.defeat.nsfw.coat`（不占正式 NS） |

---

## 7. 待封装清单

| # | 缺什么 | 目标 | 前后变化 |
|---|---|---|---|
| U1 | 战败通用 `adult_optional` TextSlot（非 NPC quiet） | 挂 assess/推进节点的可选成人正文 | 前：仅 riker/nara quiet；后：defeat 节点可换正文+中性 fallback |
| U2 | 运行情境 tag：黏液束缚 / 涂覆进度 / 倒挂固定 / 封口 | 供 `requiresTags`/`setTags` | 前：仅 L-state；后：story.tags 可驱动节点（勿造 foundation:\* 假已有） |
| U3 | `foundation:material.gel`（若玩法需要材料查询） | 与 theme.gel 分账 | 前：词典**查无**；后：审定后再装；此前用 L 描写+T1 |
| U4 | 战败→通用黏液化 `transformation` 节点链 | kind=transformation；仅战败后+成人门 | 前：类型枚举有、内容无；后：可选 D 阶段 |
| U5 | 精神链运行 tag + 可拒绝出口 | 指令触发≠自动非自愿 | 前：仅 L action/state；后：条件+选择契约 |
| U6 | 组合器（编辑或运行）：Material×Part×Action → 片段填槽 | 自动组合差异句 | 前：人工填表；后：按 ComboKey 抽槽 |
| U7 | 小腿等缺失 part（可选） | 补 part 素材或映射脚踝 | 前：无「小腿」ID；后：有或文档映射 |
| U8 | 封口是否硬约束 `signal`/发声求助 | 规则作者定 | 前：help 不看封口；后：条件或纯叙事二选一 |

**待封装条数：8。**

---

## 8. 自检

| 项 | 结果 |
|---|---|
| 来源 | tip d93b81d；SPEC v1.1；定词挂前 v0.2；nsfw-batches 真实 ID；adventure defeat；text-slot 01；environment-enemy-selection |
| 叙事自检 | 无长篇故事正文；仅公式/表/阶段骨架 |
| 未改审定 / pack.json / commit | 是 |
| 无物种 TF 专条 | 是（仅通用黏液化 + 定词材质） |
| 无 NPC24 | 是 |
| material.gel | 查无 → P1，未伪造 |
| quiet 槽未冒充通用战败 NSFW | 已写明 |
| adult = 偏好 + 成年资格门 | 已写明 |
| 未谎称已过游戏测试 | 是 |
| 收录≠审定≠已实装 | 是 |

---

## 来源清单（短）

- `production/TAG-STORY-WRITING-SPEC.md` v1.1  
- `/workspace/定词挂前-材质规则-v0.2.md`  
- `docs/environment-enemy-selection.md`  
- `production/text-slot-integration/01-当前接口.md`  
- `docs/tag-hub/nsfw-batches/nsfw-{material,action,part,locus,state,tf,pose,fluid,kink}.b*.json`（表内 ID）  
- `content/adventure/pack.json`（defeat 节点 / profile.gel / tags）  
- `docs/tag-hub/outbox/2026-10-13-制作卡-gel战败可玩闭环.md`（章节意识参考）  
