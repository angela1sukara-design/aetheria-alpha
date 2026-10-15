import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {loadPacks} from '../src/content/loader.ts';
import {ActionExecutor} from '../src/engine/executor.ts';
import {createGameState} from '../src/engine/state.ts';
import {WorldGenerator} from '../src/world/generator.ts';
import {SaveCodec,validateState} from '../src/persistence/codec.ts';
import {proseProblem} from '../src/content/player-prose.ts';
import {gunzipSync} from 'node:zlib';
import type {GameState,Id} from '../src/core/types.ts';

const json=async(p:string)=>JSON.parse(await readFile(new URL('../'+p,import.meta.url),'utf8'));
const index=await json('content/index.json');
const inputs=await Promise.all(index.packs.map((p:string)=>json('content/'+p)));
const fixed=await loadPacks(inputs);
const registry=await loadPacks([...inputs,await json('content/personality/pack.json'),...await Promise.all(['neighborhood-content','lexicon-content','world-profile-content','fantasy-content'].map(n=>json('content/generation/'+n+'.json')))]);
const rules=await json('content/generation/rules.json'),reference=await json('content/generation/lexicon-reference.json'),fantasyRef=await json('content/generation/fantasy-reference.json'),catalog=await json('content/generation/world-profiles.json');
const generate=(seed:number,tag='worlds:setting.fantasy')=>new WorldGenerator().generate({seed,registry,rules,references:[reference,fantasyRef],worldProfiles:catalog,worldTag:tag});
let serial=0;
const act=(e:ActionExecutor,id:Id)=>{const x=e.performAction({actionId:id},e.snapshot().meta.revision,'ux-'+ ++serial);assert.equal(x.ok,true,`${id}: ${x.message}`);assert.equal(proseProblem(x.text),undefined);return x;};
function at(state:GameState,id:Id){const s=structuredClone(state);s.world.locationId=id;s.world.knownLocationIds=[...new Set([...s.world.knownLocationIds,id])];return s;}

test('every generated location uses sampled local scenes across 17 themes and 12 fantasy seeds',async()=>{
 const samples:{seed:number;theme:string;location:string;kind:string;node:string;text:string}[]=[];
 const signatures=new Set<string>();let choices=0;
 const cases=[...catalog.profiles.map((p:{tag:string},i:number)=>({seed:100+i,tag:p.tag})),...Array.from({length:12},(_,seed)=>({seed,tag:'worlds:setting.fantasy'}))];
 for(const {seed,tag} of cases){
  const g=await generate(seed,tag);validateState(g.state,g.registry);
  for(const place of g.world.definition.locations)for(const kind of ['encounter','exploration','daily'] as const){
   const e=new ActionExecutor(g.registry,at(g.state,place.id));act(e,`progression:action.narrative.${kind}`);
   const v=e.view();assert.ok(v.state.adventure!.story!.nodeId.startsWith('worldgen:node.scene.'),v.sceneText);
   assert.equal(proseProblem(v.sceneText),undefined);assert.ok(v.sceneText.includes(v.location.name));
   const before=e.snapshot();for(let n=0;n<3;n++)e.view();assert.deepEqual(e.snapshot(),before);
   signatures.add(v.sceneText);samples.push({seed,theme:tag,location:v.location.name,kind,node:v.state.adventure!.story!.nodeId,text:v.sceneText});
   for(const option of v.actions.filter(o=>o.available&&!o.definition.effects.some(e=>e.op==='preference.set'))){
    const branch=new ActionExecutor(g.registry,before);act(branch,option.definition.id);validateState(branch.snapshot(),g.registry);assert.equal(branch.snapshot().adventure!.story,null);choices++;
   }
  }
  const place=g.world.definition.locations[0],e=new ActionExecutor(g.registry,g.state);act(e,'progression:action.narrative.encounter');
  const codec=new SaveCodec(g.registry),saved=await codec.encode(e.snapshot()),loaded=await codec.decode(saved);
  assert.equal(loaded.status,'ready',loaded.status==='quarantined'?loaded.reason:'');
  if(loaded.status==='ready'){assert.deepEqual(loaded.state,e.snapshot());assert.equal(new ActionExecutor(loaded.registry!,loaded.state).view().sceneText,e.view().sceneText);}
 }
 assert.ok(signatures.size>=cases.length*3,`${signatures.size} distinct scenes`);
 await mkdir('artifacts/procedural-ux',{recursive:true});await writeFile('artifacts/procedural-ux/report.json',JSON.stringify({worlds:cases.length,scenes:samples.length,distinctScenes:signatures.size,choices,samples},null,2));
 console.log(`Generated UX: ${cases.length} worlds, ${samples.length} scenes, ${signatures.size} distinct texts, ${choices} executable branches.`);
});

