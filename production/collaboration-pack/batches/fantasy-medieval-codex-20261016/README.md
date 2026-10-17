```json
{
  "spec": "aetheria-install/1",
  "lane": "words",
  "base": "c686c634348e244b2ad79b10a9e44e591eaba404",
  "summary": "中世纪异世界 fantasy 作者稿：B1 65 条、B2 70 条，共 135 条，55 draft / 80 hold；6 个手工预览。",
  "status": "authored",
  "files": [
    "production/collaboration-pack/batches/fantasy-medieval-codex-20261016/install.json",
    "production/collaboration-pack/batches/fantasy-medieval-codex-20261016/B1-fantasy.json",
    "production/collaboration-pack/batches/fantasy-medieval-codex-20261016/B2-fantasy.json",
    "production/collaboration-pack/batches/fantasy-medieval-codex-20261016/previews.json",
    "production/collaboration-pack/batches/fantasy-medieval-codex-20261016/review-report.json",
    "production/collaboration-pack/batches/fantasy-medieval-codex-20261016/README.md"
  ],
  "verify": [
    "node artifacts/authoring-fantasy-medieval-20261016/verify.mjs"
  ],
  "notDone": [
    "Gemini 云端改动尚未同步；未核对云端 ID、重复词面及规范变更。",
    "未将稿件接入游戏或注册为 approved；未修改共享 Schema、运行内容包及引擎。",
    "未运行参考拼装器、build-collaboration-pack、build-b-observations、游戏测试或 UI/存档验证。",
    "80 条 hold 的语义事实与 55 条 draft 的生产查询取值尚待整合方核实。"
  ]
}
```

# 中世纪异世界 · fantasy 文风试稿

本次按用户选定的一个题材交 B1/B2。135 条作者稿合计 55 draft、80 hold；不计入第二批十二题材完成数，也不替换首批已完成 fantasy 稿。独立 ID 前缀为 word.fantasy.medieval-codex-20261016，尚未接入游戏。

- B1：40 道具 + 25 感官 = 65 条；45 draft、20 hold。五种感官通道各 5 条。
- B2：30 人物泛称 + 40 观察动作 = 70 条；10 draft、60 hold。动作分等候、工作、消遣、警惕、社交各 8 条。
- 人物职业、穿戴、持有和站位没有现成事实键；30 条人物泛称全部 hold。细动作、复合声源、旧痕和触觉来源均保留待补条件。

每条均有 scene.setting=fantasy 前置，Tag 全部来自 05 参考，suggestedTags 为空。draft 仅表示作者字段和查询引用自检；09 目前全部为 fixture-only，不能称作生产可用。开放字符串取值及全部 hold 原因详见 review-report.json。

## 手工文风预览

以下六例均为 manual / hypothetical-only。场景名称、物件、人物、行为与免费出口是明确的人工假设。含 hold 的样张仅供文字审阅，不进入运行候选。previews.json 给出外部模板全文、所用词条、实例假设和全部待补条件；没有创建 approved 或真实按钮。

### 石桥集市 · B1 · 仅 draft词条

在石桥集市，你留意到一架天平。你察觉到铃铛的轻响。你可以结束观察，继续自己的安排。

### 炉火旅店 · B1 · 仅 draft词条

在炉火旅店，你留意到一盏油灯。你察觉到温暖。你可以结束观察，继续自己的安排。

### 渡鸦书院 · B1 · 含 hold词条

在渡鸦书院，你留意到一根镶着水晶的法杖。你察觉到草木的清香。你可以结束观察，继续自己的安排。

### 钟楼铁坊 · B2 · 含 hold词条

在钟楼铁坊，你留意到一位围着皮围裙的人，对方以小锤敲平扣环。你可以结束观察，继续自己的安排。

### 炉火旅店 · B2 · 含 hold词条

在炉火旅店，你留意到一位巡游歌者，对方拨动鲁特琴的琴弦。你可以结束观察，继续自己的安排。

### 灰石公会 · B2 · 含 hold词条

在灰石公会，你留意到一位冒险者公会接待员，对方把摊开的地图转向同伴。你可以结束观察，继续自己的安排。

## 校验与同步边界

运行命令：`node artifacts/authoring-fantasy-medieval-20261016/verify.mjs`。已检查数量、每通道/动作类别配额、词条和模板字段、05 canonical Tag、09 事实键、每条题材门控、跨批 ID/词面重复及手工预览逐项对应。没有运行参考拼装器，因此没有 fixture-verified 预览。

用户明确要求顶层 contentTier=general；当前本地 v1.3 delivery Schema 没有该字段，原稿直接校验会报 `$/contentTier: 未知字段`。本次在克隆 Schema 中验证该用户要求，并仅对内存副本去掉这一字段后运行原验证器。共享 Schema 和作者原稿都保留原状；不得把兼容检查说成原稿已无条件通过官方 Schema。

基于本地提交 `c686c634348e244b2ad79b10a9e44e591eaba404`。Gemini 云端改动同步后，再比对本目录的独立 ID、重复词面、Tag、事实映射和 Schema；不得用本稿覆盖共享文件。当前状态保持 authored。
