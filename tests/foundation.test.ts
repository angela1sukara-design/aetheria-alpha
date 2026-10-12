import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { packs } from './helpers.ts';
import { loadPacks } from '../src/content/loader.ts';
import { parsePack } from '../src/content/schema.ts';
import { createGameState } from '../src/engine/state.ts';
import { ActionExecutor } from '../src/engine/executor.ts';
import { instantiateBody, patchedBody } from '../src/engine/body.ts';
import { effectivePart, bodyMatches, capabilityCount, entityBody, PLAYER } from '../src/engine/query.ts';
import { evaluate } from '../src/engine/conditions.ts';
import { derivedSemantics } from '../src/engine/semantic-query.ts';
import { SaveCodec, validateState } from '../src/persistence/codec.ts';
import type { ContentPack, Id } from '../src/core/types.ts';
const json=async(p:string)=>JSON.parse(await readFile(new URL('../'+p,import.meta.url),'utf8'));
const base=await packs(),district=await json('content/district/pack.json'),foundation=await json('content/foundation/pack.json');
const inputs=[...base,district,foundation];
const registry=await loadPacks(inputs);
function withTestPack():ContentPack {
  return {manifest:{id:'test/foundation',namespace:'probe',version:'1.0.0',schemaVersion:2,engineApiVersion:'0.1',author:'test',status:'draft',dependencies:inputs.map(p=>({id:p.manifest.id,version:p.manifest.version,optional:false})),requiresCapabilities:['foundation.v2','body.graph.v1','tf.pipeline.v1','condition.v1','effect.v1','hook.action.v1'],migrations:[]},variables:[],flags:[],hooks:[],locations:[],routes:[],events:[],actions:[],texts:{'probe:result':'测试完成'},contributions:[]};
}
test('唯一实体身体、缺省与未知；读取不改状态、随机流或历史文本',()=>{
  const s=createGameState(registry,42),before=structuredClone(s),unknown=entityBody(createGameState(new (registry.constructor as any)(base,registry.packs.filter(p=>base.some(b=>b.manifest.id===p.id))),1),{kind:'npc',id:'aetheria-social:npc.velvet'});
  assert.equal(unknown.known,false);
  assert.equal(entityBody(s,{kind:'npc',id:'district:npc.nara'}).known,true);
  const part=s.player.body!.parts[0];assert.equal(effectivePart(part,registry).color,undefined);
  assert.deepEqual(evaluate({op:'not',condition:{op:'body.matches',target:PLAYER,part:{kind:'hand',color:'black'}}},s,registry).known,false);
  for(let i=0;i<20;i++){derivedSemantics(s,registry,{entity:PLAYER});capabilityCount(s,registry,PLAYER,'grasp');}
  assert.deepEqual(s,before);
});
test('机械手＋有机尾不会被跨部件合并成机械尾；真实能力不由材料或 Tag 授予',()=>{
  const s=createGameState(registry,42);s.player.body=patchedBody(s.player.body!,registry.bodyPatch('aetheria-tf:patch.tail.organic'),registry);
  s.player.body=patchedBody(s.player.body,{id:'probe:p',label:'测试',summary:'测试',operations:[{type:'attributes',partId:'hand.left',set:{materialId:'foundation:material.alloy'},unset:[]}]},registry);
  assert.deepEqual(bodyMatches(s,registry,PLAYER,{kind:'tail',materialFamily:'mechanical'}),{known:true,value:false});
  assert.ok(derivedSemantics(s,registry,{entity:PLAYER}).includes('foundation:body.has-tail'));
  assert.ok(!derivedSemantics(s,registry,{entity:PLAYER}).includes('foundation:body.mechanical-tail'));
  assert.deepEqual(capabilityCount(s,registry,PLAYER,'grasp'),{known:true,value:2});
  const gel={instanceId:'gel',definitionId:'district:part.hand.gel' as Id,overrides:{color:'white' as const}};
  assert.equal(effectivePart(gel,registry).materialId,'foundation:material.gel');assert.equal(effectivePart(gel,registry).color,'white');
});
test('v1 拒绝 v2 属性；未知引用、歧义 Tag、替代环与部件范围错误明确拒绝',async()=>{
  const bad=structuredClone(base.find(p=>p.bodyParts?.length)!);bad.bodyParts![0].defaults={color:'black'};assert.throws(()=>parsePack(bad));
  const p=withTestPack();p.partProfiles=[{id:'probe:profile',partId:'aetheria-tf:part.hand',defaults:{lengthMm:500}}];await assert.rejects(loadPacks([...inputs,p]),/lengthMm/);
  p.partProfiles![0].defaults={materialId:'probe:missing'};await assert.rejects(loadPacks([...inputs,p]));
  const f=structuredClone(foundation);f.tags[1].aliases=f.tags[0].aliases;await assert.rejects(loadPacks([...base,district,f]),/歧义/);
  const cycle=structuredClone(foundation);cycle.tags[0].status=cycle.tags[1].status='deprecated';cycle.tags[0].replacementId=cycle.tags[1].id;cycle.tags[1].replacementId=cycle.tags[0].id;await assert.rejects(loadPacks([...base,district,cycle]),/循环/);
});
test('NPC TF 经事务修改唯一目标；重复请求幂等、失败回滚和存读一致',async()=>{
  const p=withTestPack();p.bodyPatches=[{id:'probe:patch',label:'颜色调整',summary:'颜色调整',operations:[{type:'attributes',partId:'hand.left',set:{color:'silver'},unset:[]}]}];p.transformations=[{id:'probe:tf',label:'颜色调整',source:'free',stages:[{id:'apply',atMinutes:0,label:'完成',patchId:'probe:patch'}]}];
  const target={kind:'npc' as const,id:'district:npc.nara' as Id};
  p.actions=[{id:'probe:change',label:'调整',hint:'测试',group:'daily',conditions:[],effects:[{op:'tf.apply',id:'probe:tf',target}],resultText:'probe:result'},{id:'probe:fail',label:'回滚',hint:'测试',group:'daily',conditions:[],effects:[{op:'tf.apply',id:'probe:tf',target:{kind:'npc',id:'district:npc.riker'}},{op:'var.change',id:'core:money',amount:-999}],resultText:'probe:result'}];p.contributions=[{hookId:'aetheria:hook.apartment.actions',actionIds:p.actions.map(a=>a.id)}];
  const r=await loadPacks([...inputs,p]),s=createGameState(r,42),e=new ActionExecutor(r,s),intent={actionId:'probe:change' as Id};
  const result=e.performAction(intent,0,'npc-color');assert.equal(result.ok,true,result.message);assert.deepEqual(e.performAction(intent,0,'npc-color'),result);
  assert.deepEqual(e.snapshot().player.body,s.player.body);
  const body=entityBody(e.snapshot(),target);assert.ok(body.known);if(body.known)assert.equal(effectivePart(body.value.parts.find(p=>p.instanceId==='hand.left')!,r).color,'silver');
  assert.equal(e.snapshot().tfQueues[0].target?.kind,'npc');
  const before=e.snapshot();assert.equal(e.performAction({actionId:'probe:fail'},1,'rollback').ok,false);assert.deepEqual(e.snapshot(),before);
  validateState(before,r);const codec=new SaveCodec(r),read=await codec.decode(await codec.encode(before));assert.equal(read.status,'ready');if(read.status==='ready')assert.deepEqual(read.state,before);
});
test('旧 v3 加载增量包保持账本/记忆/图；原包哈希不冒用',async()=>{
  const old=await loadPacks([...base,district]),s=createGameState(old,7),codec=new SaveCodec(registry),read=await codec.decode(await new SaveCodec(old).encode(s));assert.equal(read.status,'ready');if(read.status==='ready'){assert.equal(read.state.meta.schemaVersion,4);for(const key of ['clock','player','rng','ledger','tfQueues','eventInstances']as const)assert.deepEqual(read.state[key],s[key]);assert.equal(read.state.meta.packs.length,old.packs.length+1);}
  for(const p of old.packs)assert.deepEqual(registry.packs.find(x=>x.id===p.id),p);
});
test('统一成年门槛不允许新种族低阈值绕过，未知年龄仍回退',async()=>{
  const {adultNPCEligibility}=await import('../src/engine/npc.ts');const social=structuredClone(base.find(p=>p.npcs?.length)!);social.species![0].adultAgeYears=1;social.npcs![0].ageYears=17;
  const r=await loadPacks(base.map(p=>p.manifest.id===social.manifest.id?social:p));assert.equal(adultNPCEligibility(r,social.npcs![0].id).pass,false);
  social.npcs![0].ageYears=null;const r2=await loadPacks(base.map(p=>p.manifest.id===social.manifest.id?social:p));assert.equal(adultNPCEligibility(r2,social.npcs![0].id).pass,false);
});
