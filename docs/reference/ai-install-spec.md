# 安装规范（唯一入口）

版本：`aetheria-install/1`（2026-10-16）。

Cursor、Claude、Gemini、GPT 以及其他能写 JSON 或补丁的模型，都按本文件交付。不要再为某个模型单写一份规范，也不要把 `development-plan.md`、自包含任务 ZIP 或某次审查记录当成现行装入口径。

本文件只规定**怎样交、交到哪、怎样算装上**。槽位字段细节仍以 [槽位拼装规范](prose-slot-assembly-standard.md) 与 `production/collaboration-pack/docs/01-通用规范.md`（v1.3）为准。已拍板的玩法取舍仍记在 [协作核对](ai-collaboration-review.md)，与本文件冲突时以本文件的交付格式为准，玩法取舍以核对表为准。

## 1. 先选一条车道

交稿前只选一条。混在一份稿里时，按机制车道整份处理。

| 车道 | 何时用 | 允许改什么 | 禁止 |
| --- | --- | --- | --- |
| `words` | 只增加可拼装短语或模板，不改变规则、奖励、身体、关系 | 作者层 JSON（词条、模板、`assembly-rules.json`） | 改 `src/`、改 `content/*/pack.json`、把 `*-data.ts` 当原稿 |
| `content` | 用**已经能加载**的 opcode 增加地点、行动、事件、文本、居民模板 | `content/` 下的内容包，以及 `content/index.json`（仅当新建包） | 发明字段或 opcode；改 `content/core/pack.json`（其哈希被旧档钉住） |
| `mechanism` | 需要新字段、新 opcode、新存档形状或新 UI 行为 | 类型、Schema、引擎、存档校验、测试，外加一份统一 diff | 只改类型不改校验；在 `module-boundaries.ts` 里再声明一套不运行的接口 |

判断口诀：现有 `parsePack` 会拒绝的字段，就是机制，不是内容。

## 2. 所有模型共用的交付头

每份交付的第一段都是这个对象（放在 PR 说明、回复开头，或单独的 `install.json`）。字段名不要改。

```json
{
  "spec": "aetheria-install/1",
  "lane": "words",
  "base": "git commit SHA；读不到仓库时写 offline",
  "summary": "一句话说明交了什么",
  "status": "authored",
  "files": ["相对路径"],
  "verify": ["实际跑过的命令"],
  "notDone": ["没做或没跑的项"]
}
```

`status` 只允许三个值，禁止互换：

| 值 | 含义 |
| --- | --- |
| `authored` | 作者稿，字段自检过，未装进游戏 |
| `checked` | 整合方已跑过本文件第 5 节对应命令，离线或类型检查通过 |
| `installed` | 新世界或指定入口里能触发，旧档行为不变，测试有记录 |

`hold`、离线样例、任务卡正文都不算 `installed`。

## 3. 共用硬规则

1. 玩法状态只由 `ActionExecutor.performAction` 提交。条件、选项、UI、调试不改 `GameState`，不消耗游戏 RNG。
2. 未知字段、未知 opcode、未登记 Tag 在加载时失败，不要静默忽略。
3. 定义 ID 形如 `namespace:local.id`，小写命名空间，只定义本包自己的 ID。跨包引用必须在 `manifest.dependencies` 里写明对方 `id` 与精确 `version`。
4. Tag 的 `label` 至少一个汉字，并在本包 `tags` 里注册后才能引用。
5. 每个 `choice` 事件和每个叙事节点都须有资源耗尽时仍可执行的推进或结算路径。它可以继续受困、承受失败后果或等待救援，不要求每段都有免费脱身按钮。「跳过」只略过过程描写，照常执行同一路径的时间、状态和后果，到下一关键选择停下；不得代替选择、抹去损失或直接回安全点。实际撤离按剧情条件和代价决定。
6. 功能由具体 `services` 和设施决定。做不到的功能不要出现，包括折叠栏。缺资源才显示限制。职业名和性格不能代替能力。
7. 玩家创建只收集姓名。成人内容默认关闭；关闭后仍能玩完，并有普通正文回退。NPC 成年与智慧资格照旧单独检查。
8. 新结构只出现在新世界。旧档按快照恢复，不放宽包哈希，不重抽地图、身份或性格。
9. 正文不能冒充已发奖励、已装部件、已学会技能或已改变关系。
10. 同一批共享文件（生成器、内容 Schema、存档校验、拼装规则）只由一个整合者改。其他人交 diff，不交整文件覆盖。
11. 没跑的测试写在 `notDone`，不要写成通过。

## 4. 各车道怎么写

### 4.1 `words`

按协作包 v1.3 的作者 Schema 交词条和模板：`production/collaboration-pack/docs/01-通用规范.md`。八个槽只使用 place、propEnv、bodyPart、senseMod、actionCore、materialFluid、opponentForm、exitChoice。`review` 只写 `draft` 或 `hold`。作者不把状态改成 `approved`。

