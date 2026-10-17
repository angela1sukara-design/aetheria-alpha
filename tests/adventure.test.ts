import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {loadPacks} from '../src/content/loader.ts';
import {parsePack} from '../src/content/schema.ts';
import {ActionExecutor} from '../src/engine/executor.ts';
import {createGameState} from '../src/engine/state.ts';
import {SaveCodec,validateState} from '../src/persistence/codec.ts';
import {loadPersistedExtensions} from '../src/content/extensions.ts';
import {initialAdventure,startNarrative} from '../src/engine/narrative.ts';
import {evaluate} from '../src/engine/conditions.ts';
import {WorldGenerator} from '../src/world/generator.ts';
import {sumEquipmentBonuses} from '../src/engine/numerics.ts';
import {actionPreview} from '../src/ui/action-preview.ts';
import type {GameState,Id} from '../src/core/types.ts';
import {rikerRoute} from './district-helpers.ts';
const json=async(p:string)=>JSON.parse(await readFile(new URL('../'+p,import.meta.url),'utf8'));
const index=await json('content/index.json'),inputs=await Promise.all(index.packs.map((p:string)=>json('content/'+p))),registry=await loadPacks(inputs);
const adventureInput=inputs.find(p=>p.manifest.id==='aetheria/adventure');
let serial=0;
function act(e:ActionExecutor,id:Id){const result=e.performAction({actionId:id},e.snapshot().meta.revision,'adventure-test-'+ ++serial);assert.equal(result.ok,true,`${id}: ${result.message}`);return result;}
function stateAt(location:Id='aetheria:location.market',seed=42):GameState{const s=createGameState(registry,seed);s.world.locationId=location;if(!s.world.knownLocationIds.includes(location))s.world.knownLocationIds.push(location);return s;}

test('zero stamina battle retains an emergency exit before and after saving',async()=>{
 const s=stateAt();s.player.variables['core:stamina']=0;const e=new ActionExecutor(registry,s);act(e,'progression:action.challenge.gel');
 assert.equal(e.view().actions.find(o=>o.definition.id==='district:action.combat.flee')?.available,true);
 const codec=new SaveCodec(registry),loaded=await codec.decode(await codec.encode(e.snapshot()));assert.equal(loaded.status,'ready');if(loaded.status!=='ready')return;
 const restored=new ActionExecutor(registry,loaded.state),money=restored.snapshot().player.variables['core:money'];act(restored,'district:action.combat.flee');assert.equal(restored.snapshot().district!.combat,null);assert.equal(restored.snapshot().player.variables['core:money'],money);
});

test('split real travel accumulates recovery time and remainder survives save',async()=>{
 const s=stateAt('aetheria:location.apartment');s.player.variables['core:aftertaste']=80;s.player.variables['core:skillResource']=0;
 let e=new ActionExecutor(registry,s);const codec=new SaveCodec(registry);
 for(let i=0;i<6;i++){act(e,i%2===0?'aetheria:action.travel.apartment_street':'aetheria:action.travel.street_apartment');if(i===1){const loaded=await codec.decode(await codec.encode(e.snapshot()));assert.equal(loaded.status,'ready');if(loaded.status==='ready')e=new ActionExecutor(registry,loaded.state);}}
 assert.equal(e.snapshot().clock.totalMinutes-s.clock.totalMinutes,60);assert.equal(e.snapshot().player.variables['core:aftertaste'],75);assert.equal(e.snapshot().player.variables['core:skillResource'],20);
});

test('10000 actual actions keep a bounded history and archived requests never pay again',async()=>{
 const e=new ActionExecutor(registry,createGameState(registry,42));
 for(let i=0;i<10000;i++){const result=e.performAction({actionId:'district:action.preference.off'},i,'long-lived-'+i);assert.equal(result.ok,true,result.message);}
 const state=e.snapshot();assert.ok(state.ledger.checkpoint);assert.ok(state.ledger.transactions.length<=512);validateState(state,registry);
 const codec=new SaveCodec(registry),save=await codec.encode(state);assert.ok(Buffer.byteLength(save)<1024*1024);const loaded=await codec.decode(save);assert.equal(loaded.status,'ready');
 assert.equal(e.performAction({actionId:'district:action.preference.off'},0,'long-lived-0').code,'REQUEST_ARCHIVED');assert.equal(e.snapshot().meta.revision,10000);
});

