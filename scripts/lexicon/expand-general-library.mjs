import {readFile,writeFile,mkdir,readdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {catalog} from './catalog.mjs';
import {createTaxonomy} from './general-tag-taxonomy.mjs';
import {projectRoot,deliveryPath,sourcePath,parseInventory} from './refine-general-tags.mjs';
import {commonSeeds} from './common-general-seeds.mjs';
import {expandedTaxonomy} from './expanded-general-taxonomy.mjs';
import {dictionaryRegistry,validateSemanticBatch} from './semantic-format.mjs';

export const expandedPath=`${deliveryPath}/general-expanded`;
export const gapPaths=[
  `${deliveryPath}/readable/2026-10-12-已写好tag-正文交付/03-待入库/通用环境世界观查缺-待入库-v1.md`,
  `${deliveryPath}/readable/2026-10-12-已写好tag-正文交付/03-待入库/通用环境世界观查缺-待入库-v2-加量.md`,
];
const hash=v=>createHash('sha256').update(v).digest('hex');
const normalized=v=>v.normalize('NFKC').trim();
const cell=v=>String(v??'').replaceAll('|','\\|').replaceAll('\n',' ');

/** 来源主题与描写名分开；候选身份由来源版本+库+名称固定，不由排序决定。 */
export function parseWorldGap(text,sourceFile,version){
  let theme='';const rows=[],seen=new Set();
  for(const [i,line]of text.split(/\r?\n/).entries()){
    const heading=/^###\s+\d+\.\d+\s+(.+)$/.exec(line);
    if(heading)theme=heading[1].replace(/\s*[（(]\d+[）)][\s\S]*$/,'').trim();
    if(!/^\|[^|]+\| `(?:world|daily|text|body)-[^`]+` \|/.test(line)||!line.includes('候选/待入库'))continue;
    const cols=line.split('|').slice(1,-1).map(s=>s.trim());
    const [material,lib,sourceCategory,,description,provenance]=cols;
    const library=lib.replaceAll('`','');
    if(!theme||!material||!description||!catalog.some(c=>c.code===library))throw Error(`环境候选无法解析：${sourceFile}:${i+1}`);
    const id=`general-gap:${version}.${library}.${hash(normalized(material)).slice(0,16)}`;
    if(seen.has(id))throw Error(`候选身份重复：${id}`);seen.add(id);
    rows.push({id,library,subcategory:'环境候选',material,description,kind:library==='text-environment'?'phrase':'named',
      sourceLine:i+1,sourceFile,sourceCategory,sourceTheme:theme,sourceVersion:version,sourceClaim:provenance,
      sourceModel:'unrecorded',reviewStatus:'unreviewed'});
  }
  if(!rows.length)throw Error(`未解析到环境候选：${sourceFile}`);
  return rows;
}

export function selectNewSeeds(existing,seeds=commonSeeds){
  const byLabel=new Map();
  for(const r of existing){const label=normalized(r.material??r.label);(byLabel.get(label)??byLabel.set(label,[]).get(label)).push(r.id??r.sourceEntryId);}
  const additions=[],reused=[];
  for(const seed of seeds){const key=normalized(seed.label);
    if(byLabel.has(key)){reused.push({key:seed.key,label:seed.label,existingIds:byLabel.get(key),decision:'label-collision-kept-out-for-review'});continue;}
    additions.push(seed);byLabel.set(key,[`general-common:${seed.key}`]);
  }
  return {additions,reused};
}

/** 清单被截短的行仅在 JSON 全文以原文为前缀时恢复；其它差异一律保留待审。 */
export function joinSource(entry,record){
  if(!record)return {...entry,description:null,sourceJoin:'missing'};
  const text=record.entry.name??record.entry.text;
  const categoryMatches=record.entry.category===entry.library&&record.entry.subcategory===entry.subcategory;
  const exact=categoryMatches&&text===entry.material;
  const truncated=categoryMatches&&text.length>entry.material.length&&text.startsWith(entry.material)&&entry.kind==='phrase';
  return {...entry,material:truncated?text:entry.material,uploadedMaterial:entry.material,
    description:exact||truncated?record.entry.description??null:null,
    examples:exact||truncated?record.entry.examples??[]:[],
    sourceJoin:exact?'exact':truncated?'restored-truncated-prose':'conflict',
    collectionText:text,collectionFile:record.file,collectionHash:record.sha256,collectionSource:record.source};
}

const classifierCache=new WeakMap();
function classifier(taxonomy){
  if(classifierCache.has(taxonomy))return classifierCache.get(taxonomy);
  const definitions=new Map(taxonomy.concepts.map(c=>[c.id,c])),rules=new Map();
  for(const r of taxonomy.rules)if(r.source==='literal-span')for(const lib of r.libraries){
    if(!rules.has(lib))rules.set(lib,[]);rules.get(lib).push({...r,regex:new RegExp(r.expression,'gu')});
  }
  const result={definitions,rules};classifierCache.set(taxonomy,result);return result;
}

function matchTopics(text,library,taxonomy,field){
  const {definitions,rules}=classifier(taxonomy),found=[];
  for(const rule of rules.get(library)??[])for(const m of text.matchAll(rule.regex)){
    const d=definitions.get(rule.conceptId),start=m.index,end=start+m[0].length;
    const before=text.slice(Math.max(0,start-8),start),after=text.slice(end,end+4);
    // 说明中的类比、否定及假设不能作为正向标签；材质只从标题取显式候选。
    if(field==='description'&&(d.facet==='material'||/不(?:是|能|会|可)?|没有|并非|未有|无需|避免|假如|如果|像|仿佛|如同/.test(before)||/般|似的/.test(after)))continue;
    if(d.facet==='material'&&/^(?:色|光|纹|般|似的)/.test(after))continue;
    found.push({conceptId:rule.conceptId,ruleId:rule.id,field,source:'literal-span',fragment:m[0],start,end});
  }
  const accepted=[];
  for(const e of found.sort((a,b)=>b.fragment.length-a.fragment.length||a.start-b.start||a.conceptId.localeCompare(b.conceptId))){
    if(accepted.some(a=>definitions.get(a.conceptId).facet===definitions.get(e.conceptId).facet&&a.start<e.end&&e.start<a.end))continue;
    accepted.push(e);
  }
  return accepted.sort((a,b)=>a.start-b.start||a.conceptId.localeCompare(b.conceptId));
}

export function classifyGeneral(entry,taxonomy){
  const {definitions}=classifier(taxonomy);
  const protectedName=taxonomy.protectedLibraries.includes(entry.library)||taxonomy.protectedSubcategories[entry.library]?.includes(entry.subcategory);
  const evidence=protectedName?[]:matchTopics(entry.material,entry.library,taxonomy,'material');
  if(!protectedName)for(const r of taxonomy.rules)if(r.source==='source-subcategory'&&r.library===entry.library&&r.subcategory===entry.subcategory)
    evidence.push({conceptId:r.conceptId,ruleId:r.id,field:'subcategory',source:r.source,fragment:entry.subcategory,start:null,end:null});
  const descriptionEvidence=protectedName||!entry.description?[]:matchTopics(entry.description,entry.library,taxonomy,'description');
  const coreConceptIds=[...new Set(evidence.filter(e=>definitions.get(e.conceptId).role==='core').map(e=>e.conceptId))];
  const qualifierConceptIds=[...new Set(evidence.filter(e=>definitions.get(e.conceptId).role==='qualifier').map(e=>e.conceptId))];
  const contextConceptIds=taxonomy.settingContexts[entry.sourceTheme]??[];
  const attributeOnly=!coreConceptIds.length&&qualifierConceptIds.length>0;
  const resolution=protectedName?'protected-name':coreConceptIds.length?'proposed':attributeOnly?'attribute-only':'needs-core-review';
  return {sourceEntryId:entry.id,library:entry.library,sourceSubcategory:entry.subcategory,material:entry.material,
    description:entry.description??null,examples:entry.examples??[],materialKind:entry.kind,sourceJoin:entry.sourceJoin??'candidate-original',
    source:{file:entry.sourceFile??sourcePath,line:entry.sourceLine,collectionFile:entry.collectionFile??null,
      collectionHash:entry.collectionHash??null,collectionSource:entry.collectionSource??null,
      uploadedMaterial:entry.uploadedMaterial??entry.material,theme:entry.sourceTheme??null,
      model:entry.sourceModel??entry.collectionSource?.model??'unrecorded',claim:entry.sourceClaim??null},
    coreConceptIds,qualifierConceptIds,contextConceptIds,
    descriptionTopicIds:[...new Set(descriptionEvidence.map(e=>e.conceptId))],
    resolution,reviewStatus:'unreviewed',evidence,descriptionEvidence,
    issues:[...(!protectedName&&!coreConceptIds.length&&!attributeOnly?['core-needs-review']:[]),
      ...(coreConceptIds.length>1?['multiple-topics-do-not-collapse']:[]),...(qualifierConceptIds.length?['modifier-attachment-not-inferred']:[]),
      ...(entry.kind==='phrase'?['prose-kept-as-example']:[]),...(descriptionEvidence.length?['description-topics-are-context-not-entity-state']:[]),
      ...(entry.library==='body-form'?['source-category-does-not-prove-capability']:[]),
      ...(entry.sourceJoin==='conflict'?['source-conflict-no-description-join']:[])],
  };
}

async function originalsSnapshot(root){
  const receipt=JSON.parse(await readFile(path.join(root,deliveryPath,'receipt.json'),'utf8'));
  const result=[];
  for(const r of [...receipt.originals,...receipt.extractedFiles]){
    const actual=hash(await readFile(path.join(root,deliveryPath,r.path)));
    if(actual!==r.sha256)throw Error(`原件已发生变化：${r.path}`);result.push({path:r.path,sha256:actual});
  }
  return result;
}

async function loadCollections(root){
  const base='production/lexicon-authoring/collections',map=new Map(),sources=[];
  for(const d of (await readdir(path.join(root,base),{withFileTypes:true})).sort((a,b)=>a.name.localeCompare(b.name))){
    if(!d.isDirectory()||!catalog.some(c=>c.code===d.name))continue;
    for(const name of (await readdir(path.join(root,base,d.name))).sort()){
      if(!name.endsWith('.json'))continue;const file=`${base}/${d.name}/${name}`,bytes=await readFile(path.join(root,file)),raw=JSON.parse(bytes);
      // 仓库JSON在Windows检出为CRLF；内容规范化后散列，使跨平台重建一致。
      const sha256=hash(JSON.stringify(raw));sources.push({path:file,sha256,hashing:'json-stringify-sha256'});
      for(const entry of raw.entries??[]){if(map.has(entry.id))throw Error(`JSON词库ID冲突：${entry.id}`);map.set(entry.id,{entry,source:raw.source,file,sha256});}
    }
  }
  return {map,sources};
}

/** 正式 v2 纯文字批次。未注册的编辑标签留在 sidecar，不能冒充运行 TagDef。 */
export function materialBatches(rows,startBatch,dictionary,producer){
  const batches=[],links=[];
  for(const library of [...new Set(rows.map(r=>r.library))].sort()){
    const local=rows.filter(r=>r.library===library);
    for(let offset=0;offset<local.length;offset+=50){
      const batchId=`${library}.b${String(startBatch+offset/50).padStart(4,'0')}`;
      const entries=local.slice(offset,offset+50).map((r,i)=>{
        const id=`lx.${batchId}.${String(i+1).padStart(4,'0')}`;links.push({sourceEntryId:r.sourceEntryId,materialEntryId:id});
        return {id,category:library,subcategory:r.sourceSubcategory,text:r.material,description:r.description,tags:[],
          classification:{tier:'general',preferenceKey:null,eligibility:'general'}};
      });
      batches.push({format:'aetheria-lexicon-materials',schemaVersion:2,batchId,library,domain:'general',
        source:{producer,model:producer==='GPT'?'GPT (exact model not recorded)':'not recorded in source',theme:'通用词条整理扩充；独立审稿，未自动安装'},dictionary,entries});
    }
  }
  return {batches,links};
}

export async function prepareExpanded(root=projectRoot){
  const preserved=await originalsSnapshot(root),source=await readFile(path.join(root,sourcePath));
  const upload=parseInventory(source.toString('utf8')),{map,sources}=await loadCollections(root);
  if(upload.length!==10700)throw Error('通用源清单数量不符。');
  const joined=upload.map(e=>joinSource(e,map.get(e.id))),gaps=[],gapSources=[];
  for(const [i,file]of gapPaths.entries()){
    const bytes=await readFile(path.join(root,file));gapSources.push({path:file,sha256:hash(bytes)});
    const parsed=parseWorldGap(bytes.toString('utf8'),file,`v${i+1}`);
    if(parsed.length!==[138,529][i])throw Error(`环境候选数量不符：${file}`);gaps.push(...parsed);
  }
  const {additions,reused}=selectNewSeeds([...joined,...gaps,...createTaxonomy(catalog).concepts]);
  const taxonomy=expandedTaxonomy(additions),base=joined.map(e=>classifyGeneral(e,taxonomy)),world=gaps.map(e=>classifyGeneral(e,taxonomy));
  const common=additions.map(s=>({sourceEntryId:`general-common:${s.key}`,library:s.library,sourceSubcategory:s.subcategory,
    material:s.label,description:s.description,materialKind:'named',sourceJoin:'GPT-authored',source:{producer:'GPT',key:s.key},
    coreConceptIds:s.role==='core'?[taxonomy.seedConceptIds[s.key]]:[],
    qualifierConceptIds:s.role==='qualifier'?[taxonomy.seedConceptIds[s.key]]:[],contextConceptIds:[],descriptionTopicIds:[],
    resolution:s.role==='core'?'authored-core':'authored-attribute',reviewStatus:'authored-proposed',evidence:[],descriptionEvidence:[],issues:[]}));
  const entries=[...base,...world,...common];
  const duplicates=[...Map.groupBy(entries,r=>normalized(r.material))].filter(([,rs])=>rs.length>1)
    .map(([material,rs])=>({material,sourceEntryIds:rs.map(r=>r.sourceEntryId),decision:'preserve-different-sources-pending-semantic-review'}));
  const registry=await dictionaryRegistry(root),pack=registry.packs.find(p=>p.id==='aetheria/foundation');
  if(!pack)throw Error('找不到基础字典。');const dictionary={id:pack.id,version:pack.version,hash:pack.hash};
  const exports=[materialBatches(common,9001,dictionary,'GPT'),materialBatches(world,9101,dictionary,'world-gap-source')];
  for(const exp of exports)for(const batch of exp.batches){validateSemanticBatch(batch,registry);for(const e of batch.entries)if(map.has(e.id))throw Error(`导出ID与已存在条目冲突：${e.id}`);}
  const sourceCorrections=joined.filter(e=>e.sourceJoin!=='exact').map(e=>({id:e.id,join:e.sourceJoin,uploaded:e.uploadedMaterial,
    restored:e.material,collectionText:e.collectionText,collectionFile:e.collectionFile,decision:e.sourceJoin==='restored-truncated-prose'?'restore-full-text-in-derived-copy-only':'manual-review'}));
  const counts={base:base.length,worldGap:world.length,newCommon:common.length,total:entries.length,
    exactDescriptionJoins:joined.filter(e=>e.sourceJoin==='exact').length,restoredTruncatedProse:joined.filter(e=>e.sourceJoin==='restored-truncated-prose').length,
    sourceConflicts:joined.filter(e=>['conflict','missing'].includes(e.sourceJoin)).length,
    concepts:taxonomy.concepts.length,protectedNames:entries.filter(e=>e.resolution==='protected-name').length,
    withCore:entries.filter(e=>e.coreConceptIds.length).length,withQualifiers:entries.filter(e=>e.qualifierConceptIds.length).length,
    needsCoreReview:entries.filter(e=>e.resolution==='needs-core-review').length,
    seedLabelCollisions:reused.length,duplicateLabelGroups:duplicates.length,validatedV2Batches:exports.reduce((n,x)=>n+x.batches.length,0)};
  const index={format:'aetheria-general-expanded-index',schemaVersion:1,taxonomyVersion:taxonomy.version,domain:'general',runtimeImportable:false,
    counts,reviewStatus:'editorial-proposals-not-runtime-approved',nsfwChanges:0,
    sources:[{path:sourcePath,sha256:hash(source)},...gapSources,...sources],preservedSourceFiles:preserved,
    dictionary,editorialSemantics:'Name, topic, attribute, source setting, example and description evidence are separate. No state, capability, consent, eligibility or reward is inferred.',
    idPolicy:{source:'Existing IDs retained; gap IDs hash source version/library/name; new concepts use authored keys.',exports:'b9001 common / b9101 world candidates. IDs frozen in export-links.json for this delivery; future additions need new batches, never re-sort old exports.'}};
  return {index,taxonomy,entries,base,world,common,sourceCorrections,duplicates,reused,exports};
}

export async function writeExpanded(root=projectRoot){
  const result=await prepareExpanded(root),{index,taxonomy,entries,base,world,common}=result;
  const dir=path.join(root,expandedPath);await mkdir(dir,{recursive:true});
  const links=result.exports.flatMap(exp=>exp.links);
  let previousLinks=[];
  try{previousLinks=JSON.parse(await readFile(path.join(dir,'export-links.json'),'utf8'));}catch(e){if(e.code!=='ENOENT')throw e;}
  assertStableExportLinks(previousLinks,links);
  const json=(name,v)=>writeFile(path.join(dir,name),JSON.stringify(v,null,2)+'\n','utf8');
  const lines=(name,rows)=>writeFile(path.join(dir,name),rows.map(r=>JSON.stringify(r)).join('\n')+'\n','utf8');
  const md=(name,text)=>writeFile(path.join(dir,name),text,'utf8');
  await json('taxonomy.json',taxonomy);await json('index.json',index);
  await lines('entries.jsonl',entries);await lines('base-10700.jsonl',base);await lines('world-gap-667.jsonl',world);
  await json('common-additions.json',common);await json('source-corrections.json',result.sourceCorrections);
  await json('duplicates.json',result.duplicates);await json('reused-common-labels.json',result.reused);
  await lines('needs-core-review.jsonl',entries.filter(e=>e.resolution==='needs-core-review'));
  const labels=new Map(taxonomy.concepts.map(c=>[c.id,c])),names=ids=>ids.map(id=>labels.get(id).label).join('、')||'—';
  const attrs=e=>e.qualifierConceptIds.map(id=>`${labels.get(id).facet}：${labels.get(id).label}`).join('；')||'—';
  const table=rows=>`| 稳定来源ID | 原素材／独立词条 | 核心概念 | 独立属性 | 状态 |\n| --- | --- | --- | --- | --- |\n${rows.map(e=>`| ${e.sourceEntryId} | ${cell(e.material)} | ${names(e.coreConceptIds)} | ${attrs(e)} | ${e.resolution} |`).join('\n')}\n`;
  await mkdir(path.join(dir,'按库'),{recursive:true});
  const libraries=[...new Set(entries.map(e=>e.library))].sort();
  for(const lib of libraries)await md(`按库/${lib}.md`,`# ${lib}\n\n核心和属性为编辑提案，完整描述、证据与上下文见 entries.jsonl。专名和句子保持完整。\n\n${table(entries.filter(e=>e.library===lib))}`);
  const seedLibraries=[...new Set(common.map(e=>e.library))];
  await md('新增常用通用词条.md',`# 新增常用通用词条（${common.length}条）\n\nGPT 撰写；排除与已有素材、概念和环境候选重名的条目。对象与属性分栏，定义说明适用范围；不靠改颜色或堆修饰词凑数。原子属性允许短语命名，但一条只表示一个维度。\n\n${seedLibraries.map(lib=>`## ${lib}\n\n| 独立词条 | 类型／维度 | 定义 | 稳定来源ID |\n| --- | --- | --- | --- |\n${common.filter(e=>e.library===lib).map(e=>{const d=labels.get([...e.coreConceptIds,...e.qualifierConceptIds][0]);return `| ${e.material} | ${d.role} / ${d.facet} | ${e.description} | ${e.sourceEntryId} |`;}).join('\n')}\n`).join('\n')}`);
  await md('世界环境候选整理.md',`# 世界／环境候选整理（667条）\n\n原两批138+529条逐条保留。主题作为背景筛选条件单列，不赋予当前世界这些设定。来源未记录模型名，不能断言两批由 Grok 生成；已收录的 world-* JSON 原词库标记为 Grok Bot。\n\n${[...new Set(world.map(e=>e.source.theme))].map(theme=>`## ${theme}\n\n背景维度：${names(taxonomy.settingContexts[theme]??[])}\n\n${table(world.filter(e=>e.source.theme===theme))}`).join('\n')}`);
  await md('原子概念字典.md',`# 原子概念字典\n\n编辑命名空间，未注册为游戏 TagDef。一个核心概念可有多个原素材例句；属性、背景与核心对象不得合并为复合Tag。定义相近但不同维度的标签不自动合并。\n\n| ID | 标签 | 类型 | 维度 | 定义 |\n| --- | --- | --- | --- | --- |\n${taxonomy.concepts.map(c=>`| ${c.id} | ${c.label} | ${c.role} | ${c.facet} | ${cell(c.definition)} |`).join('\n')}\n`);
  await md('来源全文恢复.md',`# 来源全文恢复与冲突\n\n原上传文件未改动。5条上传清单短句是对应JSON全文的严格前缀，仅在派生整理版中恢复，原ID与原短句均保存。非前缀差异不自动覆盖。\n\n${result.sourceCorrections.map(c=>`## ${c.id}\n\n- 核验：${c.join}\n- 上传：${c.uploaded}\n- 全文：${c.collectionText}\n- JSON：${c.collectionFile}\n`).join('\n')}`);
  const examples=['细铜丝耳圈','霓虹下层雨街','公司塔裙楼层','哑光陶瓷臂壳','棉絮触肤','先问再帮','雨夜灯罩环','低重力','零重力'];
  await md('拆分规则与示例.md',`# 拆分规则与示例\n\n1. 核心对象独立：耳饰不包含尺寸、材质和佩戴场景。\n2. 属性分维度：颜色、材质、尺寸、质感、灯光、层位、天气、时间与空间分别记录，不猜测修饰对象。\n3. 主题分离：赛博、废土、地下、极地是来源背景，不能改变游戏世界设定。\n4. 姓名、外号与正式地名保留；普通设施名中的修饰可以拆分。\n5. 长句保留为例句；目录功能和描述主题单列，不冒充实体状态。\n6. 描述不反推材质，否定、假设和类比不作为正向属性；涉及作用域的映射仍需审稿。\n7. 不靠切字拆词；遇到语义不明保留原素材并排入 needs-core-review.jsonl。\n\n${table(examples.map(n=>entries.find(e=>e.material===n)).filter(Boolean))}\n每条候选都有 evidence（标题／目录依据）、descriptionEvidence（说明依据）与 source（来源）。说明主题与标题拆分结果独立；所有自动映射为 unreviewed。\n`);
  await mkdir(path.join(dir,'v2-material-batches'),{recursive:true});
  for(const exp of result.exports)for(const batch of exp.batches)await json(`v2-material-batches/${batch.batchId}.json`,batch);
  await json('export-links.json',links);
  await md('v2-material-batches/README.md',`# v2纯素材交换批次\n\n共 ${index.counts.validatedV2Batches} 批，已用仓库 validateSemanticBatch 校验格式、分级、ID与字典引用。只含新增常用词条和世界候选，原10700条ID保持在主表中。\n\n运行：node scripts/lexicon/cli.mjs validate-v2 <文件路径>。单批最多50条。b9001起为GPT新增，b9101起为世界候选；这些ID只为本次交付固定，后续增补另开批次，不能重新排序覆盖已发布ID。export-links.json保留回溯关系。\n\n这是待审文字素材，未安装到游戏。tags为空数组：general-taxonomy编辑概念还不是运行字典ID，不能假装已注册。检索与审稿使用外侧taxonomy.json和entries.jsonl中的编辑标签。批次没有奖励、关系或身体状态效果字段。\n\n字典：${index.dictionary.id} ${index.dictionary.version}，hash=${index.dictionary.hash}。字典升级时须重新校验；不得直接替换引用字符串。\n`);
  await md('README.md',`# 通用词条统一整理与扩充\n\n- 原有通用素材：${index.counts.base}条，完整保留原ID和来源。\n- 世界／环境候选：${index.counts.worldGap}条，两批均纳入；维持候选状态。\n- 真正新增常用词条：${index.counts.newCommon}条；${index.counts.seedLabelCollisions}项重名提案单列复核，不重复添加，也不自动合并不同语义。\n- 合计：${index.counts.total}条素材；${index.counts.concepts}个独立编辑概念（含背景与属性）。\n- 10,695条精确关联原JSON描述；5条被截短的句子在派生版恢复全文，来源冲突${index.counts.sourceConflicts}条。\n- ${index.counts.protectedNames}个专名保留；${index.counts.needsCoreReview}条没有可靠核心拆分，明确列入复核队列。自动映射均未标记审稿通过。\n- 原交付${index.preservedSourceFiles.length}个文件哈希不变，NSFW改动0。游戏引擎、规则、存档和运行字典不变。\n\n## 阅读入口\n\n- [新增常用词条](新增常用通用词条.md)\n- [世界环境候选](世界环境候选整理.md)\n- [拆分规则与示例](拆分规则与示例.md)\n- [原子概念字典](原子概念字典.md)\n- [按库浏览](按库/)（${libraries.length}库）\n- [全文恢复记录](来源全文恢复.md)\n- [v2交换批次说明](v2-material-batches/README.md)\n- [机器索引与来源哈希](index.json)\n\nentries.jsonl为合并主表，base-10700.jsonl、world-gap-667.jsonl、common-additions.json为分源副本；taxonomy.json为编辑概念定义；duplicates.json列出跨来源重名而不破坏性合并；needs-core-review.jsonl是待审队列。descriptionTopicIds只说明描写涉及什么，不能证明玩家拥有某部位或已经执行某动作。\n\n本轮完成资料整理、补充写作、格式校验与回溯；不宣称全部自动语义映射已人工审定，也未把候选直接装入运行词库。[上一版仅标题整理](../general-refined/README.md)保留作历史快照，本版核对了JSON全文。\n\n重建：node scripts/lexicon/expand-general-library.mjs。源文件哈希变化将停止输出，JSON来源哈希写入索引。\n`);
  if(JSON.stringify(await originalsSnapshot(root))!==JSON.stringify(index.preservedSourceFiles))throw Error('原件在整理期间变化。');
  // JSON来源同样核对，防止生成期间读到并发修改后的不同版本。
  for(const s of index.sources){
    const bytes=await readFile(path.join(root,s.path));
    const actual=hash(s.hashing==='json-stringify-sha256'?JSON.stringify(JSON.parse(bytes)):bytes);
    if(actual!==s.sha256)throw Error(`来源并发变化：${s.path}`);
  }
  return result;
}

export function assertStableExportLinks(previous,next){
  const bySource=new Map(next.map(l=>[l.sourceEntryId,l.materialEntryId]));
  const byTarget=new Set(next.map(l=>l.materialEntryId));
  if(bySource.size!==next.length||byTarget.size!==next.length)throw Error('交换批次ID冲突。');
  for(const p of previous)if(bySource.get(p.sourceEntryId)!==p.materialEntryId)throw Error(`已交付ID不得重排或静默删除：${p.sourceEntryId}。请发布新交付版本并显式迁移。`);
}

if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){
  try{const r=await writeExpanded();console.log(JSON.stringify(r.index.counts,null,2));}catch(e){console.error(e.stack);process.exitCode=1;}
}
