# NSFW combo P0：成人遭遇回填（标注版）

任务名称：nsfwcombo existing-prose 回填 · P0 成人六条  
模式：existing-prose  
工程基线：`codex/tag-effect-preview@f9f2ecd`；已读 `production/TAG-STORY-WRITING-SPEC.md` v1.1、`docs/tag-hub/outbox/2026-10-13-故事试写-proposed-nodes-NSFW自动组合制作卡.md`、`docs/nsfw-auto-combo.md`、`/tmp/nsfwcombo-backfill-focus.json`、`docs/tag-hub/outbox/2026-10-13-NSFW-auto-combo-可填槽清单.md`  
本次范围：C8→C9→C4→C10→C11→C12 标注扩写；**.detail / choice 结果短句本批不动**；**不改**节点条件/效果/next/choices；禁止物种 TF 专条、禁止 NPC24；外衣黏附≠身体已黑胶化；素材态≠已写入 story.tags。  
读取日期：2026-10-13（SGT）

## 共用依据表

| 标记 | 名称与真实 ID/事实 | 来源路径及条目/节点 | 作用对象 | 审核/安装/核验状态 |
|---|---|---|---|---|
| T1 | 黑胶题材：`foundation:theme.gel` | tag-dictionary.json | 题材选材（C3/C12 可轻挂） | active；≠身体已黑胶化 |
| L1 | 触手黏液：`lx.nsfw-material.b0005.0004` | nsfw-batches/nsfw-material.b0005.json | 材质 | L 素材；收录≠运行态 |
| L2 | 蛞蝓黏液：`lx.nsfw-material.b0002.0001` | nsfw-material.b0002.json | 材质（定词挂前） | L；≠ creature |
| L3 | 虫巢黏液：`lx.nsfw-material.b0005.0003` | nsfw-material.b0005.json | 材质 | L |
| L4 | 史莱姆黏液：`lx.nsfw-material.b0008.0002` | nsfw-material.b0008.json | 材质 | L |
| L5 | 活体黑胶：`lx.nsfw-material.b0001.0001` | nsfw-material.b0001.json | 材质 | L；可与 T1 并存 |
| L6 | 凝胶膜：`lx.nsfw-material.b0001.0006` | 同上 | 材质 | L；gel 描写变体 |
| L7 | 缠绕：`lx.nsfw-action.b0002.0001` | nsfw-action.b0002.json | 动作 | L；≠已被缠绕状态 |
| L8 | 涂覆：`lx.nsfw-action.b0002.0002` | 同上 | 动作 | L |
| L9 | 滴落包覆：`lx.nsfw-action.b0002.0003` | 同上 | 动作 | L |
| L10 | 封口包覆：`lx.nsfw-action.b0002.0004` | 同上 | 动作 | L；成人门 |
| L11 | 丝状滴落：`lx.nsfw-action.b0002.0005` | 同上 | 动作 | L |
| L12 | 倒挂：`lx.nsfw-action.b0002.0006` | 同上 | 动作 | L |
| L13 | 指令触发：`lx.nsfw-action.b0003.0001` | nsfw-action.b0003.json | 动作 | L；≠催眠已成立 |
| L14 | 嘴唇：`lx.nsfw-part.b0001.0001` | nsfw-part.b0001.json | 部位 | L |
| L15 | 脖颈：`lx.nsfw-part.b0001.0007` | 同上 | 部位 | L |
| L16 | 锁骨窝：`lx.nsfw-part.b0001.0008` | 同上 | 部位 | L |
| L17 | 腰侧：`lx.nsfw-part.b0001.0016` | 同上 | 部位 | L |
| L18 | 手腕：`lx.nsfw-part.b0001.0028` | 同上 | 部位 | L |
| L19 | 大腿内侧：`lx.nsfw-part.b0001.0021` | 同上 | 部位 | L |
| L20 | 脚踝：`lx.nsfw-part.b0001.0023` | 同上 | 部位 | L |
| L21 | 胯下：`lx.nsfw-locus.b0001.0001` | nsfw-locus.b0001.json | locus | L |
| L22 | 身后：`lx.nsfw-locus.b0001.0005` | 同上 | locus | L |
| L23 | 被黏液束缚：`lx.nsfw-state.b0002.0001` | nsfw-state.b0002.json | 描写目标态 | L；**≠** story.tags |
| L24 | 整身被涂覆：`lx.nsfw-state.b0002.0002` | 同上 | 描写目标态 | L；**≠** story.tags |
| L25 | 倒挂固定：`lx.nsfw-state.b0002.0003` | 同上 | 描写目标态 | L；**≠** story.tags |
| L26 | 性器外露：`lx.nsfw-state.b0002.0007` | 同上 | 描写目标态 | L adult；**≠** story.tags |
| L27 | 催眠中：`lx.nsfw-state.b0003.0001` | nsfw-state.b0003.json | 描写目标态 | L；**≠** story.tags |
| L28 | 恍惚服从：`lx.nsfw-state.b0003.0002` | 同上 | 描写目标态 | L；**≠** story.tags |
| L29 | 黏液化（通用）：`lx.nsfw-tf.b0002.0001` | nsfw-tf.b0002.json | TF 指向 | L；禁物种专条；**≠**已完成 |
| L30 | 倒挂拱身：`lx.nsfw-pose.b0002.0002` | nsfw-pose.b0002.json | 姿态参考 | L |
| F1 | 材质接触可见；动作已发生 | focus.json stub；遭遇成立 | player 接触面 | 本次允许事实 |
| F2 | coat.stuck / 整身涂覆完成 / 黏液化完成 / 催眠态 / signal 成功脱困 **均尚未写入** | focus stub 禁止提前；SPEC §7 | player | 未结算 |
| F3 | 成人门：`profile.created` 且年龄≥18 且 `adultOptional` | 制作卡 §1；text-slot 接口 | player | 关闭→仅中性回退 |
| F4 | opponent 持有 `progression:tag.nsfwcombo.active` | focus requiresTags | opponent | 节点进入条件 |
| P1 | `foundation:material.gel` 词典查无 | SPEC / 制作卡 P1 | — | **勿伪造** |
| P2 | 催眠/恍惚运行 `progression:tag.hypnosis.*` 缺 | 制作卡 U5 | — | 仅 L 指向 |

