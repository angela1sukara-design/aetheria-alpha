import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {prepareExpanded,parseWorldGap,joinSource,selectNewSeeds,classifyGeneral,assertStableExportLinks,expandedPath} from '../scripts/lexicon/expand-general-library.mjs';
import {dictionaryRegistry,validateSemanticBatch} from '../scripts/lexicon/semantic-format.mjs';
import {projectRoot,sourcePath,parseInventory} from '../scripts/lexicon/refine-general-tags.mjs';

const result=await prepareExpanded(),{index,taxonomy,entries,base,world,common}=result;
const definitions=new Map(taxonomy.concepts.map((c:any)=>[c.id,c]));
const labels=(ids:string[])=>ids.map(id=>(definitions.get(id) as any).label);
const find=(name:string)=>entries.find((e:any)=>e.material===name)!;
const sha=(bytes:any)=>createHash('sha256').update(bytes).digest('hex');

test('扩充：原10700、两批667与388条真正新增均完整保留且身份唯一',()=>{
  assert.equal(base.length,10700);assert.equal(world.length,667);assert.equal(common.length,388);
  assert.equal(entries.length,11755);assert.equal(new Set(entries.map((r:any)=>r.sourceEntryId)).size,entries.length);
  assert.equal(index.counts.sourceConflicts,0);assert.equal(index.counts.seedLabelCollisions,2);
  const existing=new Set([...base,...world].map((r:any)=>r.material.normalize('NFKC')));
  assert.equal(new Set(common.map((r:any)=>r.material)).size,common.length);
  for(const r of common){assert.ok(!existing.has(r.material));assert.ok(r.description.trim());assert.notEqual(r.description,r.material);assert.ok(!/待补|TODO|占位/.test(r.description));assert.equal(r.reviewStatus,'authored-proposed');}
});

test('扩充：17种背景标题去掉数量与备注，全部有独立背景维度',()=>{
  assert.equal(new Set(world.map((r:any)=>r.source.theme)).size,17);
  assert.ok(world.some((r:any)=>r.source.theme==='奇幻地牢墓穴'));
  assert.ok(world.some((r:any)=>r.source.theme==='西部拓荒'));
  for(const r of world){assert.ok(r.contextConceptIds.length>0);assert.equal(r.source.model,'unrecorded');}
  const r=world.find((r:any)=>r.source.theme==='沙漠戈壁')!;
  assert.deepEqual(labels(r.contextConceptIds),['沙漠','戈壁']);
});

test('扩充：候选ID不因插入或排序改变，原表文字与说明独立',()=>{
  const heading='### 2.1 赛博都市（2） · **备注**\n';
  const a='| 霓虹下层雨街 | `world-district` | 街区 | 候选/待入库 | 雨中街道。 | 来源声明 |\n';
  const b='| 公司塔裙楼层 | `world-building` | 建筑 | 候选/待入库 | 巨构楼层。 | 来源声明 |\n';
  const x=parseWorldGap(heading+a,'source.md','v1'),y=parseWorldGap(heading+b+a,'source.md','v1');
  assert.equal(x[0].id,y[1].id);assert.equal(x[0].description,'雨中街道。');assert.equal(x[0].sourceTheme,'赛博都市');
  assert.throws(()=>parseWorldGap(heading+a+a,'source.md','v1'),/重复/);
});

test('扩充：截短行有前缀证据才恢复，任意同ID差异不覆盖',()=>{
  assert.equal(result.sourceCorrections.length,5);
  for(const r of result.sourceCorrections){assert.equal(r.join,'restored-truncated-prose');assert.ok(r.restored.startsWith(r.uploaded));assert.ok(r.restored.length>r.uploaded.length);}
  const row={id:'x',library:'text-environment',subcategory:'空间层次',kind:'phrase',material:'原句'};
  const record={entry:{name:'不同的句子',category:row.library,subcategory:row.subcategory,description:'不可借用'},file:'x',sha256:'x',source:{}};
  const r=joinSource(row,record);assert.equal(r.material,'原句');assert.equal(r.sourceJoin,'conflict');assert.equal(r.description,null);
});

