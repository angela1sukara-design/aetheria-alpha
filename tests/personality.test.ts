import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {gunzipSync} from 'node:zlib';
import {loadPacks} from '../src/content/loader.ts';
import {WorldGenerator} from '../src/world/generator.ts';
import {ActionExecutor} from '../src/engine/executor.ts';
import {SaveCodec} from '../src/persistence/codec.ts';
import {TRAIT_TAGS} from '../src/core/personality-types.ts';
import {narrativeTags,explainNarrativeNode,narrativeText} from '../src/engine/narrative.ts';
import {evaluate} from '../src/engine/conditions.ts';
import {advanceWorldSimulation} from '../src/world/simulation.ts';
import {residentMemoryText} from '../src/engine/resident-quests.ts';
import type {GameState,Id} from '../src/core/types.ts';

const json=async(p:string)=>JSON.parse(await readFile(new URL('../'+p,import.meta.url),'utf8'));
const index=await json('content/index.json'),fixed=await Promise.all(index.packs.map((p:string)=>json('content/'+p)));
const shared=await json('content/personality/pack.json'),extras=await Promise.all(['neighborhood-content','lexicon-content','world-profile-content','fantasy-content','personality-dialogue-content'].map(n=>json('content/generation/'+n+'.json')));
const registry=await loadPacks([...fixed,shared,...extras]),rules=await json('content/generation/rules.json'),references=await Promise.all(['lexicon','fantasy'].map(n=>json('content/generation/'+n+'-reference.json'))),worldProfiles=await json('content/generation/world-profiles.json');
const input={registry,rules:{...rules,startMinutes:600},references,worldProfiles,worldTag:'worlds:setting.fantasy',parameters:{npcCount:20}};
const worlds=await Promise.all([7,42,19].map(seed=>new WorldGenerator().generate({...input,seed})));
const world=worlds[0]!;
const resident=world.state.district!.residents.find(n=>n.traitTags?.length)!;
let serial=0;
function fixture(change:(s:GameState)=>void=()=>{},w=world,actor=resident){const s=structuredClone(w.state);s.world.locationId=actor.locationId;s.world.knownLocationIds=[...new Set([...s.world.knownLocationIds,actor.locationId])];s.district!.currentResidentId=actor.id;s.district!.profile={name:'旅人',created:true,adultOptional:false};change(s);return new ActionExecutor(w.registry,s);}
function act(e:ActionExecutor,id:Id){const x=e.performAction({actionId:id},e.snapshot().meta.revision,'personality-'+ ++serial);assert.equal(x.ok,true,x.message);return x;}
function start(e:ActionExecutor){const a=e.view().actions.filter(a=>a.definition.effects.some(f=>f.op==='narrative.start'&&f.kind==='conversation'));assert.equal(a.length,1);act(e,a[0]!.definition.id);assert.ok(e.snapshot().adventure?.story);return a[0]!.definition.id;}
const choose=(e:ActionExecutor,index:number)=>act(e,`progression:action.story.${index}`);
const actorOf=(e:ActionExecutor)=>e.snapshot().district!.residents.find(n=>n.id===resident.id)!;

