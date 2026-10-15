# Tag 组合与九类覆盖矩阵的制作源

本目录是规则和矩阵的可重建制作工具，不是游戏内容包，也不是九类玩法的新执行器。

- `spec.mjs`：九大类任务、完整共用规则、依赖顺序和接口缺口。
- `evaluate.mjs`：离线组合核查，保留未知值和对象边界。
- `../../scripts/build-tag-matrices.mjs`：从当前内容重新统计、按类展开并生成独立协作文件。
- `../../scripts/check-tag-matrices.mjs`：检查全部源项覆盖、矩阵维度、规则、包内全文和指纹。
- `../../tests/tag-matrices.test.mjs`：组合正反例、与实际服务实现对照、九类交付验收。

重建：`node scripts/build-tag-matrices.mjs`；验收：`node --test tests/tag-matrices.test.mjs` 和 `node scripts/check-tag-matrices.mjs`。

输出在 `deliverables/tag-matrices/`，压缩包在 `deliverables/Tag组合规则与九类矩阵-2026-10-15.zip`。规则变更先改制作源再重建。不要手工改生成矩阵后忘记更新制作源。运行内容保持不变；Tag 素材与缺接口项目都保留账目，不把它们宣称为已实装。