---

## C8｜活体黑胶×胯下×涂覆→性器外露

- textKey（中性槽）：`progression:text.node.encounter.nsfwcombo.c8`
- textKey（成人槽，优先回填）：`progression:text.node.encounter.nsfwcombo.c8.adult`
- nodeId：`progression:node.encounter.nsfwcombo.c8`（成人节点另见 `…c8.adult`）
- comboKey：活体黑胶×胯下×涂覆→性器外露
- 允许：材质接触胯下可见；涂覆动作已发生【F1】【L5】【L21】【L8】
- 禁止提前：coat.stuck 已结算、整身涂覆完成、黏液化完成、催眠成立、求助成功脱困【F2】；「性器外露」仅素材指向【L26】

### 扩写正文（成人门内；标注）

温热的活体黑胶【L5】贴上你的胯下【L21】，沿布料与皮肤缝隙做缓慢涂覆【L8】【F1】。胶面带着细微搏动，把私处轮廓一点一点抹开、抹湿；衣料被推得滑开时，性器外露【L26】只是本组合的描写目标态——**素材指向，未写入 story.tags**【F2】。【成人门：adultOptional + 年龄≥18】【F3】战败外衣黏附、整身涂覆完成、黏液化与催眠态均尚未结算。你可以核对组合原子与挂接提示，或结束当前经历、回到安全位置。

### 中性回退（关闭成人时）

活体黑胶在胯下发生可见涂覆；接触与动作已成立。目标态「性器外露」仅素材指向，未写入 story.tags。可核对组合原子，或结束回到安全位置。

### 选择表（严格抄录 focus.json）

| 选项 | 适用条件 | 本次效果 | 下一节点 |
|---|---|---|---|
| 核对组合原子与挂接提示 | 无 | clock.advance 5 分钟 | nsfwcombo-detail |
| 结束当前经历，回到安全位置 | 无 | 无 | null |

resultText：`progression:text.choice.nsfwcombo.c8.detail`｜`progression:text.choice.184`（**.detail / choice 短句本批不动**）

### 可粘贴纯正文

**成人槽 `…c8.adult`：**

```
温热的活体黑胶贴上你的胯下，沿布料与皮肤缝隙做缓慢涂覆。胶面带着细微搏动，把私处轮廓一点一点抹开、抹湿；衣料被推得滑开时，性器外露只是本组合的描写目标态——素材指向，未写入 story.tags。（成人门：adultOptional + 年龄≥18）战败外衣黏附、整身涂覆完成、黏液化与催眠态均尚未结算。你可以核对组合原子与挂接提示，或结束当前经历、回到安全位置。
```

**中性槽 `…c8`：**

```
活体黑胶在胯下发生可见涂覆；接触与动作已成立。目标态「性器外露」仅素材指向，未写入 story.tags。可核对组合原子，或结束回到安全位置。
```

---

## C9｜蛞蝓黏液×大腿内侧、胯下×滴落包覆→整身被涂覆→黏液化

