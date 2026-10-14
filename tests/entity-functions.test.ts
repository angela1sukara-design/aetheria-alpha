import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { loadPacks } from '../src/content/loader.ts';
import { WorldGenerator } from '../src/world/generator.ts';
import { ActionExecutor } from '../src/engine/executor.ts';
import { SaveCodec } from '../src/persistence/codec.ts';
import { serviceAvailable } from '../src/engine/entity-functions.ts';
import type { GameState, Id } from '../src/core/types.ts';
import type { GeneratedWorld } from '../src/world/types.ts';

const json=async(p:string)=>JSON.parse(await readFile(new URL('../'+p,import.meta.url),'utf8'));
const index=await json('content/index.json');
const inputs=await Promise.all(index.packs.map((p:string)=>json('content/'+p)));
const extra=await Promise.all(['neighborhood-content','lexicon-content','world-profile-content','fantasy-content'].map(n=>json('content/generation/'+n+'.json')));
const registry=await loadPacks([...inputs,...extra]);
const rules=await json('content/generation/rules.json'),reference=await json('content/generation/lexicon-reference.json'),fantasy=await json('content/generation/fantasy-reference.json'),profiles=await json('content/generation/world-profiles.json');
const worlds=await Promise.all([7,42,19].map(seed=>new WorldGenerator().generate({seed,registry,rules:{...rules,startMinutes:600},references:[reference,fantasy],worldProfiles:profiles,worldTag:'worlds:setting.fantasy',parameters:{npcCount:20}})));
function fixture(world:GeneratedWorld,actorId:string,change:(s:GameState)=>void=()=>{}){
  const state=structuredClone(world.state),actor=state.district!.residents.find(n=>n.id===actorId)!;
  state.world.locationId=actor.locationId;state.world.knownLocationIds=[...new Set([...state.world.knownLocationIds,actor.locationId])];
  state.district!.currentResidentId=actor.id;state.district!.profile={name:'验证者',created:true,adultOptional:false};change(state);
  return new ActionExecutor(world.registry,state);
}
const merchant=worlds[0]!.state.district!.residents.find(n=>{const t=worlds[0]!.registry.residentTemplates.find(t=>t.id===n.templateId)!;return !!t.services?.trade?.length&&!!t.services?.teach?.length;})!;
const offered=(e:ActionExecutor,move:string)=>e.view().actions.filter(a=>a.definition.effects.some(f=>f.op==='progression.act'&&f.move===move));

test('configured fantasy generation is reproducible while different seeds produce different real residents and inventories',async()=>{
  const again=await new WorldGenerator().generate({seed:7,registry,rules:{...rules,startMinutes:600},references:[reference,fantasy],worldProfiles:profiles,worldTag:'worlds:setting.fantasy',parameters:{npcCount:20}});
  assert.deepEqual(again.state,worlds[0]!.state);assert.deepEqual(again.world.definition,worlds[0]!.world.definition);
  assert.notDeepEqual(worlds[0]!.state.district!.residents.map(n=>[n.name,n.templateId,n.body]),worlds[1]!.state.district!.residents.map(n=>[n.name,n.templateId,n.body]));
  for(const world of worlds){
    assert.ok(world.state.district!.residents.some(n=>world.registry.residentTemplates.find(t=>t.id===n.templateId)?.services?.trade?.length));
    for(const actor of world.state.district!.residents){
      const template=world.registry.residentTemplates.find(t=>t.id===actor.templateId)!;
      const engine=fixture(world,actor.id);
      const goods=offered(engine,'buy').map(a=>{const effect=a.definition.effects.find(e=>e.op==='progression.act'&&e.move==='buy')!;return effect.op==='progression.act'?effect.id:undefined;});
      assert.deepEqual(goods.sort(),[...template.services?.trade??[]].sort());
    }
  }
});

test('NPC inventory and lessons come from explicit service data, with no unrelated actions',()=>{
  assert.ok(merchant,'normal generation must provide a configured workshop operator');
  const world=worlds[0]!,engine=fixture(world,merchant.id),template=world.registry.residentTemplates.find(t=>t.id===merchant.templateId)!;
  const ids=(move:string)=>offered(engine,move).map(a=>{const fx=a.definition.effects.find(f=>f.op==='progression.act'&&f.move===move)!;return fx.op==='progression.act'?fx.id:undefined;}).sort();
  assert.deepEqual(ids('buy'),[...template.services!.trade!].sort());
  assert.deepEqual(ids('train'),[...template.services!.teach!].sort());
  assert.equal(engine.view().actions.filter(a=>a.definition.effects.some(f=>f.op==='resident.help')).length,1);
  assert.ok(!engine.view().actions.some(a=>a.definition.id==='progression:action.sleep'||a.definition.id==='progression:action.care'));
});