test('archiving preserves completed event conditions and TF/NPC source receipts',async()=>{
 const s=stateAt('aetheria-tf:location.clinic'),e=new ActionExecutor(registry,s);
 act(e,'aetheria-tf:action.clinic.consult');act(e,'aetheria-tf:action.consult.offer.accept');for(let i=0;i<3;i++)act(e,'aetheria-tf:action.clinic.wait');
 const completed=e.snapshot().eventInstances.find(x=>x.status==='completed')!.definitionId;
 for(let i=0;i<600;i++)act(e,'district:action.preference.off');
 assert.equal(evaluate({op:'event.state',id:completed,state:'completed'},e.snapshot(),registry).pass,true);validateState(e.snapshot(),registry);
 const codec=new SaveCodec(registry);assert.equal((await codec.decode(await codec.encode(e.snapshot()))).status,'ready');
});

test('persisted incompatible extensions are isolated while valid base still loads',async()=>{
 const raw=structuredClone(inputs.at(-1));raw.manifest.dependencies[0].version='999.0.0';const loaded=await loadPersistedExtensions(inputs.slice(0,-1),[raw]);assert.equal(loaded.quarantined.length,1);assert.equal(loaded.accepted.length,0);assert.ok(loaded.registry.locations.length);
});

test('defeat preserves scoped context and completes the authored recovery instead of offering a free escape',async()=>{
 const s=stateAt();s.player.variables['core:health']=1;s.player.variables['core:defense']=0;const e=new ActionExecutor(registry,s);act(e,'progression:action.challenge.gel');
 for(let i=0;i<10&&e.snapshot().district!.combat;i++)act(e,'district:action.combat.guard');
 assert.ok(['progression:node.defeat.control','progression:node.defeat.control.cautious'].includes(e.snapshot().adventure!.story!.nodeId));const before=e.snapshot();e.view();e.view();assert.deepEqual(e.snapshot(),before);
 const codec=new SaveCodec(registry),loaded=await codec.decode(await codec.encode(before));assert.equal(loaded.status,'ready');if(loaded.status!=='ready')return;const restored=new ActionExecutor(registry,loaded.state);assert.deepEqual(restored.snapshot(),before);
 act(restored,'progression:action.story.0');assert.equal(restored.snapshot().adventure!.story?.nodeId,'progression:node.defeat.coat');const options=restored.view().actions;assert.ok(options.some(o=>o.available));assert.ok(options.every(o=>o.definition.label!=='结束当前经历，回到安全位置'));act(restored,'progression:action.story.1');assert.equal(restored.snapshot().adventure!.story?.stage,'help');act(restored,'progression:action.story.0');assert.equal(restored.snapshot().adventure!.story,null);assert.ok(restored.snapshot().player.variables['core:health']!>=1);assert.ok(restored.snapshot().clock.totalMinutes>before.clock.totalMinutes);
});

test('accepted mechanical maintenance applies real TF once with verifiable narrative origin',async()=>{
 const s=stateAt('aetheria-tf:location.clinic');let e=new ActionExecutor(registry,s);act(e,'aetheria-tf:action.clinic.consult');act(e,'aetheria-tf:action.consult.offer.accept');for(let i=0;i<3;i++)act(e,'aetheria-tf:action.clinic.wait');
 const next=structuredClone(e.snapshot());next.adventure!.lastCombat={enemyId:'district:enemy.scavenger',enemyName:'失控搬运机',result:'defeat',turn:1,tags:[]};
 const tail=next.player.body!.parts.find(p=>p.instanceId==='tail')!;tail.overrides={...tail.overrides,lengthMm:500};
 startNarrative(next,registry,{budget:64,changes:[],resolvedTexts:[],transactionId:'maintenance-story',actionId:'progression:action.story.0'},'defeat','progression:profile.scavenger');e=new ActionExecutor(registry,next);
 act(e,'progression:action.story.0');assert.equal(e.snapshot().adventure!.story?.nodeId,'progression:node.defeat.repair.tail');act(e,'progression:action.story.0');
 assert.equal(e.snapshot().player.body!.parts.find(p=>p.instanceId==='tail')!.overrides!.lengthMm,650);assert.equal(e.snapshot().tfQueues.at(-1)!.status,'completed');validateState(e.snapshot(),registry);
 assert.equal((await new SaveCodec(registry).decode(await new SaveCodec(registry).encode(e.snapshot()))).status,'ready');
 const finished=structuredClone(e.snapshot());startNarrative(finished,registry,{budget:64,changes:[],resolvedTexts:[],transactionId:'maintenance-repeat',actionId:'progression:action.story.0'},'defeat','progression:profile.scavenger');const repeated=new ActionExecutor(registry,finished);act(repeated,'progression:action.story.0');assert.equal(repeated.snapshot().adventure!.story?.nodeId,'progression:node.defeat.repair.scope');
});

