# Tag 组合与九类覆盖矩阵的制作源

本目录是规则和矩阵的可重建制作工具，不是游戏内容包，也不是九类玩法的新执行器。

当前版本 1.2：正文默认交有序 `proseTemplate`，完整 `prose` 只作普通回退。矩阵只引用 `assemblyRuleId`，禁止按 Tag 笛卡尔组合逐格写正文。人物/地名通过精确绑定快照的 displayRef 取值；[姓名与继承契约](../../docs/reference/names-and-inheritance.md) 区分已实装命名与待开发后代实体。详见 [槽位拼装规范](../../docs/reference/prose-slot-assembly-standard.md)。

- `spec.mjs`：九大类任务、完整共用规则、依赖顺序和接口缺口。
- `evaluate.mjs`：离线组合核查，保留未知值和对象边界。
- `assembly-rules.json`：独立拼装规则；冻结八类槽及选择预算。
- `assembly.mjs`：离线入槽、互斥、有界回溯、定词挂前、T32/T34 与完整回退。
- `assembly-example.json`：完整中性八槽示例和演示快照，不是生产审定词库。
- `coverage-cells.mjs`：按实际来源/规则职责覆盖，不展开笛卡尔写作格。
- `../../scripts/build-tag-matrices.mjs`：从当前内容重新统计、按类展开并生成独立协作文件。
- `../../scripts/check-tag-matrices.mjs`：检查全部源项覆盖、矩阵维度、规则、包内全文和指纹。
- `../../tests/tag-matrices.test.mjs`：组合正反例、与实际服务实现对照、九类交付验收。

重建：`node scripts/build-tag-matrices.mjs`；验收：`node --test tests/tag-matrices.test.mjs tests/prose-assembly.test.mjs` 和 `node scripts/check-tag-matrices.mjs`。

输出在 `deliverables/tag-matrices/`，压缩包在 `deliverables/Tag组合规则与九类矩阵-槽位版-2026-10-15.zip`。规则变更先改制作源再重建。不要手工改生成矩阵后忘记更新制作源。游戏尚未接入槽位格式；0.11.0 另行实装了居民结构化姓名。Tag 素材与缺接口项目都保留账目，不把它们宣称为已实装。交付后可删除与已验证 ZIP 重复的展开目录，需再次检查时先重建；`npm run test:tag-matrices` 会先自动重建。
