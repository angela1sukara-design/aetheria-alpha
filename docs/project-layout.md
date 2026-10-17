# 工程目录与归档约定

当前工程只有本目录这一份，开发统一使用main；已并入主线的旧分支无需长期保留。

游戏源码、正式内容、审定来源、构建脚本、测试夹具及仍被工具读取的制作源留在仓库。现行说明集中在docs/reference，由docs/README.md导航。

dist、node_modules、artifacts、deliverables以及examples中的生成HTML和截图不上传。试玩由脚本重建，生成结果不作为另一份源码维护。

历史阶段文档、设计原稿、重复外发包和旧产物放在工程外的../aetheria-history。2026-10-16/project-cleanup保留前次归档；2026-10-17/workspace-outputs保留本次旧测试产物和专项试玩页，附逐文件SHA-256清单。examples只保留制作说明，试玩页按需重建。

正式入口统一为根目录“启动游戏-双击直接运行.html”，start_game.bat打开同一文件。根目录index.html为构建模板，dist是生成目录；npm run dev仅用于开发。默认构建生成正式游戏，种子示例改为npm run examples:worldgen按需生成。

production和docs/tag-hub中的部分资料仍参与构建或测试，应继续保留。测试依赖Git内源文件或明确生成步骤，不依赖某台电脑的交付目录。
