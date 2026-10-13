# NSFW auto-combo 可填槽清单（合载后）

日期：2026-10-13。分支：`codex/tag-effect-preview`。
基线合载：`f9f2ecd`；本轮续填 C7–C12 + 成人门接线。

> 词条 ≠ 玩法 ≠ 数值。不改词库审定。成人正文须 `created` + 年龄≥18 + `adultOptional`。绝不涉及未成年人。

## 入口（已接线）

| 类型 | ID | 说明 |
|---|---|---|
| action | `progression:action.nsfwcombo.encounter` | 试跑 NSFW 材质组合遭遇 |
| profile | `progression:profile.nsfwcombo.matrix` | 写入 opponent `nsfwcombo.active` |
| tag | `progression:tag.nsfwcombo.active` | 节点 requiresTags |
| condition | `preference.adultOptional` | 成人选项/节点门（本轮补） |

## 样例矩阵与可填文本槽

| 样例 | 成人 | 组合键 | start 节点 | 中性正文槽 | detail 槽 | adult 正文槽（优先可填） | adult 节点 |
|---|---|---|---|---|---|---|---|
| C1 | 否 | 触手黏液×手腕、腰侧×缠绕→被黏液束缚 | `progression:node.encounter.nsfwcombo.c1` | `progression:text.node.encounter.nsfwcombo.c1` | `progression:text.node.encounter.nsfwcombo.c1.detail` | — | — |
| C2 | 否 | 蛞蝓黏液×脚踝、大腿内侧×涂覆 | `progression:node.encounter.nsfwcombo.c2` | `progression:text.node.encounter.nsfwcombo.c2` | `progression:text.node.encounter.nsfwcombo.c2.detail` | — | — |
| C3 | 否 | 凝胶膜×外衣下摆×滴落包覆 | `progression:node.encounter.nsfwcombo.c3` | `progression:text.node.encounter.nsfwcombo.c3` | `progression:text.node.encounter.nsfwcombo.c3.detail` | — | — |
| C4 | 是 | 活体黑胶×嘴唇×封口包覆 | `progression:node.encounter.nsfwcombo.c4` | `progression:text.node.encounter.nsfwcombo.c4` | `progression:text.node.encounter.nsfwcombo.c4.detail` | `progression:text.node.encounter.nsfwcombo.c4.adult` | `progression:node.encounter.nsfwcombo.c4.adult` |
| C5 | 否 | 虫巢黏液×身后×丝状滴落 | `progression:node.encounter.nsfwcombo.c5` | `progression:text.node.encounter.nsfwcombo.c5` | `progression:text.node.encounter.nsfwcombo.c5.detail` | — | — |
| C6 | 否 | 史莱姆黏液×倒挂姿态×倒挂→倒挂固定 | `progression:node.encounter.nsfwcombo.c6` | `progression:text.node.encounter.nsfwcombo.c6` | `progression:text.node.encounter.nsfwcombo.c6.detail` | — | — |
| C7 | 否 | 触手黏液×脖颈、锁骨窝×缠绕→被黏液束缚 | `progression:node.encounter.nsfwcombo.c7` | `progression:text.node.encounter.nsfwcombo.c7` | `progression:text.node.encounter.nsfwcombo.c7.detail` | — | — |
| C8 | 是 | 活体黑胶×胯下×涂覆→性器外露 | `progression:node.encounter.nsfwcombo.c8` | `progression:text.node.encounter.nsfwcombo.c8` | `progression:text.node.encounter.nsfwcombo.c8.detail` | `progression:text.node.encounter.nsfwcombo.c8.adult` | `progression:node.encounter.nsfwcombo.c8.adult` |
| C9 | 是 | 蛞蝓黏液×大腿内侧、胯下×滴落包覆→整身被涂覆→黏液化 | `progression:node.encounter.nsfwcombo.c9` | `progression:text.node.encounter.nsfwcombo.c9` | `progression:text.node.encounter.nsfwcombo.c9.detail` | `progression:text.node.encounter.nsfwcombo.c9.adult` | `progression:node.encounter.nsfwcombo.c9.adult` |
| C10 | 是 | 史莱姆黏液×嘴唇、脖颈×指令触发→催眠中 | `progression:node.encounter.nsfwcombo.c10` | `progression:text.node.encounter.nsfwcombo.c10` | `progression:text.node.encounter.nsfwcombo.c10.detail` | `progression:text.node.encounter.nsfwcombo.c10.adult` | `progression:node.encounter.nsfwcombo.c10.adult` |
| C11 | 是 | 虫巢黏液×手腕、腰侧×封口包覆→被黏液束缚 | `progression:node.encounter.nsfwcombo.c11` | `progression:text.node.encounter.nsfwcombo.c11` | `progression:text.node.encounter.nsfwcombo.c11.detail` | `progression:text.node.encounter.nsfwcombo.c11.adult` | `progression:node.encounter.nsfwcombo.c11.adult` |
| C12 | 是 | 凝胶膜×胯下×缠绕→恍惚服从 | `progression:node.encounter.nsfwcombo.c12` | `progression:text.node.encounter.nsfwcombo.c12` | `progression:text.node.encounter.nsfwcombo.c12.detail` | `progression:text.node.encounter.nsfwcombo.c12.adult` | `progression:node.encounter.nsfwcombo.c12.adult` |