test('same seed reproduces prose and changed seed changes content, not just a seed label',async()=>{
 const a=await generate(19),b=await generate(19),c=await generate(20);assert.deepEqual(a.state,b.state);
 const render=(g:typeof a)=>{const e=new ActionExecutor(g.registry,g.state);act(e,'progression:action.narrative.encounter');return e.view().sceneText;};
 assert.equal(render(a),render(b));assert.notEqual(render(a),render(c));
});

test('preferences work in every fixed location, active narrative and combat without moving or spending time',()=>{
 for(const location of fixed.locations){
  const e=new ActionExecutor(fixed,at(createGameState(fixed,42),location.id));const start=e.snapshot();
  act(e,'district:action.preference.on');assert.equal(e.snapshot().district!.profile.adultOptional,true);
  act(e,'district:action.preference.off');assert.equal(e.snapshot().world.locationId,start.world.locationId);assert.deepEqual(e.snapshot().clock,start.clock);
 }
 for(const id of ['progression:action.narrative.exploration','progression:action.challenge.gel'] as Id[]){
  const e=new ActionExecutor(fixed,at(createGameState(fixed,7),'aetheria:location.market'));act(e,id);const before=e.snapshot();
  act(e,'district:action.preference.on');assert.deepEqual(e.snapshot().adventure?.story,before.adventure?.story);assert.deepEqual(e.snapshot().district?.combat,before.district?.combat);assert.deepEqual(e.snapshot().clock,before.clock);
 }
});

test('event completion feedback is unique and narrative costs match actual time',()=>{
 const p=fixed.contentPacks.find(p=>p.manifest.id==='aetheria/district')!;
 const event=p.events.find(e=>e.nodes.some(n=>n.actionIds.some(id=>fixed.action(id).label==='登记借用再归还')))!;
 const s=createGameState(fixed,42);s.eventInstances=[{instanceId:'event-fixture',definitionId:event.id,nodeId:event.startNode,status:'active',textByNode:{[event.startNode]:event.nodes[0]!.textVariants[0]!},draws:[{nodeId:event.startNode,value:0}],locals:{}}];s.activeEventStack=['event-fixture'];s.rng.streams['event:event-fixture']={state:1,draws:1};
 const e=new ActionExecutor(fixed,s),id=event.nodes[0]!.actionIds.find(id=>fixed.action(id).label==='登记借用再归还')!;
 const result=act(e,id);const paragraphs=result.text.split('\n\n');assert.equal(new Set(paragraphs).size,paragraphs.length);
 const body=new ActionExecutor(fixed,createGameState(fixed,42));act(body,'progression:action.narrative.transformation');const before=body.snapshot().clock.totalMinutes;act(body,'progression:action.story.0');assert.equal(body.snapshot().clock.totalMinutes-before,10);
});

test('all reachable narrative and choice text is finished, including optional variants',()=>{
 for(const n of fixed.narrativeNodes)for(const k of [n.textKey,...n.choices.map(c=>c.resultText)])assert.equal(proseProblem(fixed.text(k),true),undefined,k);
 assert.ok(!fixed.globalActions().some(a=>/narrative\.(quest|ending)$/.test(a.id)));
 assert.ok(!fixed.narrativeNodes.some(n=>n.choices.some(c=>/继续核对细节/.test(c.label))));
});

test('ordinary exploration in fixed and generated danger areas offers fight/avoid and round-trips mid-battle',async()=>{
 const g=await generate(7),commons=g.world.definition.locations.find(l=>l.service==='commons')!;
 const cases=[{registry:fixed,state:at(createGameState(fixed,7),'district:location.canal'),look:'district:action.observe.location.canal' as Id},
  {registry:g.registry,state:at(g.state,commons.id),look:`worldgen:action.look.${g.world.definition.locations.indexOf(commons)}` as Id}];
 for(const c of cases){
  const e=new ActionExecutor(c.registry,c.state);act(e,c.look);assert.ok(e.snapshot().activeEventStack.length);
  const fight=e.view().actions.find(o=>o.available&&o.definition.effects.some(e=>e.op==='combat.encounter'))!;
  const avoid=e.view().actions.find(o=>o.available&&o.definition.effects.some(e=>e.op==='event.advance'))!;
  assert.ok(fight&&avoid);const warning=e.snapshot(),branch=new ActionExecutor(c.registry,warning);act(branch,avoid.definition.id);assert.equal(branch.snapshot().district!.combat,null);assert.equal(branch.snapshot().activeEventStack.length,0);
  act(e,fight.definition.id);assert.ok(e.snapshot().district!.combat);validateState(e.snapshot(),c.registry);
  const codec=new SaveCodec(c.registry),loaded=await codec.decode(await codec.encode(e.snapshot()));assert.equal(loaded.status,'ready',loaded.status==='quarantined'?loaded.reason:'');
  if(loaded.status==='ready')assert.deepEqual(loaded.state,e.snapshot());
 }
 for(const place of g.world.definition.locations.filter(l=>l.service==='home'||l.service==='clinic'))assert.ok(!g.registry.storylets.some(s=>s.locationId===place.id&&s.id.includes('.danger.')));
});

