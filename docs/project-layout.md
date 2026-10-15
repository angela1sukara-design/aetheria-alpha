# 工程目录与归档约定

当前工程只有本目录这一份，开发统一使用main；已并入主线的旧分支无需长期保留。

游戏源码、正式内容、审定来源、构建脚本、测试夹具及仍被工具读取的制作源留在仓库。现行说明集中在docs/reference，由docs/README.md导航。

dist、node_modules、artifacts、deliverables以及examples中的生成HTML和截图不上传。试玩由脚本重建，生成结果不作为另一份源码维护。

历史阶段文档、设计原稿、重复外发包和旧产物放在工程外的../aetheria-history。本次归档为2026-10-16/project-cleanup，附逐文件校验清单。当前可玩的A/B示例留在本机examples中，便于继续使用已打开的试玩页。

production和docs/tag-hub中的部分资料仍参与构建或测试，应继续保留。测试依赖Git内源文件或明确生成步骤，不依赖某台电脑的交付目录。
