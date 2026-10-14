import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {gunzipSync} from 'node:zlib';
import {loadPacks} from '../src/content/loader.ts';
import {createGameState} from '../src/engine/state.ts';
import {ActionExecutor} from '../src/engine/executor.ts';
import {SaveCodec} from '../src/persistence/codec.ts';
import {evaluate} from '../src/engine/conditions.ts';
import {adultNPCEligibility} from '../src/engine/npc.ts';
import {parsePack} from '../src/content/schema.ts';
import type {Id} from '../src/core/types.ts';
const json=async(p:string)=>JSON.parse(await readFile(new URL('../'+p,import.meta.url),'utf8'));
const index=await json('content/index.json'),inputs=await Promise.all(index.packs.map((p:string)=>json('content/'+p))),registry=await loadPacks(inputs);

test('new characters only submit a name and never acquire a player age property',async()=>{
 const engine=new ActionExecutor(registry,createGameState(registry,42));
 assert.equal(Object.hasOwn(engine.snapshot().district!.profile,'ageYears'),false);
 const result=engine.performAction({actionId:'district:action.create',params:{name:'旅客'}},0,'name-only');
 assert.equal(result.ok,true,result.message);assert.equal(engine.snapshot().district!.profile.name,'旅客');
 assert.equal(Object.hasOwn(engine.snapshot().district!.profile,'ageYears'),false);assert.doesNotMatch(result.text,/岁|年龄|undefined/);
 const codec=new SaveCodec(registry),loaded=await codec.decode(await codec.encode(engine.snapshot()));
 assert.equal(loaded.status,'ready',loaded.status==='quarantined'?loaded.reason:'');if(loaded.status==='ready')assert.deepEqual(loaded.state,engine.snapshot());
});

test('old creation requests retain ledger compatibility without recreating the age stat',async()=>{
 const engine=new ActionExecutor(registry,createGameState(registry,42));
 const result=engine.performAction({actionId:'district:action.create',params:{name:'旧请求',ageYears:31}},0,'old-request');assert.equal(result.ok,true,result.message);
 assert.equal(Object.hasOwn(engine.snapshot().district!.profile,'ageYears'),false);
 const codec=new SaveCodec(registry),loaded=await codec.decode(await codec.encode(engine.snapshot()));assert.equal(loaded.status,'ready',loaded.status==='quarantined'?loaded.reason:'');
});

test('existing profile ages remain readable without changing saved progress',async()=>{
 const state=createGameState(registry,42);state.district!.profile={name:'旧角色',ageYears:37,created:true,adultOptional:false};
 const codec=new SaveCodec(registry),loaded=await codec.decode(await codec.encode(state));assert.equal(loaded.status,'ready');if(loaded.status==='ready')assert.deepEqual(loaded.state,state);
 const fixture=gunzipSync(await readFile(new URL('fixtures/ux-predecessor-world.json.gz',import.meta.url))).toString('utf8');
 const old=JSON.parse(fixture).payload.state,world=await codec.decode(fixture);assert.equal(world.status,'ready',world.status==='quarantined'?world.reason:'');
 if(world.status==='ready'){assert.deepEqual(world.state.district,old.district);assert.deepEqual(world.state.clock,old.clock);}
});

test('optional content still requires opting in; NPC adult eligibility is unchanged',async()=>{
 const engine=new ActionExecutor(registry,createGameState(registry,42));
 const check=()=>evaluate({op:'preference.adultOptional',value:true},engine.snapshot(),registry).pass;
 assert.equal(check(),false);engine.performAction({actionId:'district:action.create',params:{name:'旅客'}},0,'create');assert.equal(check(),false);
 engine.performAction({actionId:'district:action.preference.on'},1,'on');assert.equal(check(),true);
 engine.performAction({actionId:'district:action.preference.off'},2,'off');assert.equal(check(),false);
 const source=structuredClone(inputs);const social=source.find(p=>p.npcs?.length);social.npcs[0].ageYears=17;
 const changed=await loadPacks(source);assert.equal(adultNPCEligibility(changed,social.npcs[0].id as Id).pass,false);
});

test('age-free player.create definitions load and invalid names still fail atomically',()=>{
 const pack=structuredClone(inputs.find(p=>p.manifest.id==='aetheria/district'));
 const action=pack.actions.find((a:{id:string})=>a.id==='district:action.create');delete action.effects[0].ageYears;
 assert.doesNotThrow(()=>parsePack(pack));
 const engine=new ActionExecutor(registry,createGameState(registry,42)),before=engine.snapshot();
 const result=engine.performAction({actionId:'district:action.create',params:{name:' '}},0,'bad-name');assert.equal(result.ok,false);assert.deepEqual(engine.snapshot(),before);
});
