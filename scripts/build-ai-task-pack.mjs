import {readFile,writeFile,readdir,mkdir,lstat} from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {deflateRawSync,inflateRawSync} from 'node:zlib';
import assert from 'node:assert/strict';
const out='deliverables/ai-tasks',date='2026-10-15';
const sha=b=>createHash('sha256').update(b).digest('hex');
async function walk(dir){const list=[];for(const e of await readdir(dir,{withFileTypes:true})){const file=dir+'/'+e.name;if(e.isDirectory())list.push(...await walk(file));else if(!(await lstat(file)).isSymbolicLink())list.push(file);}return list.sort();}
const index=JSON.parse(await readFile('content/index.json','utf8'));
const common=[...await walk('src'),...index.packs.map(p=>'content/'+p.replace(/^\.\//,'')),...await walk('content/generation'),...await walk('content/personality'),...await walk('tests/fixtures'),
  'package.json','package-lock.json','tsconfig.json','index.html','ai.md','README.md','docs/ai-collaboration-review.md','docs/entity-functions-batch.md','docs/module-d-collaboration-review.md','docs/module-d-implementation.md',
  ...['build-adventure-content','build-personality-content','build-quest-content','build-neighborhood-quests','build-world-profiles','build-lexicon-adapter','build','build-standalone','build-world-samples','build-function-example','check-dist','check-foundation'].map(n=>'scripts/'+n+'.mjs'),
  'scripts/nsfw-auto-combo/combiner.mjs','scripts/nsfw-auto-combo/atoms.json','tests/folio-navigation.mjs','docs/prose-slot-assembly-standard.md','docs/names-and-inheritance.md','scripts/name-cultures.mjs','tests/names.test.ts','tests/prose-assembly.test.mjs',...await walk('production/tag-matrices')];
const tasks=[
 {key:'A',file:'01-P0-A-区域与地点完整任务.md',priority:'P0，先做；为 B 提供结构基础',status:'待实施。当前仍是单区域；region 名称变化不代表已实现三地区。',title:'三地区、地点配额、特殊地点和连通地图',
  needs:[
   '完整实施原 ai.md 模块 A 的 A.1–A.3 与任务卡 1，包含区域属性、地点模板、特殊地点门槛、数量分配、跨区路线、地图显示和存档校验，不只改类型或名称。',
   '统一实例字段 placeArchetype，参考模板 data.archetype 映射到它；不要新增第二个 archetype 字段分别驱动规则。region.kind/stats 与地点 isSpecial 同步更新类型、参考 Schema、生成、恢复校验及 UI。',
   '只对采用三地区结构的新幻想世界启用新约束：总数至少 6；城镇至少 home/market/workshop/clinic 四地点，领地与野外分别至少一个 commons。原五地点旧档保留。剩余配额按原方案权重分配，总数精确等于用户参数。',
   '区域属性使用确定性随机流，保证 0–100 整数；minStats/maxStats/regionKinds 全部实际生效，特殊模板无候选时用合适常规模板回退，不乱塞未达门槛地点。',
   '城镇、领地、野外均可达，路线双向及相邻关系清晰；距离和费用使用当前 numerics 契约。禁止重复扣旅行时间或体力。地图显示真实区域归属。',
   '保留 C 的设施与 NPC 服务、D 的 traitVariants/traitTags 和统一交谈；更新生成器版本以及全部版本判断，不让旧快照重新生成。',
   '5 服务保底、出生点、组织、日程和任务绑定继续有效；新字段不能仅出现在图上。提供不少于 3 个种子的生成、行走、保存/恢复与低资源检查。'],
  tests:['worldgen.test.ts','worldgen-v02.test.ts','world-profiles.test.ts','main-relationships.test.ts','procedural-ux.test.ts','entity-functions.test.ts','personality.test.ts','folio-browser.mjs']},
 {key:'C',file:'02-P0-C-NPC功能补完完整任务.md',priority:'P0，紧接 A；来源内容可先准备，generator 变更串行整合',status:'原 C 门控首批已完成；真实任务链、技能教学与修理等能力尚需补完。不要重写已完成的能力筛选。',title:'NPC 能力、真实任务/教学与内容扩充',
  needs:[
   '原 ai.md 模块 C 的 C.1–C.4 与任务卡 3 全文已附，但 functional 默认开放和不支持功能只禁用的旧要求已被用户否决，以现有 services 独立能力为准。',
   '每类 NPC 使用通用功能接口，按具体属性与真实数据出现对话、交易、任务、教学等。路人不显示不存在的服务，包含不可用折叠栏；只对实际提供但玩家缺资源的功能显示限制。不能根据职业名授予全部能力。',
   '在当前 work/trade/teach/orders/investments 上扩充真实服务模板：旅店经营者、酒馆老板、炼金师、治疗师、公会接待等各自有合理库存、场所与工作。身份与服务不可由一句正文冒充。',
   '按用户整体目标补齐独立 NPC 任务的接取、进行、提交和完成状态、条件、真实奖励及防重复领取。不能把现有一次性公开订单宣称为完整任务链。',
   '区分基础属性训练与真实技能教学。技能需存在定义、学习条件和支付、获得后的实际使用入口、存档恢复。没有执行器的服务先实现契约与效果，禁止先露空按钮。',
   '装备修理若纳入本批，须同时实现真实耐久/损坏、维修成本和结果；不得展示“修理成功”而不改变装备。无法纳入时如实列为未实施，不伪造完成。',
   '保留原免费恢复、防死路、每日工作限制、商品真实结算与旧档策略。A 的地点原型可用于选池，服务仍由具体能力和设施共同决定。',
   '完整覆盖类型/Schema/加载依赖/初始化/执行/选项/UI/存档，扩充内容来自已登记 Tag 和真实定义，不给所有居民复制同一库存或任务。'],
  tests:['entity-functions.test.ts','entity-functions-browser.mjs','district.test.ts','district-b.test.ts','equipment-items.test.ts','save.test.ts','personality.test.ts','personality-browser.mjs']},
 {key:'B',file:'03-P1-B-地点选人选敌完整任务.md',priority:'P1，A 的区域与 placeArchetype 契约整合后实施',status:'已有按 commons 等条件编译的自然遭遇；尚未完成原计划的地区/原型差异选池。',title:'地点属性驱动 NPC 分布和敌人遭遇',
  needs:[
   '完整实施原 ai.md 模块 B 的 B.1–B.3 与任务卡 2：城镇、边境、野外和特殊原型的不同 NPC/敌人池，区域数值对候选和强度的实际影响。',
   '使用 A 已冻结的 region.kind/stats、placeArchetype、isSpecial 及真实 Tag；不要在 B 再发明不同字段或直接硬编码地点名。',
   '城镇正常居住/商业区不无条件刷高危魔物；暗巷、下水道、边境、巢穴、遗迹有明确不同候选与条件，时间和治安门槛实际参与筛选。',
   'EnvironmentEnemyRule 固化 hp/reward/combat/defeatTags 覆盖，不修改基础 EnemyDef 字节。新增敌人、档位、行为档案、包依赖和正文同时校验；奖励、血量和战斗上限仍合法。',
   '地点驻留经营者与到访路人使用不同候选与日程；保证基础服务有真实经营者，野外不出现无关普通市民。能力沿用 C，性格生成沿用 D。',
   '正常探索能自然触发，迎战、避开、逃离、投降、放弃抵抗均有真实后续；不能只能靠调试挑战入口。关闭可选偏好仍有完整普通战败/脱困流程。',
   '候选无匹配时安全回退，不产生占位或身份复抽。固定种子相同，换种子有差异；存档保存实际选池/覆盖及对手，不读档重抽。'],
  tests:['environment-enemies.test.ts','adventure.test.ts','worldgen.test.ts','worldgen-v02.test.ts','procedural-ux.test.ts','entity-functions.test.ts','personality.test.ts','adventure-browser.mjs']},
 {key:'E',file:'04-P2-E-关系路线完整任务.md',priority:'P2，C/D 的人物与交互稳定，B 的特殊敌人契约稳定后实施',status:'尚未实装 affinity 路线状态机；当前 trust/visits 和背景关系不能冒充恋人、契约或腐蚀路线。',title:'NPC 与特殊敌人的关系、契约和真实转化状态机',
  needs:[
   '完整覆盖原 ai.md 模块 E 的 E.1–E.4 与任务卡 5：居民/固定 NPC 的 affinity，玩家与特殊敌人的双向关系，状态转移、对应对白、功能及真实身体转化。原文完整附后，最新约束优先。',
   '先建立统一状态转换表，再写操作符。采用详细表的 lover 全条件：affection>=70、trust>=10、corruption<50；不能只检查任务卡中的 affection。多个路线同时达标时，作为可选择的候选，由明确路线选择决定 stage，不自动强制切换。',
   '明确 stranger/acquaintance/close/lover/submissive/corrupted、变化上下限、互斥/复合政策、降级与恢复规则。性格或数值不能代替人物意愿，也不自动开放交易、任务等服务权限。',
   'affinity.compare/change 等 DSL 同步类型、解析、引用、事务、存档与调试。current 目标只在入口解析成真实绑定对象，后续不能因改选人物串线。未知对象与不在场目标须有明确拒绝或远程规则。',
   '若跨实体 TF，先补齐内容 JSON 的 target 白名单与端到端解析；对真实 BodyGraph 写入并保留来源、队列及校验。衣着/叙事描述不能冒充已安装部件。',
   '特殊敌人建立稳定实例与可重复见面身份，胜败/契约结果不得修改共享敌人模板或复制多个同一对象。对应人物、关系、日程或召唤状态必须可保存恢复。',
   '按明确选择提供普通关系、合意亲近、契约或非露骨幻想转化内容。偏好、人物资格、意愿、身体能力与场景分别检查；关闭偏好后系统与安全退出完整可玩。',
   '专属援助、伴侣补给、收益、任务和阵营变化必须真实结算并有持久限制；保留 D 的每日记忆与 C 的功能契约。每条路线提供正常、失败、拒绝、退出和恢复测试。'],
  tests:['npc.test.ts','district.test.ts','body-tf.test.ts','save.test.ts','adventure.test.ts','personality.test.ts','entity-functions.test.ts','adventure-browser.mjs']},
 {key:'D',file:'05-P3-D-已实装系统对接与扩展完整任务.md',priority:'P3，已实装；其他模块整合后验收，避免重复重写',status:'0.10.0 已实现共享性格、统一入口、锁定对象、软权重、离场、防刷、真实赠礼和非露骨可选相处。',title:'已实装模块 D 的对接、回归与内容扩展',
  needs:[
   '完整原 D 需求和原任务卡 4 已附；当前实现以 docs/module-d-implementation.md 与用户拍板约束为准。不要使用旧稿的 progression:trait 命名、文本哈希兜底或全故事注入。',
   '保留独立 aetheria/personality 六个 personality:trait.* 与 aetheria/personality-dialogue 内容包；显式依赖、严格性格集合和模板/实例一致性继续有效。',
   '保留正常交谈单入口、每日 talk 信任与记忆；当前 18 个节点包含六类各两个开场和一个深入阶段。正向/中性/冒犯的不同后果、赠礼扣除与持久限制不能倒退。',
   '只绑定 story.actor，后续条件/效果/右栏均一致；离场时收尾或只留免费退出，其他故事不得继承选中居民性格。权重与调试解释一致，浏览不抽 RNG。',
   'A/B/C/E 新接口整合后执行全部 D 专项与浏览器测试；尤其检查 NPC 新日程、关系、技能和地点变化不会造成串线、空候选、重复按钮或记忆显示异常。',
   '可扩展已完成的职业话题、关系阶段和地点组合，但不得用身体/衣着/场景假设制造矛盾，不得添加只换文案却没有后果的空分支。',
   '旧世界保持原行为的边界继续保留。新增版本/来源应显式更新生成与恢复，不重新生成旧人物，不放宽哈希，不宣称所有旧档自动获得新节点。'],
  tests:['personality.test.ts','personality-browser.mjs','entity-functions.test.ts','entity-functions-browser.mjs','adventure.test.ts','district.test.ts','save.test.ts','folio-browser.mjs']},
];
await mkdir(out,{recursive:true});
const allPaths=[...new Set([...common,...tasks.flatMap(t=>t.tests.map(n=>'tests/'+n)),...await walk('tests').then(list=>list.filter(f=>/helpers\.ts$/.test(f)))])].sort();
const cache=new Map();for(const file of allPaths)cache.set(file,await readFile(file));
const contracts=`当前基准是生成器 0.10.0。A/B/E 尚未实施，C 首批已完成，D 已实装。\n\n1. 状态只由 ActionExecutor 事务提交；查询、UI、调试不改 GameState、不消耗游戏 RNG。\n2. 新字段/操作符同时覆盖类型、严格 Schema、引用依赖、初始化、执行、选项、存档与实际 UI。\n3. 功能按独立 services 和设施决定。不支持就完全隐藏；实际提供但缺资源才显示限制。职业名、性格或 functional 二元分类不能代替真实服务。\n4. 无玩家年龄输入；NPC 成年智慧资格保留。新内容采用非露骨表达，偏好与人物意愿、资格分别检查；免费退出始终可执行。\n5. 只在新世界启用新结构。旧世界从保存快照恢复，不重抽身份/地图/性格，不放宽哈希。固定都市既有包字节在 D 实装中保持不变。\n6. 标签必须注册、active、显式依赖，BodyGraph 是身体权威。故事 Tag 不赋予身体能力。\n7. 所有收益、物品、任务和变形要有真实效果与防重复措施；不能用说明性正文冒充实装。\n8. A/B/C/E 共改 generator、类型和校验，必须基于这里的文件指纹交差异补丁，顺序整合；不要并行覆盖整份文件。\n9. 本文件附完整原 ai.md 供追溯，其中冲突要求已被这些约束及对应模块任务修正，不能恢复旧年龄、默认功能开放、非功能按钮折叠或文本哈希性格。\n10. 无法执行工程的 AI 应如实标注未运行测试，交可审查补丁及测试代码，禁止编造通过。\n11. 文字默认交有序proseTemplate，整段prose只作普通回退。冻结八槽：place/propEnv/bodyPart/senseMod/actionCore/materialFluid/opponentForm/exitChoice。词条交allowedSlots、priority、实例绑定、审核、互斥；定词仅在materialFluid槽挂前。矩阵cell只挂assemblyRuleId，规则独立assembly-rules.json；禁止笛卡尔写作穷举，拼装失败整段回退，T32/T34前后复核。\n12. 该格式已提供离线拼装器，尚未接入游戏NarrativeNode/文本包/UI/存档；不要直接添加未知字段或把素材自动标approved。完整规范及规则文件全文附后。`;
const delivery=`请先实现该任务优先级最高的基础契约与正常触发路径，再补齐本模块所有子任务。涉及文字制作还须交独立assembly-rules.json、proseTemplate、入槽词条、普通prose回退、拼装预览和失败校验报告；相关规范与工具全文已附。最终交付：统一差异补丁（基于所附 SHA-256）、新增文件全文、数据/构建产物变化清单、专门测试与实际执行结果、兼容性说明和未完成项。不得用省略号代替修改内容，不得要求读取未附的工程源码后才开始。若需要改变其他模块契约，先清晰列出变更并提供对应整合补丁。`;
const sourceManifest=allPaths.map(file=>({path:file,bytes:cache.get(file).length,sha256:sha(cache.get(file)),encoding:file.endsWith('.gz')?'base64':'utf8'}));
const criticalFiles={
  A:['src/world/types.ts','src/world/schema.ts','src/world/generator.ts','src/world/validation.ts','src/world/relationship-validation.ts','src/ui/world-panel.ts','src/engine/numerics.ts','src/ui/render.ts'],
  C:['src/core/district-types.ts','src/core/function-types.ts','src/engine/entity-functions.ts','src/engine/selectors.ts','src/engine/district.ts','src/engine/progression.ts','src/content/district-schema.ts','src/persistence/district-validation.ts','src/ui/district-panel.ts'],
  B:['src/world/combat-encounters.ts','src/engine/environment-enemies.ts','src/core/adventure-types.ts','src/world/generator.ts','src/world/types.ts','src/content/adventure-schema.ts'],
  E:['src/core/npc-types.ts','src/core/district-types.ts','src/core/adventure-types.ts','src/engine/npc.ts','src/engine/narrative.ts','src/engine/transformations.ts','src/content/schema.ts','src/content/foundation-schema.ts','src/engine/conditions.ts','src/engine/effects.ts','src/engine/eligibility.ts','src/persistence/npc-validation.ts','src/persistence/district-validation.ts'],
  D:['src/engine/personality.ts','src/core/personality-types.ts','src/engine/narrative.ts','src/engine/district.ts','src/engine/selectors.ts','src/engine/resident-quests.ts','scripts/build-personality-content.mjs','tests/personality.test.ts'],
};
const rendered=[];
for(const t of tasks){
  let document=`# ${t.file.replace(/\.md$/,'')}\n\n生成日期：${date}。任务：${t.title}。\n\n**优先级：${t.priority}**\n\n**当前状态：${t.status}**\n\n这是独立、自包含的任务文件。需求之后立即给出本模块关键源码全文，后续继续附完整接口、测试和数据，可直接上传这一份给不能读取工程的 Gemini。每份均包含全部运行源码、固定内容包、生成库、当前构建脚本、测试夹具和所列测试全文；没有源码摘要或“自行查看工程”的替代段落。文件内容很长，需求和执行优先级放在最前面，随后就是实际代码；目录与指纹移至最后。\n\n## 先执行的任务需求（完整）\n\n${t.needs.map((n,i)=>`${i+1}. ${n}`).join('\n\n')}\n\n## 共同契约与最新修订\n\n${contracts}\n\n## 验收与交付\n\n${delivery}\n\n~~~sh\nnode node_modules/typescript/bin/tsc --noEmit\nnode --test ${t.tests.filter(f=>f.endsWith('.ts')).map(f=>'tests/'+f).join(' ')}\nnode --test tests/*.test.ts\nnpm run build\nnode scripts/check-dist.mjs\nnode scripts/check-foundation.mjs\n${t.tests.filter(f=>f.endsWith('.mjs')).map(f=>'node tests/'+f).join('\n')}\n~~~\n\n源工程使用 Node.js 24+。浏览器测试需 Playwright 与本机浏览器；这份文件是阅读/返回补丁用的完整任务输入，不附 node_modules 或构建二进制。原始制作素材档案不属于本任务修改范围。\n\n## 本任务关键文件：以下直接给出完整源码\n`;
  const offsets=[];
  const preferred=criticalFiles[t.key];for(const file of preferred)assert.ok(cache.has(file),file);const ordered=[...preferred.map(file=>sourceManifest.find(f=>f.path===file)),...sourceManifest.filter(f=>!preferred.includes(f.path)&&!f.path.startsWith('content/')&&!f.path.startsWith('tests/fixtures/')),...sourceManifest.filter(f=>f.path.startsWith('content/')||f.path.startsWith('tests/fixtures/'))];
  for(const f of ordered){const bytes=cache.get(f.path),body=f.encoding==='base64'?bytes.toString('base64'):bytes.toString('utf8'),runs=body.match(/`+/g)??[],fence='`'.repeat(Math.max(4,...runs.map(s=>s.length+1))),lang=f.encoding==='base64'?'base64':f.path.endsWith('.ts')?'typescript':f.path.endsWith('.mjs')?'javascript':f.path.endsWith('.json')?'json':f.path.endsWith('.css')?'css':f.path.endsWith('.html')?'html':'text';
    document+=`\n### ${f.path}\n\nBEGIN FILE: ${f.path}\n\n${fence}${lang}\n`;
    offsets.push({path:f.path,start:document.length,length:body.length,encoding:f.encoding});document+=body+'\n'+fence+`\nEND FILE: ${f.path}\n\n校验信息（源码已在上方全文给出）：${f.bytes} 字节；SHA-256 ${f.sha256}；${f.encoding}\n`;
  }
  document+=`\n## 文件目录与指纹（仅供校验，上方已包含全部文件全文）\n\n| 文件 | 字节 | SHA-256 |\n| --- | ---: | --- |\n${sourceManifest.map(f=>`| ${f.path} | ${f.bytes} | ${f.sha256} |`).join('\n')}\n`;
  const file=out+'/'+t.file;await writeFile(file,document);const reread=await readFile(file,'utf8');
  for(const offset of offsets){const raw=reread.slice(offset.start,offset.start+offset.length),bytes=Buffer.from(raw,offset.encoding==='base64'?'base64':'utf8');assert.equal(sha(bytes),sha(cache.get(offset.path)),t.key+':'+offset.path);}
  rendered.push({file:t.file,module:t.key,priority:t.priority,bytes:Buffer.byteLength(document),sha256:sha(Buffer.from(document)),embeddedFiles:offsets.length,allEmbeddedFilesVerified:true});
}
const readme=`# Gemini 完整任务包\n\n${date}，基准生成器 0.10.0。按文件名前的顺序分发：\n\n${tasks.map(t=>`- **${t.file}**：${t.priority}。${t.status}`).join('\n')}\n\n先发 01-A，再发 02-C；03-B 需要已整合的 A，04-E 需要稳定的 C/D 与特殊敌人契约。05-D 已实装，主要用于回归与扩展，不要让其他 AI 重做。多任务涉及同一源码，返回补丁需顺序整合并重新导出任务包，后续 AI 才能拿到最新基准。\n\n本说明仅负责分发顺序，不能单独当作任务发给 AI。必须发送 01–05 中对应任务文件。每份任务正文独立包含完整需求、全局约束、整个原 ai.md、当前源码与运行数据全文及逐文件 SHA-256；需求后立刻是本模块关键源码，目录与指纹在文件末尾。上传对应一份 .md 即可，无需让 Gemini 读取 D 盘路径。二进制旧档夹具以完整 Base64 附在文件内。所有内嵌文件均逐一读回校验，不使用省略号替代源码；文件很长请作为附件上传。\n\nMANIFEST.json 记录所有源文件和任务文件字节/指纹。修改工程后运行 node scripts/build-ai-task-pack.mjs 更新，旧任务包是特定基准，不能覆盖新源码。\n`;
await writeFile(out+'/00-先读-优先级与使用说明.md',readme);
await writeFile(out+'/MANIFEST.json',JSON.stringify({date,generator:'0.10.0',selfContained:true,sourceFiles:sourceManifest,tasks:rendered},null,2));
// Store a normal ZIP and read every compressed entry back before delivery.
const table=Array.from({length:256},(_,n)=>{for(let i=0;i<8;i++)n=n&1?0xedb88320^(n>>>1):n>>>1;return n>>>0;});
const crc=bytes=>{let c=0xffffffff;for(const b of bytes)c=table[(c^b)&255]^(c>>>8);return(c^0xffffffff)>>>0;};
const chunks=[],central=[],entries=[];let at=0;
for(const name of ['00-先读-优先级与使用说明.md',...tasks.map(t=>t.file),'MANIFEST.json']){const bytes=await readFile(out+'/'+name),compressed=deflateRawSync(bytes),filename=Buffer.from(name),checksum=crc(bytes),local=Buffer.alloc(30);local.writeUInt32LE(0x04034b50);local.writeUInt16LE(20,4);local.writeUInt16LE(0x800,6);local.writeUInt16LE(8,8);local.writeUInt32LE(checksum,14);local.writeUInt32LE(compressed.length,18);local.writeUInt32LE(bytes.length,22);local.writeUInt16LE(filename.length,26);chunks.push(local,filename,compressed);const header=Buffer.alloc(46);header.writeUInt32LE(0x02014b50);header.writeUInt16LE(20,4);header.writeUInt16LE(20,6);header.writeUInt16LE(0x800,8);header.writeUInt16LE(8,10);header.writeUInt32LE(checksum,16);header.writeUInt32LE(compressed.length,20);header.writeUInt32LE(bytes.length,24);header.writeUInt16LE(filename.length,28);header.writeUInt32LE(at,42);central.push(header,filename);entries.push({name,sha256:sha(bytes),compressedOffset:at+30+filename.length,compressedBytes:compressed.length});at+=local.length+filename.length+compressed.length;}
const directory=Buffer.concat(central),end=Buffer.alloc(22);end.writeUInt32LE(0x06054b50);end.writeUInt16LE(entries.length,8);end.writeUInt16LE(entries.length,10);end.writeUInt32LE(directory.length,12);end.writeUInt32LE(at,16);const zip=Buffer.concat([...chunks,directory,end]),zipPath='deliverables/Gemini-任务与源码全文-2026-10-15.zip';await writeFile(zipPath,zip);const disk=await readFile(zipPath);for(const e of entries)assert.equal(sha(inflateRawSync(disk.subarray(e.compressedOffset,e.compressedOffset+e.compressedBytes))),e.sha256,e.name);
console.log(JSON.stringify({archive:zipPath,MB:Number((zip.length/1048576).toFixed(2)),sourceFiles:allPaths.length,tasks:rendered.map(t=>({file:t.file,MB:Number((t.bytes/1048576).toFixed(2)),embeddedFiles:t.embeddedFiles})),allFilesReadBackVerified:true},null,2));
