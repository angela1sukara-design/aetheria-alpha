# 基础词条生产工具包 v0.2

基于Alpha 0.2最新源码的独立素材生产工作区。包含58类、首期10700条的计划与58份正确格式示例。数量均为生产目标，尚未量产正文。实际库存见management/index.json。

## 一次委派完成大部分或全部素材

直接把本资料压缩包交给其他AI，让它执行“prompts/整包-全部词库.md”。一个AI可连续完成全部10700条；也可让少数AI各负责NPC、身体与外观、世界与环境、行为与日常、文字素材中的一个大类。每大类有独立整包总指令。你不需要逐50条派任务或确认继续。

内部仍用214个批号记录ID与来源，由写作AI自行管理；最后一次交回lexicon-delivery.json和生产报告，可打成一个压缩包。详见交给AI快速开始.md和07-整包生产与接收.md。旧的试产/分批指南保留为可选制作方式，不限制整包委派。

先读01-分类目录.md了解范围；02-格式与示例.md说明简单格式；04-存储与游戏边界.md区分收录和实装；05-现有素材盘点.md列出现有工程统计。

## 本地工具

- npm run lexicon -- assign-scope all ai-main
- npm run lexicon -- validate-delivery 整包交付.json
- npm run lexicon -- import-delivery 整包交付.json
- npm run lexicon -- index
- npm run lexicon -- review 审稿文件.json
- npm run lexicon -- export 新输出文件.json

原assign、validate、import等单批工具继续可用。收录不是审定，也不等于实装。

运行npm run lexicon:prepare可重建静态任务和盘点，不覆盖已收录与审稿数据。运行npm run test:lexicon验证工具本身。验收记录见ACCEPTANCE.md与WHOLE-PACK-ACCEPTANCE.md。
