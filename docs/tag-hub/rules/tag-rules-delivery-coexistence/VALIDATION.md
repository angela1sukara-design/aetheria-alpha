# VALIDATION · 共存规则交付

| 项 | 值 |
|---|---|
| 时间 | 2026-10-12 18:01 SGT |
| 包 | `authoring/tag-coexistence-v013` + `authoring/reference-tag-coexistence-v013` |
| 总状态 | **提出 / draft**；静态检查通过；未宣称 check:foundation 已覆盖本包 |

## 1. 已执行

| 检查 | 结果 |
|---|---|
| JSON 可解析（两份正式包） | 通过 |
| ContentPack 壳字段齐全（manifest 依赖/capability、空数组、texts={}） | 通过（对照 rules-content-example） |
| proseSelections：channel∈{body,environment}；when 仅用已文档化 op | 通过 |
| when **零**引用 theme.gel / theme.mechanical / theme.night / theme.transformation | 通过（分维度硬约束） |
| entryId 均落在 available-content 已审定 prose 列表 | 通过（5/5） |
| 新增 Tag 数 = 0；无汉字 ID；未冒用 rulesdemo | 通过 |
| ReferencePack：format/schemaVersion/模板必填字段；weight 1–1000 | 通过 |
| requiresTags 仅 service.*；无 theme.* 硬门 | 通过 |
| excludesTemplates 双向成对 | 通过 |
| 未写 suggestive / NSFW 元数据进 proseMaterials | 通过（本包无 proseMaterials） |
| 未生成 58 类 / NSFW 库际数值互斥表 | 通过（刻意不做） |

## 2. 未执行（有运行环境亦须单独挂载）

| 检查 | 状态 | 说明 |
|---|---|---|
| `npm run check:foundation` | **未对本包执行覆盖** | 该脚本只验随附 example，不扫描 docs/tag-hub 交付 |
| `loadPacks([...foundation, content-pack.v2.json])` | 未执行 | 交付后可由集成者挂载；本 bot 未改 content/index.json |
| `parseReference(reference-pack)` + 与 reference.json 合载 | 未执行 | 须与工程已有参考库组合 |
| WorldGenerator 种子 7 / 42 | 未执行 | 本包活动不保证被抽中；合法候选≠必选 |
| 机械手+有机尾 反例实跑 | 未执行 | 期望见 RULE-MATRIX A1；逻辑与 foundation 示例一致 |
| 599 / 600 mm 边界实跑 | 未执行 | 期望见 A2 |
| 存档往返 | 未执行 | 新规则只应影响按新规则创建的世界 |

**不得**用 example 的 check:foundation 通过数冒充本交付已通过。

## 3. 预期（供集成者复验）

1. 机械手 + 有机尾：`…mechanical-tail-by-material` **失败**。
2. 同机械尾：机械尾选择通过；长度未知时 long-tail **失败**；600 边界正确。
3. 仅挂 theme.gel、无 gel/organic 尾材料：任何 body when **不**因题材通过。
4. lit→dark：lit 选择失效，dark 选择生效；service 不变。
5. 两活动 templates 互斥：已选其一则另一不可同池并选（combination 反向排斥）。
6. 非法候选：无 workshop 服务时，即使 weight=1000 也不能进入工坊活动。

## 4. 待审核项

- manifest.status=`draft` → 需人工审包后才可谈 reviewed / 集成。
- commons / workshop 活动文案为中性示范，需世界观审阅是否入库参考库。
- 与 NSFW 词条库的编辑约定以摘要文档为准；本包**不**审定 b0001–b0016。

## 5. 失败 / 风险

| 风险 | 缓解 |
|---|---|
| 读者把 compatibleTags/requiresTags 里的 theme 当成身体条件 | 本包 requires **不含** theme；RULE-MATRIX 写明 |
| 读者以为本包实现了词条组合冲突检测 | FUTURE-REQUIREMENTS 明确未做 |
| 与 rulesdemo 示例同载 ID 冲突 | 使用独立 namespace `tagcoexist` |

## 6. 运行环境阻点（本机）

| 项 | 值 |
|---|---|
| 工程 engines.node | `>=24` |
| 本 box `node -v` | v20.19.2 |
| 影响 | `npm run check:foundation` / `loadPacks` 直接 import `.ts` 失败（ERR_UNKNOWN_FILE_EXTENSION） |
| 处理 | 静态检查已通过；引擎合载复验留给 Node≥24 环境的集成者 |

