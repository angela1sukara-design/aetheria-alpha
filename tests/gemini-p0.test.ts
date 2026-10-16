import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {gunzipSync} from 'node:zlib';
import {loadPacks} from '../src/content/loader.ts';
import {WorldGenerator} from '../src/world/generator.ts';
import {parseWorldProfiles,applyWorldProfile} from '../src/world/profiles.ts';
import {compileATemplates} from '../src/world/a-templates.ts';
import {ActionExecutor} from '../src/engine/executor.ts';
import {captureAProse} from '../src/engine/a-prose.ts';
import {SaveCodec,validateState} from '../src/persistence/codec.ts';
import type {Id} from '../src/core/types.ts';
import type {ReferenceTemplate} from '../src/world/types.ts';

const json=async(f:string)=>JSON.parse(await readFile(new URL('../'+f,import.meta.url),'utf8'));
const index=await json('content/index.json');
const source=await loadPacks([...await Promise.all(index.packs.map((f:string)=>json('content/'+f))),await json('content/personality/pack.json'),...await Promise.all(['neighborhood-content','lexicon-content','world-profile-content','fantasy-content','personality-dialogue-content'].map(f=>json('content/generation/'+f+'.json')))]);
const catalog=await json('content/generation/world-profiles.json');
const profiles=parseWorldProfiles(catalog,source);
const args={registry:source,rules:await json('content/generation/rules.json'),references:await Promise.all(['lexicon-reference','fantasy-reference'].map(f=>json('content/generation/'+f+'.json'))),worldProfiles:catalog};
const worlds=await Promise.all(profiles.map(p=>new WorldGenerator().generate({...args,seed:42,worldTag:p.tag})));
const modern=worlds.find(g=>g.world.definition.setting!.tag==='worlds:setting.modern')!;

test('all 17 themes keep real services, profile-specific built-in roles/names and valid saved worlds',()=>{
 for(const [i,g]of worlds.entries()){
  const profile=profiles[i]!;validateState(g.state,g.registry);
  if(profile.tag!=='worlds:setting.fantasy')for(const n of g.state.district!.residents){
   assert(profile.residentNames.includes(n.personalName!.givenName),profile.id+' '+n.name);
   assert.equal(n.personalName!.cultureId,profile.nameCulture!.id);
   assert.doesNotMatch(n.profession,/神殿护理员|附魔工匠|委托文书/);
  }
  const template=g.registry.residentTemplates.find(t=>t.id==='worldgen:resident.0')!;
  assert(template.services,'existing provider capabilities must survive a display-role fix');
 }
});

test('all twelve remaining themes assemble A1 from genuine default facilities and conditional saved light',()=>{
 const firstFive=new Set(['modern','cyberpunk','fantasy','xianxia','post-apocalypse']);
 for(const g of worlds.filter(g=>!firstFive.has(g.world.definition.setting!.id.slice(6)))){
  const engine=new ActionExecutor(g.registry,g.state);
  assert(engine.performAction({actionId:'worldgen:action.a-environment.0'},engine.snapshot().meta.revision,'light-assembly').ok);
  const state=structuredClone(engine.snapshot()),place=g.registry.location(state.world.locationId);
  assert(place.proseScenery?.some(o=>o.kind==='prop'));
  const senses=place.proseScenery!.filter(o=>o.kind==='sense');
  assert(senses.every(o=>o.conditions.some(c=>c.op==='environment.light')),'no service-name-based invented sensory facts');
  for(const node of g.registry.narrativeNodes.filter(n=>n.proseAssembly?.mode==='environment'))assert.equal(captureAProse(state,g.registry,node).mode,'assembled',g.world.definition.setting!.id+' '+node.id);
  (state.environment??={})[state.world.locationId]={light:'dark'};
  const node=g.registry.narrativeNodes.find(n=>n.proseAssembly?.mode==='environment')!;
  const snapshot=captureAProse(state,g.registry,node);
  assert.equal(snapshot.mode,'assembled');
  assert.equal(snapshot.lexemes.find(e=>e.allowedSlots.includes('senseMod'))!.text,'昏暗的光线');
 }
});

test('explicitly empty facilities and missing light profiles never acquire fictitious props or sensory facts',()=>{
 const g=worlds.find(g=>g.world.definition.setting!.id==='world.steampunk')!;
 const pack=structuredClone(g.world.definition.packs.find(p=>p.manifest.id==='generated/neighborhood')!);
 const world=structuredClone(g.world.definition);
 world.locations=world.locations.slice(0,1);pack.locations=pack.locations.slice(0,1);
 pack.locations[0]!.facilities=[];pack.locationProfiles=[];
 pack.narrativeNodes=[];pack.narrativeProfiles=[];pack.tags=[];pack.actions=[];pack.contributions=[];pack.texts={};
 compileATemplates(pack,world,source,42);
 assert.deepEqual(pack.locations[0]!.proseScenery,[]);
});

