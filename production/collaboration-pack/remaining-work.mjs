// Task definitions only. Generated hand-off files live under ignored deliverables/.
export const themes = [
 ['steampunk','蒸汽都市'],['space-station','轨道空间站'],['desert','沙漠世界'],
 ['floating','浮空世界'],['volcanic','火山世界'],['underground','地下矿城'],
 ['polar','极地世界'],['jungle','雨林世界'],['underwater','深海世界'],
 ['harbor','自由港世界'],['dungeon','地下城世界'],['western','西部边境'],
];

export const common = `你收到的是当前工程的独立协作任务，不是批准直接覆盖主项目。先阅读任务，解压随附源码，再读 AGENTS.md 和本任务白名单；仅检查相关文件与必要依赖。历史 development-plan.md 不是现行接口权威，冲突以本任务、AGENTS.md、当前源码及实际测试为准。

已完成：A1/A2/A3 共54条普通观察模板，三个实际观察入口；B 共945条素材，其中新675条按审定配方生成景物；首批 services/设施门控；六类性格的统一交谈；17题材主支线骨架及NPC记忆。不要把这些重新作为待开发功能。文案A/B编号与工程模块A/B不是同一体系。

工程约束：状态只经 ActionExecutor.performAction 事务提交；选择器、条件、UI不能改权威状态或消耗游戏RNG。未知事实不得由文案创造；人物、部件、物件严格绑定真实实例，名字读取实际保存值。新字段同步类型、加载Schema、初始化/执行、存档校验。services与设施决定功能，不使用职业名或functional默认开放。生成脚本及导出数据一起交付，不手改生成大文件。新世界使用新版本；旧档保留快照，不放宽所有哈希、不静默重生成。

本包新增写作限定general，完整游玩不依赖成人偏好；保留既有资格校验及普通回退。所有选择节点有真实可执行、无条件、无成本的退出。失败动作完整回滚，重复requestId不能重复扣费发奖。不能删断言、修改旧fixture或宣称未运行的测试已通过。

代码交付：基于BASELINE.json中的commit给出UTF-8 unified diff（建议git diff --binary），新增文件、修改理由、实际执行命令/结果、未完成项和接口变化表。无.git附件可临时git init并提交原始源码后再改；不要交整文件覆盖。不得包含node_modules、dist、旧报告或个人凭据。没有执行环境就明确写“未运行”，不能靠解释冒充实装。`;

