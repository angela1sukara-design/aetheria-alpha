> 历史报告：以下为第一阶段当次交付记录。2026-10-11 用户反馈 Windows 浏览器试玩正常并授权继续；第二阶段的新增实现与浏览器结果另见 `phase-2-report.md`。

# Alpha 0.1 第一阶段交付报告

**结论：第一阶段实现与非浏览器检查完成；真实浏览器验收未完成，阶段 Gate 尚未全部通过。没有进入下一阶段。**

## 本轮目标

新建独立 TypeScript 游戏工程，完成内容包→注册表→动作事务→时间/状态→存读档→基础游戏 UI 的最小可运行链路。按最新指令只包含公寓、主街、集市，不继承旧 Demo 代码或存档。

## 已完成

| 能力 | 文件 | 实际行为/证据 |
| --- | --- | --- |
| 最小 Registry/加载 | `src/content/schema.ts`, `loader.ts`, `registry.ts` | JSON 校验、依赖拓扑、明确 opcode、引用类型/命名空间、稳定索引和 SHA-256；两个基础包及第三方 Hook 测试通过。 |
| 统一条件/效果/事务 | `src/engine/conditions.ts`, `effects.ts`, `executor.ts` | 只有 executor 提交玩法状态；条件纯读取；requestId 重放、revision 拒绝、草稿失败全回滚测试通过。 |
| GameState/时间/RNG | `state.ts`, `clock.ts`, `rng.ts` | 累计分钟、逐个午夜边界、事件独立随机流、稳定抽样和深冻结快照。 |
| 最小事件 | `events.ts`, `content/world/pack.json` | 一件街头小事，两种初始文字、两个选择及两个真实结束节点；接受/离开后果不同，出口不锁死。 |
| 三地点与行动 | `content/world/pack.json` | 公寓⇄主街⇄集市，休息、等待、整理货箱、买热食、调查告示；8:00 开始，完整循环到10:25，金钱60→64，精力70→100。 |
| 存档 | `src/persistence/codec.ts`, `store.ts` | checksum/状态/事件/RNG/包检查、单槽 IndexedDB 原子写、JSON 导入导出；codec 与 MemoryStore 测试通过。真实浏览器 IndexedDB 操作仍未验证。 |
| 游戏基础 UI | `src/ui/*`, `index.html` | 中央正文与行动，顶部地点/时间，侧边状态与周边路线，地图/存档/记录弹层。移动端 CSS 已写，未声称截图验收通过。 |
| 后续边界 | `src/engine/module-boundaries.ts` | BodyGraph、LocalSlot、InteractionScene/Contact、TF、NPC、Combat 的最小独立类型；没有实现其规则，也没有生成假按钮。 |
| 独立项目与交付 | 新目录、独立 Git、`dist/`、启动脚本 | 旧 Demo 未修改；交付包含源代码、JSON、构建产物、测试与报告。没有新增/更新旧试玩站。 |

## 实际测试

环境：Node v24.19.0，npm 11.9.0，Git 2.51.1；TypeScript 5.9.3，Playwright 1.62.1（锁文件已保存）。

```sh
npm run check
```

实际 exit code **0**。完整原始输出见 `artifacts/check-output.txt`，机器摘要见 `artifacts/verification.json`。

- `tsc --noEmit`：通过，0 个类型错误。
- `node --test tests/*.test.ts`：**32 tests，32 pass，0 fail，0 skipped**。
- `node scripts/build.mjs`：通过，生成 ESM、独立 JSON 与 CSS。
- `node scripts/check-dist.mjs`：通过。实际导入编译后的 JS，执行移动/事件/工作及存档往返，并检查模块引用路径；这是构建产物运行检查，不是浏览器检查。
- `node --check tests/browser.mjs`：通过。只证明浏览器脚本语法合法，不证明测试已执行。

规则测试覆盖：完整日常循环、同 ID 重放、ID 冒用拒绝、过期 revision、越权动作/参数、纯读取与深冻结、条件不足、效果中途全回滚、两种事件结果、多个午夜、零精力回家恢复、时间窗口、独立 RNG、包加载顺序、第三方 Hook、未知操作符/依赖/引用/出口负例、JSON 与存档恢复、事件 RNG 稳定、读档后重复奖励拒绝、损坏存档、缺包/hash 变化隔离、未知字段和错误类型引用、事件栈/随机记录/账本校验、存储失败反馈。

## 浏览器验证：未完成

实际尝试及结果：

1. Chromium 安装：下载得到无效/截断压缩包，安装失败。
2. 预览服务曾成功启动；云端标签创建超时，恢复后只得到空白标签。
3. 导航到预览地址返回 `ERR_CONNECTION_REFUSED`；检查发现预览服务已停止，重新启动后服务返回运行状态。
4. 浏览器重新载入被安全策略拒绝，理由为当前 URL 协议不允许；停止该浏览器路径，不通过其他浏览器命令绕过。

**实际通过浏览器检查数：0。没有游戏页面截图，没有验证 IndexedDB 在真实浏览器中的保存/恢复，没有验证窄屏画面。** 此项不是软件测试通过，不把浏览器脚本数量计入已通过测试。

已附 `tests/browser.mjs`，在可用的开发环境执行：

```sh
npm ci
npx playwright install chromium
npm run test:browser
```

脚本预定检验：加载、菜单纯读取、三地点移动、工作与热食、事件中途 IndexedDB 保存/刷新、领取与退出、读档不重抽、JSON 下载/导入、390px 无横向溢出、运行时错误与失败请求。成功会保存实际截图与 JSON 结果；当前这些结果不存在。

## 未完成与限制

1. **P1：真实浏览器与视觉验收未完成，因此第一阶段尚未完整通过。** 不扩展后续玩法，先完成这一项。
2. BodyGraph/TF/NPC/姿态/战斗的完整系统、人物创建、自由塑形与剧情变化均未实现。
3. 最小事件不是完整 EventGraph/Storylet：没有嵌套、延迟任务、暂停子事件、复杂演出或四种跳过机制。
4. 最小 pack-lint 只校验本切片；不具备身体、年龄/人物、接触资源、战斗等高级内容验收能力；相应内容不可导入。
5. 无包迁移；内容包新增、删除或 hash 变化时会隔离现有存档。未声称能无缝安装扩展到已有存档。
6. 存档是单槽手动保存，上限4 MiB；没有跨标签页状态协调、云同步、自动保存或账本压缩。
7. 数值、地图坐标、氛围文字和新小事件为 **PROPOSED**。未增加核心 NPC 或改变已确认世界来源。
8. 构建使用 Node 24 自带类型移除 API，会有实验性提示；构建前已用 TypeScript 进行严格检查。打包结果是模块目录，需要本地 HTTP 服务，不是双击即玩的单文件 HTML。

## 需要用户确认

当前第一阶段技术实现没有新的产品问题需要立即确认。不会要求先确定自由 TF 开放度、姿态粒度或新 NPC 正史才能完成本阶段。

## 停止点

本轮到此停止。下一次应只补真实浏览器 Gate；通过后，再由用户决定后续系统的范围。
