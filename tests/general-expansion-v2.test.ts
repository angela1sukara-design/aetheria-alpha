import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import path from 'node:path';
import {expansionSeeds,expansionGroups} from '../scripts/lexicon/common-general-seeds-v2.mjs';
import {prepareExpansionV2,expansionV2Path,selectExpansion,ruleHint,assertFrozenRelease,snapshotPrevious,verifyOriginalReceipts} from '../scripts/lexicon/build-general-expansion-v2.mjs';
import {dictionaryRegistry,validateSemanticBatch} from '../scripts/lexicon/semantic-format.mjs';
import {projectRoot} from '../scripts/lexicon/refine-general-tags.mjs';

const result = await prepareExpansionV2();
const readJson = async (name:string) => JSON.parse(await readFile(path.join(projectRoot,expansionV2Path,name),'utf8'));
const byLabel = (label:string) => result.common.find((r:any) => r.material === label)!;
const hintFor = (label:string) => result.hints.find((r:any) => r.sourceEntryId === byLabel(label).sourceEntryId)!;

test('第二轮：820候选去重为787新增，主表12542条，旧素材逐条保留',()=>{
  assert.equal(expansionSeeds.length,820); assert.equal(result.common.length,787);
  assert.equal(result.collisions.length,33); assert.equal(result.entries.length,12542);
  assert.deepEqual(result.entries.slice(0,result.base.length),result.base);
  assert.equal(new Set(result.entries.map((r:any) => r.sourceEntryId)).size,result.entries.length);
  const oldLabels = new Set([...result.base.map((r:any) => r.material),...result.previousTaxonomy.concepts.map((r:any) => r.label)].map((s:string) => s.normalize('NFKC').trim()));
  for (const row of result.common) { assert.ok(!oldLabels.has(row.material.normalize('NFKC').trim())); assert.equal(row.reviewStatus,'authored-proposed'); }
});

test('第二轮：41组均有实际新增与说明，跨库角色和规则用途独立',()=>{
  assert.equal(expansionGroups.length,41);
  for (const group of result.groups) {
    assert.ok(group.addedCount > 0,group.key); assert.ok(group.example.length > 15);
    assert.equal(group.candidateCount,20); assert.equal(group.sourceEntryIds.length,group.addedCount);
    for (const id of group.sourceEntryIds) assert.ok(result.common.some((r:any) => r.sourceEntryId === id && r.source.group === group.key));
  }
  assert.equal(result.groups.reduce((n:number,g:any) => n+g.addedCount,0),result.common.length);
  for (const row of result.common) { assert.ok(row.description.length > 8); assert.ok(!/TODO|NSFW|待补|占位/.test(row.description)); }
});

test('第二轮：重名、别名及全角名称进入复核而非自动合并，重复稳定键拒绝',()=>{
  const seed = expansionSeeds[0];
  const selected = selectExpansion([{material:' A ',sourceEntryId:'old'}],[{id:'concept-x',label:'其他',aliases:['另名']}],
    [{...seed,key:'test.a',label:'Ａ'},{...seed,key:'test.b',label:'另名'},{...seed,key:'test.c',label:'新词'}]);
  assert.deepEqual(selected.additions.map((x:any) => x.key),['test.c']);
  assert.equal(selected.collisions[0].existingReferences[0].id,'old');
  assert.equal(selected.collisions[1].existingReferences[0].kind,'alias');
  for (const collision of result.collisions) { assert.ok(collision.existingReferences.length); assert.equal(collision.automaticallyMerged,false); }
  assert.throws(()=>selectExpansion([],[],[seed,seed]),/稳定键重复/);
});