test('v2 scenery conditions reject unknown operations, invalid light values and dangling location references',async()=>{
 const g=worlds.find(g=>g.world.definition.setting!.id==='world.steampunk')!;
 for(const condition of [{op:'environment.light',value:'unrecorded'},{op:'invented.condition',value:'lit'},{op:'environment.light',value:'lit',locationId:'missing:location.orphan'}]){
  const packs=JSON.parse(JSON.stringify(g.registry.contentPacks));
  const location=packs.find((p:{manifest:{id:string}})=>p.manifest.id==='generated/neighborhood').locations[0];
  location.proseScenery.find((o:{kind:string})=>o.kind==='sense').conditions=[condition];
  await assert.rejects(loadPacks(packs));
 }
});

test('observed schedules never invent a performed task, posture, records or props',()=>{
 const g=modern,state=structuredClone(g.state);
 const n=state.district!.residents.find(n=>g.world.agents.some(a=>a.residentId===n.id&&a.schedule.some(s=>s.locationId===n.locationId&&s.start<=540&&s.end>540)))!;
 assert(n);state.world.locationId=n.locationId;state.district!.currentResidentId=n.id;
 const engine=new ActionExecutor(g.registry,state),i=g.world.definition.locations.findIndex(l=>l.id===n.locationId);
 const result=engine.performAction({actionId:`worldgen:action.a-person.${i}`},state.meta.revision,'observe-schedule');assert(result.ok,result.message);
 const snapshot=engine.snapshot().adventure!.story!.prose!;
 assert.equal(snapshot.context.bindings.actor.subject,'resident/'+n.id);
 assert.match(snapshot.lexemes.find(e=>e.poolIds.includes('action.observed'))!.text!,/^在(?:居家|工作|闲暇)时段留在这里$/);
});

test('theme adaptation removes unscoped foreign architecture but retains explicitly scoped imported details',async()=>{
 const profile=profiles.find(p=>p.id==='world.cyberpunk')!;
 const reference=await json('content/generation/lexicon-reference.json');
 const plain=structuredClone(reference.templates.find((t:ReferenceTemplate)=>t.kind==='place')) as ReferenceTemplate;
 assert(plain.kind==='place');plain.data.description='来源概述\n\n不适用于此题材的天井';plain.data.ambience={morning:'天井旧声',day:'天井旧声',evening:'天井旧声',night:'天井旧声'};
 const scoped=structuredClone(plain);scoped.requiresTags.push(profile.tag);
 applyWorldProfile([plain],profile);applyWorldProfile([scoped],profile);
 assert(plain.kind==='place'&&scoped.kind==='place');assert.doesNotMatch(plain.data.description,/天井/);assert.doesNotMatch(JSON.stringify(plain.data.ambience),/天井/);
 assert.match(scoped.data.description,/天井/);assert.match(JSON.stringify(scoped.data.ambience),/天井/);
});

test('dedicated combination encounters cannot be hijacked by unrelated home, street or canal chains',()=>{
 for(const g of worlds){
  const engine=new ActionExecutor(g.registry,g.state);
  const result=engine.performAction({actionId:'progression:action.nsfwcombo.encounter'},engine.snapshot().meta.revision,'profile-isolation');assert(result.ok,result.message);
  const story=engine.snapshot().adventure!.story!;
  assert.equal(story.profileId,'progression:profile.nsfwcombo.matrix');
  assert.match(story.nodeId,/nsfwcombo/);
 }
});

test('quest text is clean and a real pre-install save preserves its exact historic prose and world',async()=>{
 const questPacks=modern.registry.contentPacks.filter(p=>['main','side'].includes(p.manifest.namespace));
 assert(questPacks.length);
 for(const pack of questPacks)for(const text of Object.values(pack.texts))assert.doesNotMatch(text,/【(?:工作|调查|身份)】/);
 const old=gunzipSync(await readFile(new URL('fixtures/pre-gemini-p0-world.json.gz',import.meta.url))).toString('utf8');
 const restored=await new SaveCodec(modern.registry,source).decode(old);assert(restored.status==='ready',restored.status==='ready'?'':restored.reason);
 const snapshot=restored.state.adventure!.story!.prose!;assert(snapshot);
 assert(snapshot.lexemes.find(e=>e.allowedSlots.includes('bodyPart'))!.text!.includes('旅人的'));
 const roundTrip=await new SaveCodec(restored.registry!).decode(await new SaveCodec(restored.registry!).encode(restored.state));assert(roundTrip.status==='ready');
 assert.deepEqual(roundTrip.state,restored.state);
});
