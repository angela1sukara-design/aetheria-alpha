import {readFile, writeFile, mkdir, readdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {expansionSeeds, expansionGroups} from './common-general-seeds-v2.mjs';
import {projectRoot, deliveryPath} from './refine-general-tags.mjs';
import {expandedPath, materialBatches, assertStableExportLinks} from './expand-general-library.mjs';
import {dictionaryRegistry, validateSemanticBatch} from './semantic-format.mjs';

export const expansionV2Path = `${deliveryPath}/general-expansion-v2`;
export const normalizeLabel = value => value.normalize('NFKC').trim();
const sha = value => createHash('sha256').update(value).digest('hex');
const jsonl = rows => rows.map(row => JSON.stringify(row)).join('\n') + '\n';
const cell = value => String(value ?? '').replaceAll('|', '\\|').replaceAll('\n', ' ');
const sourceId = seed => `general-common:v2.${seed.key}`;
const conceptId = seed => `general-taxonomy:v2.${seed.key}`;

/** 同名只进入复核清单；不凭字面断定不同来源或不同作用域的概念等价。 */
export function selectExpansion(existing, concepts, seeds = expansionSeeds) {
  const labels = new Map();
  const remember = (label, id, kind) => {
    const key = normalizeLabel(label);
    if (!labels.has(key)) labels.set(key, []);
    labels.get(key).push({id, kind});
  };
  for (const row of existing) remember(row.material, row.sourceEntryId, 'material');
  for (const def of concepts) {
    remember(def.label, def.id, 'concept');
    for (const alias of def.aliases ?? []) remember(alias, def.id, 'alias');
  }
  const keys = new Set(), additions = [], collisions = [], winners = new Map();
  const priority = new Map(expansionGroups.map((group,index) => [group.key,index]));
  // 同批同名按固定分组优先级及稳定键确定候选，不按调用方的数组顺序抢占。
  for (const seed of seeds) {
    if (keys.has(seed.key)) throw Error(`候选稳定键重复：${seed.key}`);
    keys.add(seed.key);
    if (!/^[a-z][a-z0-9-]*\.[a-z][a-z0-9-]*$/.test(seed.key) || !seed.definition.trim() || seed.definition.length > 240)
      throw Error(`候选定义不合法：${seed.key}`);
    const key = normalizeLabel(seed.label), winner = winners.get(key);
    const rank = priority.get(seed.group) ?? Number.MAX_SAFE_INTEGER;
    const winnerRank = priority.get(winner?.group) ?? Number.MAX_SAFE_INTEGER;
    if (!winner || rank < winnerRank || (rank === winnerRank && seed.key < winner.key)) winners.set(key,seed);
  }
  for (const seed of seeds) {
    const key = normalizeLabel(seed.label), winner = winners.get(key);
    if (labels.has(key) || winner.key !== seed.key) {
      collisions.push({sourceEntryId:sourceId(seed), label:seed.label, proposedRole:seed.role, proposedFacet:seed.facet,
        definition:seed.definition, existingReferences:(labels.get(key) ?? [{id:sourceId(winner),kind:'new-candidate'}]).map(x => ({...x})),
        decision:'exclude-new-material-pending-semantic-review', automaticallyMerged:false});
      continue;
    }
    additions.push(seed);
  }
  return {additions, collisions};
}

export function ruleHint(seed) {
  const isParameter = seed.valueType === 'number' || seed.group === 'properties';
  const semanticKind = isParameter ? 'parameter-dimension' : seed.usage === 'action-intent' ? 'action-intent'
    : seed.group === 'goals' ? 'goal' : seed.group === 'habits' ? 'habit'
    : seed.group === 'history' ? 'history-fact' : seed.group === 'emotion' ? 'current-emotion'
    : seed.facet === 'interaction-state' ? 'interaction-fact' : seed.role === 'core' ? 'object-or-concept' : 'attribute';
  return {sourceEntryId:sourceId(seed), conceptId:conceptId(seed), runtimeExecutable:false,
    family:seed.family, usage:seed.usage, semanticKind, facet:seed.facet,
    allowedSubjectKinds:[...seed.subjects], bindingPolicy:'explicit-subject-instance',
    requiredBindings:seed.facet === 'spatial-relation' ? ['subjectId','referenceSubjectId']
      : seed.family === 'interaction' ? ['sceneId','participantIds','scope']
      : seed.usage === 'action-intent' ? ['actorId','targetId-or-explicit-none'] : ['subjectId'],
    value:{type:seed.valueType, unit:seed.unit, default:null,
      unitPolicy:seed.valueType === 'number' ? 'declared-unit-no-implicit-conversion' : isParameter ? 'requires-property-specific-schema' : 'not-applicable'},
    sourceOfTruth:seed.usage === 'action-intent' ? 'action-definition-and-current-state'
      : seed.usage === 'authoritative-fact' || seed.group === 'history' ? 'recorded-facts-with-provenance'
      : seed.family === 'world' ? 'declared-world-or-location-data' : 'explicit-subject-state-with-provenance',
    missingValue:'unknown', unknownAllowsAction:false, deriveStateFromText:false,
    executionChecks:seed.usage === 'action-intent' ? ['availability','permission','resources','body-and-environment-compatibility'] : [],
    effectsAllowed:false};
}

async function fingerprint(root, relative) {
  const text = await readFile(path.join(root, relative), 'utf8');
  const canonical = relative.endsWith('.json') ? JSON.stringify(JSON.parse(text)) : text.replaceAll('\r\n', '\n');
  return {path:relative, hashing:relative.endsWith('.json') ? 'json-stringify-sha256' : 'lf-text-sha256', sha256:sha(canonical)};
}
export async function snapshotPrevious(root = projectRoot) {
  const files = [];
  async function walk(relative) {
    for (const item of (await readdir(path.join(root, relative), {withFileTypes:true})).sort((a,b) => a.name.localeCompare(b.name))) {
      const file = `${relative}/${item.name}`;
      if (item.isDirectory()) await walk(file); else files.push(await fingerprint(root, file));
    }
  }
  await walk(expandedPath); return files;
}
export async function verifyOriginalReceipts(root = projectRoot) {
  const index = JSON.parse(await readFile(path.join(root, expandedPath, 'index.json'), 'utf8'));
  for (const item of index.preservedSourceFiles) {
    const bytes = await readFile(path.join(root, deliveryPath, item.path));
    if (sha(bytes) !== item.sha256) throw Error(`原始交付文件变化：${item.path}`);
  }
  return index.preservedSourceFiles.length;
}

export async function prepareExpansionV2(root = projectRoot) {
  const previousFiles = await snapshotPrevious(root);
  const base = (await readFile(path.join(root, expandedPath, 'entries.jsonl'), 'utf8')).trim().split(/\r?\n/).map(JSON.parse);
  const previousTaxonomy = JSON.parse(await readFile(path.join(root, expandedPath, 'taxonomy.json'), 'utf8'));
  const {additions, collisions} = selectExpansion(base, previousTaxonomy.concepts);
  const definitions = additions.map(seed => ({id:conceptId(seed),label:seed.label,role:seed.role,facet:seed.facet,
    definition:seed.definition,status:'authored-proposed'}));
  const taxonomy = {...previousTaxonomy,version:'1.2.0',concepts:[...previousTaxonomy.concepts,...definitions],
    seedConceptIds:{...previousTaxonomy.seedConceptIds,...Object.fromEntries(additions.map(seed => [`v2.${seed.key}`,conceptId(seed)]))}};
  const common = additions.map(seed => ({sourceEntryId:sourceId(seed),library:seed.library,sourceSubcategory:seed.subcategory,
    material:seed.label,description:seed.definition,materialKind:'named',sourceJoin:'GPT-authored',source:{producer:'GPT',key:`v2.${seed.key}`,group:seed.group},
    coreConceptIds:seed.role === 'core' ? [conceptId(seed)] : [],qualifierConceptIds:seed.role === 'qualifier' ? [conceptId(seed)] : [],
    contextConceptIds:[],descriptionTopicIds:[],resolution:seed.role === 'core' ? 'authored-core' : 'authored-attribute',
    reviewStatus:'authored-proposed',evidence:[],descriptionEvidence:[],issues:[]}));
  const hints = additions.map(ruleHint), entries = [...base,...common];
  const registry = await dictionaryRegistry(root), pack = registry.packs.find(p => p.id === 'aetheria/foundation');
  if (!pack) throw Error('缺少运行基础字典。');
  const dictionary = {id:pack.id,version:pack.version,hash:pack.hash};
  const exported = materialBatches(common,9201,dictionary,'GPT');
  const oldLinks = JSON.parse(await readFile(path.join(root, expandedPath, 'export-links.json'), 'utf8'));
  const oldTargets = new Set([...oldLinks.map(x => x.materialEntryId),...base.map(x => x.sourceEntryId)]);
  for (const batch of exported.batches) {
    validateSemanticBatch(batch,registry);
    for (const row of batch.entries) if (oldTargets.has(row.id)) throw Error(`导出ID占用：${row.id}`);
  }
  assertStableExportLinks([],exported.links);
  if (new Set(entries.map(x => x.sourceEntryId)).size !== entries.length || new Set(taxonomy.concepts.map(x => x.id)).size !== taxonomy.concepts.length)
    throw Error('主表或概念ID冲突。');
  const groups = expansionGroups.map(group => ({...group,
    candidateCount:expansionSeeds.filter(s => s.group === group.key).length,
    addedCount:additions.filter(s => s.group === group.key).length,
    sourceEntryIds:additions.filter(s => s.group === group.key).map(sourceId)}));
  const preservedOriginals = await verifyOriginalReceipts(root);
  const index = {format:'aetheria-general-expansion-v2',schemaVersion:1,domain:'general',runtimeImportable:false,
    reviewStatus:'authored-proposed',nsfwChanges:0,previousRelease:expandedPath,previousFiles,
    counts:{previousMaterials:base.length,candidates:expansionSeeds.length,newCommon:common.length,
      excludedLabelCollisions:collisions.length,totalMaterials:entries.length,previousConcepts:previousTaxonomy.concepts.length,
      newConcepts:definitions.length,totalConcepts:taxonomy.concepts.length,groups:groups.length,
      numericParameters:hints.filter(h => h.value.type === 'number').length,
      previousNeedsCoreReview:base.filter(r => r.resolution === 'needs-core-review').length,
      validatedV2Batches:exported.batches.length,verifiedOriginalReceipts:preservedOriginals},dictionary,
    idPolicy:'v2 candidate keys are immutable; b9201+ reserved for this frozen release; further additions require a new release',
    ruleHintStatus:'authoring-metadata-only-no-runtime-template-compiler',
    textImportStatus:'v2 exchange batches validated; not installed; editorial concepts are not runtime TagDef IDs'};
  return {index,base,previousTaxonomy,taxonomy,common,entries,hints,groups,collisions,exported};
}

export function assertFrozenRelease(previousLinks, nextLinks) {
  assertStableExportLinks(previousLinks,nextLinks);
  if (previousLinks.length && previousLinks.length !== nextLinks.length) throw Error('已发布批次不可增补；请新开交付版本。');
}
export async function writeExpansionV2(root = projectRoot) {
  const result = await prepareExpansionV2(root);
  const dir = path.join(root, expansionV2Path);
  let previousLinks;
  try { previousLinks = JSON.parse(await readFile(path.join(dir,'export-links.json'),'utf8')); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
  if (previousLinks) assertFrozenRelease(previousLinks,result.exported.links);
  await mkdir(path.join(dir,'v2-material-batches'),{recursive:true});
  const write = (file,text) => writeFile(path.join(dir,file),text,'utf8');
  const json = (file,value) => write(file,JSON.stringify(value,null,2)+'\n');
  await json('index.json',result.index); await json('groups.json',result.groups);
  await json('common-additions.json',result.common); await json('rule-hints.json',result.hints);
  await json('label-collisions.json',result.collisions); await json('taxonomy.json',result.taxonomy);
  await write('new-entries.jsonl',jsonl(result.common)); await write('entries.jsonl',jsonl(result.entries));
  await json('export-links.json',result.exported.links);
  for (const batch of result.exported.batches) await json(`v2-material-batches/${batch.batchId}.json`,batch);
  const c = result.index.counts;
  await write('README.md',`# 第二轮通用词条扩充\n\n本轮新增 ${c.newCommon} 条，覆盖 ${c.groups} 组常用概念。累计 ${c.totalMaterials} 条素材、${c.totalConcepts} 个编辑概念。${c.excludedLabelCollisions} 个同名候选未重复添加，详见 label-collisions.json；这里不自动判定同义。NSFW 原件保持不变。\n\n- [新增词条和定义](新增通用词条.md)：按用途阅读，不用翻全部主表。\n- common-additions.json / new-entries.jsonl：仅本轮新增。\n- entries.jsonl / taxonomy.json：合并主表与编辑字典；上一版数据逐条保留，不重新自动拆分。\n- groups.json / rule-hints.json：适用主体、对象绑定、参数单位、事实来源与未知值策略。\n- [规则用途说明](规则用途说明.md)：说明这些元数据如何供后续规则开发使用。\n- v2-material-batches：${c.validatedV2Batches} 个正式 v2 纯文字交换批次，ID 使用 b9201 起的独立命名空间。\n\n状态：GPT 已主写定义，审稿状态 authored-proposed；纯文字格式和引用已校验。素材尚未安装到游戏；编辑概念不是运行 TagDef，交换批次 tags 留空。rule-hints 也不是可执行的条件或效果。\n\n累计数量不等于规则覆盖率。上一轮 ${c.previousNeedsCoreReview} 条核心拆分待审仍然保留。本轮没有以补词替代这项复核，也不宣称已实现通用规则模板编译器。\n\n重建：node scripts/lexicon/build-general-expansion-v2.mjs。冻结版本只允许一致重建，不能向旧批次继续追加词条。原始交付 ${c.verifiedOriginalReceipts} 个文件校验哈希；前一版全目录保存规范化指纹。\n`);
  await write('新增通用词条.md',`# 新增通用词条：${c.newCommon} 条\n\n每行一个可复用概念，定义不包含隐含奖励或状态变化。参数名与参数值分开；有条件的动作不是已经发生的事实。\n\n` + result.groups.map(group => {
    const rows = result.common.filter(row => row.source.group === group.key);
    return `## ${group.label}（新增 ${rows.length} / 候选 ${group.candidateCount}）\n\n分组使用示例：${group.example}\n\n| 词条 | 独立定义 | 角色 / 维度 | 稳定 ID |\n| --- | --- | --- | --- |\n` + rows.map(row => {
      const def = result.taxonomy.concepts.find(d => d.id === [...row.coreConceptIds,...row.qualifierConceptIds][0]);
      return `| ${cell(row.material)} | ${cell(row.description)} | ${def.role} / ${def.facet} | ${row.sourceEntryId} |`;
    }).join('\n') + '\n';
  }).join('\n'));
  await write('规则用途说明.md',`# 词条与规则用途\n\n这些是编辑层元数据，不会单独解锁动作、改变关系或赋予身体能力。现有 conditions、身体查询和事务执行仍是运行依据；规则模板编译器尚未实现。\n\n| 字段 | 含义 |\n| --- | --- |\n| family / usage | 建议接入的规则类别与用途，并非现成规则 ID |\n| allowedSubjectKinds | 允许绑定的编辑对象类别，不是可直接传给 EntityRef 的值 |\n| requiredBindings | 必须补齐的主体、参照对象或互动场景范围 |\n| value | 值类型与单位；default=null 表示资料未提供实际测量值 |\n| sourceOfTruth | 运行时必须读取的权威事实来源 |\n| missingValue | 缺失为 unknown，不把未知自动当作通过 |\n| runtimeExecutable / effectsAllowed | 均为 false，不允许从这份资料执行效果 |\n\n长度、厚度、净空等 ${c.numericParameters} 个量纲使用显式单位；没有默认数值，不根据“狭窄”自动填入门宽。弹性、导电性等物性仅标注为参数维度，其具体量表需要单独定义，不把“出现该词”视为对象具备该属性。\n\n空间关系需要 subjectId 和 referenceSubjectId。身体尺寸需要绑定同一个部位实例；多个角色各自查询，不能把全场标签混成一套。\n\n情绪是当前状态；性格和习惯是选择倾向；目标是愿望；经历和互动同意是有来源的事实。兴趣不授予技能，职业不授予许可，随和不代替同意。邀约、接触、暂停、继续需要检查本次范围、资源和兼容性。\n\n编辑示例（不是可执行脚本）：\n\n1. 搬运：绑定行动者与具体物品，查询其质量、可握持结构和当前资源，再由已有事务结算。\n2. 通道：绑定具体身体部位与通道，对照真实尺寸、姿态和净空；尺寸缺失时不能仅凭“宽阔”放行。\n3. 日常对话：当前情绪决定表达变体；已记录经历决定可提及事实，不从词条定义创建新记忆。\n4. 互动恢复：读取实际场景、参与者与本次同意，重新校验身体和接触资源，不依据“信任”跳过检查。\n\n导入文字：node scripts/lexicon/cli.mjs validate-v2 <批次文件>。校验只证明结构、分级和字典引用符合要求；审稿与安装需走已有内容流水线。文字批次无奖励、效果或状态字段，编辑 ID 不硬塞进运行字典。\n\n同名候选仅排除重复添加，原有概念或素材保留；某些同名词可能处于不同语义或作用域，必须阅读 label-collisions.json 再决定是否人工关联。\n`);
  await write('验证与完成状态.md',await readFile(path.join(root,'docs/general-vocabulary-expansion-v2.md'),'utf8'));
  if (JSON.stringify(await snapshotPrevious(root)) !== JSON.stringify(result.index.previousFiles)) throw Error('上一版资料在生成期间发生变化。');
  await verifyOriginalReceipts(root);
  return result;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try { const result = await writeExpansionV2(); console.log(JSON.stringify(result.index.counts,null,2)); }
  catch (error) { console.error(error.stack); process.exitCode=1; }
}
