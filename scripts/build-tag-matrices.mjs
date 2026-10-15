import {readFile,writeFile,mkdir,readdir,stat} from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {deflateRawSync,inflateRawSync} from 'node:zlib';
import assert from 'node:assert/strict';
import {domains,rules,futureGaps,services,ecologies,facilities,traits,version,sourceKinds,relationshipGates,editorialFamilyDomains,editorialFacetDomains} from '../production/tag-matrices/spec.mjs';
import {generationEligibility,locationService,safeExit,relationshipCandidates} from '../production/tag-matrices/evaluate.mjs';

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
await read('ai.md'); // 阈值追溯指纹；不把旧稿正文与不适用的旧要求复制进协作任务。
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
const byKind=k=>definitions.filter(d=>d.kind===k);
const nodeRows=d=>byKind('narrativeNodes').filter(n=>n.domains.includes(d));
const matrices=new Map(domains.map(d=>[d.id,{id:d.id,name:d.name,version,axes:d.axes,rules:rules.filter(r=>r.domains.includes(d.id)).map(r=>r.id),sourceItems:[],cells:[],gaps:futureGaps.filter(g=>g.domains.includes(d.id))}]));
for(const d of definitions)for(const domain of d.domains)matrices.get(domain)?.sourceItems.push(d);
for(const t of templates)for(const domain of t.domains)matrices.get(domain).sourceItems.push(Object.fromEntries(Object.entries(t).filter(([k])=>k!=='raw')));
for(const s of [...worldSourceItems,...questSourceItems])for(const domain of s.domains)matrices.get(domain).sourceItems.push(s);
for(const s of editorialSourceItems)for(const domain of s.domains)matrices.get(domain).sourceItems.push(s);
for(const s of editorialSourceItems.filter(s=>s.kind==='editorialRuleHint'))for(const condition of ['bound-known','missing-binding','unknown-value','wrong-subject','attempt-effects',...(s.payload.value.type==='number'?['wrong-unit']:[])])for(const domain of s.domains)matrices.get(domain).cells.push({key:s.key+':'+condition,family:'v2细分规则覆盖',source:s.key,concept:s.id,condition,expected:condition==='bound-known'?'仅可选材；不执行效果':condition==='missing-binding'||condition==='unknown-value'?'unknown，不入候选，无默认值':'拒绝该组合',status:'编辑规则提示，runtimeExecutable=false',required:['T02','T03','T05','T26','T29']});
// 01: 全部题材 × 生态 × 服务 × 时段，不把制作适配格宣称为真实可达世界。
const envTemplates=templates.filter(t=>t.kind==='environment');
function normalizeTemplate(t){const v=structuredClone(t);for(const k of ['environmentTags','requiresTags','excludesTags','compatibleTags'])v[k]=(v[k]??[]).map(x=>canonical(x));return v;}
for(const p of profiles)for(const eco of ecologies)for(const service of services)for(const time of ['morning','day','evening','night']){
 const envs=envTemplates.filter(t=>t.raw.data.tags.some(x=>new RegExp('(wet|dry|garden|frost|forge|tidal)$').test(x)&&x.endsWith(eco)));
 const environmentTags=[p.tag,...new Set(envs.flatMap(e=>e.raw.data.tags.map(x=>canonical(x))))];
 const candidates=templates.filter(t=>t.kind==='place'&&t.raw.data.service===service&&generationEligibility(normalizeTemplate(t.raw),{tags:environmentTags,environmentTags,templates:envs.map(e=>e.id),packs:packs.map(x=>x.data.manifest.id)}).eligible).map(t=>t.key);
 matrices.get('01').cells.push({key:`place:${p.id}:${eco}:${service}:${time}`,family:'题材生态地点',theme:p.tag,ecology:eco,service,time,environmentTags,candidates,status:candidates.length?'制作适配格：已有候选，需按单一参考组合生成':'制作缺口：无候选',requirements:['T09','T10','T11','T14','T27'],fallback:domains[0].fallback});
}
// 02: 来源模板 × 8 种合法性格变体；固定 NPC 和日程契约均保留源行。
for(const r of byKind('residentTemplates')){
 const original=packs.find(p=>p.file===r.file).data.residentTemplates.find(t=>t.id===r.id);
 const variants=original.traitVariants?.length?original.traitVariants.map(v=>v.traitTags):[original.traitTags??[]];
 for(const [i,ids]of variants.entries())matrices.get('02').cells.push({key:r.key+':trait:'+i,family:'居民性格来源',resident:r.id,source:r.key,traitTags:ids,speciesId:original.speciesId,bodyTemplateId:original.bodyTemplateId,patchIds:original.patchIds,profession:original.profession,roleName:original.roleName??null,services:mechanical(original.services??{}),status:ids.length?'新世界确定性选择；需合法模板和日程':'普通交谈回退；不补猜性格',required:['T03','T12','T13','T16'],schedule:['home','work','leisure']});
}
for(const state of ['在场','正常工作时段','午夜跨日','离场','同名不同ID','读档恢复'])matrices.get('02').cells.push({key:'schedule:'+state,family:'日程边界',state,status:'必须核查',expect:state==='同名不同ID'?'以实例ID区分':state==='离场'?'服务和交谈绑定不可转移':'保留稳定身份与实际日程',required:['T03','T12','T13','T17']});
for(let mask=0;mask<2**traits.length;mask++){
 const ids=traits.filter((_,i)=>mask&(1<<i)),sources=matrices.get('02').cells.filter(c=>c.family==='居民性格来源'&&json([...c.traitTags].sort())===json([...ids].sort())).map(c=>c.source);
 matrices.get('02').cells.push({key:'trait-subset:'+mask,family:'合法性格集合全集',traitTags:ids,sources,status:ids.length===0?'合法空集合，普通对话':sources.length?'合法且有来源变体':'Schema合法，但当前来源没有此组合；不得说已生成',required:['T16','T29']});
}
// 03: 设施组合全展开，对照实际执行器；NPC 每模板逐服务列出授予数据。
for(let mask=0;mask<2**facilities.length;mask++){const fs=facilities.filter((_,i)=>mask&(1<<i));for(const stamina of [100,7])for(const service of ['rest','sleep','care','work','train','publicDesk','light','wait'])matrices.get('03').cells.push({key:`facility:${mask}:${stamina}:${service}`,family:'设施服务真值表',facilities:fs,stamina,service,expected:locationService(service,fs,stamina),status:'离线与实际 serviceAvailable 差分校验',required:['T14','T15']});}
for(const r of byKind('residentTemplates'))for(const service of ['talk','work','trade','teach','order','invest']){
 const template=packs.find(p=>p.file===r.file).data.residentTemplates.find(t=>t.id===r.id),s=template.services;
 const value=service==='talk'?true:service==='order'?s?.orders:service==='invest'?s?.investments:s?.[service];
 matrices.get('03').cells.push({key:r.key+':service:'+service,family:'NPC服务授权',resident:r.id,source:r.key,service,declared:value??false,legacySnapshot:s===undefined,display:s===undefined?'旧档适配规则，见所附源码':value&&(Array.isArray(value)?value.length:true)?'还须在场/常驻/设施；缺资源才禁用':'隐藏',status:'授权审计，不跳过实际执行条件',required:['T14','T15','T18','T19']});
}
// 04: 六性格、反应、在场、当日状态完整笛卡尔格；非匹配返回普通交谈。
for(const trait of traits)for(const reaction of ['positive','neutral','offended','gift','exit'])for(const presence of [true,false])for(const daily of ['fresh','talked','gifted','declined']){
 const matching=nodeRows('04').filter(n=>(n.payload.requiresTags??[]).some(t=>t.tagId===trait)).map(n=>n.key);
 const expect=!presence?(reaction==='exit'?'免费退出':'不得继续深入'):daily==='declined'&&reaction!=='exit'?'普通交谈；不重进性格分支':reaction==='exit'?'免费退出':reaction==='offended'?'trust−1并结束，保存当日declined':reaction==='neutral'?'结束，无正向深入':reaction==='gift'?(daily==='gifted'?'不可重复赠礼':'还需库存与welcome/信任等该选择实际条件，扣物品并保存收据'):'welcome后可进入深入；talk信任仅每日一次';
 matrices.get('04').cells.push({key:`talk:${trait}:${reaction}:${presence}:${daily}`,family:'性格对话后果',trait,reaction,presence,daily,candidates:matching,expected:expect,status:'制作验收格；具体可选阶段仍按源节点conditions',required:['T16','T17','T18','T19','T20','T21']});
}
// 05: 每事件/活动/Storylet 单列，外加服务时段重复状态。
for(const s of [...templates.filter(t=>['event','activity'].includes(t.kind)),...byKind('storylets')])matrices.get('05').cells.push({key:'event-source:'+s.key,family:'事件来源覆盖',source:s.key,predicate:s.payload.conditions??{environmentTags:s.payload.environmentTags,requiresTags:s.payload.requiresTags,excludesTags:s.payload.excludesTags},repeat:s.payload.repeat??'按生成后定义',cooldownGroup:s.payload.cooldownGroup??null,status:'按真实门槛选取；不保证每局出现',required:['T10','T18','T20','T27']});
for(const service of services)for(const time of ['morning','day','evening','night'])for(const repeat of ['once-unseen','once-seen','daily-fresh','daily-used','repeat-ready','repeat-cooldown'])matrices.get('05').cells.push({key:`event:${service}:${time}:${repeat}`,family:'事件重复边界',service,time,repeat,expected:/seen$/.test(repeat)&&repeat!=='once-unseen'||/used|cooldown/.test(repeat)?'相应事件不入候选；可继续其他活动':'仍需全部conditions通过',required:['T05','T10','T18','T27']});
// 06: 所有题材及独立生态任务来源的全部阶段/选择与支线，无省略。
for(const q of questRows)matrices.get('06').cells.push({key:q.key,family:'任务源覆盖',...q,status:'已有任务源；绑定与编译仍须核查',required:['T18','T19','T22']});
for(const phase of ['接取','进行','提交','完成','失败','取消','重接'])for(const condition of ['满足前置','缺前置','提供者离场','重复提交','读档恢复'])matrices.get('06').cells.push({key:`lifecycle:${phase}:${condition}`,family:'独立NPC任务生命周期',phase,condition,status:'接口缺口 G03，不能伪造当前按钮',expected:condition==='重复提交'?'不重复奖励':condition==='提供者离场'?'保留原提供者引用，不转移':'按新生命周期契约实现后验收',required:['T03','T18','T22','T29']});
// 07: 17×真实敌人×5结果；可达性按当前编译器精确逻辑另标。
function automaticEnemy(theme,wet){return theme==='worlds:setting.fantasy'&&wet?'district:enemy.gel':/cyberpunk|space|industrial|postapocalypse/.test(theme)?'district:enemy.scavenger':'progression:enemy.raider';}
for(const p of profiles)for(const enemy of byKind('enemies'))for(const outcome of ['victory','defeat','escape','surrender','giveup']){
 const profile=byKind('narrativeProfiles').filter(x=>x.payload.enemyId===enemy.id).map(x=>x.key);
 const auto=[false,true].some(wet=>automaticEnemy(p.tag,wet)===enemy.id);
 matrices.get('07').cells.push({key:`combat:${p.id}:${enemy.id}:${outcome}`,family:'战斗题材审计',theme:p.tag,enemy:enemy.id,tier:enemy.payload.tier??'由现有数值推断',outcome,profiles:profile,status:auto?'该题材commons有自然入口条件；仍需实际生态/地点匹配':'当前该题材未自动编译此敌人入口；固定/调试入口另查',actualResult:['surrender','giveup'].includes(outcome)?'defeat + player:'+outcome:outcome,required:['T11','T21','T23','T24'],fallback:'普通非色情战后收束；不更换对手'});
}
for(const p of byKind('narrativeProfiles').filter(x=>!x.payload.enemyId))matrices.get('07').cells.push({key:'non-enemy:'+p.key,family:'非敌人profile',source:p.key,status:'不计入真实敌人，不扩展内容',required:['T23','T29']});
// 08: 每个实际TF五状态及所有装备对象/部件对象的结构覆盖。
for(const tf of byKind('transformations'))for(const state of ['active','paused','blocked','completed','cancelled'])for(const target of ['player','npc','resident'])matrices.get('08').cells.push({key:tf.key+':'+state+':'+target,family:'TF阶段状态',source:tf.key,tf:tf.id,state,target,stages:tf.payload.stages,status:target==='player'?'当前玩家变化契约':'G07：跨实体入口逐条核查，不计已实装',expected:state==='completed'?'只描述实际已完成补丁，不重放':state==='blocked'?'保持实际图，说明阻塞，不偷应用':state==='cancelled'?'不继续推进；已应用阶段按现有策略保留':state==='paused'?'不推进，正文保持当前图':'按时钟推进尚未完成阶段',targetPolicy:'按入口 Schema 核查target；不能把任意目标视为已支持',required:['T03','T04','T18','T25']});
for(const d of [...byKind('bodyParts'),...byKind('bodyTemplates'),...byKind('bodyPatches'),...byKind('equipment')])matrices.get('08').cells.push({key:'body-source:'+d.key,family:'结构与装备覆盖',source:d.key,payload:d.payload,status:'以真实图/装备条件为权威；词条不能补能力',required:['T04','T07','T08','T25','T27']});
for(const kind of ['root','head','ear','arm','hand','leg','foot','tail'])for(const material of ['organic','mechanical'])for(const capability of ['grasp','walk','hear','balance','tailGrip']){
 const candidates=byKind('bodyParts').filter(p=>p.payload.kind===kind&&p.payload.material===material&&(p.payload.capabilities??[]).includes(capability)).map(p=>p.key);
 matrices.get('08').cells.push({key:`capability:${kind}:${material}:${capability}`,family:'部件材质能力',kind,material,capability,candidates,status:candidates.length?'已有对应定义；仍需真实安装在目标BodyGraph':'没有授予此能力的部件定义，不从名称/素材推断',required:['T03','T04','T08']});
}
// 09: 路线规划所有实体/阶段/门槛状态；未拍板阈值必须留为待定而非随意赋值。
for(const entity of ['npc','resident','enemy'])for(const stage of ['stranger','acquaintance','close','lover','submissive','corrupted'])for(const event of ['达标未选择','明确选择','拒绝','退出','数值下降','恢复','读档'])matrices.get('09').cells.push({key:`relation:${entity}:${stage}:${event}`,family:'关系路线规划',entity,stage,event,status:'接口缺口 G05'+(entity==='enemy'?' + G06':''),gate:relationshipGates.stages[stage],expected:event==='退出'?'普通告别，无费用':event==='达标未选择'?'只列合法候选，不自动切换stage':event==='拒绝'?'不推进亲近路线':event==='数值下降'?relationshipGates.withdrawal:'绑定稳定实例、真实转换与持久收据后才开放',required:['T03','T18','T20','T28','T29','T31']});
matrices.get('09').relationshipGates=relationshipGates;
for(const affection of [0,29,30,69,70,100])for(const submission of [0,29,30,69,70,100])for(const corruption of [0,29,30,49,50,69,70,100])for(const trust of [9,10])for(const visits of [0,1]){
 const values={affection,submission,corruption,trust,visits};matrices.get('09').cells.push({key:`relation-boundary:${Object.values(values).join(':')}`,family:'关系门槛边界全集',values,expectedCandidates:relationshipCandidates(values).value,status:'离线制作门槛；非运行时affinity实装',required:['T26','T28','T31']});
}
for(const relation of ['colleague','neighbor','acquaintance','grudge','debt','coworker','ally','rival'])matrices.get('09').cells.push({key:'background:'+relation,family:'已有背景关系',relation,status:'背景分账，不等于路线stage',required:['T28']});