### choice 结果文本槽（次要）

- C1 detail choice → `progression:text.choice.nsfwcombo.c1.detail`
- C2 detail choice → `progression:text.choice.nsfwcombo.c2.detail`
- C3 detail choice → `progression:text.choice.nsfwcombo.c3.detail`
- C4 detail choice → `progression:text.choice.nsfwcombo.c4.detail`
- C4 adult choice → `progression:text.choice.nsfwcombo.c4.adult`
- C5 detail choice → `progression:text.choice.nsfwcombo.c5.detail`
- C6 detail choice → `progression:text.choice.nsfwcombo.c6.detail`
- C7 detail choice → `progression:text.choice.nsfwcombo.c7.detail`
- C8 detail choice → `progression:text.choice.nsfwcombo.c8.detail`
- C8 adult choice → `progression:text.choice.nsfwcombo.c8.adult`
- C9 detail choice → `progression:text.choice.nsfwcombo.c9.detail`
- C9 adult choice → `progression:text.choice.nsfwcombo.c9.adult`
- C10 detail choice → `progression:text.choice.nsfwcombo.c10.detail`
- C10 adult choice → `progression:text.choice.nsfwcombo.c10.adult`
- C11 detail choice → `progression:text.choice.nsfwcombo.c11.detail`
- C11 adult choice → `progression:text.choice.nsfwcombo.c11.adult`
- C12 detail choice → `progression:text.choice.nsfwcombo.c12.detail`
- C12 adult choice → `progression:text.choice.nsfwcombo.c12.adult`

## 每样例节点阶段

- `start`：中性遭遇 fragment；选项「核对组合原子」「结束」；成人样例另有「阅读成人向补充描写」（需 `preference.adultOptional`）
- `nsfwcombo-detail`：组合键 / lexiconRefs / 战败挂接提示
- `nsfwcombo-adult`（仅 adultRequired）：**优先可填**的成人正文占位槽

## 原子池（可继续展开组合）

- materials：M1/蛞蝓黏液、M2/触手黏液、M3/虫巢黏液、M4/史莱姆黏液、M5/活体黑胶、M6/凝胶膜
- parts：Pt1/嘴唇、Pt4/腰侧、Pt5/手腕、Pt6/大腿内侧、Pt7/脚踝、Pt2/脖颈、Pt3/锁骨窝
- loci：Lc2/身后、Lc1/胯下
- actions：A1/缠绕、A2/涂覆、A3/滴落包覆、A4/封口包覆*、A5/丝状滴落、A6/倒挂、A7/指令触发*
- states：S1/被黏液束缚、S3/倒挂固定、S2/整身被涂覆、S4/性器外露、S5/催眠中、S6/恍惚服从
- tfs：Tf1/黏液化
- poses：Po1/倒挂拱身

