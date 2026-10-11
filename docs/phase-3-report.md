# Alpha 0.1 第三阶段交付报告

日期：2026-10-11。独立工程：`aetheria-alpha-0.1`，版本 `0.1.0-alpha.3`。

## 本轮目标与结果

已完成一位固定 NPC 的实际互动闭环：走到沙龙 → 等待人物日程 → 正式认识 → 多轮交谈/换话题/退出 → 接或拒绝委托 → 去集市真实核对 → 回来报告 → 一次性报酬与关系变化 → 保存/刷新/读取。前两阶段的日常玩法、身体图与自由/剧情TF保留。

本轮以已存在的薇尔维特（velvet，沙龙经营者）为角色基础。来源为Notion《架构修订v0.2》《Claude接续说明》及《重构版策划v3.0》10.1/10.3。没有新增核心人物姓名、出身、势力或世界历史。09:00–18:00在沙龙、18:00–19:00在集市、核对清单委托、对白及数值属于PROPOSED测试内容。年龄和具体身体构型未确定，保留未知。

## 架构变化

- `src/core/npc-types.ts`：NPC、资格词表、记忆定义与固定实例类型；具体角色留在内容包。
- `src/content/schema.ts / loader.ts / registry.ts`：能力声明、引用、人物身份键、完整且无重叠日程校验；只读人物索引与公开话题Hook。
- `src/engine/npc.ts`：纯日程位置查询、事件临时在场覆盖、一次性事实与关系结算。位置不从UI写入。
- `src/engine/conditions.ts / effects.ts / selectors.ts`：新增npc.present/memory/relation与npc.remember，仍由同一个ActionExecutor预检和原子提交；NPC不在场时话题不授权。
- `src/persistence/npc-validation.ts / codec.ts / stage2-packs.ts`：schema3、记忆来源事务与关系重建校验、两个官方旧版本精确升级。未知包和损坏数据仍隔离。
- `src/ui/npc-panel.ts`：人物入口、在场人物、已结识角色、熟悉/信任、带时间的事实记忆、日常行程；只读状态。
- `content/social/pack.json`：官方世界子包aetheria/social，添加第五地点沙龙、薇尔维特、25个实际动作、8节点普通交谈事件、7项记忆事实。前3包没有被修改，路线通过公开Hook追加。

协议详见 `docs/phase-3-protocol.md`。本轮仍保持候选协议，没有宣布M2冻结。

## 已完成的可复验行为

| 行为 | 实际结果 |
| --- | --- |
| 固定人物 | 同角色定义的实例ID不随seed改变；没有每天重抽姓名或经历 |
| 日程 | 开始分钟含、结束分钟不含；沙龙/集市/离场覆盖全天；跨午夜准确 |
| 正在交谈时到关店时间 | NPC暂留当前事件；结束后恢复真实日程，在集市还能遇见 |
| 多轮对话 | 问服务、接/拒绝委托、进度、报告、机械尾展示、近况；可换题或退出 |
| 关系与记忆 | 事实只写一次，重复问候/同话题不反复刷熟悉和信任 |
| 小委托 | 实际去集市核对耗15分钟/2精力；回报后一次8币和关系变化 |
| 不全知 | 集市核对先记录玩家事实；NPC只有亲自听报告/看机械尾后才有相应记忆 |
| 拒绝与回头 | 拒绝不扣款，记录事实，后来仍可再次接受 |
| 存读 | NPC身份、关系、来源记忆、事件节点、锁定文字、日程覆盖、RNG与TF一致 |
| 原子回滚 | 节点记忆/关系已经作用但后续付费失败时，全事务回滚 |
| 第三方话题扩展 | 独立作者只追加公开Hook；同组包不同加载顺序一致；无需人物专用UI/引擎分支 |

## 实际测试证据

环境：Node.js24.19.0、TypeScript5.9.3、Playwright1.62.1、Chromium153.0.8010.0。

