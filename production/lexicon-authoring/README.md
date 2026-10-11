# 基础词条生产工具包 v0.1

基于Alpha 0.2最新源码的独立素材生产工作区。包含58类、首期10700条/214批的计划、每分类与每批次可直接派发的AI指令，以及58份正确格式示例。这里没有批量生成正文，数量均是目标。当前正式收录0条、游戏使用0条（后续实际数据以management/index.json为准）。

## 直接交给其他AI

从tasks/挑一个未领取的任务，先登记领取，再把对应.md全文发给GPT、Claude、Gemini或其他写作AI。任务已写明类别、子类、数量、主题、多样性、格式与自查；无需让AI读引擎源码或设计规则。详见03-批次与多AI流程.md。

先读01-分类目录.md了解范围；02-格式与示例.md说明简单格式；04-存储与游戏边界.md区分收录和实装；05-现有素材盘点.md列出现有工程统计。

## 本地工具

- npm run lexicon -- index
- npm run lexicon -- assign npc-trait.b0001 claude-a
- npm run lexicon -- validate 交付文件.json
- npm run lexicon -- import 交付文件.json
- npm run lexicon -- review 审稿文件.json
- npm run lexicon -- export 新输出文件.json
- npm run lexicon -- extend npc-trait gemini-b '补充主题'
- npm run lexicon -- duplicates
- npm run lexicon -- inventory

validate不等于审定，import不等于实装。任务可以任意分配给模型，题材分工与批次编号相互独立。长JSON若模型难以一次完整输出，先由整理者将任务改分小批并同步登记数量，不允许随意截断、拼接或借号。当前标准工具默认50条；首期任务没有自动拆批命令。

运行npm run lexicon:prepare可重建静态任务和盘点，不覆盖已收录与审稿数据。运行npm run test:lexicon验证工具本身。完整工程交付验收另见ACCEPTANCE.md。