test('six traits are shared, strictly registered and independent of district/adventure; invalid traits and undeclared dependencies fail',async()=>{
  assert.equal(shared.tags.length,6);assert.deepEqual(shared.manifest.dependencies,[]);
  for(const trait of TRAIT_TAGS)assert.equal(registry.tag(trait).status,'active');
  for(const bad of ['foundation:body.has-tail','foundation:service.home','missing:trait.ghost']){
    const altered=structuredClone(extras);altered[3].residentTemplates[0].traitTags=[bad];await assert.rejects(()=>loadPacks([...fixed,shared,...altered]));
  }
  const altered=structuredClone(extras);altered[3].manifest.dependencies=altered[3].manifest.dependencies.filter((d:{id:string})=>d.id!=='aetheria/personality');await assert.rejects(()=>loadPacks([...fixed,shared,...altered]));
  const inactive=structuredClone(shared);inactive.tags[0].status='deprecated';await assert.rejects(()=>loadPacks([...fixed,inactive,...extras]));
});
test('all six traits and mixed personalities occur in normal generation; same seed reproduces, other seeds vary',async()=>{
  const seen=new Set(worlds.flatMap(w=>w.state.district!.residents.flatMap(n=>n.traitTags??[])));assert.deepEqual([...seen].sort(),[...TRAIT_TAGS].sort());
  assert.ok(worlds.some(w=>w.state.district!.residents.some(n=>n.traitTags?.length===2)));
  assert.deepEqual((await new WorldGenerator().generate({...input,seed:7})).state,world.state);
  assert.notDeepEqual(worlds[1]!.state.district!.residents.map(n=>[n.name,n.traitTags]),world.state.district!.residents.map(n=>[n.name,n.traitTags]));
  for(const w of worlds)for(const n of w.state.district!.residents){const t=w.registry.residentTemplates.find(t=>t.id===n.templateId)!;assert.deepEqual(n.traitTags,t.traitTags);assert.ok(n.traitTags?.length);}
});
test('normal NPC entry starts bound personality conversation once and preserves daily memories, services and pure queries',()=>{
  const e=fixture(),before=e.snapshot(),entry=start(e),s=e.snapshot(),n=actorOf(e);
  assert.deepEqual(s.adventure!.story!.actor,{kind:'resident',id:resident.id});assert.equal(n.trust,resident.trust+1);assert.equal(n.visits,resident.visits+1);assert.ok(n.memories.includes('talk:0'));assert.equal(s.clock.totalMinutes,before.clock.totalMinutes+5);
  const frozen=e.snapshot();for(let i=0;i<6;i++){e.view();const trace=explainNarrativeNode(e.snapshot(),world.registry)!;assert.ok(trace.tendencyHits.some(t=>n.traitTags!.includes(t.tagId)&&t.added===3));assert.equal(trace.finalWeight,trace.baseWeight+trace.tendencyHits.reduce((v,t)=>v+t.added,0));}assert.deepEqual(e.snapshot(),frozen);
  choose(e,3);const opts=e.view().actions;assert.equal(opts.filter(a=>a.definition.id===entry).length,1);assert.ok(opts.some(a=>a.definition.effects.some(f=>f.op==='progression.act'&&f.move==='buy'))===!!world.registry.residentTemplates.find(t=>t.id===resident.templateId)!.services?.trade?.length);
});
test('each of the six personalities has real positive, neutral and offended paths with no global score farming',()=>{
  for(const tag of TRAIT_TAGS){const found=worlds.flatMap(w=>w.state.district!.residents.map(n=>({w,n}))).find(({n})=>n.traitTags?.length===1&&n.traitTags[0]===tag)!;assert.ok(found,tag);
    for(const branch of [0,1,2]){const e=fixture(()=>{},found.w,found.n);start(e);const before=e.snapshot(),n=before.district!.residents.find(n=>n.id===found.n.id)!;choose(e,branch);
      if(branch===0){assert.match(e.snapshot().adventure!.story!.stage,/deepen/);choose(e,0);}else assert.equal(e.snapshot().adventure!.story,null);
      if(branch===2){const after=e.snapshot().district!.residents.find(n=>n.id===found.n.id)!;assert.equal(after.trust,Math.max(0,n.trust-1));assert.ok(after.memories.includes('conversation:declined:0'));assert.ok(!e.view().actions.some(a=>a.definition.effects.some(f=>f.op==='narrative.start'&&f.kind==='conversation')));}
      for(const field of ['reputation','influence','safety'] as const)assert.equal(e.snapshot().adventure![field],before.adventure![field]);
    }
  }
});
test('repeated dialogue cannot repeat daily trust or visit rewards and receipts survive saving',async()=>{
  const e=fixture();for(let i=0;i<3;i++){start(e);choose(e,0);choose(e,0);}const n=actorOf(e);assert.equal(n.trust,resident.trust+1);assert.equal(n.visits,resident.visits+1);assert.equal(n.memories.filter(m=>m==='talk:0').length,1);
  const codec=new SaveCodec(world.registry),loaded=await codec.decode(await codec.encode(e.snapshot()));assert.equal(loaded.status,'ready');if(loaded.status==='ready'){const again=new ActionExecutor(loaded.registry??world.registry,loaded.state);start(again);choose(again,1);assert.equal(actorOf(again).trust,n.trust);}
});
test('gift checks and deducts a real item atomically, once per person/day, and survives restoration',async()=>{
  const e=fixture(s=>{s.adventure!.items={'fantasy:item.ration':2};});start(e);choose(e,0);const before=e.snapshot();choose(e,1);
  assert.equal(e.snapshot().adventure!.items!['fantasy:item.ration'],1);assert.equal(actorOf(e).trust,before.district!.residents.find(n=>n.id===resident.id)!.trust+1);assert.ok(actorOf(e).memories.includes('conversation:gift:0'));
  assert.match(residentMemoryText('conversation:gift:0',world.registry),/接受/);assert.match(residentMemoryText('conversation:welcomed:0',world.registry),/交谈/);
  start(e);choose(e,0);const offer=e.view().actions.find(a=>a.definition.id==='progression:action.story.1')!;assert.equal(offer.available,false);const s=e.snapshot();assert.equal(e.performAction({actionId:offer.definition.id},s.meta.revision,'forged-gift').ok,false);assert.deepEqual(e.snapshot(),s);
  const codec=new SaveCodec(world.registry),loaded=await codec.decode(await codec.encode(s));assert.equal(loaded.status,'ready');if(loaded.status==='ready')assert.deepEqual(loaded.state,s);
  const poor=fixture();start(poor);choose(poor,0);assert.equal(poor.view().actions.find(a=>a.definition.id==='progression:action.story.1')!.available,false);
});
test('optional closeness separately requires preference, real adult eligibility, presence and existing trust',()=>{
  const e=fixture(s=>{s.district!.residents.find(n=>n.id===resident.id)!.trust=2;});start(e);choose(e,0);assert.equal(e.view().actions.find(a=>a.definition.id==='progression:action.story.2')!.available,false);
  act(e,'district:action.preference.on');assert.equal(e.view().actions.find(a=>a.definition.id==='progression:action.story.2')!.available,true);
  const altered=structuredClone(e.snapshot());altered.district!.residents.find(n=>n.id===resident.id)!.ageYears=17;assert.equal(evaluate({op:'conversation.adultEligible'},altered,world.registry).pass,false);
  choose(e,2);assert.equal(e.snapshot().adventure!.story,null);
});
test('time-based departure permits only a free exit; departure during a choice closes the conversation safely',async()=>{
  const e=fixture(s=>{s.clock.totalMinutes=rules.workEnd-2;advanceWorldSimulation(s);});start(e);assert.ok(!evaluate({op:'conversation.present'},e.snapshot(),world.registry).pass);
  const choices=e.view().actions.filter(a=>a.definition.effects.some(f=>f.op==='narrative.choose'));assert.equal(choices.length,1);assert.equal(choices[0]!.definition.id,'progression:action.story.3');assert.ok(choices[0]!.available);
  const before=e.snapshot();assert.equal(e.performAction({actionId:'progression:action.story.0'},before.meta.revision,'departed-forge').ok,false);assert.deepEqual(e.snapshot(),before);choose(e,3);
  const during=fixture(s=>{s.clock.totalMinutes=rules.workEnd-8;advanceWorldSimulation(s);});start(during);choose(during,0);assert.equal(during.snapshot().adventure!.story,null);const codec=new SaveCodec(world.registry);assert.equal((await codec.decode(await codec.encode(during.snapshot()))).status,'ready');
});
test('bound actor remains authoritative if selection changes; other story kinds never inherit the selected resident traits',()=>{
  const e=fixture();start(e);const s=structuredClone(e.snapshot()),other=s.district!.residents.find(n=>n.id!==resident.id)!;other.locationId=s.world.locationId;s.district!.currentResidentId=other.id;
  const beforeOther=other.trust,bound=s.district!.residents.find(n=>n.id===resident.id)!.trust,changed=new ActionExecutor(world.registry,s);choose(changed,0);choose(changed,0);assert.equal(changed.snapshot().district!.residents.find(n=>n.id===other.id)!.trust,beforeOther);assert.equal(actorOf(changed).trust,bound);
  const nonConversation=structuredClone(e.snapshot());nonConversation.adventure!.story!.kind='defeat';nonConversation.adventure!.story!.tags=[];assert.ok(!narrativeTags(nonConversation,world.registry).some(t=>TRAIT_TAGS.includes(t.tagId)));
});
test('low resources preserve free exit, body-agnostic prose resolves, and bad instance traits are rejected',async()=>{
  const e=fixture(s=>{s.player.variables['core:money']=0;s.player.variables['core:stamina']=0;s.player.variables['core:energy']=0;});start(e);assert.ok(!/[{}]|占位|手套|靴尖|墙面/.test(narrativeText(e.snapshot(),world.registry)!));choose(e,3);
  const codec=new SaveCodec(world.registry),bad=structuredClone(e.snapshot());bad.district!.residents.find(n=>n.id===resident.id)!.traitTags=['foundation:body.has-tail'];await assert.rejects(()=>codec.encode(bad));
  const swapped=structuredClone(e.snapshot());swapped.district!.residents.find(n=>n.id===resident.id)!.traitTags=[TRAIT_TAGS.find(t=>!resident.traitTags!.includes(t))!];await assert.rejects(()=>codec.encode(swapped));
});
test('current 0.9 snapshot keeps its content and short conversation under the new engine',async()=>{
  const raw=gunzipSync(await readFile(new URL('./fixtures/module-d-world-0.9.json.gz',import.meta.url))).toString('utf8');
  const loaded=await new SaveCodec(registry).decode(raw);assert.equal(loaded.status,'ready');if(loaded.status!=='ready')return;
  assert.equal(loaded.state.worldInstance!.generation.generatorVersion,'0.9.0');assert.ok(!loaded.registry!.hasTag(TRAIT_TAGS[0]!));const e=new ActionExecutor(loaded.registry!,loaded.state);assert.ok(e.view().actions.some(a=>a.definition.effects.some(f=>f.op==='resident.talk')));assert.ok(!e.view().actions.some(a=>a.definition.effects.some(f=>f.op==='narrative.start'&&f.kind==='conversation')));
  assert.equal((await new SaveCodec(loaded.registry!).decode(await new SaveCodec(loaded.registry!).encode(e.snapshot()))).status,'ready');
});
test('unknown source personalities remain empty and use ordinary dialogue without hash inference',async()=>{
  const changed=structuredClone(extras);for(const t of changed[3].residentTemplates){delete t.traitVariants;t.traitTags=[];t.personality=['尚未适配的自定义个性'];}
  const source=await loadPacks([...fixed,shared,...changed]),w=await new WorldGenerator().generate({...input,registry:source,seed:7});
  assert.ok(w.state.district!.residents.every(n=>n.traitTags?.length===0));
  const n=w.state.district!.residents[0]!,e=fixture(()=>{},w,n);assert.ok(e.view().actions.some(a=>a.definition.effects.some(f=>f.op==='resident.talk')));assert.ok(!e.view().actions.some(a=>a.definition.effects.some(f=>f.op==='narrative.start'&&f.kind==='conversation')));
});
