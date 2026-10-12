# RULE-MATRIX · 共存 / 互斥 / 分维度

状态标注：`编辑约定` | `可加载示范(draft)` | `已实现(引擎)` | `待制定`

---

## A. 可加载示范（本包 JSON）

### A1. 机械尾素材 ← 材料族，≠ 题材「机械」

| 项 | 内容 |
|---|---|
| id | `tagcoexist:selection.mechanical-tail-by-material` |
| 输入 | 玩家 BodyGraph 尾部 |
| 条件 | `body.matches` part.kind=tail ∧ materialFamily=mechanical |
| 结果 | 候选 `foundation:prose.1.mechanical-tail` |
| 正例 | 同尾为 mechanical → 通过 |
| 反例 | 机械手 + 有机尾 → **不通过**（合取必须在同一 part） |
| 反例 | 仅有 `foundation:theme.mechanical` 题材、尾未知/有机 → **不通过** |
| 未知 | 无尾或材料未知 → 不满足；NOT 未知仍未知 |
| 阶段 | 运行时 prose 选择（body 通道） |
| 边界 | 题材机械 ≠ 材料机械 |

### A2. 长尾素材 ← 长度，≠ 题材

| 项 | 内容 |
|---|---|
| id | `tagcoexist:selection.long-tail-by-length` |
| 条件 | tail ∧ minLengthMm≥600 |
| 正例 | 600 / 601 mm → 通过 |
| 反例 | 599 mm → 不通过；长度未知 → 不通过 |
| 边界 | 无 maxLengthMm（未实现字段不编造） |

### A3. 有机尾素材 ← organic 族

| 项 | 内容 |
|---|---|
| id | `tagcoexist:selection.organic-tail-by-family` |
| 条件 | tail ∧ materialFamily=organic |
| 正例 | 有机尾（含 material.gel 族为 organic 时）→ 通过本选择 |
| 反例 | 机械尾 → 不通过 |
| 边界 | `foundation:material.gel` 是**材料**；`foundation:theme.gel` 是**题材**；本 when **不**读 theme.gel |

### A4–A5. 环境光照

| id | 条件 | 正例 | 反例 |
|---|---|---|---|
| `…environment-dark` | `environment.light=dark` | 地点 dark | lit 时不选 dark 文 |
| `…environment-lit` | `environment.light=lit` | 地点 lit | dark 时不选 lit 文 |

服务仍由权威 `service` 字段决定，不被光照替换。预设「湿润」≠ 真实湿度。

### A6. 工坊活动（Reference）

| 项 | 内容 |
|---|---|
| id | `tagcoexist.activity.workshop-tool-check` |
| requiresTags | `foundation:service.workshop` |
| capabilities | grasp |
| boosts | `foundation:setting.forge` ×2（只调已合法候选权重） |
| excludesTemplates | `tagcoexist.activity.commons-quiet-observe` |
| 正例 | 工坊服务 + 有抓握 → 可成候选 |
| 反例 | 无工坊服务；或缺 grasp → 不可用 |
| 反例 | 提高 weight 不能绕过缺服务 |
| 禁止误读 | **不**把 `theme.gel` / `theme.mechanical` 写入 requiresTags |

### A7. 公共空间活动 + 模板互斥

| 项 | 内容 |
|---|---|
| id | `tagcoexist.activity.commons-quiet-observe` |
| requiresTags | `foundation:service.commons` |
| excludesTemplates | workshop-tool-check（双向） |
| 说明 | 示范**模板层**互斥 = 引擎已支持；**不是** §10.2 词条类矩阵 |

---

## B. 编辑约定（词条侧，不进本包字段）

来源：v0.13 §10.1 + 摘要对照库存。状态均为**编辑约定**（除非另注）。

| # | 规则 | 正例 | 禁例 |
|---|---|---|---|
| B1 | 一条一事 / 一主分类 | 勒、挂住分条；category=library | 整场戏一条；跨库假同名 |
| B2 | 通用 vs NSFW format 互斥混装 | 分 batch、分 format | NSFW 塞进 body-* |
| B3 | 词条 vs 运行时包互斥互导 | lexicon ≠ ContentPack | batch 当 ContentPack 导入 |
| B4 | material ∥ fluid；定词挂前 | 触手黏液 = 定词+黏液 | 定词当 creature；黑胶 synonyms 顶替黏液 |
| B5 | 黑胶 ⊄ 黏液 ⊄ 凝胶 | 分条可并存描写 | synonyms 互充 |
| B6 | goo/黑胶化通用组合 | 活体黑胶(material)+黑胶化(tf)+可选 state/kink | 「研究员黑胶化」专条 |
| B7 | kink ≠ state ≠ 意愿 | kink 必填 tier；意愿走旗标/事件 | 「正在截换」当 kink；tags「已同意」 |
| B8 | 性癖不进拼装槽 | kink 仅编辑选材 | 性癖自动决定动作 |
| B9 | action ≠ tf ≠ state；pose 俗称+precise | pose 同条 precise | 粗类 pose 冒充「××后入」 |
| B10 | creature ≠ part；种族∥形态 | 狼根∥马屌并列 | synonyms 互充；creature 冒充 part |
| B11 | 身体 SFW/NSFW 两层不共享 id；≠ BodyGraph | 跨层人工对照 | 假共享 id；素材冒充已实现槽位 |
| B12 | foundation 题材只表题材 | theme.gel 故事主题 | 当作活体黑胶或黑胶化进度 |
| B13 | 字段分列 | kink.tier / contentTier / 年龄 / 意愿 / adultOptional | 混用冒充 |
| B14 | 未成年 ⊥ 成人场景 | 可验证年龄门槛 | 未知当成年；素材标签冒充年龄 |
| B15 | gore 默认不强产 | 用户点名才加 gore | 批量强产 gore |

---

## C. 一页自检（抽条前 yes/no）

与摘要 §5 对齐，≤10：

1. 一条一事 + 一主分类？
2. 通用/NSFW format·library 未混装？词条未冒充运行时包？
3. material∥fluid；定词挂前且定词≠creature？
4. 黑胶⊄黏液⊄凝胶；未 synonyms 互充？
5. goo/黑胶化是否通用组合（无××黑胶化专条）？
6. kink≠state≠意愿；kink 有 tier；性癖未进拼装槽？
7. action≠tf≠state；pose 有 precise？
8. creature≠part；种族∥形态未互塞 synonyms？
9. 身体两层不共享 id；foundation 题材只表题材？
10. 字段分列；未编造未确认矩阵；未声称已验收/已实装？

---

## D. 明确不在本矩阵数值化的项

见 `FUTURE-REQUIREMENTS.md`：58 类正式矩阵、NSFW 库际硬表、跨层字段对照、运行时组合冲突检测、suggestive 字段等 —— **只列待定+建议默认，不输出伪已解决表**。