test('training has real costs and daily limits; shops equip weapon and armor together',()=>{
 const s=stateAt('district:location.workshop');s.player.variables['core:money']=200;const e=new ActionExecutor(registry,s);
 act(e,'progression:action.train.attack');act(e,'progression:action.train.attack');assert.equal(e.snapshot().player.variables['core:attack'],12);assert.equal(e.view().actions.find(o=>o.definition.id==='progression:action.train.attack')!.available,false);
 act(e,'progression:action.train.defense');assert.equal(e.view().actions.find(o=>o.definition.id==='progression:action.train.speed')!.available,false);
 act(e,'progression:action.buy.blade');act(e,'progression:action.buy.vest');act(e,'progression:action.wear.blade');act(e,'progression:action.wear.vest');assert.equal(Object.keys(e.snapshot().adventure!.equipment).length,2);
 const gear=Object.values(e.snapshot().adventure!.equipment).map(id=>registry.equipment.find(x=>x.id===id)!);assert.deepEqual(sumEquipmentBonuses(gear),{attack:3,defense:3,evasion:3});validateState(e.snapshot(),registry);
 const next=structuredClone(e.snapshot());next.district!.equipped=null;const restored=new ActionExecutor(registry,next);act(restored,'progression:action.challenge.raider');assert.match(restored.view().sceneText,/攻击15；防御14/);
});

test('orders, investments and daily income form a playable resource loop',()=>{
 const e=new ActionExecutor(registry,stateAt());act(e,'progression:action.order');act(e,'progression:action.order');act(e,'progression:action.order');assert.equal(e.snapshot().adventure!.orders,3);assert.equal(e.view().actions.find(o=>o.definition.id==='progression:action.order')!.available,false);
 act(e,'progression:action.invest');assert.equal(e.snapshot().adventure!.assets,5);const before=e.snapshot().player.variables['core:money']!;act(e,'district:action.waitday.location.market');assert.equal(e.snapshot().player.variables['core:money'],before+10);act(e,'progression:action.order');assert.equal(e.snapshot().adventure!.assets,6);
});

test('all story categories have usable starts and condition-driven branches',()=>{
 for(const kind of ['encounter','exploration','daily','transformation']as const){const s=stateAt();s.adventure!.reputation=2;const e=new ActionExecutor(registry,s);act(e,`progression:action.narrative.${kind}`);assert.equal(e.snapshot().adventure!.story!.kind,kind);const last=e.view().actions.at(-1)!;assert.equal(last.available,true);act(e,last.definition.id);assert.equal(e.snapshot().adventure!.story,null);}
 const s=stateAt();s.clock.totalMinutes=1320;const e=new ActionExecutor(registry,s);act(e,'progression:action.narrative.exploration');assert.equal(e.snapshot().adventure!.story!.nodeId,'progression:node.exploration.night');
});

test('strict authoring validation rejects unknown scopes and resource deadlocks while allowing forward-only beats',()=>{
 const raw=structuredClone(adventureInput);raw.narrativeNodes[0].requiresTags=[{role:'someone',tagId:'foundation:theme.gel'}];assert.throws(()=>parsePack(raw));const blocked=structuredClone(adventureInput);delete blocked.narrativeNodes[0].skipChoiceIndex;blocked.narrativeNodes[0].choices=[{...blocked.narrativeNodes[0].choices[0],conditions:[{op:'var.compare',id:'core:stamina',comparison:'gte',value:10}]}];assert.throws(()=>parsePack(blocked));assert.doesNotThrow(()=>parsePack(adventureInput));
});

