import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {gunzipSync} from 'node:zlib';
import {loadPacks} from '../src/content/loader.ts';
import {WorldGenerator} from '../src/world/generator.ts';
import {ActionExecutor} from '../src/engine/executor.ts';
import {SaveCodec,validateState} from '../src/persistence/codec.ts';
import {applyEffects} from '../src/engine/effects.ts';
import {advanceClock} from '../src/engine/clock.ts';
import {patchedBody} from '../src/engine/body.ts';
import {PERSONAL_CONTENT} from '../src/world/personal-content-data.ts';
import type {Id} from '../src/core/types.ts';

const json=async(f:string)=>JSON.parse(await readFile(new URL('../'+f,import.meta.url),'utf8'));
const index=await json('content/index.json');
const source=await loadPacks([...await Promise.all(index.packs.map((f:string)=>json('content/'+f))),await json('content/personality/pack.json'),...await Promise.all(['neighborhood-content','lexicon-content','world-profile-content','fantasy-content','personality-dialogue-content'].map(f=>json('content/generation/'+f+'.json')))]);
const args={registry:source,seed:42,rules:await json('content/generation/rules.json'),references:await Promise.all(['lexicon-reference','fantasy-reference'].map(f=>json('content/generation/'+f+'.json'))),worldProfiles:await json('content/generation/world-profiles.json')};
const g=await new WorldGenerator().generate({...args,worldTag:'worlds:setting.fantasy'});
const pack=g.registry.contentPacks.find(p=>p.manifest.id==='generated/neighborhood')!;
let serial=0;
function act(e:ActionExecutor,actionId:Id,requestId='personal-'+ ++serial){const r=e.performAction({actionId},e.snapshot().meta.revision,requestId);assert(r.ok,r.message+' '+actionId);return r;}
function engine(trust=2){const s=structuredClone(g.state);for(const n of s.district!.residents)n.trust=trust;return new ActionExecutor(g.registry,s);}
function walk(e:ActionExecutor,target:Id){
 const start=e.snapshot().world.locationId,queue:[Id,Id[]][]=[[start,[]]],seen=new Set<Id>();
 while(queue.length){const [at,path]=queue.shift()!;if(at===target){for(const routeId of path){const action=e.view().actions.find(a=>a.definition.effects.some(x=>x.op==='location.move'&&x.routeId===routeId));assert(action);act(e,action.definition.id);}return;}if(seen.has(at))continue;seen.add(at);for(const r of g.registry.routes.filter(r=>r.from===at))queue.push([r.to,[...path,r.id]]);}
 throw Error('No route');
}
function enter(e:ActionExecutor,key:string){const action=g.registry.action(`worldgen:action.personal.${key}.enter`);const where=action.conditions.find(c=>c.op==='location.is');assert(where?.op==='location.is');walk(e,where.id);act(e,action.id);}
async function roundTrip(e:ActionExecutor){const s=e.snapshot(),codec=new SaveCodec(g.registry,source),r=await codec.decode(await codec.encode(s));assert(r.status==='ready',r.status==='ready'?'':r.reason);assert.deepEqual(r.state,s);return new ActionExecutor(r.registry!,r.state);}

test('all authored stages, six commissions and goods compile into valid new fantasy worlds only',async()=>{
 validateState(g.state,g.registry);assert.equal(pack.events.filter(e=>/event.personal.story.\d.s\d$/.test(e.id)).length,12);assert.equal(pack.events.filter(e=>/event.personal.job.\d.offer$/.test(e.id)).length,6);
 assert.equal(pack.items!.filter(i=>i.id.includes('personal')).length,3);assert.equal(pack.equipment!.filter(i=>i.id.includes('personal')).length,2);
 for(const text of Object.values(pack.texts))assert.doesNotMatch(text,/【人物】|【地点】/);
 for(const action of pack.actions)assert.doesNotMatch(action.label,/【人物】|【地点】/);
 const cyber=await new WorldGenerator().generate({...args,worldTag:'worlds:setting.cyberpunk'});assert(!cyber.registry.contentPacks.flatMap(p=>p.events).some(e=>e.id.includes('event.personal.')));
 const again=await new WorldGenerator().generate({...args,worldTag:'worlds:setting.fantasy'});assert.deepEqual(again.state,g.state);
});

