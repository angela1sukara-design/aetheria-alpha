import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import {loadPacks} from '../src/content/loader.ts';
import {WorldGenerator} from '../src/world/generator.ts';
import {ActionExecutor} from '../src/engine/executor.ts';
import {SaveCodec,validateState} from '../src/persistence/codec.ts';
import {narrativeText} from '../src/engine/narrative.ts';
import {captureAProse,replayAProse} from '../src/engine/a-prose.ts';
import {advanceClock} from '../src/engine/clock.ts';
import {effectivePart} from '../src/engine/query.ts';
import {A_TEMPLATE_CATALOG} from '../src/world/a-template-data.ts';
import {assembleProse as reference} from '../production/tag-matrices/assembly.mjs';
import {assembleProse as runtime} from '../src/engine/prose-assembly.generated.ts';
import type {Id} from '../src/core/types.ts';
import type {ProseMode} from '../src/core/prose-types.ts';
const read=async(p:string)=>JSON.parse(await readFile(new URL('../'+p,import.meta.url),'utf8'));
const index=await read('content/index.json');
const source=await loadPacks([...await Promise.all(index.packs.map((p:string)=>read('content/'+p))),await read('content/personality/pack.json'),...await Promise.all(['neighborhood-content','lexicon-content','world-profile-content','fantasy-content','personality-dialogue-content'].map(p=>read('content/generation/'+p+'.json')))]);
const args={registry:source,rules:await read('content/generation/rules.json'),references:[await read('content/generation/lexicon-reference.json'),await read('content/generation/fantasy-reference.json')],worldProfiles:await read('content/generation/world-profiles.json')};
const g=await new WorldGenerator().generate({...args,seed:42,worldTag:'worlds:setting.fantasy'});
function enter(mode:ProseMode,empty=false){
 const state=structuredClone(g.state);
 const n=state.district!.residents.find(n=>state.worldInstance!.agents.some(a=>a.residentId===n.id&&a.schedule.some(t=>t.locationId===n.locationId&&t.start<=540&&t.end>540)))!;
 assert(n);state.world.locationId=n.locationId;state.district!.currentResidentId=n.id;
 if(empty)for(const person of state.district!.residents)if(person.locationId===state.world.locationId)person.locationId=g.world.definition.locations.find(p=>p.id!==state.world.locationId)!.id;
 const engine=new ActionExecutor(g.registry,state),i=g.world.definition.locations.findIndex(p=>p.id===state.world.locationId);
 const result=engine.performAction({actionId:`worldgen:action.a-${mode}.${i}`},engine.snapshot().meta.revision,'a-enter-'+mode+(empty?'-empty':''));assert(result.ok,result.message);
 return engine;
}
test('all 54 reviewed rules are fingerprinted, installed, and the canonical runtime matches reference assembly',async()=>{
 const source=await read('content/prose/a-templates-v2.json'),plan=await read('production/text-slot-integration/a-templates-v1.json');
 assert.equal(plan.sourceHash,createHash('sha256').update(JSON.stringify(source)).digest('hex'));
 assert.equal(A_TEMPLATE_CATALOG.rules.length,54);
 assert.deepEqual(new Set(g.registry.narrativeNodes.flatMap(n=>n.proseAssembly?[n.proseAssembly.rule.id]:[])),new Set(A_TEMPLATE_CATALOG.rules.map(r=>r.id)));
 const fixture=await read('production/tag-matrices/assembly-example.json'),base=await read('production/tag-matrices/assembly-rules.json');base.rules.push(fixture.rule);
 const input={catalog:base,assemblyRuleId:fixture.rule.id,lexemes:fixture.lexemes,context:fixture.context};
 assert.deepEqual(runtime(input),reference(input));
 input.lexemes=[];assert.deepEqual(runtime(input),reference(input));
});
test('every one of the 54 templates assembles against real generated locations, residents and body graphs',()=>{
 const counts={environment:0,person:0,body:0};
 for(const mode of ['environment','person','body'] as const){
  const state=structuredClone(enter(mode).snapshot());
  for(const node of g.registry.narrativeNodes.filter(n=>n.proseAssembly?.mode===mode)){
   const snapshot=captureAProse(state,g.registry,node);assert.equal(snapshot.mode,'assembled',node.id+' '+JSON.stringify(replayAProse(node,snapshot))+' '+JSON.stringify(snapshot.lexemes));assert(snapshot.text.includes('返回地点'));assert.equal(replayAProse(node,snapshot).text,snapshot.text);
   const live=state.adventure!.story!;live.nodeId=node.id;live.prose=snapshot;live.visits={[node.id]:1};validateState(state,g.registry);
   const subject=snapshot.context.bindings.actor?.subject;
   for(const word of snapshot.lexemes.filter(e=>e.allowedSlots.includes('bodyPart')||e.role==='qualifier'||e.poolIds.includes('body.material')))assert.equal(word.binding.subject,subject);
   if(mode==='body'){
    assert.equal(subject,'player');const part=state.player.body.parts.find(p=>p.instanceId===snapshot.context.bindings.part.instanceId)!;assert(part);
    const attributes=effectivePart(part,g.registry);assert(snapshot.text.includes(attributes.materialId?g.registry.material(attributes.materialId).label:attributes.materialFamily==='organic'?'有机材质':'机械材质'));
   }
   counts[mode]++;
  }
 }
 assert.deepEqual(counts,{environment:18,person:30,body:6});
});
for(const mode of ['environment','person','body'] as const)test(`${mode}: real action captures once, saves exactly, continues and exits without resources or time`,async()=>{
 const engine=enter(mode),before=engine.snapshot();validateState(before,g.registry);assert.equal(before.adventure!.story!.prose!.mode,'assembled');
 const body=narrativeText(before,g.registry),codec=new SaveCodec(g.registry),restored=await codec.decode(await codec.encode(before));
 assert.equal(restored.status,'ready',restored.reason);assert.deepEqual(restored.state,before);assert.equal(narrativeText(restored.state!,restored.registry!),body);
 const changed=structuredClone(before);changed.player.body.parts[0]!.overrides={...changed.player.body.parts[0]!.overrides,color:'silver'};
 assert.equal(narrativeText(changed,g.registry),body,'rendering must not re-query or rewrite captured prose');
 const act=(id:Id)=>{const r=engine.performAction({actionId:id},engine.snapshot().meta.revision,'a-'+mode+'-'+id);assert(r.ok,r.message);};
 act('progression:action.story.0');assert(engine.snapshot().adventure!.story!.prose);
 act('progression:action.story.1');const after=engine.snapshot();assert.equal(after.adventure!.story,null);assert.deepEqual(after.player,before.player);assert.deepEqual(after.district,before.district);assert.deepEqual(after.clock,before.clock);
});
test('absent or departed residents yield complete fallback, never another resident or invented work',()=>{
 const empty=enter('person',true).snapshot();assert.equal(empty.adventure!.story!.prose!.mode,'fallback');assert.equal(empty.adventure!.story!.prose!.text,'你可以结束观察，继续自己的安排。');
 const state=structuredClone(enter('person').snapshot()),actor=state.adventure!.story!.actor!;assert.equal(actor.kind,'resident');
 advanceClock(state,13*60);state.adventure!.story!.steps=1;
 const n=state.district!.residents.find(n=>actor.kind==='resident'&&n.id===actor.id)!;n.locationId=g.world.definition.locations.find(p=>p.id!==state.world.locationId)!.id;
 const rule=g.registry.narrativeNodes.find(n=>n.proseAssembly?.mode==='person'&&n.proseAssembly.rule.proseTemplate.some(t=>t.poolId==='action.observed'&&t.required))!;
 const snapshot=captureAProse(state,g.registry,rule);assert.equal(snapshot.mode,'fallback');assert.equal(state.adventure!.story!.actor,actor);
});
test('schema rejects malformed templates and save validation rejects text, exit and object-binding tampering',async()=>{
 const packs=structuredClone(g.registry.contentPacks),node=packs.flatMap(p=>p.narrativeNodes??[]).find(n=>n.proseAssembly)!;
 node.proseAssembly!.rule.proseTemplate[0]!.slot='unknown';await assert.rejects(loadPacks(packs));
 const state=enter('body').snapshot();
 for(const edit of [(s:typeof state)=>s.adventure!.story!.prose!.text+='虚构内容。',(s:typeof state)=>s.adventure!.story!.prose!.context.exitChoice.actionId='worldgen:action.work.0',(s:typeof state)=>s.adventure!.story!.prose!.context.bindings.actor.subject='resident/other']){
  const corrupt=structuredClone(state);edit(corrupt);assert.throws(()=>validateState(corrupt,g.registry));
 }
});
test('body-panel TF is executable during A observation, preserves captured text and restores from a real save',async()=>{
 const engine=enter('body'),before=engine.snapshot(),text=narrativeText(before,g.registry);
 const applied=engine.performAction({actionId:'aetheria-tf:action.free.ears.cat'},before.meta.revision,'a-body-live-tf');assert(applied.ok,applied.message);
 const after=engine.snapshot();assert.notDeepEqual(after.player.body,before.player.body);assert.deepEqual(after.adventure!.story!.prose,before.adventure!.story!.prose);assert.equal(narrativeText(after,g.registry),text);
 const codec=new SaveCodec(g.registry),loaded=await codec.decode(await codec.encode(after));assert.equal(loaded.status,'ready',loaded.reason);assert.deepEqual(loaded.state,after);
 assert(!engine.view().actions.some(a=>a.definition.id==='worldgen:action.work.0'));
});
test('five supported themes retain 54 live templates and old worlds remain usable without retroactive nodes',async()=>{
 for(const theme of ['modern','cyberpunk','xianxia','post-apocalypse']){const world=await new WorldGenerator().generate({...args,seed:42,worldTag:'worlds:setting.'+theme});validateState(world.state,world.registry);assert.equal(world.registry.narrativeNodes.filter(n=>n.proseAssembly).length,54);}
 const old=gunzipSync(await readFile(new URL('fixtures/a-predecessor-five-themes.json.gz',import.meta.url))).toString('utf8'),codec=new SaveCodec(g.registry,source),restored=await codec.decode(old);
 assert.equal(restored.status,'ready',restored.reason);assert(!restored.registry!.narrativeNodes.some(n=>n.proseAssembly));assert(!restored.state!.adventure!.story!.prose);
});
