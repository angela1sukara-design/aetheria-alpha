# 以太都市：深渊重塑

当前游戏工程。后续开发统一使用main。

## 游玩与构建

本机双击根目录“启动游戏-双击直接运行.html”。从仓库首次下载后，需要Node.js 24或以上：

```sh
npm ci
npm run build
```

正式游玩统一双击根目录“启动游戏-双击直接运行.html”；start_game.bat也打开同一文件。开发时使用npm run dev。

根目录index.html是构建模板；dist是运行产物，examples是按需生成的专项试玩。它们不作为另外几版游戏使用。默认构建不再生成种子试玩，确有需要时执行npm run examples:worldgen。

## 当前内容

游戏包含固定都市、随机世界、人物交谈、工作与交易、战斗、身体变化及存档。

- B系列945条背景素材已接入“观察周围的细节”。
- A系列54条模板已接入“细看周边环境”“观察在场人物”“查看身体细节”，使用真实状态拼装并保存正文。
- NPC服务与地点设施筛选、性格交谈、结构化姓名已接入。
- 旧存档保留原世界快照；新增入口需要新建世界。

## 开发入口

- [安装规范](docs/reference/ai-install-spec.md)：所有模型共用的交付与装入口径。
- [AGENTS.md](AGENTS.md)：能读仓库时的目录白名单与验证命令。
- src、content：游戏源码、内容及需要保存的审定来源。
- scripts、tests：构建、制作工具和验证。
- production：构建或验证仍需使用的制作源；保留不代表所有素材都已实装。
- [现行文档索引](docs/README.md)：接口、制作规范与已实现范围。
- [可玩示例的重建方式](examples/README.md)。

验证：npm run typecheck、npm test、npm run test:a-content、npm run test:b-content。浏览器检查见package.json对应命令。

构建、依赖、试玩HTML、截图、外发包和验证日志不上传。历史文档与旧产物收在工程旁的../aetheria-history，详见[目录与归档约定](docs/project-layout.md)。2026-10-17已将旧测试产物和专项试玩页移出工程，备份保留原文件及SHA-256清单。