for(let story=0;story<3;story++)for(let branch=0;branch<2;branch++)test(`story ${story}, ending ${branch}: real stages, daily gate, free exit, exact save and explicit ending`,async()=>{
 let e=engine();
 for(let stage=0;stage<4;stage++){
  const key=`story.${story}.s${stage}`;
  if(stage){const wait=e.view().actions.find(a=>a.definition.effects.some(x=>x.op==='clock.advance'&&x.minutes===1440));assert(wait);act(e,wait.definition.id);}
  enter(e,key);if(stage)assert(e.view().sceneText.includes(g.registry.action(`worldgen:action.personal.story.${story}.s${stage-1}.${branch}`).label),'later dialogue must remember the actual previous choice');const before=e.snapshot();act(e,`worldgen:action.personal.${key}.exit`);const left=e.snapshot();assert.deepEqual(left.player,before.player);assert.deepEqual(left.clock,before.clock);assert.deepEqual(left.district,before.district);
  enter(e,key);act(e,`worldgen:action.personal.${key}.${branch}`);assert(e.snapshot().player.flags[`worldgen:flag.personal.story.${story}.s${stage}`]);e=await roundTrip(e);
  if(stage<3){const before=e.snapshot();const result=e.performAction({actionId:`worldgen:action.personal.story.${story}.s${stage+1}.enter`},before.meta.revision,'too-early-'+ ++serial);assert(!result.ok);assert.deepEqual(e.snapshot().clock,before.clock);}
 }
 assert(e.snapshot().player.flags[`worldgen:flag.personal.story.${story}.s3.c${branch}`]);
 assert(!e.snapshot().player.flags[`worldgen:flag.personal.story.${story}.s3.c${1-branch}`]);
 enter(e,`story.${story}.ending.${branch}`);assert.match(e.view().sceneText,/。/);act(e,`worldgen:action.personal.story.${story}.ending.${branch}.exit`);
});

for(let job=0;job<6;job++)for(let branch=0;branch<2;branch++)test(`commission ${job}, outcome ${branch}: offer, real travel, steps, save, submit once and follow-up`,async()=>{
 let e=engine();enter(e,`job.${job}.offer`);act(e,`worldgen:action.personal.job.${job}.offer.0`);
 const def=PERSONAL_CONTENT.commissions[job]!;
 const before=e.snapshot();assert(!e.performAction({actionId:`worldgen:action.personal.job.${job}.submit.enter`},before.meta.revision,'premature-'+ ++serial).ok);
 for(let step=0;step<def.steps.length;step++){enter(e,`job.${job}.step${step}`);act(e,`worldgen:action.personal.job.${job}.step${step}.${branch}`);e=await roundTrip(e);}
 enter(e,`job.${job}.submit`);const at=e.snapshot(),request='settle-'+ ++serial;act(e,`worldgen:action.personal.job.${job}.submit.${branch}`,request);
 const paid=e.snapshot();assert(paid.player.variables['core:money']!>at.player.variables['core:money']!);assert(paid.player.flags[`worldgen:flag.personal.job.${job}.done`]);
 act(e,`worldgen:action.personal.job.${job}.submit.${branch}`,request);assert.deepEqual(e.snapshot(),paid,'idempotent repeated request');
 const again=e.performAction({actionId:`worldgen:action.personal.job.${job}.submit.${branch}`},paid.meta.revision,'duplicate-'+ ++serial);assert(!again.ok);assert.equal(e.snapshot().player.variables['core:money'],paid.player.variables['core:money']);
 e=await roundTrip(e);enter(e,`job.${job}.follow${branch}`);act(e,`worldgen:action.personal.job.${job}.follow${branch}.exit`);
});

