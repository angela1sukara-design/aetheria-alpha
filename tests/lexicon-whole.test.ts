import test, {type TestContext} from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { catalog, initialPlan } from '../scripts/lexicon/catalog.mjs';
import { exampleBatch } from '../scripts/lexicon/prepare.mjs';
import { wholePrompt } from '../scripts/lexicon/whole-pack.mjs';
import { scopeTasks, validateDelivery, assignScope, assign, importDelivery, collection, rebuildIndex, atomicJSON, assignments } from '../scripts/lexicon/library.mjs';
function delivery(scope='daily') {
 return {format:'aetheria-lexicon-delivery',schemaVersion:1,scope,batches:scopeTasks(scope).map(t=>{
  const c=catalog.find(c=>c.code===t.library),b=exampleBatch(c,t);b.source.producer='ai-main';b.source.model='synthetic-test';
  b.entries=Array.from({length:t.size},(_,i)=>{
   const e={...structuredClone(b.entries[0]),id:`lx.${t.batchId}.${String(i+1).padStart(4,'0')}`,description:`临时测试描述${t.batchId}.${i}`};
   if('text' in e)e.text=`仅在临时目录使用的测试文本${t.batchId}.${i}`;else e.name=`测试样本${t.batchId}.${i}`;
   return e;
  });return b;
 })};
}
async function fixture(t:TestContext) {const root=await mkdtemp(path.join(os.tmpdir(),'aetheria-whole-'));t.after(()=>rm(root,{recursive:true,force:true}));return {root,file:path.join(root,'delivery.json')};}
test('五个大类完整覆盖全量10700条且批号互不重叠',()=>{
 const tasks=['npc','body','world','daily','text'].flatMap(scopeTasks);assert.equal(tasks.length,214);assert.equal(new Set(tasks.map(t=>t.batchId)).size,214);assert.equal(tasks.reduce((n,t)=>n+t.size,0),10700);
 assert.equal(scopeTasks('all').length,initialPlan().length);assert.throws(()=>scopeTasks('unknown'));
});
test('全包总指令要求连续完成而无需逐50条确认，五类也有独立指令',()=>{
 const text=wholePrompt('all');assert.ok(text.includes('10700'));assert.ok(text.includes('不要每50条向用户请示'));assert.ok(text.includes('不设计生成算法'));assert.ok(text.includes('不得虚报'));
 for(const scope of ['npc','body','world','daily','text'])assert.ok(wholePrompt(scope,`ai-${scope}`).includes(`scope=${scope}`));
});
test('整包格式要求完整范围，拒绝缺批、重批、范围外批次和夹带规则',()=>{
 const d=delivery();assert.equal(validateDelivery(d).batches.length,scopeTasks('daily').length);
 for(const modify of [(d:ReturnType<typeof delivery> & {effects?:unknown[]})=>d.batches.pop(),(d:ReturnType<typeof delivery> & {effects?:unknown[]})=>d.batches.push(d.batches[0]),(d:ReturnType<typeof delivery> & {effects?:unknown[]})=>d.scope='npc',(d:ReturnType<typeof delivery> & {effects?:unknown[]})=>d.effects=[],(d:ReturnType<typeof delivery> & {effects?:unknown[]})=>d.batches.at(-1)!.entries[0].weight=1]){const raw=delivery();modify(raw);assert.throws(()=>validateDelivery(raw));}
});
test('一次领取整类，重领幂等，范围冲突不会部分改写领取记录',async t=>{
 const {root}=await fixture(t);await assign(root,'daily-work.b0001','another-ai');const before=await assignments(root);
 await assert.rejects(assignScope(root,'daily','ai-main'),/未改动/);assert.deepEqual(await assignments(root),before);
 const assigned=await assignScope(root,'npc','ai-npc');assert.equal(assigned.entries,catalog.filter(c=>c.group==='npc').reduce((n,c)=>n+c.target,0));await assignScope(root,'npc','ai-npc');
});
test('整类一次导入，保持原ID与未审稿状态；重复整包幂等且修复派生索引',async t=>{
 const {root,file}=await fixture(t);await assignScope(root,'daily','ai-main');const d=delivery();await atomicJSON(file,d);
 const result=await importDelivery(root,file);assert.equal(result.entries,1500);assert.equal(result.batches,30);assert.equal((await collection(root)).entries[0].id,d.batches[0].entries[0].id);
 assert.deepEqual((await rebuildIndex(root)).totals,{collected:1500,approved:0,used:0});
 await atomicJSON(path.join(root,'management','index.json'),{stale:true});assert.equal((await importDelivery(root,file)).status,'unchanged');assert.equal(JSON.parse(await readFile(path.join(root,'management','index.json'),'utf8')).totals.collected,1500);
});
test('最后一批格式或来源错误，整包都不收录',async t=>{
 const {root,file}=await fixture(t);await assignScope(root,'daily','ai-main');
 const bad=delivery();bad.batches.at(-1)!.entries[0].effects=[];await atomicJSON(file,bad);await assert.rejects(importDelivery(root,file));assert.equal((await collection(root)).entries.length,0);
 const wrong=delivery();wrong.batches.at(-1)!.source.producer='imposter';await atomicJSON(file,wrong);await assert.rejects(importDelivery(root,file),/来源/);assert.equal((await collection(root)).entries.length,0);
});
test('整包内部精确重复会拒绝所有批次，不留下前面已检查的词条',async t=>{
 const {root,file}=await fixture(t);await assignScope(root,'daily','ai-main');const d=delivery();d.batches[1].entries[0].text=d.batches[0].entries[0].text;await atomicJSON(file,d);
 await assert.rejects(importDelivery(root,file),/精确重复/);assert.equal((await collection(root)).entries.length,0);
});
test('部分已收录后重交完整包只补齐缺失批次，不覆盖旧内容',async t=>{
 const {root,file}=await fixture(t);await assignScope(root,'daily','ai-main');const d=delivery(),b=d.batches[0];await atomicJSON(path.join(root,'collections',b.library,b.batchId+'.json'),b);await atomicJSON(file,d);
 assert.equal((await importDelivery(root,file)).entries,1450);
 d.batches[0].entries[0].description='试图覆盖原内容';await atomicJSON(file,d);await assert.rejects(importDelivery(root,file),/不可覆盖/);assert.equal((await collection(root)).entries.length,1500);
});
