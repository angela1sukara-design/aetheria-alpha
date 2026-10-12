import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
import { catalog } from './catalog.mjs';
import { createTaxonomy } from './general-tag-taxonomy.mjs';

export const projectRoot = fileURLToPath(new URL('../../', import.meta.url));
export const deliveryPath = 'production/tag-deliveries/2026-10-12';
export const sourcePath = `${deliveryPath}/readable/2026-10-12-已写好tag-正文交付/01-通用已有/通用已有词条清单-10700.md`;
export const outputPath = `${deliveryPath}/general-refined`;
const sha256 = value => createHash('sha256').update(value).digest('hex');

export function parseInventory(text) {
  const entries = [];
  const ids = new Set();
  const libs = new Map(catalog.map(c => [c.code,c]));
  for (const [i,line] of text.split(/\r?\n/).entries()) {
    if (!line.startsWith('- `lx.')) continue;
    const match = /^- `(lx\.([a-z-]+)\.b\d{4}\.\d{4})` · ([^\r\n]+?) · ([^\r\n]+)$/.exec(line);
    if (!match) throw Error(`清单第${i+1}行无法无损解析。`);
    const [,id,library,subcategory,material] = match;
    const lib = libs.get(library);
    if (!lib || !lib.subcategories.includes(subcategory) || ids.has(id)) throw Error(`分类或ID冲突：${id}`);
    ids.add(id);
    entries.push({id,library,subcategory,material,kind:lib.kind,sourceLine:i+1});
  }
  if (!entries.length) throw Error('没有找到清单条目。');
  return entries;
}

function nonOverlapping(evidence, definitions) {
  const accepted = [];
  // 同一维度最长匹配优先：黄铜不拆成黄铜+铜，项链坠不拆成项链+挂坠。
  for (const e of evidence.sort((a,b) => b.fragment.length-a.fragment.length || a.start-b.start || a.conceptId.localeCompare(b.conceptId))) {
    if (accepted.some(a => definitions.get(a.conceptId).facet === definitions.get(e.conceptId).facet && a.start < e.end && e.start < a.end)) continue;
    accepted.push(e);
  }
  return accepted.sort((a,b) => a.start-b.start || a.conceptId.localeCompare(b.conceptId));
}

export function refineEntry(entry, taxonomy = createTaxonomy(catalog)) {
  const bucket = taxonomy.buckets.find(b => b.library === entry.library && b.label === entry.subcategory);
  if (!bucket) throw Error(`未定义来源分类：${entry.library}/${entry.subcategory}`);
  const protectedName = taxonomy.protectedLibraries.includes(entry.library)
    || taxonomy.protectedSubcategories[entry.library]?.includes(entry.subcategory) === true;
  const definitions = new Map(taxonomy.concepts.map(c => [c.id,c]));
  const explicit = [], inherited = [];
  if (!protectedName) for (const rule of taxonomy.rules) {
    if (rule.source === 'source-subcategory') {
      if (rule.library === entry.library && rule.subcategory === entry.subcategory) inherited.push({conceptId:rule.conceptId,ruleId:rule.id,source:rule.source,fragment:entry.subcategory,start:null,end:null});
    } else if (rule.libraries.includes(entry.library)) {
      for (const match of entry.material.matchAll(new RegExp(rule.expression,'gu'))) explicit.push({conceptId:rule.conceptId,ruleId:rule.id,source:rule.source,fragment:match[0],start:match.index,end:match.index+match[0].length});
    }
  }
  const evidence = [...nonOverlapping(explicit,definitions),...inherited];
  const core = [...new Set(evidence.filter(e => definitions.get(e.conceptId).role === 'core').map(e => e.conceptId))];
  const qualifiers = [...new Set(evidence.filter(e => definitions.get(e.conceptId).role === 'qualifier').map(e => e.conceptId))];
  const attributeOnly = taxonomy.attributeLibraries.includes(entry.library) && qualifiers.length>0;
  const issues = [];
  if (!protectedName && !attributeOnly && !core.length) issues.push('core-needs-review');
  if (core.length > 1) issues.push('multiple-topics-do-not-collapse');
  if (qualifiers.length) issues.push('qualifier-scope-needs-review');
  if (entry.kind === 'phrase') issues.push('prose-kept-as-example');
  if (entry.library === 'body-form' && ['悬浮形态','游水形态'].includes(entry.subcategory)) issues.push('source-category-does-not-prove-capability');
  if (entry.library === 'body-surface' && entry.subcategory === '皮肤质感') issues.push('metaphor-does-not-prove-material');
  return {sourceEntryId:entry.id,sourceLine:entry.sourceLine,library:entry.library,sourceSubcategory:entry.subcategory,sourceBucketId:bucket.id,
    material:entry.material,materialKind:entry.kind,retention:protectedName?'proper-name-kept':'source-phrase-kept',
    coreConceptIds:core,qualifierConceptIds:qualifiers,resolution:protectedName?'protected-name':attributeOnly?'attribute-only':core.length?'proposed':'needs-core-review',
    reviewStatus:'unreviewed',issues,evidence};
}

