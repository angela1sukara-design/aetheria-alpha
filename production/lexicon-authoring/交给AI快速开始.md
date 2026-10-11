# 直接派发给其他 AI

作者只需要一个批次任务全文，不需要游戏源码，也不需要设计规则。

1. 在工程中登记批次领取，例如 `npm run lexicon -- assign npc-trait.b0001 claude-a`。
2. 打开生成的 `outbox/npc-trait.b0001.md`，把全文发给写作 AI。指令已经填好这次的批号、条数和来源名称。
3. 把返回内容保存成 `inbox/npc-trait.b0001.json`，交给整理者校验、查重、收录和审稿。

没有运行管理工具时，也可以先打开 `tasks/npc-trait/b0001.md`，另行告诉 AI：“本次 producer 填 claude-a。”然后用一张领取表登记批号，避免重复派发；正式收录前仍需在工程中补登记。

建议先试产以下十个首批任务，各50条，共500条：

- `tasks/npc-name/b0001.md`：姓名。
- `tasks/npc-trait/b0001.md`：性格。
- `tasks/npc-job/b0001.md`：职业。
- `tasks/body-clothing/b0001.md`：服装。
- `tasks/world-detail/b0001.md`：环境细节。
- `tasks/world-weather/b0001.md`：天气氛围。
- `tasks/daily-work/b0001.md`：工作动作。
- `tasks/text-opening/b0001.md`：对话开场。
- `tasks/text-reply/b0001.md`：回应。
- `tasks/text-tf-adapt/b0001.md`：TF后适应描写。

可以把十批分给十个工作单元，也可以分几轮完成。任何模型都遵循同一份任务格式；每个单元使用不同的 producer 名称。

后续给同一分类继续生产前，运行 `npm run lexicon -- context npc-trait`，将生成的已收录摘要附在下一任务后。先统一文风、具体程度和重复判定，再扩大量产。

作者压缩包只有任务、示例、分类与统计，不含游戏剧情源码。命令需要在原工程根目录运行；这个资料包不是游戏安装包，也不是独立管理程序。完整工具源码在原工程的 `scripts/lexicon/`。

不要直接把基础词条JSON导入游戏“文本扩展包”入口。收录、审定和接入游戏是三个不同步骤。