// 每类把适用 Tag 的角色与局限完整列出，而不是把几千词条变成硬规则。
for(const m of matrices.values()){
 m.tagLedger=tagLedger.filter(t=>t.domains.includes(m.id)||t.domains.includes('00'));
 m.ruleDefinitions=rules.filter(r=>r.domains.includes(m.id));
 m.coverage={sourceItems:m.sourceItems.length,cells:m.cells.length,applicableTags:m.tagLedger.length,excludedSourceItems:m.sourceItems.filter(x=>x.status?.startsWith('范围外')).length};
}
const sourceManifest=()=>[...sources].sort(([a],[b])=>sort(a,b)).map(([file,bytes])=>({file,bytes:bytes.length,sha256:sha(bytes)}));
const coverage={version,date,generator:'0.10.0',scope:'Tag 制作组合规则及全部九类有限覆盖矩阵；非九类玩法实装或完整正文交付',universe:{contentJson:contentFiles.length,contentPacks:packs.length,defaultPacks:defaultPackIds,referencePacks:refs.length,referenceTemplates:templates.length,worldProfiles:profiles.length,registeredTags:tagLedger.length,defaultTags:tagLedger.filter(t=>t.defaultLoaded).length,retrievalTags:tagLedger.filter(t=>t.classification.startsWith('检索')).length,editorialConcepts:editorialTaxonomy.concepts.length,editorialRuleHints:editorialHints.length,lexicalRules:editorialTaxonomy.rules.length,semanticMaterials:semanticEntries.length,definitions:definitions.length,questSourceRows:questRows.length,rawMaterialBatches:batchRows.length,uniqueRawMaterials:materialMap.size,rawConflicts:materialConflicts.length},rules:rules.length,duplicateTags,matrix:[...matrices.values()].map(m=>({id:m.id,name:m.name,...m.coverage})),gaps:futureGaps};
await writeFile(out+'/00-规则数据.json',json({version,date,domains,rules,futureGaps,services,ecologies,facilities,traits,relationshipGates}));
await writeFile(out+'/00-逐Tag覆盖账本.json',json(tagLedger));
await writeFile(out+'/00-未实装素材账本.json',json(materialLedger));
await writeFile(out+'/00-覆盖报告.json',json(coverage));
for(const m of matrices.values())await writeFile(out+'/'+m.id+'-'+m.name+'-矩阵.json',json(m));

