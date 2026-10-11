// 词条工具验收使用临时目录与合成占位样本，不将测试样本计入素材库存。
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, mkdir, rm, readdir } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { catalog, initialPlan } from '../scripts/lexicon/catalog.mjs';
import { exampleBatch, taskPrompt } from '../scripts/lexicon/prepare.mjs';
import { validateBatch, duplicateReport, normalize, assign, extend, importBatch, rebuildIndex, applyReview, exportReviewed, collection, atomicJSON, contextSummary } from '../scripts/lexicon/library.mjs';
import { inventory } from '../scripts/lexicon/inventory.mjs';
const project=fileURLToPath(new URL('../',import.meta.url));
const kit=path.join(project,'production','lexicon-authoring');
const task=initialPlan().find(t=>t.batchId==='npc-trait.b0001');
function batch(t=task,producer='writer-a') {
 const c=catalog.find(c=>c.code===t.library),b=exampleBatch(c,t);b.source.producer=producer;b.source.model='synthetic-test';
 b.entries=Array.from({length:t.size},(_,i)=>({...structuredClone(b.entries[0]),id:`lx.${t.batchId}.${String(i+1).padStart(4,'0')}`,name:`测试占位${t.batchId}${i}`,description:`只供临时测试的占位描述${t.batchId}${i}`}));
 return b;
}
async function fixture(t) {
 const root=await mkdtemp(path.join(os.tmpdir(),'aetheria-lexicon-'));t.after(()=>rm(root,{recursive:true,force:true}));
 return {root,file:path.join(root,'incoming.json')};
}
async function imported(t) {
 const f=await fixture(t);await assign(f.root,task.batchId,'writer-a');await atomicJSON(f.file,batch());await importBatch(f.root,f.file);return f;
}
async function reviewFile(root,id,status='approved') {
 const file=path.join(root,'review-input.json');await atomicJSON(file,{format:'aetheria-lexicon-review',schemaVersion:1,reviewer:'editor-a',decisions:[{id,status,note:'测试审稿决定'}]});return file;
}
test('58类示例均有合法子类与完整独立批次结构，示例不进入库存',async t=>{
 assert.equal(catalog.length,58);
 for(const c of catalog) {
  const sample=JSON.parse(await readFile(path.join(kit,'examples',c.code+'.json'),'utf8'));
  validateBatch(sample);assert.equal(sample.entries.length,1);assert.equal(sample.entries[0].subcategory,c.exampleSubcategory);
 }
 const {root}=await fixture(t);await atomicJSON(path.join(root,'examples','npc-trait.json'),exampleBatch(catalog.find(c=>c.code===task.library),task));
 assert.equal((await collection(root)).entries.length,0);
});
test('首期10700条/214批无重号，每个独立任务已落盘且编号正确',async()=>{
 const plan=initialPlan();assert.equal(plan.length,214);assert.equal(plan.reduce((s,t)=>s+t.size,0),10700);assert.equal(new Set(plan.map(t=>t.batchId)).size,plan.length);
 for(const t of plan) {const prompt=await readFile(path.join(kit,t.prompt),'utf8');assert.ok(prompt.includes(`本批恰好 ${t.size} 条`));assert.ok(prompt.includes(`lx.${t.batchId}.0050`));assert.ok(prompt.includes('不设计组合规则'));}
});
test('规则包、脚本字段与写作者自批approved不能伪装成纯素材',()=>{
 for(const modify of [b=>b.weight=1,b=>b.entries[0].effects=[],b=>b.entries[0].conditions=[],b=>b.entries[0].reviewStatus='approved',b=>b.source.rules={},b=>b.format='aetheria-reference']) {
  const b=batch();modify(b);assert.throws(()=>validateBatch(b));
 }
});
test('分类错配、跳号、批次零号和未定义子类被拒绝',()=>{
 for(const modify of [b=>b.library='unknown',b=>b.entries[0].category='npc-name',b=>b.entries[1].id=b.entries[0].id,b=>b.batchId='npc-trait.b0000',b=>b.entries[0].subcategory='任意新子类']) {
  const b=batch();modify(b);assert.throws(()=>validateBatch(b));
 }
});
test('超过批量、空文本、错误字段类型、空标签与控制字符被拒绝',()=>{
 for(const modify of [b=>b.entries.push({...b.entries[0]}),b=>b.entries[0].description=' ',b=>b.entries[0].name=24,b=>b.entries[0].tags=[],b=>b.entries[0].description='坏\u0000文本',b=>b.entries[0].name='界'.repeat(41)]) {
  const b=batch();modify(b);assert.throws(()=>validateBatch(b));
 }
});
test('未实现身体形态与器官可合法收录为描述，不要求BodyGraph能力',()=>{
 for(const code of ['body-organ','body-form','body-anomaly']) {const c=catalog.find(c=>c.code===code),t=initialPlan().find(t=>t.library===code);assert.doesNotThrow(()=>validateBatch(exampleBatch(c,t)));}
});
test('精确查重规范化全半角、空白、标点；同名不同义只提示',()=>{
 assert.equal(normalize('Ａ， B！'),normalize('a b'));
 const report=duplicateReport([{id:'1',category:'x',text:'窗边，落着雨。'},{id:'2',category:'y',text:'窗边落着雨'},{id:'3',category:'x',name:'木扣',description:'磨旧的佩件'},{id:'4',category:'x',name:'木扣',description:'用于固定雨棚的配件'}]);
 assert.deepEqual(report.exact,[['1','2']]);assert.deepEqual(report.sameName,[['3','4']]);
});
test('字面相近项给出审查线索，不自动删除或合并',()=>{
 const report=duplicateReport([{id:'1',category:'x',text:'门边的旧油漆被反复靠放的提篮磨出一道浅痕。'},{id:'2',category:'x',text:'门边的旧油漆被反复靠放的提篮磨出一道细痕。'}]);
 assert.equal(report.exact.length,0);assert.equal(report.near.length,1);
});
test('领取人冲突拒绝，重复领取幂等，扩充不会重用首期批号',async t=>{
 const {root}=await fixture(t);await assign(root,task.batchId,'writer-a');await assign(root,task.batchId,'writer-a');
 await assert.rejects(assign(root,task.batchId,'writer-b'),/已由/);
 const next=await extend(root,'npc-trait','writer-b','新主题');assert.equal(next.batchId,'npc-trait.b0005');assert.equal(next.size,50);
 const index=await rebuildIndex(root);assert.equal(index.tasks.length,215);assert.equal(index.tasks.find(t=>t.batchId===next.batchId).producer,'writer-b');
});
test('未领取与假冒来源的交付无法收录',async t=>{
 const {root,file}=await fixture(t);await atomicJSON(file,batch());await assert.rejects(importBatch(root,file),/领取/);
 await assign(root,task.batchId,'writer-b');await assert.rejects(importBatch(root,file),/来源/);assert.equal((await collection(root)).entries.length,0);
});
test('交付数量与主题必须匹配已派发任务，错误不留下半批数据',async t=>{
 const {root,file}=await fixture(t);await assign(root,task.batchId,'writer-a');
 for(const b of [({...batch(),entries:batch().entries.slice(0,49)}),({...batch(),source:{...batch().source,theme:'擅自改主题'}})]) {await atomicJSON(file,b);await assert.rejects(importBatch(root,file),/任务不符/);}
 assert.equal((await collection(root)).entries.length,0);
});
test('批次收录与重复导入幂等，已收录文件不允许覆盖',async t=>{
 const {root,file}=await imported(t);assert.equal((await importBatch(root,file)).status,'unchanged');
 const b=batch();b.entries[0].description='改写已收录内容';await atomicJSON(file,b);await assert.rejects(importBatch(root,file),/不可覆盖/);
 assert.equal((await collection(root)).entries.length,50);
});
test('跨批精确重复使整批不写入，近似项保留编辑判断',async t=>{
 const {root,file}=await imported(t),next=initialPlan().find(t=>t.batchId==='npc-trait.b0002');await assign(root,next.batchId,'writer-a');
 const b=batch(next);b.entries[0]={...batch().entries[0],id:`lx.${next.batchId}.0001`};await atomicJSON(file,b);
 await assert.rejects(importBatch(root,file),/精确重复/);assert.equal((await collection(root)).entries.length,50);
});
test('本批精确重复也拒绝，锁在失败后释放',async t=>{
 const {root,file}=await fixture(t);await assign(root,task.batchId,'writer-a');const b=batch();b.entries[1]={...b.entries[0],id:b.entries[1].id};await atomicJSON(file,b);
 await assert.rejects(importBatch(root,file),/精确重复/);await atomicJSON(file,batch());await importBatch(root,file);assert.equal((await collection(root)).entries.length,50);
});
test('收录、审定、游戏使用三个数量分开；只导出审定条目并保留来源',async t=>{
 const {root}=await imported(t);let index=await rebuildIndex(root);assert.deepEqual(index.totals,{collected:50,approved:0,used:0});
 const id=batch().entries[0].id;await applyReview(root,await reviewFile(root,id));index=await rebuildIndex(root);assert.deepEqual(index.totals,{collected:50,approved:1,used:0});
 const out=path.join(root,'export.json');assert.equal((await exportReviewed(root,out)).exported,1);const data=JSON.parse(await readFile(out,'utf8'));assert.equal(data.entries[0].source.producer,'writer-a');assert.equal(data.entries[0].batchId,task.batchId);
 await assert.rejects(exportReviewed(root,out),/EEXIST/);
});
test('混合审稿中任一未知ID会拒绝整份决定',async t=>{
 const {root}=await imported(t),file=await reviewFile(root,batch().entries[0].id);const r=JSON.parse(await readFile(file,'utf8'));r.decisions.push({id:'unknown',status:'approved',note:'错误项'});await atomicJSON(file,r);
 await assert.rejects(applyReview(root,file),/审稿 ID/);assert.equal((await rebuildIndex(root)).totals.approved,0);
});
test('hold与rejected保留收录历史，不进入已审定导出',async t=>{
 const {root}=await imported(t),id=batch().entries[0].id;
 for(const status of ['hold','rejected']) {await applyReview(root,await reviewFile(root,id,status));assert.equal((await rebuildIndex(root)).totals.collected,50);assert.equal((await exportReviewed(root,path.join(root,`${status}.json`))).exported,0);}
});
test('使用登记必须来自已收录审定条目；不能先登记后冒充实装',async t=>{
 const {root}=await imported(t),id=batch().entries[0].id;
 const usage={format:'aetheria-lexicon-usage',schemaVersion:1,bindings:[{entryId:id,targetFile:'content/example/pack.json',targetPointer:'/texts/example',verifiedBy:'test-editor'}]};
 await atomicJSON(path.join(root,'management','usage.json'),usage);await assert.rejects(rebuildIndex(root),/已审定/);
 // 清除无效登记后审定，再登记；这里只验证编辑统计，不声称目标游戏内容存在。
 await atomicJSON(path.join(root,'management','usage.json'),{...usage,bindings:[]});await applyReview(root,await reviewFile(root,id));await atomicJSON(path.join(root,'management','usage.json'),usage);
 assert.equal((await rebuildIndex(root)).totals.used,1);
 const before=await readFile(path.join(root,'management','reviews.json'),'utf8');await assert.rejects(applyReview(root,await reviewFile(root,id,'rejected')),/已审定/);assert.equal(await readFile(path.join(root,'management','reviews.json'),'utf8'),before);
});
test('并发写锁阻止领取，不覆盖既有管理记录',async t=>{
 const {root}=await fixture(t);await mkdir(path.join(root,'management','.lock'),{recursive:true});await assert.rejects(assign(root,task.batchId,'writer-a'),/另一个整理进程/);
});
test('跨批续写摘要只来自已收录词库，提供稳定ID与精简内容',async t=>{
 const {root}=await imported(t);const result=await contextSummary(root,'npc-trait');assert.equal(result.count,50);const data=JSON.parse(await readFile(result.output,'utf8'));assert.equal(data.entries[0].id,batch().entries[0].id);assert.ok(data.entries.every(e=>e.summary.length<=160));
});
test('一万条规模可查精确重复，报告不改变原始条目',()=>{
 const entries=Array.from({length:10000},(_,i)=>({id:`test-${i}`,category:'stress',text:`临时测试样本条目${i.toString(36)}专用，不是生产素材。`}));entries.push({...entries[123],id:'duplicate'});
 const before=JSON.stringify(entries);const report=duplicateReport(entries);assert.ok(report.exact.some(g=>g.includes('test-123')&&g.includes('duplicate')));assert.equal(JSON.stringify(entries),before);
});
test('现有素材统计来自实际默认加载列表，可选包分开且不公开秘密正文',async()=>{
 const inv=await inventory(project),index=JSON.parse(await readFile(path.join(project,'content/index.json'),'utf8'));assert.equal(inv.byPack.length,index.packs.length);
 const packs=await Promise.all(index.packs.map(f=>readFile(path.join(project,'content',f),'utf8').then(JSON.parse)));assert.equal(inv.totals.textKeys,packs.reduce((n,p)=>n+Object.keys(p.texts).length,0));
 assert.ok(inv.sources.every(s=>/^[a-f0-9]{64}$/.test(s.sha256)));assert.ok(inv.optional.every(p=>p.loadedByDefault===false));assert.equal(Object.hasOwn(inv,'texts'),false);
});
test('运行时源码与默认内容入口没有导入词库，新增素材不会变更游戏存档',async()=>{
 async function scan(dir) {for(const e of await readdir(dir,{withFileTypes:true})) {const file=path.join(dir,e.name);if(e.isDirectory())await scan(file);else if(e.name.endsWith('.ts'))assert.ok(!/lexicon-authoring|scripts\/lexicon/.test(await readFile(file,'utf8')),file);}}
 await scan(path.join(project,'src'));assert.ok(!(await readFile(path.join(project,'content/index.json'),'utf8')).includes('lexicon'));
});
test('已分配任务的可派发指令带正确来源，不要求AI改动规则',()=>{
 const prompt=taskPrompt(catalog.find(c=>c.code===task.library),{...task,producer:'claude-a'});assert.ok(prompt.includes('"producer": "claude-a"'));assert.ok(prompt.includes('其余字段全部禁止'));assert.ok(prompt.includes('不定义')||prompt.includes('不设计'));
});
