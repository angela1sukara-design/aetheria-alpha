# R003 黑沼靴尖粘附 · 试玩 ContentPack

| 项 | 值 |
|---|---|
| namespace | `playtest-r003-mire` |
| 事件 | `playtest-r003-mire:event.trap`（N01–N05） |
| 街巷入口 | 「走近黑沼迷雾带（试玩）」 |
| rating | **general**（draft） |

**不进默认 `content/index.json`。** 仅通过试玩 index 或本目录 `pack.json` 手工合载。

## 如何试玩

1. 启动开发服：`npm run dev`
2. 浏览器打开根路径并带上查询参数：**`?playtest=r003-mire`**  
   例：`http://localhost:5173/?playtest=r003-mire`（端口以终端为准）
3. 完成角色创建 / 进入街巷后，在街巷行动列表找到 **「走近黑沼迷雾带（试玩）」**
4. 走完 N01–N05 后可再次触发（事件非 `active` 时）

全路径对照见同目录 [ROUTE-CHECK.md](./ROUTE-CHECK.md)。

## 合载说明

试玩 index：`content/index.playtest-r003-mire.json` = 默认冒险栈 + `./playtest-r003-mire/pack.json`。  
加载逻辑：`src/ui/main.ts` 在 `playtest=r003-mire` 时选用该 index。