const common=`本包验收的是规则与覆盖矩阵，未实现新玩法、未批量写正文。完整边界：扫描 content 下全部 JSON，识别 ContentPack / ReferencePack / 17 世界配置 / 6 生态任务源；原始批次扫描账本写明的四目录，另纳入最新扩充版 ${semanticEntries.length} 条语义素材、${editorialTaxonomy.concepts.length} 个概念、${editorialHints.length} 条细分规则提示及 ${editorialTaxonomy.rules.length} 条词面提取规则。按稳定 sourceEntryId 去重，导出ID只是别名。未来任意标签组合没有有限全集，新增 Tag、来源或玩法须重建矩阵。\n\n每格状态分别为已有定义、制作适配格、制作缺口、接口缺口、不适用、范围外。已有定义不等于有正常入口；审计笛卡尔格不等于全部可达剧情。情色、性暴力及人与动物性行为的正文/制作组合不属于本包；相关原始文件保留原位，账本只记录存在与未接入状态。\n\n玩家不使用年龄属性；本次没有修改现有 NPC 资格代码。可选内容偏好依现有接口单独检查；性格、关系和偏好均不替代意愿。\n\n约束裁决顺序：注册/依赖 → 对象绑定 → 数据已知 → 真实结构/地点/时段/资源 → 互斥与前置 → 服务支持 → 生命周期/收据 → 候选优先级与软权重 → 正文事实与槽 → 执行事务重查。没有同对象冲突的跨轴信息可共存；不列黑名单并不等于自动支持。\n\n向其他 AI 交付时，一份对应大类 .md 已包含完整共用规则、该类矩阵、本类所有相关登记 Tag 账本、本类原始素材元数据、相关源码全文与本工具源码；无需读取你的 D 盘。大文件只做离线阅读与交回完整差异；不是带 node_modules 的运行工程。运行数据在矩阵中按机械字段完整投影，删除正文/外观/说明字段，投影不是可直接导入的原 ContentPack。代码全文与规则投影必须区分。\n\n协作者返回：逐格覆盖结果，缺口ID，新增/变更的完整规则，正文另批交付，若涉及实现则交差异补丁与新增文件全文；无法运行必须写未运行，不得编造测试通过。不得改共享实体字段、Tag ID 或阈值后不通知其他类；先提交契约变更，再顺序整合。`;
const rulesText=rules.map(r=>`### ${r.id} ${r.name}\n\n适用：${r.domains.join('、')}。\n\n规则：${r.allow}\n\n拒绝/反例：${r.reject}\n\n判定式：\`${r.predicate}\`。\n\n实施层：${r.level}\n`).join('\n');
const protocol=`## 协作与验收\n\n1. 优先完成 P0：01 地点、02 人物生成、03 功能。冻结共用字段后，再由 04–08 分头制作；09 路线在关系执行器明确后进入实装。表内 dependencies 是输入依赖，不能拿旧包覆盖别人已更新的 generator。\n2. 各类只能改自己的规则/内容；共享 spec、Tag 注册、类型、Schema、generator、存档由整合者串行合并。禁止同时返回不同版本的同一整文件覆盖。\n3. 缺素材交制作需求；缺接口交接口任务；不适用写排除理由；范围外保留账目。不能为了让覆盖率好看把缺口改成已完成。\n4. 所有新规则带主体、实例绑定、前置、排除、权重、实际入口、状态效果、收据/冷却、退出、回退、正反例与来源。\n5. 至少验证正常、缺资源、缺部件、对象离场、同名异人、重复点击/跨日、旧档、新档保存恢复；浏览和调试不消耗 RNG。\n6. 规则验收用 node --test tests/tag-matrices.test.mjs 与 node scripts/check-tag-matrices.mjs；若改运行逻辑再跑该类所附专项及完整项目验收。\n\n### 统一格格式\n\nkey、family、输入轴、source/candidates、主体绑定、required 规则、expected、status、fallback。矩阵 sourceItems 携带实际机械字段完整投影；每格通过 source key 回到此包内的数据，不依赖外部文件链接。\n`;
await writeFile(out+'/00-总规范与协作分工.md',`# Tag 组合规则与九类覆盖矩阵\n\n${date} · v${version} · 基准生成器 0.10.0\n\n${common}\n\n${protocol}\n\n## 九大类\n\n| 文件前缀 | 分类 | 优先级 | 输入依赖 | 格数 | 源项 |\n| --- | --- | --- | --- | ---: | ---: |\n${domains.map(d=>{const m=matrices.get(d.id);return `| ${d.id} | ${d.name} | ${d.priority} | ${d.dependencies.join(',')||'无'} | ${m.cells.length} | ${m.sourceItems.length} |`;}).join('\n')}\n\n## 完整共用规则\n\n${rulesText}\n\n## 真实接口缺口\n\n${futureGaps.map(g=>`- ${g.id} ${g.name}：${g.status}。${g.requirement}`).join('\n')}\n\n## 本次实际统计\n\n\`\`\`json\n${json(coverage)}\`\`\`\n`);