export const tasks = [
 {id:'ENG-PROSE', folder:'01-A接入正常玩法', module:'正文工程 N（非原区域模块A）', title:'让A模板参与真实对话、工作、普通战后和身体变化反馈',
  files:['src/core/prose-types.ts','src/core/adventure-types.ts','src/engine/a-prose.ts','src/engine/narrative.ts','src/engine/personality.ts','src/engine/entity-functions.ts','src/engine/district.ts','src/engine/district-effects.ts','src/engine/transformations.ts','src/content/prose-schema.ts','src/content/adventure-schema.ts','src/persistence/prose-validation.ts','src/persistence/adventure-validation.ts','src/world/a-templates.ts','scripts/build-a-templates.mjs','production/tag-matrices/assembly.mjs','docs/reference/a-template-installation-2026-10-15.md','tests/a-templates.test.ts','tests/prose-assembly.test.mjs'],
  needs:`当前54条编辑稿均是观察正文，不能因为旧ID含工作/战斗就把它们当成结算模板。先列四类真实业务触发点及可查询事实，再实现展示适配；现有三个入口保留。
1. 普通交谈：绑定本次真实在场居民、实际选项与已经提交的反应，不凭文案改变信任或插入未发生动作。不得抢占D已有的性格分支。
2. NPC工作：绑定实际提供work服务的居民、设施、此次成功或失败结果；报酬和耗时必须读取本次事务，文案不再次执行工作。不支持服务时完全不显示入口。
3. 普通战后：绑定此次实际敌方运行快照、胜/败/逃离结果、已经结算的奖励或损失，不借当前场所其他NPC作对手。仅general，保留战败现有流程和免费退出。
4. 身体变化：描述此次实际目标和部件，比较必须有合法before/after记录。TF排队、暂停、取消不等于已经变化；不存在历史对照时只写当前状态。不能把玩家变化写到居民身上。
5. 新增专用结果模板或适配声明须与当前观察规则区分，复用参考拼装器；先冻结结果事实、快照持久化、缺事实回退合同，再实现。不得把未经核实的draft/hold作者词条批量approved。若需要新增模板，使用现行v1.3作者层格式并附独立审定记录。
6. 进入/结算时捕获一次，渲染、重绘、存档恢复不重抽、不重算收益；保持原历史快照可读，新版本严格校验。未知事实省略或完整普通回退。
验收必须覆盖四类真实执行路径；零资源、动作失败、NPC离场、错对象、同名异人、重复请求、两部件变化、旧档恢复。提供浏览器实际入口证据，不能仅添加一个观察按钮就算完成。`,
  tests:['npm run typecheck','npm run test:a-content','node --test tests/entity-functions.test.ts tests/personality.test.ts tests/body-tf.test.ts tests/adventure.test.ts tests/save.test.ts','npm run build','npm run test:a-content:browser'], dependencies:'可先独立开发。与关系任务共改narrative/存档，与职业任务共改工作结果，先交新增接口和局部补丁，由整合方逐项合并。'},
 {id:'ENG-WORLD',folder:'02-地区与特殊地点',module:'A（区域与地点）',title:'三地区、特殊地点和连通地图',
  files:['src/world/types.ts','src/world/schema.ts','src/world/generator.ts','src/world/validation.ts','src/world/relationship-validation.ts','src/world/combat-encounters.ts','src/engine/numerics.ts','src/ui/world-panel.ts','src/ui/render-map.ts','content/generation/fantasy-reference.json','docs/reference/ai-collaboration-review.md','tests/worldgen.test.ts','tests/worldgen-v02.test.ts','tests/world-profiles.test.ts'],
  needs:`只对新生成的fantasy世界实施城镇town、领地domain、野外wilds三地区。其他16题材维持现有生成；旧五地点存档继续恢复。
冻结契约：region.kind与stats{development,security,mana}均显式定义；stats为0–100整数。地点实例统一placeArchetype，模板data.archetype映射到它；isSpecial明确布尔值；模板可声明regionKinds/minStats/maxStats。新字段须全链路严格校验，禁止第二套archetype权威。
三地区新世界至少6地点：城镇保留home/market/workshop/clinic，领地与野外各至少1个commons；5地点的新幻想参数在生成前清楚说明最低6并阻止提交，不能静默改数量。现有其他世界和旧档5地点合法。余量按区域属性与明确权重分配，总数等于参数，不因特殊地点额外越界。
增加按门槛抽选的酒馆、铁匠铺、神殿、黑市、庄园、巢穴、遗迹等地点模板；无候选时合法常规回退。它们使用已有服务/设施，不凭名字自动增加新玩法、物品或奖励。
生成独立确定性随机流；同种子同输入同结果。所有地点可达、连接双向，区内/跨区距离按现有数值系统，不重复扣行走资源。地图展示实际区域，任务、组织、出生点、日程和服务继续有效。
更新生成器版本及相关版本门控，避免新版本意外关闭D性格、A/B入口或任务；新增字段出现在保存的WorldDef与恢复校验，旧档不补生地区。
交不少于3个种子、6与20地点边界、属性门槛、无候选、保存恢复、旧五地点fixture与低资源旅行验证。地点选人选敌是单独后续接口，不把区域工程夸为完整危险生态。`,
  tests:['npm run typecheck','npm run test:worldgen','node --test tests/world-profiles.test.ts tests/main-relationships.test.ts tests/entity-functions.test.ts tests/personality.test.ts tests/a-templates.test.ts tests/save.test.ts','npm run build'],dependencies:'本任务先合入。地点属性驱动选人/选敌待基于新区域字段二次派发；不能与其他AI同时覆盖generator.ts。'},
 {id:'ENG-RELATION',folder:'03-NPC长期故事',module:'E（关系与路线，普通版首期）',title:'同一NPC可持续推进的关系与个人故事',
  files:['src/core/npc-types.ts','src/core/district-types.ts','src/core/adventure-types.ts','src/core/quest-types.ts','src/engine/npc.ts','src/engine/resident-quests.ts','src/engine/personality.ts','src/engine/narrative.ts','src/engine/conditions.ts','src/engine/effects.ts','src/content/schema.ts','src/content/adventure-schema.ts','src/persistence/npc-validation.ts','src/persistence/district-validation.ts','src/world/quests.ts','src/ui/npc-panel.ts','src/ui/district-panel.ts','tests/npc.test.ts','tests/personality.test.ts','tests/neighborhood-quests.test.ts','tests/save.test.ts'],
  needs:`当前已有trust、memories、静态玩家关系、主线关系树和人物短支线，不等于有持续关系路线。先实现general可玩的长期友谊/合作/分歧路线及三套完整个人故事，再扩范围。
冻结状态表：关系事实、已选路线、阶段及故事进度按真实目标ID保存；原Resident和NPCState是不同对象，定义显式EntityRef绑定，不把同名当同人。先说明如何复用trust/memories以及何时才需要新数值，避免同时出现互相矛盾的两套关系权威。
阶段必须经明确事件/选择推进，不能一次gift或单一数值>=70自动确认所有关系。说明路线分歧、多条件同时满足、拒绝/暂缓/退出、重复奖励和恢复政策；无资源也有普通继续路径。
每故事至少4阶段、每阶段2个有意义选择和免费退出；实际影响后续对白/援助或经营选择，结局至少2种。本人离场时不替换为另一个NPC，任务进度仍绑定原ID。每日限制和一次奖励必须事务校验，渲染不推进。
将CONTENT-NPC交付视为作者中间稿，先检查再转换为受Schema校验的运行内容；正文只能描述已经发生的结果。新增Condition/Effect须类型、加载、执行和存档同步。
保留D性格交谈、已有主线关系树及旧档。UI显示实际进度与下次可做事项。提供从结识至两个结局的实际执行和刷新恢复，不只画进度条。本期不要求成人或强制控制路线。`,
  tests:['npm run typecheck','node --test tests/npc.test.ts tests/district.test.ts tests/personality.test.ts tests/neighborhood-quests.test.ts tests/save.test.ts','npm run build'],dependencies:'CONTENT-NPC可并行写稿；实现者先冻结状态/路线接口，避免和职业任务同时修改相同居民校验器。'},
 {id:'ENG-JOBS',folder:'04-职业与委托',module:'C（首批服务的后续扩充）',title:'独立接取、执行、提交的职业委托与服务内容',
  files:['src/core/function-types.ts','src/core/district-types.ts','src/core/quest-types.ts','src/engine/entity-functions.ts','src/engine/resident-quests.ts','src/engine/district.ts','src/engine/selectors.ts','src/engine/progression.ts','src/content/district-schema.ts','src/persistence/district-validation.ts','src/world/quests.ts','src/ui/district-panel.ts','docs/reference/entity-functions-batch.md','content/generation/fantasy-content.json','tests/entity-functions.test.ts','tests/neighborhood-quests.test.ts','tests/district.test.ts','tests/save.test.ts'],
  needs:`当前work/trade/teach/orders/investments已有基础实现，禁止重写为functional开关。优先补三职业（铁匠、护理员、委托文书）的独立委托：接取→实际行动/目标→可提交→一次结算→后续事件。每职业2条，共6条，不把旧的一键work或orders改名冒充新任务链。
任务使用明确目标与已完成记录；不能接取即发奖、读正文即完成或提交给同名陌生NPC。明确未接取、进行中、可提交、已完成、退出/失败状态；资源不足不能扣到负数，同一requestId及重复提交不重复发奖。暂缓不丢进度。
服务显示仍由实际services和地点设施决定，不支持功能完全隐藏；缺资源时显示中文原因，伪造请求执行器仍拦截。商品/装备/基础教学只引用现有定义或完整注册新定义，跨包依赖精确声明。
本期新增内容应覆盖低成本工作、交易、任务及后续对白；未实现耐久/新技能的服务不能在正文声称修理完成或学会不存在技能。若需这些机制，独立列后续，不在本批假实现。
CONTENT-JOBS是中间作者稿，不是可直接导入ContentPack；转换时按真实功能建立条件与效果。生成源和导出JSON一起交，保留旧服务、旧档和每日限制。
验收6条任务完整流程、离场/换日、缺物品/金钱/设施、重复提交、失败回滚、存档跨阶段恢复，以及普通新世界从UI实际接到任务。`,
  tests:['npm run typecheck','node --test tests/entity-functions.test.ts tests/district.test.ts tests/neighborhood-quests.test.ts tests/save.test.ts','npm run build'],dependencies:'CONTENT-JOBS可并行写稿；与ENG-PROSE对齐本次工作结果快照，关系/任务共享字段先约定再合入。'},
];

