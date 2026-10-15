import {readFile,writeFile,mkdir,readdir,stat} from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {deflateRawSync,inflateRawSync} from 'node:zlib';
import assert from 'node:assert/strict';
import {domains,rules,futureGaps,services,ecologies,facilities,traits,version,sourceKinds,relationshipGates,editorialFamilyDomains,editorialFacetDomains} from '../production/tag-matrices/spec.mjs';
import {coverageCells} from '../production/tag-matrices/coverage-cells.mjs';
import {validateAssemblyCatalog,assembleProse,SLOT_TYPES} from '../production/tag-matrices/assembly.mjs';

const out='deliverables/tag-matrices',date='2026-10-15';
const sha=x=>createHash('sha256').update(x).digest('hex');
const json=x=>JSON.stringify(x,null,2)+'\n';
const sort=(a,b)=>a.localeCompare(b,'en');
async function walk(dir){let list=[];for(const e of await readdir(dir,{withFileTypes:true})){const f=dir+'/'+e.name;if(e.isDirectory())list.push(...await walk(f));else list.push(f);}return list.sort(sort);}
const sources=new Map();
async function read(file){if(!sources.has(file))sources.set(file,await readFile(file));return sources.get(file);}
async function load(file){return JSON.parse((await read(file)).toString('utf8'));}
await mkdir(out,{recursive:true});
const contentFiles=(await walk('content')).filter(f=>f.endsWith('.json'));
const documents=await Promise.all(contentFiles.map(async file=>({file,data:await load(file)})));
const packs=documents.filter(x=>x.data.manifest&&Array.isArray(x.data.actions));
const refs=documents.filter(x=>x.data.format==='aetheria-reference');
const profiles=(await load('content/generation/world-profiles.json')).profiles;
const assemblyCatalog=validateAssemblyCatalog(await load('production/tag-matrices/assembly-rules.json'));
const assemblyStandard=(await read('docs/reference/prose-slot-assembly-standard.md')).toString('utf8');
const assemblyExample=await load('production/tag-matrices/assembly-example.json');
const assemblyPreview=assembleProse({catalog:{...structuredClone(assemblyCatalog),rules:[...structuredClone(assemblyCatalog.rules),assemblyExample.rule]},assemblyRuleId:assemblyExample.rule.id,lexemes:assemblyExample.lexemes,context:assemblyExample.context});
assert.equal(assemblyPreview.mode,'assembled');
const editorialBase='production/tag-deliveries/2026-10-12/general-expansion-v2';
const editorialTaxonomy=await load(editorialBase+'/taxonomy.json');
const editorialHints=await load(editorialBase+'/rule-hints.json');
const semanticEntries=(await read(editorialBase+'/entries.jsonl')).toString('utf8').trim().split(/\r?\n/).map(JSON.parse);
const editorialMap=new Map(editorialTaxonomy.concepts.map(c=>[c.id,c]));
const hintMap=new Map(editorialHints.map(h=>[h.conceptId,h]));
for(const c of editorialTaxonomy.concepts)assert.ok(editorialFacetDomains[c.facet],'未分类概念维度：'+c.facet);
for(const h of editorialHints)assert.ok(editorialFamilyDomains[h.family],'未分类规则族：'+h.family);
const editorialSourceItems=[...editorialHints.map(h=>({key:editorialBase+'/rule-hints.json#hints/'+h.conceptId,file:editorialBase+'/rule-hints.json',kind:'editorialRuleHint',id:h.conceptId,domains:editorialFamilyDomains[h.family],status:'编辑提示；runtimeExecutable=false，不授予实际状态或效果',payload:h})),...editorialTaxonomy.rules.map(r=>({key:editorialBase+'/taxonomy.json#rules/'+r.id,file:editorialBase+'/taxonomy.json',kind:'lexicalRule',id:r.id,domains:editorialFacetDomains[editorialMap.get(r.conceptId)?.facet]??['05'],status:'词面提取规则；仅用于编辑归类，不证明实体事实',payload:r}))];
const index=await load('content/index.json');
await read('docs/reference/development-plan.md'); // 阈值追溯指纹；不把旧稿正文与不适用的旧要求复制进协作任务。
const defaultPaths=new Set(index.packs.map(f=>'content/'+f.replace(/^\.\//,'')));
const defaultPackIds=packs.filter(p=>defaultPaths.has(p.file)).map(p=>p.data.manifest.id);
const tagMap=new Map(),duplicateTags=[];
for(const p of packs)for(const tag of p.data.tags??[]){
 if(tagMap.has(tag.id)){assert.equal(json(tagMap.get(tag.id).definition),json(tag),'冲突 Tag '+tag.id);duplicateTags.push({id:tag.id,file:p.file});tagMap.get(tag.id).sources.push(p.file);}
 else tagMap.set(tag.id,{definition:tag,sources:[p.file],owner:p.data.manifest.id});
}
function canonical(value,scope='generation.v1'){
 if(tagMap.has(value))return value;
 const matches=[...tagMap.values()].filter(t=>t.definition.aliases?.some(a=>a.scope===scope&&a.value===value));
 if(matches.length===1)return matches[0].definition.id;
 return value;
}
const facetDomains={setting:['01','02','05','07'],ecology:['01','02','05','07'],service:['01','03','05','06'],body:['02','04','07','08'],context:['04','05','07','09'],theme:['05'],retrieval:[]};
const kinds=sourceKinds;
const excludedTextKeys=new Set(['texts','text','description','definition','summary','appearance','personality','attire','dialogue','prompt','completeText','result','journalText','objective','goal','style','before','after','purpose','requiredBeats']);
function mechanical(value){if(Array.isArray(value))return value.map(mechanical);if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).filter(([k])=>!excludedTextKeys.has(k)).map(([k,v])=>[k,mechanical(v)]));return value;}
function domainForNode(n){return ({defeat:'07',encounter:'05',exploration:'05',daily:'05',conversation:'04',quest:'06',transformation:'08',ending:'09'})[n.kind];}
const definitions=[];
for(const p of packs)for(const [kind,ds] of Object.entries(kinds))for(const [i,v] of (p.data[kind]??[]).entries()){
 const id=v.id??`${kind}.${i}`;
 const restricted=kind==='narrativeNodes'&&(/nsfwcombo|defeat\.play|defeat\.g\d/.test(id)||(v.requiresTags??[]).some(t=>/nsfwcombo|defeat\.play/.test(t.tagId)));
 definitions.push({key:p.file+'#'+kind+'/'+id,file:p.file,packId:p.data.manifest.id,defaultLoaded:defaultPaths.has(p.file),kind,id,domains:kind==='narrativeNodes'?[domainForNode(v)]:ds,status:restricted?'范围外：仅登记存在，不制作该内容矩阵':'已有定义；可达性须看入口',payload:restricted?{id,kind:v.kind,stage:v.stage,scope:'excluded-adult-production'}:mechanical(v)});
}
const templates=refs.flatMap(p=>p.data.templates.map(t=>({key:p.file+'#templates/'+t.id,file:p.file,referenceId:p.data.id,id:t.id,kind:t.kind,domains:t.kind==='npc'?['02']:['01',...(t.kind==='activity'||t.kind==='event'?['05']:[])],payload:mechanical(t),raw:t})));
const questSources=[...profiles.map(p=>({key:p.id,theme:p.tag,file:'content/generation/world-profiles.json',content:p.quests})),...(await load('content/generation/neighborhood-quests.json')).entries.map(e=>({key:'ecology:'+e.environmentTag,theme:canonical(e.environmentTag),file:'content/generation/neighborhood-quests.json',content:e.content}))];
const worldSourceItems=profiles.map(p=>({key:'content/generation/world-profiles.json#profiles/'+p.id,file:'content/generation/world-profiles.json',kind:'worldProfile',id:p.id,domains:['01','02'],status:'已有题材配置，生态仍独立选择',payload:mechanical(Object.fromEntries(Object.entries(p).filter(([k])=>k!=='quests')))}));
const questSourceItems=questSources.map(q=>({key:q.file+'#questSources/'+q.key,file:q.file,kind:'questSource',id:q.key,domains:['06'],status:'已有任务来源；按世界实际绑定后生效',payload:mechanical(q.content)}));
const questRows=[];
for(const q of questSources){for(const p of q.content.source.mainQuest.paths)for(const s of p.stages)questRows.push({key:q.key+'#stage/'+s.id,questSource:q.key,type:'main',path:p.id,id:s.id,stage:mechanical(s),choices:mechanical(q.content.execution.stages[s.id]??[])});for(const s of q.content.source.sideQuests)questRows.push({key:q.key+'#side/'+s.id,questSource:q.key,type:'side',id:s.id,stage:mechanical(s),execution:mechanical(q.content.execution.sides[s.id])});}
const usage=new Map([...tagMap.keys()].map(id=>[id,[]]));
function scan(value,source,domains,field='',scope='story.v1'){
 if(typeof value==='string'){const id=canonical(value,scope);if(usage.has(id))usage.get(id).push({source,field,domains});}
 else if(Array.isArray(value))value.forEach((v,i)=>scan(v,source,domains,field+'/'+i,scope));
 else if(value&&typeof value==='object')for(const [k,v]of Object.entries(value))if(!['label','name','definition','aliases','textKey','resultText'].includes(k))scan(v,source,domains,field+'/'+k,scope);
}
for(const d of definitions)if(!d.status.startsWith('范围外'))scan(d.payload,d.key,d.domains);
for(const t of templates)scan(t.payload,t.key,t.domains,'','generation.v1');
for(const p of worldSourceItems)scan(p.payload,p.key,p.domains,'','generation.v1');
const tagLedger=[...tagMap].sort(([a],[b])=>sort(a,b)).map(([id,t])=>{
 const uses=usage.get(id),retrievalOnly=id.startsWith('general-taxonomy:')||t.definition.facets.every(f=>f==='retrieval');
 const editorial=editorialMap.get(id),hint=hintMap.get(id);
 const assigned=[...new Set([...uses.flatMap(u=>u.domains),...(editorial?editorialFacetDomains[editorial.facet]:t.definition.facets.flatMap(f=>facetDomains[f]??[])),...(hint?editorialFamilyDomains[hint.family]:[])])].sort();
 return {id,label:t.definition.label,facets:t.definition.facets,status:t.definition.status,owner:t.owner,sources:t.sources,defaultLoaded:t.sources.some(f=>defaultPaths.has(f)),classification:retrievalOnly?'检索词；不授予事实或能力':uses.length?'已被规则引用；具体权威见引用字段':'已登记但本次未找到规则消费；不推断功能',domains:assigned.length?assigned:['00'],authority:retrievalOnly?'editorial-only':'只有对应真实状态/条件提供事实，Tag 本身不保证成立',editorialDefinition:editorial??null,ruleHint:hint??null,aliases:t.definition.aliases??[],replacementId:t.definition.replacementId??null,uses};
});
const tagDomains=new Map(tagLedger.map(t=>[t.id,t.domains]));
// 原始素材按 ID 去重；副本及同 ID 内容冲突保留账目，绝不删除源件。
const materialRoots=['production/lexicon-authoring/collections','production/lexicon-authoring/inbox','production/lexicon-authoring/outbox','docs/tag-hub/nsfw-batches'];
const materialMap=new Map(),batchRows=[],materialConflicts=[];
for(const root of materialRoots)for(const file of (await walk(root)).filter(f=>f.endsWith('.json'))){
 let d;try{d=JSON.parse((await readFile(file)).toString('utf8'));}catch{continue;}
 if(!['aetheria-lexicon-batch','aetheria-nsfw-lexicon-batch'].includes(d.format)||!Array.isArray(d.entries))continue;
 const bytes=await read(file);batchRows.push({file,format:d.format,batchId:d.batchId??d.id,entries:d.entries.length,sha256:sha(bytes)});
 for(const e of d.entries){const id=e.id;if(typeof id!=='string')continue;const digest=sha(json(e));if(materialMap.has(id)){const old=materialMap.get(id);old.sources.push(file);if(!old.contentHashes.includes(digest)){old.contentHashes.push(digest);materialConflicts.push({id,files:[...old.sources],reason:'同 ID 不同内容，需人工裁定，不能按最新副本覆盖'});}}else materialMap.set(id,{id,category:e.category??d.library??null,subcategory:e.subcategory??null,format:d.format,declaredReview:e.review??null,runtimeStatus:'原始素材；此账本不证明审定或接入',sources:[file],contentHashes:[digest]});}
}
const managed=await load('production/lexicon-authoring/management/index.json');
const exportLinks=[...await load('production/tag-deliveries/2026-10-12/general-expanded/export-links.json'),...await load(editorialBase+'/export-links.json')];
const exportsBySource=new Map();for(const l of exportLinks){if(!exportsBySource.has(l.sourceEntryId))exportsBySource.set(l.sourceEntryId,[]);exportsBySource.get(l.sourceEntryId).push(l.materialEntryId);}
for(const e of semanticEntries){const id=e.sourceEntryId,semantic={file:editorialBase+'/entries.jsonl',reviewStatus:e.reviewStatus,coreConceptIds:e.coreConceptIds,qualifierConceptIds:e.qualifierConceptIds,contextConceptIds:e.contextConceptIds,descriptionTopicIds:e.descriptionTopicIds,resolution:e.resolution,issues:e.issues,exportedMaterialIds:exportsBySource.get(id)??[]};if(materialMap.has(id)){materialMap.get(id).semantic=semantic;materialMap.get(id).sources.push(editorialBase+'/entries.jsonl');}else materialMap.set(id,{id,category:e.library,subcategory:e.sourceSubcategory??null,format:'aetheria-lexicon-materials',declaredReview:e.reviewStatus,runtimeStatus:'v2编辑素材；注册检索概念不等于本条已接入',sources:[editorialBase+'/entries.jsonl'],contentHashes:[sha(json(e))],semantic});}
const materialLedger={scope:'四个原始批次目录 + 最新 general-expansion-v2/entries.jsonl 全量语义库；按 sourceEntryId 去重，v2导出 material ID 只作别名，不重复计算旧版本/生成副本/ZIP/tar/任务卡/摘要。未来新增内容须重建。',roots:materialRoots,semanticSource:editorialBase+'/entries.jsonl',semanticEntries:semanticEntries.length,batches:batchRows,uniqueEntries:[...materialMap.values()].sort((a,b)=>sort(a.id,b.id)),conflicts:materialConflicts,managementSnapshot:{file:'production/lexicon-authoring/management/index.json',totals:managed.totals,libraries:managed.libraries,note:'原管理索引快照，非本工具重新审定；上方实际扫描另计。'}};
for(const entry of materialLedger.uniqueEntries)entry.slotAdaptation={status:'pending-explicit-review',allowedSlots:[],poolIds:[],priority:0,excludes:[],exclusive:[],review:'hold'};
const matrices=new Map(domains.map(d=>[d.id,{id:d.id,name:d.name,version,axes:d.axes,rules:rules.filter(r=>r.domains.includes(d.id)).map(r=>r.id),sourceItems:[],cells:[],gaps:futureGaps.filter(g=>g.domains.includes(d.id))}]));
for(const d of definitions)for(const domain of d.domains)matrices.get(domain)?.sourceItems.push(d);
for(const t of templates)for(const domain of t.domains)matrices.get(domain).sourceItems.push(Object.fromEntries(Object.entries(t).filter(([k])=>k!=='raw')));
for(const s of [...worldSourceItems,...questSourceItems])for(const domain of s.domains)matrices.get(domain).sourceItems.push(s);
for(const s of editorialSourceItems)for(const domain of s.domains)matrices.get(domain).sourceItems.push(s);
for(const m of matrices.values()){m.cells=coverageCells(m,rules,futureGaps,questRows,questSourceItems);m.assemblyRulesFile='assembly-rules.json';m.slotTypes=[...SLOT_TYPES];m.combinationStrategy='source-and-responsibility-coverage';}

// 每类把适用 Tag 的角色与局限完整列出，而不是把几千词条变成硬规则。
for(const m of matrices.values()){
 m.tagLedger=tagLedger.filter(t=>t.domains.includes(m.id)||t.domains.includes('00'));
 m.ruleDefinitions=rules.filter(r=>r.domains.includes(m.id));
 m.coverage={sourceItems:m.sourceItems.length,cells:m.cells.length,applicableTags:m.tagLedger.length,excludedSourceItems:m.sourceItems.filter(x=>x.status?.startsWith('范围外')).length};
}
const sourceManifest=()=>[...sources].sort(([a],[b])=>sort(a,b)).map(([file,bytes])=>({file,bytes:bytes.length,sha256:sha(bytes)}));
const coverage={version,date,generator:'0.11.0',scope:'Tag 制作组合规则及全部九类有限覆盖矩阵；非九类玩法实装或完整正文交付',universe:{contentJson:contentFiles.length,contentPacks:packs.length,defaultPacks:defaultPackIds,referencePacks:refs.length,referenceTemplates:templates.length,worldProfiles:profiles.length,registeredTags:tagLedger.length,defaultTags:tagLedger.filter(t=>t.defaultLoaded).length,retrievalTags:tagLedger.filter(t=>t.classification.startsWith('检索')).length,editorialConcepts:editorialTaxonomy.concepts.length,editorialRuleHints:editorialHints.length,lexicalRules:editorialTaxonomy.rules.length,semanticMaterials:semanticEntries.length,definitions:definitions.length,questSourceRows:questRows.length,rawMaterialBatches:batchRows.length,uniqueRawMaterials:materialMap.size,rawConflicts:materialConflicts.length},rules:rules.length,assemblyRules:assemblyCatalog.rules.length,assemblySlots:SLOT_TYPES.length,cartesianWritingCells:0,duplicateTags,matrix:[...matrices.values()].map(m=>({id:m.id,name:m.name,...m.coverage})),gaps:futureGaps};
await writeFile(out+'/00-规则数据.json',json({version,date,domains,rules,futureGaps,services,ecologies,facilities,traits,relationshipGates}));
await writeFile(out+'/00-逐Tag覆盖账本.json',json(tagLedger));
await writeFile(out+'/00-未实装素材账本.json',json(materialLedger));
await writeFile(out+'/00-覆盖报告.json',json(coverage));
await writeFile(out+'/assembly-rules.json',json(assemblyCatalog));
await writeFile(out+'/00-槽位拼装规范.md',assemblyStandard);
await writeFile(out+'/00-八槽拼装示例.json',json({fixture:assemblyExample,preview:assemblyPreview}));
for(const m of matrices.values())await writeFile(out+'/'+m.id+'-'+m.name+'-矩阵.json',json(m));

const common=`本包验收的是规则与覆盖矩阵，未实现新玩法、未批量写正文。完整边界：扫描 content 下全部 JSON，识别 ContentPack / ReferencePack / 17 世界配置 / 6 生态任务源；原始批次扫描账本写明的四目录，另纳入最新扩充版 ${semanticEntries.length} 条语义素材、${editorialTaxonomy.concepts.length} 个概念、${editorialHints.length} 条细分规则提示及 ${editorialTaxonomy.rules.length} 条词面提取规则。按稳定 sourceEntryId 去重，导出ID只是别名。未来任意标签组合没有有限全集，新增 Tag、来源或玩法须重建矩阵。\n\n每格状态分别为已有定义、制作适配格、制作缺口、接口缺口、不适用、范围外。已有定义不等于有正常入口；矩阵按实际来源与规则职责覆盖，禁止笛卡尔写作穷举。情色、性暴力及人与动物性行为的正文/制作组合不属于本包；相关原始文件保留原位，账本只记录存在与未接入状态。\n\n玩家不使用年龄属性；本次没有修改现有 NPC 资格代码。可选内容偏好依现有接口单独检查；性格、关系和偏好均不替代意愿。\n\n约束裁决顺序：注册/依赖 → 对象绑定 → 数据已知 → 真实结构/地点/时段/资源 → 互斥与前置 → 服务支持 → 生命周期/收据 → 候选优先级与软权重 → 正文事实与槽 → 执行事务重查。没有同对象冲突的跨轴信息可共存；不列黑名单并不等于自动支持。\n\n向其他 AI 交付时，一份对应大类 .md 已包含完整共用规则、该类矩阵、本类所有相关登记 Tag 账本、本类原始素材元数据、相关源码全文与本工具源码；无需读取你的 D 盘。大文件只做离线阅读与交回完整差异；不是带 node_modules 的运行工程。运行数据在矩阵中按机械字段完整投影，删除正文/外观/说明字段，投影不是可直接导入的原 ContentPack。代码全文与规则投影必须区分。\n\n协作者返回：实际来源和职责覆盖、缺口ID、独立assembly-rules.json规则全文、proseTemplate、词条适配、完整普通prose回退及拼装预览/校验报告；若涉及实现则交差异补丁与新增文件全文；无法运行必须写未运行，不得编造测试通过。不得改共享实体字段、Tag ID 或阈值后不通知其他类；先提交契约变更，再顺序整合。`;
const rulesText=rules.map(r=>`### ${r.id} ${r.name}\n\n适用：${r.domains.join('、')}。\n\n规则：${r.allow}\n\n拒绝/反例：${r.reject}\n\n判定式：\`${r.predicate}\`。\n\n实施层：${r.level}\n`).join('\n');
const protocol=`## 协作与验收\n\n1. 优先完成 P0：01 地点、02 人物生成、03 功能。冻结共用字段后，再由 04–08 分头制作；09 路线在关系执行器明确后进入实装。表内 dependencies 是输入依赖，不能拿旧包覆盖别人已更新的 generator。\n2. 各类只能改自己的规则/内容；共享 spec、Tag 注册、类型、Schema、generator、存档由整合者串行合并。禁止同时返回不同版本的同一整文件覆盖。\n3. 缺素材交制作需求；缺接口交接口任务；不适用写排除理由；范围外保留账目。不能为了让覆盖率好看把缺口改成已完成。\n4. 业务规则保留主体、入口、条件、效果和收据；文字另交有序proseTemplate、词条allowedSlots/priority/互斥与完整普通prose回退，拼装层不执行效果。\n5. 至少验证正常、缺资源、缺部件、对象离场、同名异人、重复点击/跨日、旧档、新档保存恢复；浏览和调试不消耗 RNG。\n6. 规则验收用 node --test tests/tag-matrices.test.mjs 与 node scripts/check-tag-matrices.mjs；若改运行逻辑再跑该类所附专项及完整项目验收。\n\n### 统一格格式\n\nkey、family、source、业务前置、expected、status、assemblyRuleId；cell不得内联proseTemplate/prose/词池/定词或预算规则。矩阵 sourceItems 携带实际机械字段完整投影；每格通过 source key 回到此包内的数据，不依赖外部文件链接。\n`;
await writeFile(out+'/00-总规范与协作分工.md',`# Tag 组合规则与九类覆盖矩阵\n\n${date} · v${version} · 基准生成器 0.11.0\n\n${common}\n\n${protocol}\n\n## 九大类\n\n| 文件前缀 | 分类 | 优先级 | 输入依赖 | 格数 | 源项 |\n| --- | --- | --- | --- | ---: | ---: |\n${domains.map(d=>{const m=matrices.get(d.id);return `| ${d.id} | ${d.name} | ${d.priority} | ${d.dependencies.join(',')||'无'} | ${m.cells.length} | ${m.sourceItems.length} |`;}).join('\n')}\n\n## 完整共用规则\n\n${rulesText}\n\n## 槽位拼装规范全文\n\n${assemblyStandard}\n\n## 真实接口缺口\n\n${futureGaps.map(g=>`- ${g.id} ${g.name}：${g.status}。${g.requirement}`).join('\n')}\n\n## 本次实际统计\n\n\`\`\`json\n${json(coverage)}\`\`\`\n`);

// 相关 TS 的本地 import 递归闭包，实际全文写入每包，不用目录和指纹代替。
async function closure(initial){const pending=[...initial],seen=new Set();while(pending.length){const file=pending.shift();if(seen.has(file))continue;const text=(await read(file)).toString('utf8');seen.add(file);for(const match of text.matchAll(/(?:from\s*|import\s*\()\s*['"](\.[^'"]+)['"]/g)){const dependency=path.posix.normalize(path.posix.join(path.posix.dirname(file),match[1]));if(/\.(ts|mjs|json)$/.test(dependency))pending.push(dependency);}}return [...seen].sort(sort);}
const taskFiles=[],embeddedManifest=[];
const toolFiles=['docs/reference/names-and-inheritance.md','src/core/name-types.ts','src/world/names.ts','tests/names.test.ts','scripts/name-cultures.mjs','docs/reference/prose-slot-assembly-standard.md','production/tag-matrices/assembly-rules.json','production/tag-matrices/assembly-example.json','production/tag-matrices/assembly.mjs','production/tag-matrices/coverage-cells.mjs','tests/prose-assembly.test.mjs','production/tag-matrices/spec.mjs','production/tag-matrices/evaluate.mjs','production/tag-matrices/README.md','scripts/build-tag-matrices.mjs','scripts/check-tag-matrices.mjs','tests/tag-matrices.test.mjs','package.json'];
const materialCategories={
 '01':['world-','text-environment'],
 '02':['npc-','body-build','body-form','body-surface','body-hair','body-scale','body-color','body-organ','body-beast','body-mechanical','body-anomaly','body-clothing','body-accessory'],
 '03':['npc-job','npc-identity','npc-goal','world-workplace','world-object','world-facility','daily-work','daily-life','daily-food'],
 '04':['npc-trait','npc-habit','npc-interest','npc-value','npc-history','npc-speech','npc-expression','npc-emotion','social-action','text-opening','text-reply','text-refusal','text-farewell','text-emotion','daily-talk','daily-social','daily-interact'],
 '05':['world-','daily-','text-encounter','text-environment'],
 '06':['npc-job','npc-goal','npc-history','world-workplace','daily-work','daily-interact','text-encounter'],
 '07':['body-build','body-form','body-beast','body-mechanical','world-terrain','world-weather','world-detail','text-refusal','text-encounter','text-body'],
 '08':['body-','material','text-body','text-tf-sense','text-tf-adapt','daily-move'],
 '09':['npc-trait','npc-value','npc-goal','npc-history','text-opening','text-reply','text-refusal','text-farewell','text-emotion','daily-social'],
};
for(const d of domains){
 const m=matrices.get(d.id),files=[...new Set([...d.files,...await closure(d.files),...toolFiles])];
 const relatedMaterials=materialLedger.uniqueEntries.filter(e=>['aetheria-lexicon-batch','aetheria-lexicon-materials'].includes(e.format)&&(materialCategories[d.id].some(c=>c.endsWith('-')?e.category?.startsWith(c):e.category===c)||[...(e.semantic?.coreConceptIds??[]),...(e.semantic?.qualifierConceptIds??[]),...(e.semantic?.contextConceptIds??[])].some(id=>tagDomains.get(id)?.includes(d.id))));
 const classMaterials={scope:'本类全部相关素材的规则索引投影；不包含原始正文。原始完整元数据总账在压缩包00-未实装素材账本.json。已注册概念的含义和全部细分规则在本类矩阵中全文给出，素材不能授予事实。',categories:materialCategories[d.id],semanticSource:materialLedger.semanticSource,columns:['sourceEntryId','category','coreConceptIds','qualifierConceptIds','contextConceptIds','reviewStatus','exportedMaterialIds','slotAdaptation'],rows:relatedMaterials.map(e=>[e.id,e.category,e.semantic?.coreConceptIds??[],e.semantic?.qualifierConceptIds??[],e.semantic?.contextConceptIds??[],e.semantic?.reviewStatus??e.declaredReview??'unreviewed',e.semantic?.exportedMaterialIds??[],e.slotAdaptation]),rawConflicts:materialLedger.conflicts};
 let text=`# ${d.id} ${d.name}：独立完整协作任务\n\n${date} · v${version} · **${d.priority}** · 输入依赖 ${d.dependencies.join('、')||'无'}\n\n${d.purpose}\n\n## 任务要求（全部）\n\n${d.jobs.map((x,i)=>`${i+1}. ${x}`).join('\n\n')}\n\n本类输入轴：${d.axes.join('；')}。\n\n默认回退：${d.fallback}\n\n${common}\n\n${protocol}\n\n## 完整共用规则\n\n${rulesText}\n\n## 槽位拼装规范全文\n\n${assemblyStandard}\n\n## 相关代码全文（放在大型数据表之前）\n`;
 const embedded=[];
 for(const file of files){const bytes=await read(file),body=bytes.toString('utf8'),fence='`'.repeat(Math.max(4,...(body.match(/`+/g)??[]).map(x=>x.length+1)));text+=`\n### ${file}\n\nBEGIN FILE: ${file}\n${fence}${file.endsWith('.json')?'json':file.endsWith('.ts')?'typescript':'javascript'}\n`;const offset=text.length;text+=body+'\n'+fence+'\nEND FILE: '+file+'\n';embedded.push({file,offset,length:body.length,bytes:bytes.length,sha256:sha(bytes)});}
 text+=`\n## 本类完整矩阵（不是示例）\n\n本类共 ${m.cells.length} 格、${m.sourceItems.length} 源项、${m.tagLedger.length} 个相关登记 Tag；所有格、Tag 含义与细分规则投影全文如下。JSON 仅移除排版空白，没有删字段或省略数据。全工程 Tag 总账另在压缩包00-逐Tag覆盖账本.json；本类所需 Tag 已完整内嵌。\n\n\`\`\`json\n`;
 const matrixOffset=text.length,matrixText=JSON.stringify(m);text+=matrixText+'\n```\n';
 text+=`\n## 本类原始与未实装素材规则索引\n\n本类 ${classMaterials.rows.length} 条，列格式见 columns。原始素材正文不在本次规则任务内。\n\n\`\`\`json\n${JSON.stringify(classMaterials)}\n\`\`\`\n\n## 专项测试入口\n\n${d.tests.map(f=>'- '+f).join('\n')}\n`;
 text+='\n## 指纹（源码已在上方全文给出）\n\n'+embedded.map(f=>`${f.file}  ${f.sha256}`).join('\n')+'\n';
 const file=d.id+'-'+d.priority+'-'+d.name+'-完整协作任务.md';await writeFile(out+'/'+file,text);const reread=await readFile(out+'/'+file,'utf8');for(const f of embedded)assert.equal(sha(Buffer.from(reread.slice(f.offset,f.offset+f.length))),f.sha256);
 taskFiles.push({id:d.id,file,bytes:Buffer.byteLength(text),sha256:sha(text),embeddedFiles:embedded.length});embeddedManifest.push({id:d.id,file,embedded,matrix:{offset:matrixOffset,length:matrixText.length,sha256:sha(matrixText)}});
}
await writeFile(out+'/00-全文校验索引.json',json(embeddedManifest));
await writeFile(out+'/00-来源指纹.json',json(sourceManifest()));
await writeFile(out+'/00-分发说明.md',`# 按大类发给其他 AI\n\n先发 01、02、03（P0）。04–08 各负责自己的内容，依赖数据要等前置契约整合；最后 09（P2）。每次发对应一个“完整协作任务.md”，单文件已自包含规则、矩阵、账本与相关源码全文；不要只发总规范、文件目录或 JSON。\n\n${taskFiles.map(t=>`- ${t.file}：${(t.bytes/1048576).toFixed(2)} MiB，全文内嵌 ${t.embeddedFiles} 个文件。`).join('\n')}\n\n范围是规则及九类矩阵；新增玩法和全部正文没有在本次实现。所有未来/缺接口项按格标出。下一轮协作修改后重新导出，不能让旧任务包覆盖新基准。\n`);
const outputFiles=(await walk(out)).filter(f=>!f.endsWith('/MANIFEST.json'));
const manifest={version,date,tasks:taskFiles,files:await Promise.all(outputFiles.map(async file=>{const bytes=await readFile(file);return {file:file.slice(out.length+1),bytes:bytes.length,sha256:sha(bytes)};}))};
await writeFile(out+'/MANIFEST.json',json(manifest));

// ZIP 使用 UTF-8 文件名，逐项解压、CRC 和原字节核对；不依赖第三方工具。
const crcTable=Array.from({length:256},(_,n)=>{for(let i=0;i<8;i++)n=n&1?0xedb88320^(n>>>1):n>>>1;return n>>>0;});
const crc=bytes=>{let c=0xffffffff;for(const b of bytes)c=crcTable[(c^b)&255]^(c>>>8);return(c^0xffffffff)>>>0;};
const chunks=[],central=[];let offset=0;
for(const file of [...outputFiles,out+'/MANIFEST.json']){const bytes=await readFile(file),name=Buffer.from('Tag组合与九类矩阵/'+file.slice(out.length+1)),data=deflateRawSync(bytes,{level:9});assert.deepEqual(inflateRawSync(data),bytes);const local=Buffer.alloc(30);local.writeUInt32LE(0x04034b50);local.writeUInt16LE(20,4);local.writeUInt16LE(0x800,6);local.writeUInt16LE(8,8);local.writeUInt32LE(crc(bytes),14);local.writeUInt32LE(data.length,18);local.writeUInt32LE(bytes.length,22);local.writeUInt16LE(name.length,26);chunks.push(local,name,data);const c=Buffer.alloc(46);c.writeUInt32LE(0x02014b50);c.writeUInt16LE(20,4);c.writeUInt16LE(20,6);c.writeUInt16LE(0x800,8);c.writeUInt16LE(8,10);c.writeUInt32LE(crc(bytes),16);c.writeUInt32LE(data.length,20);c.writeUInt32LE(bytes.length,24);c.writeUInt16LE(name.length,28);c.writeUInt32LE(offset,42);central.push(c,name);offset+=local.length+name.length+data.length;}
const cbytes=Buffer.concat(central),end=Buffer.alloc(22);end.writeUInt32LE(0x06054b50);end.writeUInt16LE(outputFiles.length+1,8);end.writeUInt16LE(outputFiles.length+1,10);end.writeUInt32LE(cbytes.length,12);end.writeUInt32LE(offset,16);const zip=Buffer.concat([...chunks,cbytes,end]);const zipFile='deliverables/Tag组合规则与九类矩阵-槽位版-'+date+'.zip';await writeFile(zipFile,zip);
console.log(json({coverage,zip:zipFile,zipMiB:(zip.length/1048576).toFixed(2),tasks:taskFiles.map(t=>({id:t.id,MiB:(t.bytes/1048576).toFixed(2),embedded:t.embeddedFiles}))}));