test('扩充：街道核心不携带霓虹、层位、雨天或赛博设定',()=>{
  const r=find('霓虹下层雨街');assert.deepEqual(labels(r.coreConceptIds),['街道']);
  const attrs=labels(r.qualifierConceptIds);for(const name of ['霓虹照明','下层','降雨'])assert.ok(attrs.includes(name));
  assert.deepEqual(labels(r.contextConceptIds),['赛博朋克']);
  const floors=labels(find('公司塔裙楼层').coreConceptIds);assert.ok(floors.includes('楼层'));assert.ok(floors.includes('裙楼'));
  assert.ok(labels(find('灰瓦排屋').qualifierConceptIds).includes('灰'));
  const elbow=labels(find('圆肘外展').qualifierConceptIds);assert.ok(elbow.includes('圆'));assert.ok(elbow.includes('外展'));
});

test('扩充：标题材质与说明主题分开，触感类比、否定及假设不赋予材质',()=>{
  const r=find('棉絮触肤');assert.ok(!r.qualifierConceptIds.some((id:string)=>(definitions.get(id) as any).facet==='material'));
  assert.ok(!r.descriptionTopicIds.some((id:string)=>(definitions.get(id) as any).facet==='material'));
  const probe=classifyGeneral({id:'probe',library:'body-mechanical',subcategory:'义肢外壳',material:'黄铜色臂壳',description:'没有铰链。如果接上弹簧，只是像硅胶般的触感。',kind:'named',sourceLine:1},taxonomy);
  assert.ok(!probe.qualifierConceptIds.some((id:string)=>(definitions.get(id) as any).facet==='material'));
  assert.ok(!labels(probe.descriptionTopicIds).includes('铰链'));
  assert.ok(!probe.descriptionTopicIds.some((id:string)=>(definitions.get(id) as any).facet==='material'));
});

test('扩充：低重力与零重力分别建概念；宽度、摩擦、照明分维度',()=>{
  const low=taxonomy.concepts.find((c:any)=>c.label==='低重力'),zero=taxonomy.concepts.find((c:any)=>c.label==='零重力');
  assert.ok(low&&zero&&low.id!==zero.id);
  assert.equal((definitions.get(find('狭窄').qualifierConceptIds[0]) as any).facet,'width');
  assert.equal((definitions.get(find('湿滑').qualifierConceptIds[0]) as any).facet,'surface-friction');
  assert.equal((definitions.get(find('逆光').qualifierConceptIds[0]) as any).facet,'lighting');
});

test('扩充：专名保留与明确待审队列，描述关键词不冒充实体状态',()=>{
  assert.equal(index.counts.protectedNames,720);const r=find('学徒灯');assert.equal(r.resolution,'protected-name');
  assert.deepEqual(r.coreConceptIds,[]);assert.deepEqual(r.descriptionTopicIds,[]);
  assert.ok(entries.some((r:any)=>r.resolution==='needs-core-review'));
  assert.equal(entries.filter((r:any)=>r.resolution==='needs-core-review').length,index.counts.needsCoreReview);
  for(const r of [...base,...world])assert.equal(r.reviewStatus,'unreviewed');
  assert.equal(index.runtimeImportable,false);assert.equal(index.nsfwChanges,0);
});

test('扩充：所有标题和描述证据都能定位回原文，引用概念均存在',()=>{
  assert.equal(new Set(taxonomy.concepts.map((c:any)=>c.id)).size,taxonomy.concepts.length);
  assert.equal(new Set(taxonomy.concepts.map((c:any)=>`${c.label}|${c.role}|${c.facet}`)).size,taxonomy.concepts.length);
  for(const r of entries){
    for(const id of [...r.coreConceptIds,...r.qualifierConceptIds,...r.contextConceptIds,...r.descriptionTopicIds])assert.ok(definitions.has(id));
    for(const e of [...r.evidence,...r.descriptionEvidence])if(e.source==='literal-span'){
      const text=e.field==='description'?r.description:r.material;assert.equal(text.slice(e.start,e.end),e.fragment);
    }
  }
});