test('authored story costs use ordinary eligibility and public previews without mutating state',async()=>{
 const raw=structuredClone(adventureInput),node=raw.narrativeNodes.find((n:{id:string})=>n.id==='progression:node.daily.start');
 node.choices[0].conditions=[];node.choices[0].effects=[{op:'var.change',id:'core:money',amount:-8},{op:'clock.advance',minutes:15}];
 const r=await loadPacks(inputs.map(p=>p.manifest.id===raw.manifest.id?raw:p)),s=createGameState(r,42);s.player.variables['core:money']=0;const e=new ActionExecutor(r,s);act(e,'progression:action.narrative.daily');
 const before=e.snapshot(),option=e.view().actions[0]!;assert.equal(option.available,false);assert.match(option.reason,/零钱不足/);assert.deepEqual(actionPreview(option.definition,r,before),['15分钟','零钱 −8币']);assert.deepEqual(e.snapshot(),before);
 const result=e.performAction({actionId:option.definition.id},before.meta.revision,'story-cannot-pay');assert.equal(result.ok,false);assert.deepEqual(e.snapshot(),before);act(e,'progression:action.story.1');assert.equal(e.snapshot().adventure!.story,null);
 const overlap=structuredClone(raw);overlap.narrativeNodes[0].choices[0].effects=[{op:'scene.start',id:'district:interaction.riker.quiet'}];assert.throws(()=>parsePack(overlap));
});

test('NPC origin receipts remain valid after old dialogue history is archived',async()=>{
 const {r,e}=await rikerRoute();for(let i=0;i<600;i++)act(e,'district:action.preference.off');validateState(e.snapshot(),r);assert.ok(e.snapshot().ledger.checkpoint!.evidence.length>0);const codec=new SaveCodec(r);assert.equal((await codec.decode(await codec.encode(e.snapshot()))).status,'ready');
});

test('skill resources are spent and same-day opponent rewards cannot be farmed',()=>{
 const s=stateAt('aetheria:location.street');s.player.variables['core:attack']=100;s.player.variables['core:skillResource']=100;
 const e=new ActionExecutor(registry,s);act(e,'progression:action.challenge.raider');act(e,'progression:action.combat.skill');assert.equal(e.snapshot().player.variables['core:skillResource'],90);
 while(e.snapshot().district!.combat)act(e,'district:action.combat.attack');act(e,'progression:action.event.victory');
 const before=e.snapshot().player.variables['core:money'];assert.equal(e.snapshot().adventure!.victories['progression:enemy.raider'],1);
 act(e,'progression:action.challenge.raider');while(e.snapshot().district!.combat)act(e,'district:action.combat.attack');act(e,'progression:action.event.victory');assert.equal(e.snapshot().player.variables['core:money'],before);assert.equal(e.snapshot().adventure!.victories['progression:enemy.raider'],1);
});

test('emergency withdrawal also works with no action points',()=>{
 const s=stateAt();s.player.variables['core:actionPoints']=0;const e=new ActionExecutor(registry,s);act(e,'progression:action.challenge.gel');act(e,'district:action.combat.flee');assert.equal(e.snapshot().district!.combat,null);
});

test('pre-adventure fixed saves upgrade additively and generated worlds have real combat in all 17 themes',async()=>{
 const oldRegistry=await loadPacks(inputs.filter(p=>!['aetheria/adventure','aetheria/story-replay'].includes(p.manifest.id))),old=createGameState(oldRegistry,42),save=await new SaveCodec(oldRegistry).encode(old),loaded=await new SaveCodec(registry).decode(save);assert.equal(loaded.status,'ready');if(loaded.status==='ready'){assert.ok(loaded.state.adventure);assert.deepEqual(loaded.state.player,old.player);assert.deepEqual(loaded.state.ledger,old.ledger);assert.ok(loaded.registry);assert.ok(!loaded.registry.packs.some(p=>p.id==='aetheria/story-replay'));}
 const extra=await Promise.all(['neighborhood-content','lexicon-content','world-profile-content'].map(n=>json('content/generation/'+n+'.json'))),source=await loadPacks([...inputs,...extra]),profiles=await json('content/generation/world-profiles.json'),references=[await json('content/generation/lexicon-reference.json')],rules=await json('content/generation/rules.json');
 for(const profile of profiles.profiles){const g=await new WorldGenerator().generate({seed:42,registry:source,references,rules,worldProfiles:profiles,worldTag:profile.tag});const commons=g.world.definition.locations.find(l=>l.service==='commons')!;g.state.world.locationId=commons.id;g.state.world.knownLocationIds.push(commons.id);const e=new ActionExecutor(g.registry,g.state);assert.equal(e.view().actions.find(o=>o.definition.id==='progression:action.challenge.raider')?.available,true);act(e,'progression:action.challenge.raider');act(e,'district:action.combat.flee');validateState(e.snapshot(),g.registry);}
});

