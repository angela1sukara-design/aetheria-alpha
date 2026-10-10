# 以太都市：深渊重塑 · Alpha 0.1

这是按 Notion 架构修订 v0.2 创建的独立 TypeScript 工程。旧 HTML Demo 不参与构建，不兼容其存档。只完成本轮第一阶段的基础切片。

## 运行

需要 Node.js 24 或更新版本。交付包带有 `dist/`，试玩不必先安装依赖：

```sh
node scripts/serve.mjs --built
```

然后在浏览器打开 `http://localhost:4173/`。Windows 可以双击 `start_game.bat`。不能通过双击 `index.html` 使用 `file://` 运行，因为浏览器需要加载 ESM 和独立 JSON 内容包。

开发和验证：

```sh
npm ci
npm run check
npm run dev
```

浏览器回归（本轮环境中未成功执行，不算通过）：

```sh
npx playwright install chromium
npm run test:browser
```

已有服务器时设置 `BROWSER_TEST_URL` 即可避免测试脚本再启动服务器。Playwright 报告与截图写入 `artifacts/`，失败退出码为 1。

## 试玩路线

1. 公寓 → 主街 → 集市。
2. 整理货箱，查看报酬、精力和时间变化；买热食。
3. 返回主街，查看告示；进入小事件后打开存档菜单保存。
4. 选择帮忙或离开；读取存档应恢复事件中途的原文字与原时间。
5. 通过地图回公寓休息，导出 JSON 并尝试导入。

只有一个手动存档槽。刷新会恢复最后一次手动存档；未保存的行动不会自动保存。JSON 导入先替换当前游戏，点击保存才覆盖手动槽。存档检查失败时保留现有游戏及存储记录，不静默修补。

## 文件边界

| 目录 | 职责 |
| --- | --- |
| `src/core` | 数据协议、错误、复制与冻结；不含具体地点/NPC |
| `src/content` | 最小运行时校验、依赖排序、引用与只读 Registry |
| `src/engine` | Condition、Effect、ActionExecutor、时间、RNG、事件和只读选择器 |
| `src/persistence` | 存档结构/校验和、缺包隔离、IndexedDB 和 JSON 编解码 |
| `src/ui` | 游戏界面渲染、输入意图、存档操作；不直接修改 GameState |
| `content/core` | 公共变量定义；没有世界人物 |
| `content/world` | 公寓、主街、集市、路线、文字、行动和小事件 |
| `tests` | 自动化规则、存档测试与浏览器回归脚本 |
| `docs` | 本轮协议、文档冲突检查、扩展约束、阶段报告 |

从 `content/index.json` 加载 JSON 包。第三方包只能定义自己的命名空间，通过已公开 action Hook 追加内容。测试中的 `test-author` 是隔离 fixture，不安装到正式游戏，不新增正史人物。

## 第一阶段实际状态

- Registry、声明式 Condition/Effect、统一动作事务、时间/RNG、三个地点和基础 UI 已实现。
- 单节点选择 → 分支结束的最小事件已实现；复杂 EventGraph、Storylet、事件嵌套及各类跳过规则未实现。
- BodyGraph、TF、NPC、InteractionScene、战斗仅在 `module-boundaries.ts` 留出分离的数据边界；没有完整实现，没有对应假按钮。
- 全部新数值、位置坐标和街头小事件是 **PROPOSED 试运行内容**，不自动成为最终策划正史。
- TypeScript、32 项规则与存档自动测试、构建通过。真实浏览器操作、IndexedDB 浏览器验收和画面检查受环境阻塞，第一阶段验收门槛尚未全部通过。

具体证据与限制见 `docs/phase-1-report.md`。没有自动进入后续阶段，没有发布或覆盖旧试玩站。