- textKey（中性）：`progression:text.node.encounter.nsfwcombo.c9`
- textKey（成人）：`progression:text.node.encounter.nsfwcombo.c9.adult`
- nodeId：`progression:node.encounter.nsfwcombo.c9`
- comboKey：蛞蝓黏液×大腿内侧、胯下×滴落包覆→整身被涂覆→黏液化
- 允许：蛞蝓黏液接触大腿内侧与胯下；滴落包覆已发生【L2】【L19】【L21】【L9】【F1】
- 禁止提前：整身涂覆完成已写入、黏液化已完成、物种 TF 专条、coat.stuck / 催眠【F2】【L24】【L29】

### 扩写正文（成人门内；标注）

蛞蝓黏液【L2】自你的大腿内侧【L19】滴落，包覆向胯下【L21】【L9】【F1】。液膜温热、略带韧性，沿皮肤往下淌，把内侧肌肤与胯间一并裹住；湿热与黏滞感清楚可辨。【成人门：adultOptional + 年龄≥18】【F3】整身被涂覆【L24】、黏液化【L29】皆为**素材指向的推进目标，未写入 story.tags，亦未完成**【F2】——仅用通用黏液化，禁止物种专条。你可以核对组合原子与挂接提示，或结束当前经历、回到安全位置。

### 中性回退

蛞蝓黏液在大腿内侧与胯下发生滴落包覆；接触可见。整身被涂覆、黏液化仅素材指向，未写入 story.tags。可核对组合或回安全。

### 选择表（抄录）

| 选项 | 适用条件 | 本次效果 | 下一节点 |
|---|---|---|---|
| 核对组合原子与挂接提示 | 无 | clock.advance 5 分钟 | nsfwcombo-detail |
| 结束当前经历，回到安全位置 | 无 | 无 | null |

resultText：`…c9.detail`｜`progression:text.choice.189`

### 可粘贴纯正文

**成人 `…c9.adult`：**

```
蛞蝓黏液自你的大腿内侧滴落，包覆向胯下。液膜温热、略带韧性，沿皮肤往下淌，把内侧肌肤与胯间一并裹住；湿热与黏滞感清楚可辨。（成人门：adultOptional + 年龄≥18）整身被涂覆、黏液化皆为素材指向的推进目标，未写入 story.tags，亦未完成——仅用通用黏液化，禁止物种专条。你可以核对组合原子与挂接提示，或结束当前经历、回到安全位置。
```

**中性 `…c9`：**

```
蛞蝓黏液在大腿内侧与胯下发生滴落包覆；接触可见。整身被涂覆、黏液化仅素材指向，未写入 story.tags。可核对组合或回安全。
```

---

## C4｜活体黑胶×嘴唇×封口包覆

- textKey（中性）：`progression:text.node.encounter.nsfwcombo.c4`
- textKey（成人）：`progression:text.node.encounter.nsfwcombo.c4.adult`
- nodeId：`progression:node.encounter.nsfwcombo.c4`
- comboKey：活体黑胶×嘴唇×封口包覆
- 允许：活体黑胶接触嘴唇；封口包覆动作已发生【L5】【L14】【L10】【F1】
- 禁止提前：求助成功脱困、signal 已写入、叫不出声硬结算、coat.stuck / 催眠 / 黏液化【F2】

### 扩写正文（成人门内；标注）

活体黑胶【L5】覆上你的嘴唇【L14】，完成封口包覆【L10】【F1】。胶膜贴紧唇缝，带着弹性压力与湿热气味，张口与发声都变得费力——但这只是当下触感，**尚未结算任何求助成功或失败**【F2】。【成人门：adultOptional + 年龄≥18】【F3】外衣黏附、催眠、黏液化均未写入。你可以核对组合原子与挂接提示，或结束当前经历、回到安全位置。

### 中性回退

活体黑胶在嘴唇发生封口包覆；接触可见。发声受阻仅为当下描写，未结算求助结果。可核对组合或回安全。

### 选择表（抄录）

| 选项 | 适用条件 | 本次效果 | 下一节点 |
|---|---|---|---|
| 核对组合原子与挂接提示 | 无 | clock.advance 5 分钟 | nsfwcombo-detail |
| 结束当前经历，回到安全位置 | 无 | 无 | null |

resultText：`…c4.detail`｜`progression:text.choice.164`

### 可粘贴纯正文

**成人 `…c4.adult`：**

```
活体黑胶覆上你的嘴唇，完成封口包覆。胶膜贴紧唇缝，带着弹性压力与湿热气味，张口与发声都变得费力——但这只是当下触感，尚未结算任何求助成功或失败。（成人门：adultOptional + 年龄≥18）外衣黏附、催眠、黏液化均未写入。你可以核对组合原子与挂接提示，或结束当前经历、回到安全位置。
```