test('capital and stewardship endings require and accept milestones earned through real actions',async()=>{
 const extra=await Promise.all(['neighborhood-content','lexicon-content','world-profile-content'].map(n=>json('content/generation/'+n+'.json'))),source=await loadPacks([...inputs,...extra]),profiles=await json('content/generation/world-profiles.json'),references=[await json('content/generation/lexicon-reference.json')],rules=await json('content/generation/rules.json');
 for(const path of profiles.profiles[0].quests.source.mainQuest.paths){
  const g=await new WorldGenerator().generate({seed:42,registry:source,references,rules,worldProfiles:profiles,worldTag:profiles.profiles[0].tag}),e=new ActionExecutor(g.registry,g.state);
  const rest=()=>{while(e.snapshot().player.variables['core:stamina']!<30||e.snapshot().player.variables['core:energy']!<15)act(e,'progression:action.rest');};
  const go=(destination:Id)=>{const queue=[{id:e.snapshot().world.locationId,path:[]as Id[]}],seen=new Set<Id>();while(queue.length){const item=queue.shift()!;if(item.id===destination){for(const route of item.path){rest();const option=e.view().actions.find(o=>o.definition.effects.some(f=>f.op==='location.move'&&f.routeId===route))!;act(e,option.definition.id);}return;}if(seen.has(item.id))continue;seen.add(item.id);for(const route of g.registry.routes.filter(r=>r.from===item.id))queue.push({id:route.to,path:[...item.path,route.id]});}assert.fail('No route');};
  for(const stage of path.stages.slice(0,-1)){const binding=g.world.definition.quests!.stages.find(b=>b.id===stage.id)!;go(binding.locationId);act(e,binding.entryActionId);act(e,`main:action.${stage.id}.b`);}
  const final=path.stages.at(-1),binding=g.world.definition.quests!.stages.find(b=>b.id===final.id)!;go(binding.locationId);act(e,binding.entryActionId);assert.equal(e.view().actions.find(o=>o.definition.id===`main:action.${final.id}.b`)!.available,false);act(e,`main:action.${final.id}.leave`);
  if(path.id==='path.resource'){
   go(g.world.definition.locations.find(l=>l.service==='market')!.id);for(let i=0;i<3;i++){rest();act(e,'progression:action.order');}act(e,'progression:action.invest');act(e,'progression:action.sleep');rest();act(e,'progression:action.order');
  }else{
   go(g.world.definition.locations.find(l=>l.service==='commons')!.id);
   for(const enemy of ['raider','gel']){rest();while(e.snapshot().player.variables['core:health']!<90)act(e,'progression:action.care');act(e,`progression:action.challenge.${enemy}`);for(let turn=0;e.snapshot().district!.combat&&turn<30;turn++){const skill=e.view().actions.find(o=>o.definition.id==='progression:action.combat.skill');act(e,skill?.available?'progression:action.combat.skill':'district:action.combat.attack');}assert.equal(e.snapshot().adventure!.lastCombat!.result,'victory');const exit=e.view().actions.find(o=>o.available&&o.definition.effects.some(f=>f.op==='event.advance'))!;act(e,exit.definition.id);}
   rest();act(e,'progression:action.patrol');act(e,'progression:action.aid');
  }
  go(binding.locationId);act(e,binding.entryActionId);act(e,`main:action.${final.id}.b`);assert.equal(e.snapshot().player.flags['main:flag.top_reached'],true);validateState(e.snapshot(),g.registry);const codec=new SaveCodec(g.registry);assert.equal((await codec.decode(await codec.encode(e.snapshot()))).status,'ready');
 }
});