test('a generated passerby can talk but never exposes work, goods or teaching, even as unavailable options',()=>{
  const found=worlds.flatMap(world=>world.state.district!.residents.map(actor=>({world,actor}))).find(({world,actor})=>{const t=world.registry.residentTemplates.find(t=>t.id===actor.templateId)!;return t.services!==undefined&&Object.keys(t.services).length===0;});
  assert.ok(found,'the sampled worlds contain a non-provider, without editing generated identities');
  const engine=fixture(found.world,found.actor.id),before=engine.snapshot();
  assert.ok(engine.view().actions.some(a=>a.definition.effects.some(f=>f.op==='resident.talk')));
  assert.equal(offered(engine,'buy').length,0);assert.equal(offered(engine,'train').length,0);
  assert.ok(!engine.view().actions.some(a=>a.definition.effects.some(f=>f.op==='resident.help')));
  const forged=engine.performAction({actionId:'progression:action.buy.blade'},before.meta.revision,'forged-passerby');
  assert.equal(forged.ok,false);assert.equal(forged.code,'ACTION_NOT_AVAILABLE');assert.deepEqual(engine.snapshot(),before);
});

test('unaffordable supported goods remain visible with a specific resource reason, and failure is atomic',()=>{
  const engine=fixture(worlds[0]!,merchant.id,s=>{s.player.variables['core:money']=0;}),options=offered(engine,'buy');
  assert.ok(options.length);assert.ok(options.every(a=>!a.available&&/零钱/.test(a.reason)));
  const before=engine.snapshot(),result=engine.performAction({actionId:options[0]!.definition.id},before.meta.revision,'unaffordable');
  assert.equal(result.ok,false);assert.deepEqual(engine.snapshot(),before);
});

test('buying and lessons execute real transactions, remain idempotent and survive save restoration',async()=>{
  const world=worlds[0]!,engine=fixture(world,merchant.id),buy=offered(engine,'buy').find(a=>a.available)!;
  const effect=buy.definition.effects.find(e=>e.op==='progression.act'&&e.move==='buy')!;
  assert.ok(effect.op==='progression.act'&&effect.id);
  const before=engine.snapshot(),result=engine.performAction({actionId:buy.definition.id},before.meta.revision,'purchase');assert.equal(result.ok,true,result.message);
  assert.ok(engine.snapshot().district!.inventory.includes(effect.id));assert.ok(engine.snapshot().player.variables['core:money']!<before.player.variables['core:money']!);
  const bought=engine.snapshot();engine.performAction({actionId:buy.definition.id},before.meta.revision,'purchase');assert.deepEqual(engine.snapshot(),bought);
  const lesson=offered(engine,'train').find(a=>a.available)!;assert.ok(lesson);
  const lessonFx=lesson.definition.effects.find(e=>e.op==='progression.act'&&e.move==='train')!;assert.ok(lessonFx.op==='progression.act'&&lessonFx.id);
  const start=engine.snapshot(),learn=engine.performAction({actionId:lesson.definition.id},start.meta.revision,'lesson');assert.equal(learn.ok,true,learn.message);
  assert.equal(engine.snapshot().player.variables[lessonFx.id],start.player.variables[lessonFx.id]!+1);
  const codec=new SaveCodec(world.registry),decoded=await codec.decode(await codec.encode(engine.snapshot()));assert.equal(decoded.status,'ready',decoded.status==='quarantined'?decoded.reason:'');
  if(decoded.status==='ready')assert.deepEqual(decoded.state,engine.snapshot());
});

test('facilities control sleep and treatment; one rest and one waiting action remain per location',()=>{
  const world=worlds[0]!;
  for(const place of world.world.definition.locations){
    const state=structuredClone(world.state);state.world.locationId=place.id;state.district!.currentResidentId=null;
    const engine=new ActionExecutor(world.registry,state),options=engine.view().actions;
    assert.equal(options.some(a=>a.definition.id==='progression:action.sleep'),place.service==='home');
    const care=options.filter(a=>a.definition.conditions.some(c=>c.op==='service.available'&&c.subject==='location'&&c.service==='care'));
    assert.equal(care.length,place.service==='clinic'?1:0);
    for(const service of ['rest','wait'])assert.equal(options.filter(a=>a.definition.conditions.some(c=>c.op==='service.available'&&c.subject==='location'&&c.service===service)).length,1,place.service+':'+service);
    assert.ok(!options.some(a=>a.definition.effects.some(f=>f.op==='environment.setLight')));
  }
});