**中性 `…c4`：**

```
活体黑胶在嘴唇发生封口包覆；接触可见。发声受阻仅为当下描写，未结算求助结果。可核对组合或回安全。
```

---

## C10｜史莱姆黏液×嘴唇、脖颈×指令触发→催眠中

- textKey（中性）：`progression:text.node.encounter.nsfwcombo.c10`
- textKey（成人）：`progression:text.node.encounter.nsfwcombo.c10.adult`
- nodeId：`progression:node.encounter.nsfwcombo.c10`
- comboKey：史莱姆黏液×嘴唇、脖颈×指令触发→催眠中
- 允许：史莱姆黏液接触嘴唇与脖颈；指令触发动作已发生【L4】【L14】【L15】【L13】【F1】
- 禁止提前：催眠中已写入、恍惚服从已成立、偏好自动非自愿、coat.stuck / 黏液化【F2】【L27】【P2】

### 扩写正文（成人门内；标注）

半透明的史莱姆黏液【L4】贴住你的嘴唇【L14】与脖颈【L15】，随接触发出短促的指令触发【L13】【F1】。声线像从胶膜内侧传来，短暂拉扯注意力与呼吸节奏；皮肤上的凉滑与指令余韵叠在一起。【成人门：adultOptional + 年龄≥18】【F3】催眠中【L27】仅作**素材指向，未写入 story.tags**；恍惚服从亦未成立【F2】【P2】。你仍可拒绝与中断——偏好不能替代同意。你可以核对组合原子与挂接提示，或结束当前经历、回到安全位置。

### 中性回退

史莱姆黏液在嘴唇与脖颈发生指令触发；接触可见。「催眠中」仅素材指向，未写入 story.tags。可核对组合或回安全。

### 选择表（抄录）

| 选项 | 适用条件 | 本次效果 | 下一节点 |
|---|---|---|---|
| 核对组合原子与挂接提示 | 无 | clock.advance 5 分钟 | nsfwcombo-detail |
| 结束当前经历，回到安全位置 | 无 | 无 | null |

resultText：`…c10.detail`｜`progression:text.choice.194`

### 可粘贴纯正文

**成人 `…c10.adult`：**

```
半透明的史莱姆黏液贴住你的嘴唇与脖颈，随接触发出短促的指令触发。声线像从胶膜内侧传来，短暂拉扯注意力与呼吸节奏；皮肤上的凉滑与指令余韵叠在一起。（成人门：adultOptional + 年龄≥18）催眠中仅作素材指向，未写入 story.tags；恍惚服从亦未成立。你仍可拒绝与中断——偏好不能替代同意。你可以核对组合原子与挂接提示，或结束当前经历、回到安全位置。
```

**中性 `…c10`：**

```
史莱姆黏液在嘴唇与脖颈发生指令触发；接触可见。「催眠中」仅素材指向，未写入 story.tags。可核对组合或回安全。
```

---

## C11｜虫巢黏液×手腕、腰侧×封口包覆→被黏液束缚

- textKey（中性）：`progression:text.node.encounter.nsfwcombo.c11`
- textKey（成人）：`progression:text.node.encounter.nsfwcombo.c11.adult`
- nodeId：`progression:node.encounter.nsfwcombo.c11`
- comboKey：虫巢黏液×手腕、腰侧×封口包覆→被黏液束缚
- 允许：虫巢黏液接触手腕与腰侧；封口包覆已发生【L3】【L18】【L17】【L10】【F1】
- 禁止提前：被黏液束缚已写入 story.tags、coat.stuck、催眠、黏液化【F2】【L23】

### 扩写正文（成人门内；标注）

虫巢黏液【L3】缠裹你的手腕【L18】与腰侧【L17】，以封口包覆【L10】把缝隙糊严【F1】。黏丝带着细粒触感，勒紧腕骨与腰线，湿热压迫让挣动手感滞涩；呼吸被腰侧的黏膜轻轻顶住。【成人门：adultOptional + 年龄≥18】【F3】被黏液束缚【L23】仅**素材指向，未写入 story.tags**【F2】。战败外衣黏附、催眠与黏液化均未结算。你可以核对组合原子与挂接提示，或结束当前经历、回到安全位置。

### 中性回退

虫巢黏液在手腕与腰侧发生封口包覆；接触可见。「被黏液束缚」仅素材指向，未写入 story.tags。可核对组合或回安全。

### 选择表（抄录）