test('第二轮：概念ID由键定义且与排序无关，旧定义与旧匹配规则原样保留',()=>{
  assert.deepEqual(result.taxonomy.concepts.slice(0,result.previousTaxonomy.concepts.length),result.previousTaxonomy.concepts);
  assert.deepEqual(result.taxonomy.rules,result.previousTaxonomy.rules);
  const selected = selectExpansion(result.base,result.previousTaxonomy.concepts,[...expansionSeeds].reverse());
  const keys = (rows:any[]) => rows.map((x:any) => `general-common:v2.${x.key}`).sort();
  assert.deepEqual(keys(selected.additions),result.common.map((x:any) => x.sourceEntryId).sort());
  for (const row of result.common) {
    const ids = [...row.coreConceptIds,...row.qualifierConceptIds]; assert.equal(ids.length,1);
    const definition = result.taxonomy.concepts.find((x:any) => x.id === ids[0]);
    assert.ok(definition); assert.equal(definition.label,row.material); assert.equal(definition.definition,row.description);
    assert.ok(definition.id.startsWith('general-taxonomy:v2.'));
  }
});

test('第二轮：灯光、声音、空间对象、味觉分别归入独立维度',()=>{
  for (const name of ['低鸣','高音','低音','吸声','掩蔽声']) assert.equal(hintFor(name).facet,'sound');
  assert.equal(hintFor('余辉').facet,'lighting');
  assert.ok(byLabel('壁龛').coreConceptIds.length); assert.equal(hintFor('壁龛').facet,'space');
  assert.equal(hintFor('相邻').facet,'spatial-relation');
  assert.deepEqual(hintFor('相邻').requiredBindings,['subjectId','referenceSubjectId']);
  for (const name of ['甜味','咸味','酸味','苦味','酥脆口感']) {
    assert.ok(byLabel(name).qualifierConceptIds.length); assert.equal(hintFor(name).facet,'taste-texture');
  }
});

test('第二轮：20种尺寸与物理量有明确单位，无默认值；物性维度不冒充事实',()=>{
  const parameters = result.hints.filter((x:any) => x.value.type === 'number'); assert.equal(parameters.length,20);
  for (const hint of parameters) { assert.ok(hint.value.unit); assert.equal(hint.value.default,null); assert.equal(hint.semanticKind,'parameter-dimension'); }
  assert.equal(hintFor('净空高度').value.unit,'mm');
  assert.equal(hintFor('承载上限').value.unit,'kg');
  assert.equal(hintFor('旋转范围').value.unit,'degree');
  assert.equal(hintFor('表面温度').value.unit,'celsius');
  assert.equal(hintFor('弹性').semanticKind,'parameter-dimension');
  assert.equal(hintFor('弹性').value.unitPolicy,'requires-property-specific-schema');
});

test('第二轮：情绪、习惯、目标、历史和同意分层，不以倾向替代真实事实',()=>{
  assert.equal(hintFor('安心').semanticKind,'current-emotion');
  assert.equal(hintFor('列清单').semanticKind,'habit');
  assert.equal(hintFor('寻找工作').semanticKind,'goal');
  assert.equal(hintFor('迁入').semanticKind,'history-fact');
  assert.equal(hintFor('迁入').sourceOfTruth,'recorded-facts-with-provenance');
  assert.equal(hintFor('同意').semanticKind,'interaction-fact');
  assert.equal(hintFor('同意').sourceOfTruth,'recorded-facts-with-provenance');
  assert.equal(hintFor('随和').usage,'preference-signal');
  assert.equal(hintFor('阅读').usage,'preference-signal');
});

test('第二轮：动作意图需要参与者和运行检查，不结算效果，身体适配绑定实例',()=>{
  const action = hintFor('提起');
  assert.equal(action.semanticKind,'action-intent');
  assert.deepEqual(action.requiredBindings,['actorId','targetId-or-explicit-none']);
  assert.ok(action.executionChecks.includes('resources')); assert.ok(action.executionChecks.includes('permission'));
  assert.equal(hintFor('试握').bindingPolicy,'explicit-subject-instance');
  const contact = hintFor('接触建立');
  assert.deepEqual(contact.requiredBindings,['sceneId','participantIds','scope']);
  for (const hint of result.hints) {
    assert.equal(hint.runtimeExecutable,false); assert.equal(hint.effectsAllowed,false);
    assert.equal(hint.deriveStateFromText,false); assert.equal(hint.missingValue,'unknown'); assert.equal(hint.unknownAllowsAction,false);
    assert.ok(hint.allowedSubjectKinds.length);
  }
  const alternate = ruleHint({...expansionSeeds[0],key:'test.rebound'});
  assert.equal(alternate.sourceEntryId,'general-common:v2.test.rebound');
});

