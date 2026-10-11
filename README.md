# 以太都市：深渊重塑 · Alpha 0.1 第三阶段

独立 TypeScript 工程的新阶段更新：增加薇尔维特沙龙、固定 NPC 日程、多轮交谈、关系与记忆，以及一件可完成的跨地点小委托。此前三个地点的日常行动、改造诊室、真实身体图与机械尾进度全部保留。旧 HTML Demo 只作设定参考，没有参与代码或存档。

## 直接启动

需要已安装 Node.js 24或更新版本。包内包含 `dist/`，试玩不需要 `npm install`。

1. 关闭上一版游戏的黑色服务器窗口。
2. 本包解压到新的文件夹。
3. Windows 双击 `start_game.bat`，服务成功启动后自动打开浏览器。

浏览器地址：`http://localhost:4173/`。保持服务器窗口开着。也可运行 `node scripts/serve.mjs --built`。端口被占用时先关闭旧版窗口；不能直接双击 `index.html` 用 file:// 加载游戏。

## 本轮试玩路线

1. 公寓 → 主街 → 薇尔维特沙龙。09:00前她还没到，可在门厅等候半小时；09:00–18:00在沙龙，18:00–19:00在集市。
2. 与薇尔维特打招呼，问沙龙服务，接着聊别的话题，或随时结束。人物菜单可看熟悉、信任与已经发生的经历。
3. 询问是否需要帮忙。答应去集市核对补货清单；也可拒绝，以后再来。
4. 回主街 → 集市，执行「替薇尔维特核对补货清单」。她此时还不知道结果。
5. 回沙龙找她继续交谈，交回结果，得到一次8币报酬与关系变化。之后可聊近况；相同委托不能再次领取。
6. 交谈中或完成后保存并刷新，检查节点、关系、记忆和日程恢复。机械尾校准完成后也可以主动展示给她看；她只记住亲眼看到的变化。

薇尔维特及沙龙经营者身份来自既有设定。日程、小委托、对白与所有新数值为 **PROPOSED试运行内容**。不是完整角色攻略线或已冻结正史。

## 存档

仍为一个手动存档槽。刷新恢复最近一次手动保存；未保存操作不会自动写入。JSON导入只恢复当前游戏，点击保存才覆盖手动槽。

同一浏览器、同一地址和端口下，可以读取前两阶段的IndexedDB。更换浏览器/地址时，先在旧版导出JSON，再在本版导入。请维持 `localhost:4173`；`127.0.0.1` 是另一个存档来源。

精确官方 Stage1/Stage2 存档会升级到schema3。Stage2已完成/暂停/阻塞中的身体与TF、金钱、事件、时间、RNG和账本保留；Stage1新增初始身体。两者新增默认人物记录。升级读取不会覆盖旧记录，点击保存后才写新版；新版不能返回旧版引擎。未知包、哈希变化、损坏旧档保留并隔离；尚无通用包迁移。

## 开发与验证

```sh
npm ci
npm run check
npx playwright install chromium
npm run test:browser
```

测试环境使用 Chromium 153.0.8010.0。脚本支持 `BROWSER_EXECUTABLE_PATH`、`BROWSER_ARGS_JSON` 和可选测试字体 `BROWSER_FONT_CSS`。交付不包含浏览器与测试字体，不增加游戏运行依赖。实际结果：77项规则测试与35项真实浏览器检查通过；详见 `docs/phase-3-report.md`，完整日志在 `artifacts/stage3-check-output.txt` 与 `stage3-browser-output.txt`；历史报告保留。

| 目录 | 职责 |
| --- | --- |
| src/core | DSL与BodyGraph/TF/NPC数据类型 |
| src/content | 只读Registry、依赖/引用/能力/日程校验 |
| src/engine | 唯一行动事务、时钟/RNG、身体/TF、NPC日程/记忆、事件与选择器 |
| src/persistence | schema3、官方旧档精确升级、状态/来源校验与IndexedDB |
| src/ui | 场景/地图/身体/人物/存档显示与intent入口 |
| content/core、world、reshaping | 前两阶段原包；内容与哈希保持 |
| content/social | 官方世界子包，公开Hook追加沙龙路线、NPC话题和小委托 |
| tests、docs | 自动化回归、真实浏览器流程、阶段协议与报告 |

本轮不实现随机路人、完整个人攻略、装备/Slot、InteractionScene、战斗、完整Storylet/EventGraph；不宣称M1/M2/M3全部完成。未覆盖或发布旧试玩站。Git历史随包保存在 `artifacts/repository.bundle`，可用 `git clone artifacts/repository.bundle <new-folder>` 恢复独立仓库。