test('扩充：语义不明的重名提案单列，不进行跨维度破坏性合并',()=>{
  const selected=selectNewSeeds([{id:'old',label:'腕部'}],[{key:'x',label:'腕部',role:'core',facet:'body-part'}]);
  assert.equal(selected.additions.length,0);assert.equal(selected.reused[0].decision,'label-collision-kept-out-for-review');
  assert.equal(result.duplicates.length,6);for(const g of result.duplicates)assert.ok(g.sourceEntryIds.length>1);
});

test('扩充：35批纯文字全部通过正式v2格式校验，编辑标签和效果不进入批次',async()=>{
  const registry=await dictionaryRegistry(projectRoot),batches=result.exports.flatMap((e:any)=>e.batches);
  assert.equal(batches.length,35);let total=0;
  const oldIds=new Set(base.map((r:any)=>r.sourceEntryId)),ids=new Set();
  for(const b of batches){validateSemanticBatch(b,registry);total+=b.entries.length;
    for(const e of b.entries){assert.deepEqual(e.tags,[]);assert.equal(e.classification.tier,'general');assert.ok(!oldIds.has(e.id));assert.ok(!ids.has(e.id));ids.add(e.id);
      assert.ok(!('effects' in e));assert.ok(!('reward' in e));assert.ok(!('body' in e));}
    const bad=structuredClone(b);bad.entries[0].effects=[];assert.throws(()=>validateSemanticBatch(bad,registry));
  }
  assert.equal(total,1055);
});

test('扩充：已交付的素材ID不能因为新增、重排或删除而悄悄改写',()=>{
  const prev=[{sourceEntryId:'a',materialEntryId:'lx.world-object.b9001.0001'}];
  assert.doesNotThrow(()=>assertStableExportLinks(prev,[...prev,{sourceEntryId:'b',materialEntryId:'lx.world-object.b9001.0002'}]));
  assert.throws(()=>assertStableExportLinks(prev,[]),/不得重排或静默删除/);
  assert.throws(()=>assertStableExportLinks(prev,[{sourceEntryId:'a',materialEntryId:'lx.world-object.b9001.0002'}]),/不得重排/);
  assert.throws(()=>assertStableExportLinks([], [...prev,...prev]),/ID冲突/);
});

test('扩充：保存的完整主表可重复生成，分库和批次交付齐全',async()=>{
  const actual=(await readFile(`${expandedPath}/entries.jsonl`,'utf8')).trim().split('\n').map(line=>JSON.parse(line));
  assert.deepEqual(actual,entries);assert.deepEqual(JSON.parse(await readFile(`${expandedPath}/index.json`,'utf8')),index);
  assert.equal((await readdir(`${expandedPath}/按库`)).filter(f=>f.endsWith('.md')).length,new Set(entries.map((r:any)=>r.library)).size);
  assert.equal((await readdir(`${expandedPath}/v2-material-batches`)).filter(f=>f.endsWith('.json')).length,35);
  const uploaded=parseInventory(await readFile(sourcePath,'utf8'));
  assert.deepEqual(base.map((r:any)=>r.sourceEntryId),uploaded.map((r:any)=>r.id));
});

test('扩充：原交付含NSFW的31个文件原始哈希与全部JSON内容哈希保持一致',async()=>{
  assert.equal(index.preservedSourceFiles.length,31);
  for(const s of index.preservedSourceFiles)assert.equal(sha(await readFile(`production/tag-deliveries/2026-10-12/${s.path}`)),s.sha256);
  for(const s of index.sources){const bytes=await readFile(s.path);assert.equal(sha('hashing' in s && s.hashing==='json-stringify-sha256'?JSON.stringify(JSON.parse(bytes.toString('utf8'))):bytes),s.sha256);}
});