// 相关 TS 的本地 import 递归闭包，实际全文写入每包，不用目录和指纹代替。
async function closure(initial){const pending=[...initial],seen=new Set();while(pending.length){const file=pending.shift();if(seen.has(file))continue;const text=(await read(file)).toString('utf8');seen.add(file);for(const match of text.matchAll(/(?:from\s*|import\s*\()\s*['"](\.[^'"]+)['"]/g)){const dependency=path.posix.normalize(path.posix.join(path.posix.dirname(file),match[1]));if(/\.(ts|mjs|json)$/.test(dependency))pending.push(dependency);}}return [...seen].sort(sort);}
const taskFiles=[],embeddedManifest=[];
const toolFiles=['production/tag-matrices/spec.mjs','production/tag-matrices/evaluate.mjs','production/tag-matrices/README.md','scripts/build-tag-matrices.mjs','scripts/check-tag-matrices.mjs','tests/tag-matrices.test.mjs','package.json'];
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
 const classMaterials={scope:'本类全部相关素材的规则索引投影；不包含原始正文。原始完整元数据总账在压缩包00-未实装素材账本.json。已注册概念的含义和全部细分规则在本类矩阵中全文给出，素材不能授予事实。',categories:materialCategories[d.id],semanticSource:materialLedger.semanticSource,columns:['sourceEntryId','category','coreConceptIds','qualifierConceptIds','contextConceptIds','reviewStatus','exportedMaterialIds'],rows:relatedMaterials.map(e=>[e.id,e.category,e.semantic?.coreConceptIds??[],e.semantic?.qualifierConceptIds??[],e.semantic?.contextConceptIds??[],e.semantic?.reviewStatus??e.declaredReview??'unreviewed',e.semantic?.exportedMaterialIds??[]]),rawConflicts:materialLedger.conflicts};
 let text=`# ${d.id} ${d.name}：独立完整协作任务\n\n${date} · v${version} · **${d.priority}** · 输入依赖 ${d.dependencies.join('、')||'无'}\n\n${d.purpose}\n\n## 任务要求（全部）\n\n${d.jobs.map((x,i)=>`${i+1}. ${x}`).join('\n\n')}\n\n本类输入轴：${d.axes.join('；')}。\n\n默认回退：${d.fallback}\n\n${common}\n\n${protocol}\n\n## 完整共用规则\n\n${rulesText}\n\n## 相关代码全文（放在大型数据表之前）\n`;
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
const cbytes=Buffer.concat(central),end=Buffer.alloc(22);end.writeUInt32LE(0x06054b50);end.writeUInt16LE(outputFiles.length+1,8);end.writeUInt16LE(outputFiles.length+1,10);end.writeUInt32LE(cbytes.length,12);end.writeUInt32LE(offset,16);const zip=Buffer.concat([...chunks,cbytes,end]);const zipFile='deliverables/Tag组合规则与九类矩阵-'+date+'.zip';await writeFile(zipFile,zip);
console.log(json({coverage,zip:zipFile,zipMiB:(zip.length/1048576).toFixed(2),tasks:taskFiles.map(t=>({id:t.id,MiB:(t.bytes/1048576).toFixed(2),embedded:t.embeddedFiles}))}));
