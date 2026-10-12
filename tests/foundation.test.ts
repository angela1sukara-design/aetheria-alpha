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
import { stableJson } from '../src/core/types.ts';
import { WorldGenerator } from '../src/world/generator.ts';
import { parseReference } from '../src/world/schema.ts';
import { presentationText } from '../src/engine/semantic-query.ts';
import { rikerRoute, da, must } from './district-helpers.ts';
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
  const emptyLight=structuredClone(foundation);emptyLight.locationProfiles[0].light='';assert.throws(()=>parsePack(emptyLight),/不支持/);
  const emptyReplacement=structuredClone(foundation);emptyReplacement.tags[0].replacementId='';assert.throws(()=>parsePack(emptyReplacement),/稳定 ID/);
  const rule=withTestPack();rule.proseSelections=[{id:'probe:rule',entryId:'foundation:prose.light.lit',channel:'environment',when:[{op:'environment.light',locationId:'' as Id,value:'lit'}]}];assert.throws(()=>parsePack(rule),/稳定 ID/);
  rule.proseSelections[0].when=[{op:'body.matches',target:PLAYER,part:{lengthMm:650}}];assert.throws(()=>parsePack(rule),/tail 作用域/);
});
test('NPC TF 经事务修改唯一目标；重复请求幂等、失败回滚和存读一致',async()=>{
  const p=withTestPack();p.bodyPatches=[{id:'probe:patch',label:'颜色调整',summary:'颜色调整',operations:[{type:'attributes',partId:'hand.left',set:{color:'silver'},unset:[]}]}];p.transformations=[{id:'probe:tf',label:'颜色调整',source:'free',stages:[{id:'apply',atMinutes:0,label:'完成',patchId:'probe:patch'}]}];
  const target={kind:'npc' as const,id:'district:npc.nara' as Id};
  p.actions=[{id:'probe:change',label:'调整',hint:'测试',group:'daily',conditions:[],effects:[{op:'tf.apply',id:'probe:tf',target}],resultText:'probe:result'},{id:'probe:fail',label:'回滚',hint:'测试',group:'daily',conditions:[],effects:[{op:'tf.apply',id:'probe:tf',target:{kind:'npc',id:'district:npc.riker'}},{op:'event.start',id:base.flatMap(p=>p.events).find(e=>!e.participantIds?.length)!.id},{op:'var.change',id:'core:money',amount:-999}],resultText:'probe:result'}];p.contributions=[{hookId:'aetheria:hook.apartment.actions',actionIds:p.actions.map(a=>a.id)}];
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
test('实际属性 TF 改变候选文本，尺寸及改造来源经存档校验',async()=>{
  const s=createGameState(registry,2);s.player.body=patchedBody(s.player.body!,registry.bodyPatch('aetheria-tf:patch.tail.organic'),registry);
  assert.match(presentationText(s,registry,'body')!,/轻轻摆动/);
  const e=new ActionExecutor(registry,s),res=e.performAction({actionId:'foundation:action.tail-length'},0,'resize');assert.equal(res.ok,true,res.message);
  assert.match(presentationText(e.snapshot(),registry,'body')!,/转身空间/);
  const part=e.snapshot().player.body!.parts.find(p=>p.instanceId==='tail')!;
  assert.equal(effectivePart(part,registry).lengthMm,650);assert.equal(part.provenance?.tfInstanceId,e.snapshot().tfQueues[0].instanceId);
  const bad=structuredClone(e.snapshot());bad.player.body!.parts.find(p=>p.instanceId==='tail')!.overrides={lengthMm:0};assert.throws(()=>validateState(bad,registry),/lengthMm/);
  const forged=structuredClone(e.snapshot());forged.player.body!.parts.find(p=>p.instanceId==='tail')!.provenance!.stageId='forged';assert.throws(()=>validateState(forged,registry),/来源/);
});
test('NPC 阶段 TF 遇真实接触阻塞，暂停/存读/恢复/取消均保留阶段且不改玩家',async()=>{
  const {e:route}=await rikerRoute(),p=withTestPack(),target={kind:'npc' as const,id:'district:npc.riker' as Id};
  p.bodyPatches=[{id:'probe:color',label:'涂层调整',summary:'涂层调整',operations:[{type:'attributes',partId:'hand.left',set:{color:'silver'},unset:[]}]}];p.transformations=[{id:'probe:story',label:'涂层维护',source:'story',stages:[{id:'first',atMinutes:5,label:'涂层完成',patchId:'probe:color'},{id:'finish',atMinutes:10,label:'维护完成'}]}];
  const fx=[{id:'enqueue',op:'tf.enqueue'},{id:'pause',op:'tf.pause'},{id:'resume',op:'tf.resume'},{id:'cancel',op:'tf.cancel'}] as const;
  p.actions=fx.map(({id,op})=>({id:`probe:${id}`,label:id,hint:'测试',group:'daily',surface:'body',conditions:[],effects:[{op,id:'probe:story',target}],resultText:'probe:result'}));p.actions.push({id:'probe:wait',label:'wait',hint:'测试',group:'daily',surface:'body',conditions:[],effects:[{op:'clock.advance',minutes:5}],resultText:'probe:result'});p.contributions=[{hookId:'aetheria-tf:hook.body',actionIds:p.actions.map(a=>a.id)}];
  const r=await loadPacks([...inputs,p]),s=structuredClone(route.snapshot());s.meta.packs=structuredClone(r.packs);let e=new ActionExecutor(r,s);
  da(e,'riker.quiet');da(e,'event.riker.quiet.private.0');da(e,'scene.contact');const player=e.snapshot().player.body;
  must(e,'probe:enqueue');must(e,'probe:wait');assert.equal(e.snapshot().tfQueues.at(-1)!.status,'blocked');assert.deepEqual(e.snapshot().tfQueues.at(-1)!.completedStageIds,[]);
  const codec=new SaveCodec(r),loaded=await codec.decode(await codec.encode(e.snapshot()));assert.equal(loaded.status,'ready');if(loaded.status!=='ready')return;e=new ActionExecutor(r,loaded.state);
  da(e,'scene.release');must(e,'probe:resume');assert.deepEqual(e.snapshot().tfQueues.at(-1)!.completedStageIds,['first']);must(e,'probe:pause');must(e,'probe:wait');assert.equal(e.snapshot().tfQueues.at(-1)!.elapsedMinutes,5);must(e,'probe:cancel');assert.equal(e.snapshot().tfQueues.at(-1)!.status,'cancelled');assert.deepEqual(e.snapshot().player.body,player);
  const body=entityBody(e.snapshot(),target);if(body.known)assert.equal(effectivePart(body.value.parts.find(p=>p.instanceId==='hand.left')!,r).color,'silver');assert.equal((await codec.decode(await codec.encode(e.snapshot()))).status,'ready');
  assert.ok(e.snapshot().district!.scene!.actors.every(a=>!a.body&&a.entity));
});
test('生成居民 TF 使用同一事务目标路由；身体变化后旧外观不再作为当前结构',async()=>{
  const r=await loadPacks([...inputs,await json('content/generation/neighborhood-content.json')]),g=await new WorldGenerator().generate({seed:7,registry:r,rules:await json('content/generation/rules.json'),references:[await json('content/generation/reference.json')]});
  const n=g.state.district!.residents[0],p=withTestPack();p.manifest.dependencies.push({id:'generated/neighborhood',version:g.world.generation.generatorVersion,optional:false});
  p.actions=[{id:'probe:resident-change',label:'居民耳部适配',hint:'测试',group:'daily',conditions:[],effects:[{op:'tf.apply',id:'aetheria-tf:tf.ears.cat',target:{kind:'resident',id:n.id}}],resultText:'probe:result'}];p.contributions=[{hookId:g.registry.location(g.state.world.locationId).actionHook,actionIds:['probe:resident-change']}];
  const installed=await loadPacks([...g.registry.contentPacks,p]),s=structuredClone(g.state);s.meta.packs=structuredClone(installed.packs);s.worldInstance!.definition.packs=structuredClone(installed.contentPacks);const e=new ActionExecutor(installed,s),player=e.snapshot().player.body;
  const res=e.performAction({actionId:'probe:resident-change'},0,'resident-tf');assert.equal(res.ok,true,res.message);assert.deepEqual(e.snapshot().player.body,player);assert.ok(e.snapshot().district!.residents[0].body.parts.some(p=>p.definitionId==='aetheria-tf:part.ear.cat'));
  const codec=new SaveCodec(installed);assert.equal((await codec.decode(await codec.encode(e.snapshot()))).status,'ready');
});
test('v0.3 世界服务/生态/光照、真实行为限制与新旧快照闭环',async()=>{
  const r=await loadPacks([...inputs,await json('content/generation/neighborhood-content.json'),await json('content/generation/lexicon-content.json')]),rules=await json('content/generation/rules.json'),reference=await json('content/generation/lexicon-reference.json');
  const g=await new WorldGenerator().generate({seed:42,registry:r,rules,references:[reference]});validateState(g.state,g.registry);
  assert.equal(g.state.meta.schemaVersion,4);
  const e=new ActionExecutor(g.registry,g.state),light=e.view().actions.find(a=>a.definition.effects.some(e=>e.op==='environment.setLight'&&e.value==='dark'))!;
  assert.ok(derivedSemantics(g.state,g.registry,{locationId:g.state.world.locationId}).some(t=>t.startsWith('foundation:service.')));
  const before=e.snapshot(),action=light.definition.id,res=e.performAction({actionId:action},0,'light-off');assert.equal(res.ok,true,res.message);assert.deepEqual(e.snapshot().rng,before.rng);assert.deepEqual(e.snapshot().clock,before.clock);
  assert.match(presentationText(e.snapshot(),g.registry,'environment')!,/熄灭/);
  const work=e.view().actions.filter(a=>a.definition.conditions.some(c=>c.op==='environment.light'&&c.value==='lit')&&!a.definition.effects.some(e=>e.op==='environment.setLight'));assert.ok(work.every(a=>!a.available));
  const codec=new SaveCodec(g.registry),loaded=await codec.decode(await codec.encode(e.snapshot()));assert.equal(loaded.status,'ready');if(loaded.status==='ready')assert.deepEqual(loaded.state,e.snapshot());
  const conflict=structuredClone(g.state);conflict.worldInstance!.definition.locations[0].tags.push('foundation:service.market');assert.throws(()=>validateState(conflict,g.registry),/service/);
  const ecology=structuredClone(g.state);ecology.worldInstance!.definition.regions[0].ecologyTags=[];assert.throws(()=>validateState(ecology,g.registry),/生态/);
});
test('新旧参考域拒绝未知 Tag、同义矛盾、错误服务及生成顺序不可达',async()=>{
  const r=await loadPacks([...inputs,await json('content/generation/neighborhood-content.json')]),ref=await json('content/generation/reference.json'),rules=await json('content/generation/rules.json');
  const unknown=structuredClone(ref);unknown.templates[0].requiresTags=['climate.typo'];assert.throws(()=>parseReference(unknown,r),/未定义/);
  const contradiction=structuredClone(ref);contradiction.templates[0].requiresTags=['climate.wet'];contradiction.templates[0].excludesTags=['foundation:setting.wet'];assert.throws(()=>parseReference(contradiction,r),/同时要求/);
  const service=structuredClone(ref),place=service.templates.find((t:any)=>t.kind==='place');place.contributes.tags=['service.clinic'];if(place.data.service==='clinic')place.contributes.tags=['service.market'];assert.throws(()=>parseReference(service,r),/service/);
  const order=structuredClone(ref);order.templates[0].combination.requiresTemplates=[order.templates.find((t:any)=>t.kind==='npc').id];await assert.rejects(new WorldGenerator().generate({seed:1,registry:r,rules,references:[order]}),/顺序不可达/);
});
test('普通与 NSFW 素材 v2 严格验收；旧 parser 不冒充兼容且正文不能夹带规则',async()=>{
  const {validateSemanticBatch}=await import('../scripts/lexicon/semantic-format.mjs');const {validateBatch}=await import('../scripts/lexicon/library.mjs');
  for(const domain of ['general','nsfw']){const p=await json(`production/lexicon-authoring/formats/v2/${domain}-example.json`);assert.equal(validateSemanticBatch(p,registry).domain,domain);assert.throws(()=>validateBatch(p));const bad=structuredClone(p);bad.entries[0].effects=[];assert.throws(()=>validateSemanticBatch(bad,registry));const tag=structuredClone(p);tag.entries[0].tags=['foundation:missing'];assert.throws(()=>validateSemanticBatch(tag,registry));}
});
test('旧场景身体副本被弃用且不升级为 NPC 权威；未知身体暂停但事件与历史不丢失',async()=>{
  const {e}=await rikerRoute();da(e,'riker.quiet');da(e,'event.riker.quiet.private.0');
  const old=await loadPacks([...base,district]),s=structuredClone(e.snapshot());s.meta={...s.meta,schemaVersion:3,engineVersion:'0.1-stage3',packs:structuredClone(old.packs)};delete s.environment;for(const n of s.npcs)delete n.body;
  for(const a of s.district!.scene!.actors){a.body=instantiateBody(old.bodyTemplate('aetheria-tf:body.human'));delete a.entity;}
  s.district!.scene!.actors[1].body=patchedBody(s.district!.scene!.actors[1].body!,old.bodyPatch('aetheria-tf:patch.tail.organic'),old);
  const codec=new SaveCodec(old),text=await codec.encode(s),loaded=await codec.decode(text);assert.equal(loaded.status,'ready');if(loaded.status!=='ready')return;
  assert.match(loaded.migration!,/身体副本/);assert.equal(loaded.state.district!.scene!.phase,'paused');assert.equal(loaded.state.npcs.find(n=>n.definitionId==='district:npc.riker')!.body,null);
  assert.ok(loaded.state.district!.scene!.actors.every(a=>!a.body&&a.entity));for(const key of ['ledger','rng','tfQueues','eventInstances','activeEventStack']as const)assert.deepEqual(loaded.state[key],s[key]);
  assert.equal((await codec.decode(await codec.encode(loaded.state))).status,'ready');
});
test('参数变化使装备失效时保留物品；候选按同一部件长度判断',async()=>{
  const p=withTestPack();p.equipment=[{id:'probe:equipment',name:'短尾护套',description:'尺寸适配',requires:[{op:'not',condition:{op:'body.matches',target:PLAYER,part:{kind:'tail',minLengthMm:600}}}]}];p.actions=[{id:'probe:wear',label:'穿戴',hint:'测试',surface:'body',group:'daily',conditions:[],effects:[{op:'equipment.wear',id:'probe:equipment'}],resultText:'probe:result'}];p.contributions=[{hookId:'aetheria-tf:hook.body',actionIds:['probe:wear']}];
  const r=await loadPacks([...inputs,p]),s=createGameState(r,7);s.player.body=patchedBody(s.player.body!,r.bodyPatch('aetheria-tf:patch.tail.organic'),r);s.player.body!.parts.find(p=>p.instanceId==='tail')!.overrides={lengthMm:450};const e=new ActionExecutor(r,s);must(e,'probe:wear');assert.equal(e.snapshot().district!.equipped,'probe:equipment');must(e,'foundation:action.tail-length');assert.equal(e.snapshot().district!.equipped,null);assert.ok(e.snapshot().district!.inventory.includes('probe:equipment'));
});

test('存档封装不能冒用另一格式版本，即使校验和有效也明确隔离',async()=>{
  const codec=new SaveCodec(registry),raw=JSON.parse(await codec.encode(createGameState(registry,7)));
  raw.payload.schemaVersion=3;
  raw.checksum=Buffer.from(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(stableJson(raw.payload)))).toString('hex');
  const text=JSON.stringify(raw),loaded=await codec.decode(text);
  assert.equal(loaded.status,'quarantined');if(loaded.status==='quarantined'){assert.match(loaded.reason,/版本不一致/);assert.equal(loaded.original,text);}
});

test('显式辅助移动和听觉职业适配允许无手足身体；生成与存档使用相同规则',async()=>{
  const content=await json('content/generation/neighborhood-content.json');
  content.manifest.schemaVersion=2;content.manifest.requiresCapabilities.push('foundation.v2');content.manifest.dependencies.push({id:'aetheria/foundation',version:'1.0.0',optional:false});
  const body=structuredClone(base.flatMap(p=>p.bodyTemplates??[]).find(t=>t.initial)!);
  body.id='neighborhood:body.listening';body.initial=false;body.label='听觉活动测试身体';
  body.parts=body.parts.filter(p=>['torso','head','ear.left','ear.right'].includes(p.instanceId));const ids=new Set(body.parts.map(p=>p.instanceId));body.edges=body.edges.filter(e=>ids.has(e.parentPartId)&&ids.has(e.childPartId));content.bodyTemplates=[body];
  content.residentAdaptations=content.residentTemplates.map((t:any,i:number)=>{t.bodyTemplateId=body.id;t.patchIds=[];return {id:`neighborhood:adaptation.${i}`,templateId:t.id,workCapabilities:['hear'],mobility:'assisted'};});
  const r=await loadPacks([...inputs,content]),args={seed:7,registry:r,rules:await json('content/generation/rules.json'),references:[await json('content/generation/reference.json')]};
  const g=await new WorldGenerator().generate(args);validateState(g.state,g.registry);
  for(const n of g.state.district!.residents){assert.deepEqual(capabilityCount(g.state,g.registry,{kind:'resident',id:n.id},'grasp'),{known:true,value:0});assert.deepEqual(capabilityCount(g.state,g.registry,{kind:'resident',id:n.id},'walk'),{known:true,value:0});}
  const codec=new SaveCodec(g.registry),loaded=await codec.decode(await codec.encode(g.state));assert.equal(loaded.status,'ready');if(loaded.status==='ready')assert.deepEqual(loaded.state,g.state);
  content.residentAdaptations.forEach((a:any)=>a.workCapabilities=['grasp']);const bad=await loadPacks([...inputs,content]);await assert.rejects(new WorldGenerator().generate({...args,registry:bad}),/活动适配/);
});