test('no resource or absent actor: actions fail without granting progress; new trust opcode has strict authority',async()=>{
 let e=engine();enter(e,'job.0.offer');act(e,'worldgen:action.personal.job.0.offer.0');
 const s=structuredClone(e.snapshot());s.player.variables['core:energy']=0;s.player.variables['core:stamina']=0;e=new ActionExecutor(g.registry,s);enter(e,'job.0.step0');const before=e.snapshot();const result=e.performAction({actionId:'worldgen:action.personal.job.0.step0.0'},before.meta.revision,'empty-resource');assert(!result.ok);assert(!e.snapshot().player.flags['worldgen:flag.personal.job.0.step0']);assert.deepEqual(e.snapshot().clock,before.clock);act(e,'worldgen:action.personal.job.0.step0.exit');
 const state=structuredClone(g.state),resident=state.district!.residents[0]!;
 const present=engine();enter(present,'story.0.s0');const departed=structuredClone(present.snapshot());advanceClock(departed,12*60);const absent=new ActionExecutor(g.registry,departed);assert(!absent.performAction({actionId:'worldgen:action.personal.story.0.s0.0'},departed.meta.revision,'departed-actor').ok);act(absent,'worldgen:action.personal.story.0.s0.exit');assert(!absent.snapshot().player.flags['worldgen:flag.personal.story.0.s0']);
 const bodyCase=engine();enter(bodyCase,'story.0.s0');const noHands=structuredClone(bodyCase.snapshot());noHands.player.body=patchedBody(noHands.player.body!,{id:'test:patch.no-grasp',label:'测试无抓握结构',summary:'测试',operations:noHands.player.body!.parts.filter(p=>g.registry.bodyPart(p.definitionId).kind==='hand').map(p=>({type:'remove' as const,partId:p.instanceId}))},g.registry);validateState(noHands,g.registry);const unsupported=new ActionExecutor(g.registry,noHands);assert(!unsupported.performAction({actionId:'worldgen:action.personal.story.0.s0.0'},noHands.meta.revision,'missing-grasp').ok);act(unsupported,'worldgen:action.personal.story.0.s0.exit');assert(!unsupported.snapshot().player.flags['worldgen:flag.personal.story.0.s0']);
 assert.throws(()=>applyEffects([{op:'resident.trust.change',residentId:resident.id,amount:10}],state,g.registry,{budget:100,changes:[],resolvedTexts:[],transactionId:'forged',actionId:'forged:action'}));
 const bad=JSON.parse(JSON.stringify(g.registry.contentPacks));const p=bad.find((p:{manifest:{id:string}})=>p.manifest.id==='generated/neighborhood');p.actions.find((a:{effects:{op:string}[]})=>a.effects.some(x=>x.op==='resident.trust.change')).effects.push({op:'resident.trust.change',residentId:resident.id,amount:101});await assert.rejects(loadPacks(bad));
});

test('personal goods use actual purchase, inventory, equipment and recovery effects; work still has daily protection',()=>{
 for(const i of [0,1,2,3,4]){
  let e=engine();const buy=g.registry.action(`worldgen:action.buy.personal.${i}`),goods=buy.effects.find(x=>x.op==='progression.act');assert(goods?.op==='progression.act');const target=goods.id!;
  const owner=pack.residentTemplates!.find(t=>t.services?.trade?.includes(target))!,agent=g.world.agents.find(a=>a.residentId.endsWith(':'+owner.id))!;
  const s=structuredClone(e.snapshot());s.world.locationId=agent.originLocationId;s.district!.currentResidentId=agent.residentId;s.player.variables['core:money']=100;s.player.variables['core:health']=50;s.player.variables['core:stamina']=50;s.player.variables['core:sanity']=50;e=new ActionExecutor(g.registry,s);
  act(e,buy.id);if(i===1||i===4){act(e,`worldgen:action.wear.personal.${i}`);assert(Object.values(e.snapshot().adventure!.equipment).includes(target));}else{act(e,`worldgen:action.use.item.personal.${i}`);assert.equal(e.snapshot().adventure!.items?.[target]??0,0);}
 }
 const owner=pack.residentTemplates!.find(t=>t.profession==='铁匠')!,agent=g.world.agents.find(a=>a.residentId.endsWith(':'+owner.id))!;const s=structuredClone(g.state);s.world.locationId=agent.originLocationId;s.district!.currentResidentId=agent.residentId;const e=new ActionExecutor(g.registry,s);
 const help=e.view().actions.find(a=>a.definition.effects.some(x=>x.op==='resident.help'));assert(help);act(e,help.definition.id);const after=e.snapshot();assert(!e.performAction({actionId:help.definition.id},after.meta.revision,'repeat-work').ok);assert.equal(e.snapshot().player.variables['core:money'],after.player.variables['core:money']);
});

test('pre-install actual saved world restores without new personal tasks or changes to captured prose',async()=>{
 const old=gunzipSync(await readFile(new URL('fixtures/pre-gemini-p0-world.json.gz',import.meta.url))).toString('utf8');const result=await new SaveCodec(g.registry,source).decode(old);assert(result.status==='ready',result.status==='ready'?'':result.reason);assert(!result.registry!.contentPacks.flatMap(p=>p.events).some(e=>e.id.includes('event.personal.')));assert(result.state.adventure!.story!.prose);validateState(result.state,result.registry!);
});