| 选项 | 适用条件 | 本次效果 | 下一节点 |
|---|---|---|---|
| 核对组合原子与挂接提示 | 无 | clock.advance 5 分钟 | nsfwcombo-detail |
| 结束当前经历，回到安全位置 | 无 | 无 | null |

resultText：`…c11.detail`｜`progression:text.choice.199`

### 可粘贴纯正文

**成人 `…c11.adult`：**

```
虫巢黏液缠裹你的手腕与腰侧，以封口包覆把缝隙糊严。黏丝带着细粒触感，勒紧腕骨与腰线，湿热压迫让挣动手感滞涩；呼吸被腰侧的黏膜轻轻顶住。（成人门：adultOptional + 年龄≥18）被黏液束缚仅素材指向，未写入 story.tags。战败外衣黏附、催眠与黏液化均未结算。你可以核对组合原子与挂接提示，或结束当前经历、回到安全位置。
```

**中性 `…c11`：**

```
虫巢黏液在手腕与腰侧发生封口包覆；接触可见。「被黏液束缚」仅素材指向，未写入 story.tags。可核对组合或回安全。
```

---

## C12｜凝胶膜×胯下×缠绕→恍惚服从

- textKey（中性）：`progression:text.node.encounter.nsfwcombo.c12`
- textKey（成人）：`progression:text.node.encounter.nsfwcombo.c12.adult`
- nodeId：`progression:node.encounter.nsfwcombo.c12`
- comboKey：凝胶膜×胯下×缠绕→恍惚服从
- 允许：凝胶膜接触胯下；缠绕已发生【L6】【L21】【L7】【F1】；可轻挂 T1 描写差异
- 禁止提前：恍惚服从已写入、催眠中已成立、coat.stuck、身体已黑胶化【F2】【L28】【P1】【T1】

### 扩写正文（成人门内；标注）

凝胶膜【L6】在你的胯下【L21】缠绕【L7】收紧【F1】，膜面清凉而黏，一圈圈勒过敏感带，牵动呼吸与注意力（可选挂黑胶题材描写【T1】，**≠身体已黑胶化**【P1】）。【成人门：adultOptional + 年龄≥18】【F3】恍惚服从【L28】是描写目标态——**素材指向，未写入 story.tags**；催眠中亦未成立【F2】【P2】。你可以核对组合原子与挂接提示，或结束当前经历、回到安全位置。

### 中性回退

凝胶膜在胯下发生缠绕；接触可见。「恍惚服从」仅素材指向，未写入 story.tags。可核对组合或回安全。

### 选择表（抄录）

| 选项 | 适用条件 | 本次效果 | 下一节点 |
|---|---|---|---|
| 核对组合原子与挂接提示 | 无 | clock.advance 5 分钟 | nsfwcombo-detail |
| 结束当前经历，回到安全位置 | 无 | 无 | null |

resultText：`…c12.detail`｜`progression:text.choice.204`

### 可粘贴纯正文

**成人 `…c12.adult`：**

```
凝胶膜在你的胯下缠绕收紧，膜面清凉而黏，一圈圈勒过敏感带，牵动呼吸与注意力（黑胶题材可作描写选材，不等于身体已黑胶化）。（成人门：adultOptional + 年龄≥18）恍惚服从是描写目标态——素材指向，未写入 story.tags；催眠中亦未成立。你可以核对组合原子与挂接提示，或结束当前经历、回到安全位置。
```

**中性 `…c12`：**

```
凝胶膜在胯下发生缠绕；接触可见。「恍惚服从」仅素材指向，未写入 story.tags。可核对组合或回安全。
```

---

## 来源清单

- tip `codex/tag-effect-preview@f9f2ecd`
- `production/TAG-STORY-WRITING-SPEC.md` v1.1
- 制作卡 / `docs/nsfw-auto-combo.md` / focus.json / 可填槽清单

## 自检

| 项 | 结果 |
|---|---|
| 来源与叙事自检 | 完成；停在选择点；第二人称「你」 |
| 未改 pack.json / 节点契约 | 是 |
| .detail / choice 结果短句 | 本批不动 |
| 无物种 TF 专条 / 无 NPC24 | 是 |
| 素材态 ≠ story.tags；外衣黏附 ≠ 身体黑胶化 | 是 |
| 未谎称已过游戏测试 | 是 |
| 成人门 + 中性回退 | 六条均有 |

P0 覆盖 textKey：  
`…c8` / `…c8.adult`，`…c9` / `…c9.adult`，`…c4` / `…c4.adult`，`…c10` / `…c10.adult`，`…c11` / `…c11.adult`，`…c12` / `…c12.adult`（各含可粘贴块）。