test('a healer sells actual herbal supplies which can be used from inventory',()=>{
  const world=worlds[0]!,healer=world.state.district!.residents.find(n=>world.registry.residentTemplates.find(t=>t.id===n.templateId)?.services?.trade?.includes('fantasy:item.bandage'))!;
  assert.ok(healer);
  const engine=fixture(world,healer.id,s=>{s.player.variables['core:health']=40;}),buy=offered(engine,'buy').find(a=>a.definition.effects.some(f=>f.op==='progression.act'&&f.id==='fantasy:item.bandage'))!;
  const before=engine.snapshot(),purchase=engine.performAction({actionId:buy.definition.id},before.meta.revision,'herbal-purchase');assert.equal(purchase.ok,true,purchase.message);
  assert.equal(engine.snapshot().adventure!.items!['fantasy:item.bandage'],1);
  const use=engine.view().actions.find(a=>a.definition.effects.some(f=>f.op==='item.use'&&f.id==='fantasy:item.bandage'))!;
  const start=engine.snapshot(),result=engine.performAction({actionId:use.definition.id},start.meta.revision,'herbal-use');assert.equal(result.ok,true,result.message);
  assert.equal(engine.snapshot().player.variables['core:health'],start.player.variables['core:health']!+10);
  assert.equal(engine.snapshot().adventure!.items!['fantasy:item.bandage']??0,0);assert.equal(engine.snapshot().clock.totalMinutes,start.clock.totalMinutes+5);
});

test('a capable provider stops offering services away from the workplace; lookups never mutate RNG or state',()=>{
  const world=worlds[0]!,state=structuredClone(world.state),actor=state.district!.residents.find(n=>n.id===merchant.id)!,home=world.world.definition.startLocationId;
  actor.locationId=home;state.world.locationId=home;state.district!.currentResidentId=actor.id;
  const before=structuredClone(state);for(let i=0;i<10;i++)assert.equal(serviceAvailable(state,world.registry,{subject:'resident',service:'trade',id:'progression:equipment.blade' as Id}),false);
  assert.deepEqual(state,before);
});

test('schemas reject unsupported services, unknown goods and unregistered facilities',async()=>{
  const fantasyPack=extra.at(-1)!;
  const bad=structuredClone(fantasyPack);bad.residentTemplates[0].services={repair:true};await assert.rejects(()=>loadPacks([...inputs,...extra.slice(0,-1),bad]));
  const missing=structuredClone(fantasyPack);missing.residentTemplates[0].services={trade:['missing:item.ghost']};await assert.rejects(()=>loadPacks([...inputs,...extra.slice(0,-1),missing]));
  const source=structuredClone(inputs);source.find(p=>p.locations.length).locations[0].facilities=['teleport'];await assert.rejects(()=>loadPacks(source));
});

test('changing only facility and provider data enables a real lesson outside the workshop class',async()=>{
  const changed=structuredClone(extra),pack=changed.at(-1)!;
  pack.residentTemplates.find((t:{id:string})=>t.id==='fantasy:resident.wolfkin').services.teach=['core:skillPower'];
  const ref=structuredClone(reference);for(const t of ref.templates)if(t.kind==='place'&&t.data.service==='clinic')t.data.facilities=['seat','care','workplace','training'];
  const changedRegistry=await loadPacks([...inputs,...changed]);
  const world=await new WorldGenerator().generate({seed:7,registry:changedRegistry,rules:{...rules,startMinutes:600},references:[ref,fantasy],worldProfiles:profiles,worldTag:'worlds:setting.fantasy',parameters:{npcCount:20}});
  const actor=world.state.district!.residents.find(n=>world.registry.residentTemplates.find(t=>t.id===n.templateId)?.services?.trade?.includes('fantasy:item.bandage'))!;
  assert.ok(actor);const engine=fixture(world,actor.id),lesson=offered(engine,'train').find(a=>a.definition.effects.some(f=>f.op==='progression.act'&&f.id==='core:skillPower'))!;
  assert.ok(lesson?.available);const before=engine.snapshot();
  const result=engine.performAction({actionId:lesson.definition.id},before.meta.revision,'configured-clinic-lesson');assert.equal(result.ok,true,result.message);
  assert.equal(engine.snapshot().player.variables['core:skillPower'],before.player.variables['core:skillPower']!+1);
});