| 验证 | 实际结果 | 完整证据 |
| --- | --- | --- |
| `npm run check` | exit0；严格类型检查、77项测试77通过/0失败/0跳过、构建通过 | artifacts/stage3-check-output.txt |
| 编译产物执行 | ESM引用、JSON包加载、日常/事件/BodyGraph/TF、NPC清单委托、schema3完整存读、Stage1/2升级通过 | 同上，Distribution check末段 |
| `node tests/browser.mjs` | exit0；35项真实浏览器检查通过，0未捕获错误、0失败网络请求 | artifacts/stage3-browser-output.txt、browser-results.json |
| 桌面/390px视觉检查 | 人物关系、长记忆与可展开日程可阅读，菜单/退出可操作，无横向溢出 | 本地QA截图已人工查看；交付不包含截图 |

浏览器验证使用独立测试环境的实际Chromium二进制，不使用mock DOM。运行时：

```sh
BROWSER_EXECUTABLE_PATH=/workspace/scratch/d2541eb6009f/browser-runtime/extracted/chromium \
BROWSER_ARGS_JSON='["--no-sandbox","--disable-dev-shm-usage","--disable-webgl"]' \
BROWSER_FONT_CSS=/workspace/scratch/d2541eb6009f/browser-runtime/font-css.txt \
node tests/browser.mjs
```

隔离Linux测试进程使用no-sandbox；网页同源/Web安全检查保持开启。测试字体只解决该Linux环境缺中文字体，未注入游戏包。用户正常Windows浏览器不需要这些环境变量。标准Playwright浏览器下载此前环境失败，替代二进制验证成功；不随游戏分发测试浏览器或字体。

77项核心测试含原56项回归与21项NPC集成/负例测试。35项浏览器检查含原24项回归与11项人物流程/Stage2启动升级检查。并已在最新构建上复验。

## 升级与存档

官方第一阶段、第二阶段的真实存档fixtures均已测试；Stage2 fixture包含猫耳、15分钟试装机械尾和暂停队列。升级不重新扣改造费、不重抽原事件、不改变旧账本；新人物初始尚未正式结识。浏览器启动读取Stage1/2的IndexedDB后，原手动槽字符串仍完全不变，用户手动保存才写schema3。

旧包内容哈希未改变：core/world/reshaping和Stage2指纹一致。新增包不是任意热安装；第三方旧包或未知变更不自动修补。不存在旧Gemini HTML Demo存档兼容。

Windows的 `start_game.bat` 本轮未在Windows执行；已验证其调用的本地服务器/构建产物在Linux浏览器实际运行。此前用户成功运行是第一阶段的Windows反馈，不冒充第三阶段Windows自动验证。

## 未完成与限制

1. NPC完整身体/装备、目标/秘密/个人攻略、随机路人及晋升尚未实现；人物目前一位、关系维度两项，记忆为登记的一次性里程碑。
2. 姿态/ContactGraph/InteractionScene、Slot/装备、战斗及失败恢复尚未实现。
3. 完整Storylet池、嵌套/暂停EventGraph、专门任务系统、通用包迁移/热安装尚未实现。小委托以记忆+玩家旗标组成，不能冒充完整任务引擎。
4. 薇尔维特精确年龄、构型和新增日程/小委托未定正史。成人内容事件尚不可加载；本轮只交普通交谈与委托。
5. 仍为单手动存档槽、4MiB上限，账本不截断。M1还有未完成项；M2/M3没有被宣布通过。

## 使用与本轮停止点

关闭旧服务器窗口，将更新包解压到新文件夹，双击start_game.bat。使用同一浏览器的 `http://localhost:4173/` 可读取旧槽；更换地址/浏览器则导出再导入JSON。完整源码、dist、内容包、tests、docs、实际日志和独立Git历史bundle随包提供。

本轮已在固定NPC闭环处停止。下轮建议二选一范围：中性交互场景与资源占用验证；或地区路人生成与持久化。未自动扩展这些玩法。