不能读仓库时，只交符合作者 Schema 的 JSON 和交付头。整合方运行 `node scripts/build-collaboration-pack.mjs` 做离线检查，再按 [构建流水线](build-pipeline.md) 决定要跑哪条 `build-a-templates` / `build-b-observations`。不要手改 `src/world/*-data.ts` 或 `src/engine/prose-assembly.generated.ts`。

### 4.2 `content`

新建包放在 `content/<目录>/pack.json`，并在 `content/index.json` 的 `packs` 里登记。包要有 `manifest`（含 `schemaVersion`、`engineApiVersion: "0.1"`、`dependencies`、`requiresCapabilities`、空的 `migrations`）以及本包真正用到的定义数组和 `texts`。

只能使用 `src/content/schema.ts` 的 `CAPABILITIES` 与当前 `parsePack` 已接受的 opcode。条件与效果的字段以加载器白名单为准，多出来的键会被拒绝。

事件行动通过 `contributions` 挂到已有地点的 `actionHook`，或挂到本包新建地点的 hook。文本用普通字符串，不要 HTML。

改完后整合方执行：

```sh
npm run typecheck
node --test tests/foundation.test.ts tests/save.test.ts
```

若动到世界生成参考数据，再加 `npm run test:worldgen`。

### 4.3 `mechanism`

在写操作符之前先写清：状态放在 `GameState` 的哪一个已有块里（`world`、`adventure`、`district`、`npcs`、`player.body`），谁在事务里写入，旧档缺这个字段时如何拒绝或如何按明确前身迁移。不要新建第三套场景类型；`src/engine/module-boundaries.ts` 里的预留接口不是运行时。

一处新字段或新 opcode 同时改这四类文件，缺一不可：

1. `src/core/*.ts` 或 `src/world/types.ts` 的类型
2. `src/content/*-schema.ts` 或 `src/world/schema.ts` 的白名单
3. `src/engine/*.ts` 的初始化、条件或 `applyEffects` 分支
4. `src/persistence/*-validation.ts` 或 `src/world/validation.ts` 的存档读取

世界形状变了才提高 `src/world/generator.ts` 的 `GENERATOR_VERSION`，并让校验认得旧版本。UI 只发 `ActionIntent`。

交付是针对 `base` 的统一 diff、新文件全文、`verify` 里的命令输出。能读仓库的模型直接在分支上改，交付头写在 PR 说明里。

## 5. 怎样算装进去

| 车道 | 整合命令 | 达到 `installed` 的条件 |
| --- | --- | --- |
| `words` | 协作包检查，再跑对应 `build-*-templates` 或 `build-b-*` | 新世界里对应入口能拼出正文；拼装失败有普通回退；旧世界快照不变 |
| `content` | `npm run typecheck` 与上表测试 | 加载无未知字段；入口行动可见；资源耗尽仍可推进或结算；跳过与正常过程后果一致；旧档仍能读 |
| `mechanism` | `npm run typecheck`，加上该机制的测试 | 四类文件一致；伪造调用被拒绝；旧档按写明的规则读取 |

## 6. 给任意模型的同一段任务说明

把下面整段贴给执行模型。能读仓库就让它改分支；不能读仓库就让它只返回交付头和车道文件。

```text
按 docs/reference/ai-install-spec.md（aetheria-install/1）交付。先在 words / content / mechanism 中选一条车道。
回复第一段必须是该规范第 2 节的 JSON 交付头。
words 只交协作包 v1.3 作者 JSON。content 只用现有 opcode，不改 content/core/pack.json。
mechanism 要同时改类型、Schema、引擎和存档校验，并给出针对 base 提交的 diff。
status 在真正装进游戏之前只能写 authored 或 checked。未运行的测试写入 notDone。
不要另写一份模型专用规范，不要用整文件覆盖生成器、Schema 或存档校验。
```

## 7. 旧文档怎么用

| 文档 | 现在的角色 |
| --- | --- |
| 本文件 | 装入与交付的唯一口径 |
| `AGENTS.md` | 能读仓库时的目录白名单，不另定格式 |
| `production/collaboration-pack/docs/01-通用规范.md` | `words` 车道的字段说明 |
| `docs/reference/ai-collaboration-review.md` | 玩法取舍记录，不是第二份交付格式 |
| `docs/reference/development-plan.md` | 模块 A–E 的历史任务说明 |
| `docs/protocol.md`、`docs/reference/content-tag-story-standard.md` | 早期协议记录；其中「尚未实现」的opcode以当前 `schema.ts` 为准 |
| `node scripts/build-ai-task-pack.mjs` | 可选的离线全文包，不是规范本身 |