test('第二轮：30个文字批次通过正式校验，不注册编辑标签、不携带状态效果',async()=>{
  const registry = await dictionaryRegistry(projectRoot);
  assert.equal(result.exported.batches.length,30);
  const exportedRows:any[] = [];
  for (const batch of result.exported.batches) {
    validateSemanticBatch(batch,registry); assert.equal(batch.domain,'general');
    assert.match(batch.batchId,/\.b92\d{2}$/);
    assert.deepEqual(await readJson(`v2-material-batches/${batch.batchId}.json`),batch);
    for (const row of batch.entries) { assert.deepEqual(row.tags,[]); assert.equal(row.classification.eligibility,'general'); exportedRows.push(row); }
  }
  assert.equal(exportedRows.length,result.common.length);
  const tampered = structuredClone(result.exported.batches[0]);
  tampered.entries[0].effects = [{type:'money',amount:100}];
  assert.throws(()=>validateSemanticBatch(tampered,registry));
  const invalidTag = structuredClone(result.exported.batches[0]);
  // 部分编辑概念已另行编译进正式字典；拒绝断言必须使用真正未登记的 ID。
  invalidTag.entries[0].tags = ['editorial-proposal:tag.unregistered'];
  assert.throws(()=>validateSemanticBatch(invalidTag,registry));
});

test('第二轮：已发布交换ID不可改序、删除、追加、重复占用',()=>{
  const links = result.exported.links;
  assertFrozenRelease(links,structuredClone(links));
  assert.throws(()=>assertFrozenRelease(links,links.slice(1)),/不得重排或静默删除/);
  assert.throws(()=>assertFrozenRelease(links,[...links,{sourceEntryId:'new',materialEntryId:'new'}]),/不可增补/);
  const remapped = structuredClone(links); remapped[0].materialEntryId = 'changed';
  assert.throws(()=>assertFrozenRelease(links,remapped),/不得重排/);
  assert.throws(()=>assertFrozenRelease(links,[...links,links[0]]),/ID冲突/);
});

test('第二轮：生成文件可确定性重建，主表、索引、旁路元数据相互一致',async()=>{
  assert.deepEqual(await readJson('index.json'),result.index);
  assert.deepEqual(await readJson('common-additions.json'),result.common);
  assert.deepEqual(await readJson('rule-hints.json'),result.hints);
  assert.deepEqual(await readJson('groups.json'),result.groups);
  assert.deepEqual(await readJson('taxonomy.json'),result.taxonomy);
  assert.deepEqual(await readJson('label-collisions.json'),result.collisions);
  assert.deepEqual(await readJson('export-links.json'),result.exported.links);
  for (const [file,rows] of [['entries.jsonl',result.entries],['new-entries.jsonl',result.common]] as const) {
    const actual = (await readFile(path.join(projectRoot,expansionV2Path,file),'utf8')).trim().split(/\r?\n/).map(line=>JSON.parse(line));
    assert.deepEqual(actual,rows);
  }
  const files = await readdir(path.join(projectRoot,expansionV2Path,'v2-material-batches'));
  assert.equal(files.filter((x:string) => x.endsWith('.json')).length,30);
});

test('第二轮：上一版指纹和31份原始交付不变，3064条待审未伪装已完成',async()=>{
  assert.deepEqual(await snapshotPrevious(),result.index.previousFiles);
  assert.equal(await verifyOriginalReceipts(),31);
  assert.equal(result.index.nsfwChanges,0);
  assert.equal(result.index.counts.previousNeedsCoreReview,3064);
  assert.equal(result.index.runtimeImportable,false);
  assert.equal(result.index.ruleHintStatus,'authoring-metadata-only-no-runtime-template-compiler');
});
