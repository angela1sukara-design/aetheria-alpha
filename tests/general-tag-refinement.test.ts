import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {catalog} from '../scripts/lexicon/catalog.mjs';
import {createTaxonomy} from '../scripts/lexicon/general-tag-taxonomy.mjs';
import {parseInventory,refineEntry,sourcePath,outputPath,deliveryPath} from '../scripts/lexicon/refine-general-tags.mjs';
const taxonomy=createTaxonomy(catalog);
const row=(library:string,subcategory:string,material:string)=>refineEntry({id:`lx.${library}.b0001.0001`,library,subcategory,material,kind:catalog.find((c:any)=>c.code===library)!.kind,sourceLine:1},taxonomy);
const id=(name:string)=>'general-taxonomy:'+name;

test('通用原子化：耳饰与材质、尺寸、丝状分开，不修改源短语',()=>{
  const r=row('body-accessory','首饰','细铜丝耳圈');
  assert.deepEqual(r.coreConceptIds,[id('object.earring')]);
  for(const key of ['dimension.thin','material.copper','shape.wire'])assert.ok(r.qualifierConceptIds.includes(id(key)));
  assert.equal(r.material,'细铜丝耳圈');assert.equal(r.reviewStatus,'unreviewed');
});
test('通用原子化：黄铜不同时重复推成铜，项链坠不推成项链',()=>{
  const r=row('body-mechanical','关节细节','黄铜铰链肘');
  assert.ok(r.qualifierConceptIds.includes(id('material.brass')));assert.ok(!r.qualifierConceptIds.includes(id('material.copper')));
  assert.deepEqual(row('body-accessory','首饰','骨片项链坠').coreConceptIds,[id('object.pendant')]);
});
test('通用原子化：夜间与雨是独立维度，不互相吞掉',()=>{
  const r=row('body-accessory','纪念饰品','雨夜灯罩环');
  assert.ok(r.qualifierConceptIds.includes(id('occasion.night')));assert.ok(r.qualifierConceptIds.includes(id('occasion.rain')));
});
test('通用原子化：软陶/棉絮是触感意象，不授予陶瓷/棉材质',()=>{
  for(const word of ['棉絮触肤','软陶凉感']){const r=row('body-surface','皮肤质感',word);assert.deepEqual(r.qualifierConceptIds,[]);assert.ok(r.issues.includes('metaphor-does-not-prove-material'));}
});
test('通用原子化：木纹/藤纹和铜色不等于对应材质，浅不等于小',()=>{
  for(const word of ['旧木纹手背','编织藤纹腿壳','黄铜色臂壳']){const r=row('body-mechanical','义肢外壳',word);assert.ok(!r.qualifierConceptIds.some((x:string)=>x.startsWith(id('material.'))));}
  const r=row('body-organ','囊与腔','锁骨下浅囊');assert.ok(r.qualifierConceptIds.includes(id('dimension.shallow')));assert.ok(!r.qualifierConceptIds.includes(id('dimension.small')));
});
test('通用原子化：姓名外号及地名原样保留，不拆成徒弟或照明',()=>{
  for(const [lib,sub,word]of [['npc-name','艺名','学徒灯'],['npc-alias','生活外号','学徒灯'],['world-district','巷名','晒被窄巷']]){const r=row(lib,sub,word);assert.equal(r.resolution,'protected-name');assert.deepEqual(r.coreConceptIds,[]);assert.deepEqual(r.qualifierConceptIds,[]);}
});
test('通用原子化：否定隐私询问不能提取为侵犯隐私，行为不折成单一人格',()=>{
  assert.deepEqual(row('npc-trait','边界意识','不问薪资隐私').coreConceptIds,[id('disposition.privacy')]);
  const r=row('npc-trait','处事倾向','先问再帮');assert.equal(r.coreConceptIds.length,2);assert.ok(r.issues.includes('multiple-topics-do-not-collapse'));
});
test('通用原子化：对白作为例句，疑问中的身体不变成已有身体',()=>{
  const r=row('text-reply','澄清','你说的机械尾，是谁正在用的？');assert.deepEqual(r.coreConceptIds,[id('speech.clarify')]);assert.deepEqual(r.qualifierConceptIds,[]);assert.ok(r.issues.includes('prose-kept-as-example'));
});
test('通用原子化：词义模糊保持待复核，颜色可独立作为属性',()=>{
  assert.equal(row('body-accessory','纪念饰品','不明物件').resolution,'needs-core-review');
  const r=row('body-color','单色','街尘灰褐');assert.equal(r.resolution,'attribute-only');assert.equal(r.qualifierConceptIds.length,2);
});
test('通用原子化：源清单ID重复或格式损坏拒绝，不静默漏条',()=>{
  const line='- `lx.body-accessory.b0001.0001` · 首饰 · 耳圈';
  assert.throws(()=>parseInventory(line+'\n'+line),/冲突/);assert.throws(()=>parseInventory('- `lx.bad`'),/无损解析/);
});
test('通用原子化：全量10700条一一映射、引用/证据精确、输出可重现',async()=>{
  const source=await readFile(sourcePath);const parsed=parseInventory(source.toString('utf8'));
  const output=(await readFile(outputPath+'/entries.jsonl','utf8')).trim().split('\n').map(JSON.parse);
  const index=JSON.parse(await readFile(outputPath+'/index.json','utf8'));
  assert.equal(parsed.length,10700);assert.equal(output.length,10700);assert.equal(new Set(output.map(e=>e.sourceEntryId)).size,10700);
  assert.equal(index.source.sha256,createHash('sha256').update(source).digest('hex'));
  const known=new Set(taxonomy.concepts.map((c:any)=>c.id));
  for(let i=0;i<parsed.length;i++){
    const p=parsed[i],r=output[i];assert.equal(r.sourceEntryId,p.id);assert.equal(r.material,p.material);assert.deepEqual(r,refineEntry(p,taxonomy));
    for(const key of [...r.coreConceptIds,...r.qualifierConceptIds])assert.ok(known.has(key));
    for(const ev of r.evidence)if(ev.source==='literal-span')assert.equal(r.material.slice(ev.start,ev.end),ev.fragment);
  }
  assert.equal(index.nsfwChanges,0);assert.equal(index.runtimeImportable,false);
});
test('通用原子化：所有交付原件与NSFW文件哈希不变',async()=>{
  const receipt=JSON.parse(await readFile(deliveryPath+'/receipt.json','utf8'));
  for(const f of [...receipt.originals,...receipt.extractedFiles]){const bytes=await readFile(deliveryPath+'/'+f.path);assert.equal(createHash('sha256').update(bytes).digest('hex'),f.sha256,f.path);}
});
