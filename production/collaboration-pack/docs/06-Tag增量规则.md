# Tag增量规则 v1.3

08是发包时从工程实际定义导出的完整canonical注册快照，含全部命名空间、别名/替代信息、active状态、定义、所属包/依赖、文件指纹及用途说明。05只是写手按池选词的参考子集，不是全库查重基准。数量随实际工程变动，以08为准，不硬记2030或其他旧数字。

Tag仅证明登记身份，不保证现场有物件、某人有部件/姿态/能力或某事件发生。general-taxonomy编辑检索概念与worlds世界题材快照分账。新增Tag不会自动新增BodyGraph字段、天气模拟、职业服务或事实查询。

## 提案格式

使用schemas/proposal.schema.json。共同字段：mode、proposedId、label、dimension、definition、closestExisting、whyNotExisting。proposedId是建议名，不是已注册引用；词条不得抢先把它放进tagIds。

- attached：只写neededByLexemes，至少3条本批真实存在的词条ID；不写neededByPools/themes。
- advance：只写neededByPools及themes，至少一个合法池、至少两个02题材；不写neededByLexemes。

closestExisting必须是08的canonical ID或明确none；说明不同概念层/语义，不能只因前缀不同就重复创建。同义候选需结合别名和定义人工核查；机器只能查ID/引用，不能证明语义不重复。备注写批次说明，不塞进运行词条notes。

先行示例：{"mode":"advance","proposedId":"general-taxonomy:appearance.weariness","label":"疲惫神态","dimension":"actor.form","definition":"可见的眼下阴影或动作迟缓等当下疲惫表现；不凭外貌推断内在意愿","neededByPools":["actor.form"],"themes":["modern","cyberpunk"],"closestExisting":"general-taxonomy:v2.emotion.weariness","whyNotExisting":"既有词是内在情绪概念，拟议项限定观察者可核实的外在表现；还需整合方核查其他近义项"}。

## 命名与审批

开放建议前缀仅general-taxonomy下的appearance、sound、weather、material、part、color、shape、surface、common.object/env/action/job/tool/facility、expanded.scent。setting/place、foundation及新顶级命名空间不由外部作者扩充。小写、点分层级、连字符分词；提案不自动建立包依赖或授予能力。

每审批批最多40项。分别按mode检查需求；统一查canonical/别名/替代与全命名空间近义定义，人工审粒度及可判性。批准、合并、拒绝均记录理由，未决稿保留proposed，不能偷偷入库。T1可以交40–55条建议，但超过40项的批准拆为多个批次；数量上限不是强制增加无用Tag。

批准注册时同步：真实目标包的Tag定义、消费依赖、版本/指纹、05/08参考、业务与文案覆盖、最小引用/未知/停用测试。只往tags数组追加而不完成这些动作不算注册完毕。

## 互斥与矩阵

词条exclusive使用数组，例如[{"group":"temperature","value":"warm"}]。同主体同实例同组异值互斥，跨实例不互斥；excludes是双向生效的成对ID列表。它们不替代真实事实前置或系统的绑定/退出/分级约束。

既有九类矩阵由脚本生成实际来源/规则职责/任务阶段/缺口覆盖，不是作者手写9562格，也不是槽位词量报告。后者按入库词条聚合为另一个自动视图。规则保留完整语义，不为凑“≤30条”删除既有约束；新稿引用独立assemblyRuleId，拼装规则在独立assembly-rules.json中，不在矩阵格里复制正文。