扩展：编辑 `scripts/nsfw-auto-combo/atoms.json` 的 `samples`，再跑 `node scripts/build-adventure-content.mjs`。

## 仍缺 / 待封装（制作卡 U）

| # | 缺口 | 现状 | 建议可填/接线 |
|---|---|---|---|
| U1 | 战败通用 `adult_optional` TextSlot | 仅有 `district:textslot.riker/nara.quiet`；**勿冒充** | 提案 `edit:textslot.defeat.nsfw.coat`（未注册） |
| U2 | 运行情境 tag（束缚/涂覆/倒挂/封口） | 仅 L-state + 遭遇 active tag | 提案 `progression:tag.nsfwcombo.bound` 等（未装） |
| U3 | `foundation:material.gel` | 词典查无 | 勿伪造；用 L 描写 + `foundation:theme.gel` |
| U4 | 战败→通用黏液化 transformation 链 | 类型有、内容无 | C9 仅遭遇提示 `optionalTf`；无 TF 节点 |
| U5 | 精神链运行 tag + 可拒出口 | C10 有 adult 槽+指令动作 | 缺 `progression:tag.hypnosis.*` |
| U6 | 组合器 | **已合载** | `scripts/nsfw-auto-combo/*` |
| U7 | 小腿 part | 用脚踝/大腿映射 | 可选补 part 素材 |
| U8 | 封口硬约束 signal | 纯叙事 | 规则作者定 |

## 现有可挂 defeat（差异槽，非本 combo 节点）

- `progression:node.defeat.start`
- `progression:node.defeat.control`
- `progression:node.defeat.direct`
- `progression:node.defeat.repair`
- `progression:node.defeat.assess`
- `progression:node.defeat.coat`
- `progression:node.defeat.hands`
- `progression:node.defeat.help`
- `progression:node.defeat.repair.scope`
- `progression:node.defeat.repair.tail`
- `progression:node.defeat.control.cautious`
- `progression:node.defeat.repair.cautious`

## 自检

- 合载样例：12（C1–C12）
- narrative 节点含 nsfwcombo：30
- adult 可填槽：6（['C4', 'C8', 'C9', 'C10', 'C11', 'C12']）
- 未改 approved 词库；无物种 TF 专条；无未成年人内容

## 正文回填状态（P0+P1）

- 源：`docs/tag-hub/outbox/2026-10-13-故事试写-nsfwcombo-可粘贴正文.md`（标注版同前缀 P0/P1）
- 工程源：`content/nsfw-auto-combo/prose-fills.json`（构建时写入 `pack.texts`）
- 已填：C1–C3/C5–C7 中性 start；C4/C8–C12 **双槽**（中性 + `.adult`）共 18 槽
- 本批未动：`.detail` / choice 结果短句
- 重建：`node scripts/build-adventure-content.mjs`

## 相关 path

- `content/nsfw-auto-combo/candidates.json`
- `scripts/nsfw-auto-combo/atoms.json`
- `scripts/build-adventure-content.mjs`
- `content/adventure/pack.json`（生成物，勿手改）
- `docs/nsfw-auto-combo.md`
- `docs/tag-hub/outbox/2026-10-13-故事试写-proposed-nodes-NSFW自动组合制作卡.md`


## fantasy 战败 8 玩法（合载）

| 玩法 | 节点 | 中性槽 | adult 槽 |
|---|---|---|---|
| 束缚制服 | `progression:node.defeat.play.01` | `…play.p1` | `…play.p1.adult` |
| 材质覆层转化 | `…02` | `…p2` | `…p2.adult` |
| 侵犯插入 | `…03` | `…p3` | `…p3.adult` |
| 口封感官剥夺 | `…04` | `…p4` | `…p4.adult` |
| 产卵灌注 | `…05` | `…p5` | `…p5.adult` |
| 公开羞辱 | `…06` | `…p6` | `…p6.adult` |
| 主从调教 | `…07` | `…p7` | `…p7.adult` |
| 多体围攻 | `…08` | `…p8` | `…p8.adult` |

入口：`progression:action.defeat.play` → hub。编辑编号保留 `edit:node.defeat.play.01`–`08`。
