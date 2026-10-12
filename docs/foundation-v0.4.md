# 底层增量 v0.4：版本与权威来源

实施基线：51404a5，188 项自动化测试通过。原工作树改动另存 artifacts/foundation-v04/preexisting.patch；不覆盖导航、整理脚本及原词库批次。

## 格式决定（实施阶段 1）

- ContentPack v1 保持严格字段验收；新增功能使用 manifest.schemaVersion=2 并声明 foundation.v2。两种格式共用 Loader、Registry、依赖及哈希设施。
- 增量包 aetheria/foundation@1.0.0 使用 namespace=foundation。审计拟定的 aetheria:* ID 改为 foundation:*，因为 aetheria 命名空间已由世界包独占。旧域 23 个生成值和 34 个故事主题精确映射，不跨域猜同义词；隐藏标记仅保留废弃别名，显示策略由 hidden 控制。
- 部件定义 defaults 或唯一 partProfile 提供默认值，实例仅保存 overrides；旧 organic/mechanical 保留，详细 materialId 不授予能力。仅尾部支持 lengthMm（1–5000 毫米），用于适配和文本阈值。未声明参数为未知。
- 新状态为存档 v4 / 0.2-foundation，增加 environment 覆盖、固定 NPC 身体及场景实体引用。旧 v3 仍按其严格规则读取；新增增量包时逐个核对旧包原版本和哈希，显式加入新包哈希后升级，绝不冒用旧哈希。
- 原 v1/v2 官方存档继续走原精确迁移。生成世界从自己的完整包快照恢复；不使用最新参考库重抽。
- 普通词库批次 v1 保留；新语义和分级扩展另行版本化，不能向 v1 偷加字段。

## 唯一权威

| 数据 | 保存位置 | 查询 |
|---|---|---|
| 玩家身体 | player.body | entityBody(player) |
| 固定 NPC 身体 | npcs[].body；由显式 npcBodies 声明初始化 | entityBody(npc ID) |
| 生成居民身体 | district.residents[].body | entityBody(resident ID) |
| 参数默认值 | 不可变内容定义 defaults 或唯一 partProfile | effectivePart |
| 参数变化 | 所属图的部件 overrides | effectivePart |
| 地点参数 | 不可变 locationProfile + environment 唯一状态覆盖 | environment |
| 派生 Tag | 不保存 | derivedSemantics → evaluate → 共享查询 |
| Tag 来源与反向引用 | Manifest / Registry 自动扫描 | tags / tagReferences |

查询不抽随机、不推进时间、不重选正文。缺身体或参数为未知；条件取反仍未知。场景只引用实体，旧场景副本不得成为固定 NPC 身体；没有显式声明时暂停并释放接触，保留事件和场景进度。不能迁移的文件由现有隔离流程保留原文及原因。

后续阶段的具体实现、验收、创作格式和边界在完成后补充。