function duplicateGroups(entries) {
  const groups = Map.groupBy(entries,e => e.material.normalize('NFKC').trim());
  return [...groups].filter(([,rows]) => rows.length>1).map(([material,rows]) => ({material,entryIds:rows.map(e=>e.id),sourceLibraries:rows.map(e=>e.library),decision:'keep-separate-until-reviewed'}));
}

async function preservationSnapshot(root) {
  const receipt = JSON.parse(await readFile(path.join(root,deliveryPath,'receipt.json'),'utf8'));
  const records = [...receipt.originals,...receipt.extractedFiles];
  const results = [];
  for (const record of records) {
    const bytes = await readFile(path.join(root,deliveryPath,record.path));
    const actual = sha256(bytes);
    if (actual !== record.sha256) throw Error(`原件哈希不匹配，停止输出：${record.path}`);
    results.push({path:record.path,sha256:actual});
  }
  return results;
}

export async function buildRefinement(root = projectRoot) {
  const before = await preservationSnapshot(root);
  const source = await readFile(path.join(root,sourcePath));
  const entries = parseInventory(source.toString('utf8'));
  if (entries.length !== 10700 || new Set(entries.map(e=>e.library)).size !== 58) throw Error('清单实际条数或分类数与预期不符，不能生成完整交付。');
  const taxonomy = createTaxonomy(catalog);
  const refined = entries.map(e=>refineEntry(e,taxonomy));
  const duplicates = duplicateGroups(entries);
  const used = new Set(refined.flatMap(e=>[...e.coreConceptIds,...e.qualifierConceptIds]));
  const counters = {entries:entries.length,libraries:58,sourceBuckets:taxonomy.buckets.length,definedConcepts:taxonomy.concepts.length,usedConcepts:used.size,
    withCore:refined.filter(e=>e.coreConceptIds.length).length,withQualifiers:refined.filter(e=>e.qualifierConceptIds.length).length,
    protectedNames:refined.filter(e=>e.resolution==='protected-name').length,attributeOnly:refined.filter(e=>e.resolution==='attribute-only').length,needsCoreReview:refined.filter(e=>e.resolution==='needs-core-review').length,
    proseExamples:refined.filter(e=>e.materialKind==='phrase').length,duplicateNameGroups:duplicates.length};
  const stats = catalog.map(c => ({library:c.code,label:c.label,entries:refined.filter(e=>e.library===c.code).length,
    withCore:refined.filter(e=>e.library===c.code&&e.coreConceptIds.length).length,
    withQualifiers:refined.filter(e=>e.library===c.code&&e.qualifierConceptIds.length).length,
    needsCoreReview:refined.filter(e=>e.library===c.code&&e.resolution==='needs-core-review').length}));
  const dir = path.join(root,outputPath);
  await mkdir(dir,{recursive:true});
  const json = (name,value) => writeFile(path.join(dir,name),JSON.stringify(value,null,2)+'\n','utf8');
  await json('taxonomy.json',taxonomy);
  await writeFile(path.join(dir,'entries.jsonl'),refined.map(e=>JSON.stringify(e)).join('\n')+'\n','utf8');
  await writeFile(path.join(dir,'needs-core-review.jsonl'),refined.filter(e=>e.resolution==='needs-core-review').map(e=>JSON.stringify(e)).join('\n')+'\n','utf8');
  await json('duplicates.json',{format:'aetheria-general-duplicate-audit',groups:duplicates});
  const index = {format:'aetheria-general-refinement-index',schemaVersion:1,taxonomyVersion:taxonomy.version,domain:'general',runtimeImportable:false,
    source:{path:sourcePath,sha256:sha256(source),columns:['id','subcategory','display-phrase'],descriptionsAvailable:false},counts:counters,libraries:stats,
    reviewStatus:'proposed-not-approved',nsfwChanges:0,preservedSourceFiles:before,editorialSemantics:'Topics and qualifiers of source wording only; do not infer entity state or modifier attachment.'};
  const after = await preservationSnapshot(root);
  if (JSON.stringify(before)!==JSON.stringify(after)) throw Error('整理期间原件发生变化，停止交付。');
  await json('index.json',index);
  const labels = new Map(taxonomy.concepts.map(c=>[c.id,c.label]));
  const selected = ['细铜丝耳圈','骨片项链坠','腕上擦汗帕','腰间针线筒','雨夜灯罩环','初薪碎币孔','哑光陶瓷臂壳','黄铜铰链肘','圆耳薄廓','垂耳软折','短尾绒球','棉絮触肤','灰瓦排屋','街角手压井','篷布缝补工','先问再帮','不问薪资隐私','浅蹼指缝','学徒灯'];
  const examples = selected.map(name=>refined.find(e=>e.material===name)).filter(Boolean);
  const cell = value => String(value).replaceAll('|','\\|').replaceAll('\n',' ');
  const coreText = e => e.coreConceptIds.map(id=>labels.get(id)).join('、') || (e.resolution==='protected-name'?'专名':e.resolution==='attribute-only'?'属性词':'待复核');
  const qualifierText = e => e.qualifierConceptIds.map(id=>{const c=taxonomy.concepts.find(c=>c.id===id);return c.facet+'：'+c.label;}).join('；');
  await writeFile(path.join(dir,'拆分示例.md'),`# 通用 Tag 原子化示例\n\n原短语保留为素材，核心概念不附带材质、部位、场景或强度。所有映射仍待语义审稿；修饰属性的作用对象不能由关键词自动推定。\n\n| 原素材 | 核心概念 | 独立修饰维度 | 处理 |\n| --- | --- | --- | --- |\n${examples.map(e=>`| ${cell(e.material)} | ${coreText(e)} | ${qualifierText(e)||'不猜测'} | ${e.resolution==='protected-name'?'专名保持完整':e.resolution==='needs-core-review'?'不强制拆分，列入复核':e.materialKind==='phrase'?'原句保留作例句':'保留原ID与短语'} |`).join('\n')}\n`,'utf8');
  await writeFile(path.join(dir,'通用词条整理版.md'),`# 通用词条整理版（10,700条）\n\n只整理通用域。每条保留原ID和原短语；标签候选待审阅，未导入游戏。空白含义不推定。\n\n${catalog.map(c=>`## ${c.code} · ${c.label}\n\n| 来源ID | 原素材 | 核心概念 | 独立修饰 | 状态 |\n| --- | --- | --- | --- | --- |\n${refined.filter(e=>e.library===c.code).map(e=>`| ${e.sourceEntryId} | ${cell(e.material)} | ${coreText(e)} | ${qualifierText(e)||'—'} | ${e.resolution} |`).join('\n')}\n`).join('\n')}`,'utf8');
  await writeFile(path.join(dir,'原子概念字典.md'),`# 通用原子概念字典\n\n仅供本批素材整理与审稿使用；general-taxonomy命名空间未注册到游戏。目录分组不是Tag，原短语不是同义别名。\n\n| 稳定ID | 标签 | 角色 | 维度 |\n| --- | --- | --- | --- |\n${taxonomy.concepts.map(c=>`| ${c.id} | ${c.label} | ${c.role} | ${c.facet} |`).join('\n')}\n`,'utf8');
  await writeFile(path.join(dir,'分类统计.md'),`# 通用词条整理统计\n\n本次逐行核验 ${counters.entries} 条、${counters.libraries} 库。来源只有ID、子类和显示短语，没有完整JSON描述；不能据此宣称逐条语义审稿通过。\n\n${Object.entries(counters).map(([key,value])=>'- '+key+': '+value).join('\n')}\n\n| 库 | 条数 | 提取核心概念 | 提取修饰维度 | 待核心复核 |\n| --- | --- | --- | --- | --- |\n${stats.map(s=>`| ${s.library} · ${s.label} | ${s.entries} | ${s.withCore} | ${s.withQualifiers} | ${s.needsCoreReview} |`).join('\n')}\n\n原交付 ${before.length} 个文件哈希保持一致，包含NSFW文件。重复名称只生成复核记录，不合并不同语义、用途或来源ID。\n`,'utf8');
  console.log(JSON.stringify(counters,null,2));
  return {index,taxonomy,entries:refined,duplicates};
}

if (process.argv[1] && import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href) {
  try { await buildRefinement(); } catch (error) { console.error(error.message);process.exitCode=1; }
}
