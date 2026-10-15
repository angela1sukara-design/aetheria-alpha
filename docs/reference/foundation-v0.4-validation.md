# 底层增量 v0.4 验证记录

日期：2026-10-12。起点 51404a5；工作分支 codex/foundation-v0.4。审计前已有 188 项测试通过。第一阶段检查点 5b7e742：版本化定义、共享身体查询、NPC 目标 TF 和初始迁移。

## 实际执行

| 检查 | 结果 |
|---|---|
| npm run typecheck | 通过 |
| npm test（全套） | 204 / 204，通过；无跳过、无 TODO |
| tests/foundation.test.ts（包含在全套中） | 16 / 16，通过 |
| npm run build | 通过，固定测试世界与种子 7/42 的独立离线 HTML 已生成 |
| scripts/check-dist.mjs | 通过，真实行动、TF、NPC、v4 往返、官方 v1/v2/v3 精确迁移 |
| npm run check:foundation | 61 个 Tag、57 个作用域别名、2 个素材格式示例、1 个完整内容包示例、2 个参考库，通过 |
| tests/browser.mjs | 43 / 43，通过 |
| tests/alpha02-browser.mjs | 15 / 15，通过 |
| tests/worldgen-browser.mjs | 10 / 10，通过 |
| tests/ui-pages-browser.mjs | 11 / 11，通过 |
| tests/ux-browser.mjs | 8 / 8，通过 |
| tests/foundation-browser.mjs | 3 / 3，通过 |

浏览器共 90 项检查。使用已构建版本和本机 Edge；三项新增检查直接打开种子 7 HTML，拦截所有 HTTP 请求并确认没有外部请求及页面异常。实际操作了生物尾、650 毫米属性 TF、灯光开关、活动失效、JSON 导出、保存刷新与 390px 页面。界面变更后复跑 Alpha 0.2 与页面回归；旧版浏览器与 UX 回归在同轮实施中执行。

日志保存在 artifacts/foundation-v04/check-final.txt、browser-*.txt；新增浏览器截图、导出状态和结果在 artifacts/foundation-v04/browser/。构建输出和运行日志按工程既有规则忽略，不把它们冒充源码提交。

## 关键自动化证据

1. 机械手与有机尾不会满足机械尾；材料不授予能力。未知身体、参数缺省、实例覆盖与 NOT 未知正确；重复查询不改时间、随机流和历史文本。
2. NPC TF 只修改指定 NPC。重复请求幂等；在实际改变身体并抽取事件后，后续失败仍回滚整个事务及随机流。阶段 TF 遇真实接触阻塞，保存恢复、释放、继续、暂停和取消保留原阶段。
3. 生成居民 TF 使用同一执行器和持久身体；玩家图保持不变。无手足居民通过显式听觉职业与辅助移动适配生成；改为不符合的抓握规则时明确失败，存档使用相同规则。
4. 尾部尺寸改变筛选正文，装备尺寸要求失效后卸下且保留物品。无效长度、伪造来源、非法材料/形态或范围被拒绝。
5. v1 不接受 v2 字段；未知 Tag、别名歧义、替代环、直接矛盾和不可达依赖被拒绝。错误 service 语义、生态来源及封装版本不一致被隔离。
6. 旧 v3 加载增量包保留身体、账本、时钟、随机流、事件、记忆和阶段；旧包原版本与哈希保持。旧场景身体副本不成为永久 NPC 权威，未知身体暂停并保留历史。历史生成快照与新 v4 快照均有恢复回归。
7. 旧普通词库流程继续通过。108 条原审定素材仍产生 882 处文本适配；没有批量重写 10,700 条收录素材。v2 普通/专用元数据验收成功，旧 parser 明确拒绝 v2，夹带规则和未知 Tag 被拒绝。
8. 成年资格使用统一下限；种族门槛为 1 岁也不能让 17 岁通过，年龄未知不通过。

## 实际交付与边界

运行版本位于 dist/Aetheria-Alpha-0.2.html、dist/WorldGenerator-Seed-7.html、dist/WorldGenerator-Seed-42.html。生成种子仍记录规则、参考包及内容包的版本/哈希；当前世界来自快照，加载不重抽。

格式与迁移详见 foundation-v0.4.md、foundation-tag-mapping.md 和 production/lexicon-authoring/formats/v2/README.md。尚未实现的范围在 foundation-v0.4.md 逐项列出，尤其是完整社会/环境模拟、NPC 装备栏、材料能力修正、任意器官参数、派生链和外部 NSFW 旧格式自动导入。

原有未提交的导航、目录整理、启动脚本和审计资料保留在工作区；本轮只提交底层实现、正式示例、相关测试和交付说明。