export const writing = [
 {id:'CONTENT-NPC',folder:'03-NPC长期故事',title:'三套NPC普通个人故事作者稿',
  body:`写三套可复用职业角色故事：铁匠、护理员、旅人，各至少4阶段；每阶段2个有意义选择并有免费“暂时离开”；每故事至少2种由明确选择产生的结局。主题为信任、合作、个人抉择与当地生活，全部general。不写死人名、地点名，不预设玩家与对象同家/同门、恋人、身体或身份。
与现有一分钟人物短支线区分：阶段间有实际条件、记忆、选择后果和后续反应；不能只是四段介绍。声明触发需求为作者意图，不伪造引擎op/Tag/实例ID，不自称直接安装。所有资源变化、服务解锁仅列proposal，由整合方映射真实效果。结局不得依赖成人偏好。`,
  shape:{format:'aetheria-story-draft',version:1,task:'CONTENT-NPC',author:'填写作者',stories:[{id:'draft.npc.blacksmith',role:'铁匠',scope:'fantasy',premise:'故事概述',stages:[{id:'s1',entryRequirements:['用自然语言列明真实触发需求'],text:'普通正文，用【人物】和【地点】标记显示引用',choices:[{id:'c1',label:'选择标题',resultText:'普通结果',next:'s2',proposedConsequences:['作者意图，尚未执行']},{id:'c2',label:'另一有意义选择',resultText:'普通结果',next:'s2',proposedConsequences:[]},{id:'exit',label:'暂时离开',resultText:'结束本次交谈',next:null,proposedConsequences:[]}]}],endings:[{id:'end1',requirements:['明确选择记录'],text:'结局正文'}]}]},
 },
 {id:'CONTENT-JOBS',folder:'04-职业与委托',title:'职业工作、商品与六条普通委托作者稿',
  body:`为铁匠、护理员、委托文书各写2条独立委托，共6条；各另写2条短工作描述（共6）、2项商品/服务提案（共6）、2条委托后续反应（共6）。委托包括接洽、目标、实际执行场景、提交、至少2种结局/结果和免费暂缓。优先幻想世界，只有真通用内容才标general-world。
不得把角色职业当作服务已存在证据；新物品、设施、技能只写proposal。每项标依赖和最低资源建议，不替引擎扣费发奖，不引用未注册运行ID。工作结果写“成功候选/失败候选”各一份，不宣称玩家已执行。不写固定人名、预设同伴或凭空身体变化。全部general。
验收不按字数灌水：目标、选择和后续要可区分，避免六条全是收集并交回。复杂机制单列，不让当前游戏缺少机制导致全批无法接入。`,
  shape:{format:'aetheria-job-draft',version:1,task:'CONTENT-JOBS',author:'填写作者',commissions:[{id:'draft.job.smith.01',role:'铁匠',scope:'fantasy',title:'委托名',offerText:'接洽',objective:'实际目标',requiredFacts:['真实触发/完成事实需求'],steps:[{id:'step1',text:'执行候选正文',choices:[{label:'选择',resultText:'结果候选',proposedConsequences:[]}]}],submitText:'提交候选',outcomes:[{id:'success',text:'成功候选',proposedConsequences:['待映射奖励']}],followUpTexts:['后续候选'],freeExitText:'暂时离开'}],workTexts:[{id:'draft.work.smith.01',role:'铁匠',successText:'成功候选',failureText:'失败候选',requiredFacts:[]}],goodsProposals:[{id:'proposal.goods.01',role:'铁匠',name:'建议商品',purpose:'用途意图',existingId:null,neededMechanics:[]}]},
 },
];