test('unsupported fields or unfinished generated reference content fail generation instead of reaching players',async()=>{
 const ref=structuredClone(reference);for(const t of ref.templates.filter((t:{kind:string})=>t.kind==='event'))t.data.prompt='【可填正文槽】{unknown}';
 await assert.rejects(()=>new WorldGenerator().generate({seed:7,registry,rules,references:[ref]}),/生成场景失败|正文未完成|未填入/);
});

test('released fixed/generated saves upgrade without changing map, NPCs, body, clock or RNG',async()=>{
 const oldText=gunzipSync(await readFile(new URL('fixtures/ux-predecessor-world.json.gz',import.meta.url))).toString('utf8');
 const original=JSON.parse(oldText).payload.state as GameState;
 const decoded=await new SaveCodec(registry).decode(oldText);assert.equal(decoded.status,'ready',decoded.status==='quarantined'?decoded.reason:'');
 if(decoded.status==='ready'){
  assert.deepEqual(decoded.state.world,original.world);assert.deepEqual(decoded.state.district,original.district);assert.deepEqual(decoded.state.player.body,original.player.body);assert.deepEqual(decoded.state.rng,original.rng);assert.deepEqual(decoded.state.clock,original.clock);
  const e=new ActionExecutor(decoded.registry!,decoded.state);act(e,'progression:action.narrative.encounter');assert.ok(e.snapshot().adventure!.story!.nodeId.startsWith('worldgen:node.scene.'));
 }
 const oldPack=original.worldInstance!.definition.packs.find(p=>p.manifest.id==='aetheria/adventure')!;
 const oldFixed=await loadPacks(inputs.map(p=>p.manifest.id===oldPack.manifest.id?oldPack:p));
 const state=createGameState(oldFixed,7),oldCodec=new SaveCodec(oldFixed),loaded=await new SaveCodec(fixed).decode(await oldCodec.encode(state));
 assert.equal(loaded.status,'ready',loaded.status==='quarantined'?loaded.reason:'');if(loaded.status==='ready'){assert.deepEqual(loaded.state.world,state.world);assert.deepEqual(loaded.state.district,state.district);}
});

test('surrender and giving up work with zero AP/stamina, pay no victory rewards, and preserve the current opponent',async()=>{
 for(const move of ['surrender','giveup'] as const){
  const s=at(createGameState(fixed,42),'aetheria:location.market');s.player.variables['core:stamina']=0;s.player.variables['core:actionPoints']=0;
  const e=new ActionExecutor(fixed,s);act(e,'progression:action.challenge.gel');const before=e.snapshot();
  assert.ok(e.view().actions.find(o=>o.definition.id===`progression:action.combat.${move}`)?.available);
  act(e,`progression:action.combat.${move}`);const after=e.snapshot();assert.equal(after.district!.combat,null);assert.equal(after.adventure!.lastCombat!.result,'defeat');
  assert.equal(after.adventure!.lastCombat!.enemyId,before.district!.combat!.enemyId);assert.equal(after.adventure!.story!.opponentName,before.district!.combat!.enemyName??fixed.enemies.find(x=>x.id===before.district!.combat!.enemyId)!.name);
  assert.equal(after.adventure!.story!.stage,move==='giveup'?'yielded':'start');
  for(const id of ['core:money','core:health','core:stamina','core:skillResource'] as Id[])assert.equal(after.player.variables[id],before.player.variables[id]);
  assert.deepEqual(after.clock,before.clock);validateState(after,fixed);
  const codec=new SaveCodec(fixed),loaded=await codec.decode(await codec.encode(after));assert.equal(loaded.status,'ready',loaded.status==='quarantined'?loaded.reason:'');
  const exit=e.view().actions.filter(o=>o.definition.effects.some(e=>e.op==='narrative.choose')).at(-1)!;act(e,exit.definition.id);assert.equal(e.snapshot().adventure!.story,null);
 }
});
