import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {loadPacks} from '../src/content/loader.ts';
import {WorldGenerator} from '../src/world/generator.ts';
import {B_OBSERVATIONS} from '../src/world/b-observation-data.ts';
import {OBSERVATION_CATALOG} from '../src/world/b-observations.ts';
import type {ObservationRecipe} from '../src/world/b-observations.ts';
import {ActionExecutor} from '../src/engine/executor.ts';
import {SaveCodec,validateState} from '../src/persistence/codec.ts';
import {narrativeText} from '../src/engine/narrative.ts';
import {evaluate} from '../src/engine/conditions.ts';
import {proseProblem} from '../src/content/player-prose.ts';
import type {Id} from '../src/core/types.ts';

const read=async(file:string)=>JSON.parse(await readFile(new URL('../'+file,import.meta.url),'utf8'));
const index=await read('content/index.json');
const registry=await loadPacks([...await Promise.all(index.packs.map((file:string)=>read('content/'+file))),
  await read('content/generation/neighborhood-content.json'),await read('content/generation/lexicon-content.json'),await read('content/generation/world-profile-content.json')]);
const rules=await read('content/generation/rules.json'),reference=await read('content/generation/lexicon-reference.json'),profiles=await read('content/generation/world-profiles.json');
const generate=(seed=42,theme='modern',parameters?:{locationCount?:number;npcCount?:number})=>new WorldGenerator().generate({seed,registry,rules,references:[reference],worldProfiles:profiles,worldTag:'worlds:setting.'+theme,parameters});
const modern=await generate();

test('270 held originals have fingerprinted, explicit scenery recipes without bulk approval',async()=>{
  const source=await read('content/prose/b-authoring-v2.json'),plan=await read('production/text-slot-integration/b-observations-v1.json');
  const words=source.deliveries.flatMap((d:{entries:{id:string;review:string;text:string}[]})=>d.entries);
  assert.equal(words.length,270);assert(words.every((e:{review:string})=>e.review==='hold'));
  assert.equal(plan.sourceHash,createHash('sha256').update(JSON.stringify(source)).digest('hex'));
  assert.deepEqual(new Set(B_OBSERVATIONS.map(r=>r.id)),new Set(words.map((w:{id:string})=>w.id)));
  for(const recipe of B_OBSERVATIONS as readonly ObservationRecipe[]){assert(recipe.entryIds.includes(recipe.id));assert.equal(proseProblem(recipe.context+'。'+recipe.fragments.join('')),undefined);}
  const find=(id:string):ObservationRecipe=>{const recipe=B_OBSERVATIONS.find(r=>r.id===id);assert(recipe,id);return recipe;};
  assert(find('word.materialqualifier.common.etched').entryIds.includes('word.material.common.glass.shards'));
  assert(find('word.bodymatqual.common.goosebump').entryIds.includes('word.bodymaterial.common.skin'));
  assert(find('word.bodymatqual.common.dense').entryIds.includes('word.bodymaterial.common.pelt'));
  assert(!find('word.materialqualifier.common.etched').entryIds.includes('word.material.common.water'));
});

test('new worlds actually publish bounded observation actions and source phrases, stable by seed',async()=>{
  validateState(modern.state,modern.registry);
  const nodes=modern.registry.narrativeNodes.filter(n=>n.id.startsWith('worldgen:node.observe.'));
  assert(nodes.length>=25&&nodes.length<=modern.world.definition.locations.length*8);
  for(const place of modern.world.definition.locations){
    const i=modern.world.definition.locations.indexOf(place);
    const action=modern.registry.action(`worldgen:action.observe.${i}`);
    assert.equal(action.effects.length,1);assert.equal(action.effects[0]!.op,'narrative.start');
    const texts=nodes.filter(n=>n.conditions.some(c=>c.op==='location.is'&&c.id===place.id)).map(n=>modern.registry.text(n.textKey));
    assert(texts.every(t=>OBSERVATION_CATALOG.some(r=>t.includes(r.context+'。'+r.fragments.join('')))));
  }
  const repeat=await generate(),other=await generate(19);
  assert.deepEqual(repeat.state,modern.state);
  assert.notDeepEqual(nodes.map(n=>modern.registry.text(n.textKey)),other.registry.narrativeNodes.filter(n=>n.id.startsWith('worldgen:node.observe.')).map(n=>other.registry.text(n.textKey)));
});

test('modern-only scenery is excluded from fantasy, existing random streams are unchanged, max world stays valid',async()=>{
  const fantasy=await generate(42,'fantasy');validateState(fantasy.state,fantasy.registry);
  const prose=fantasy.registry.narrativeNodes.filter(n=>n.id.startsWith('worldgen:node.observe.')).map(n=>fantasy.registry.text(n.textKey)).join('\n');
  assert.doesNotMatch(prose,/手机|外卖骑手|充电宝|快递柜|地铁|机油/);
  assert.deepEqual(fantasy.state.rng,modern.state.rng);
  const large=await generate(7,'modern',{locationCount:20,npcCount:40});validateState(large.state,large.registry);
  assert(large.registry.contentPacks.find(p=>p.manifest.id==='generated/neighborhood')!.narrativeNodes!.length<=500);
});

test('observation renders in the real executor, preserves resources and bodies, saves identically and exits freely',async()=>{
  const engine=new ActionExecutor(modern.registry,modern.state);
  const place=modern.world.definition.locations.findIndex(p=>p.id===modern.state.world.locationId);
  const before=engine.snapshot();let serial=0;
  const act=(id:Id)=>{const r=engine.performAction({actionId:id},engine.snapshot().meta.revision,'b-observation-'+ ++serial);assert.equal(r.ok,true,r.message);return r;};
  act(`worldgen:action.observe.${place}`);
  let state=engine.snapshot();assert(state.adventure?.story?.nodeId.startsWith('worldgen:node.observe.'));
  assert.match(narrativeText(state,modern.registry)!,/周围一瞥/);
  assert.deepEqual(state.player,before.player);assert.deepEqual(state.district,before.district);assert.equal(state.clock.totalMinutes,before.clock.totalMinutes);
  const codec=new SaveCodec(modern.registry),save=await codec.encode(state),restored=await codec.decode(save);
  assert.equal(restored.status,'ready');assert.deepEqual(restored.state,state);
  assert.equal(narrativeText(restored.state!,restored.registry!),narrativeText(state,modern.registry));
  const live=state.adventure!.story!;
  const profile=modern.registry.narrativeProfiles.find(p=>p.id==='worldgen:profile.observation')!;
  const eligible=modern.registry.narrativeNodes.filter(n=>profile.nodeIds!.includes(n.id)&&n.kind==='exploration'&&n.conditions.every(c=>evaluate(c,state,modern.registry).pass)&&n.requiresTags.every(t=>t.tagId==='worldgen:context.observation')&&!n.excludesTags.some(t=>t.tagId==='worldgen:context.observation'));
  assert(eligible.some(n=>n.id===live.nodeId));assert(eligible.every(n=>n.id.startsWith('worldgen:node.observe.')));
  act('progression:action.story.0');state=engine.snapshot();assert(state.adventure?.story?.nodeId.startsWith('worldgen:node.observe.'));
  act('progression:action.story.1');state=engine.snapshot();assert.equal(state.adventure!.story,null);
  assert.deepEqual(state.player,before.player);assert.deepEqual(state.district,before.district);assert.equal(state.clock.totalMinutes,before.clock.totalMinutes);
  validateState(state,modern.registry);
});

test('closed observation profiles reject invalid references and cannot select competing high-priority global stories',async()=>{
  for(const invalid of ['missing','duplicate']){
    const packs=structuredClone(modern.registry.contentPacks),generated=packs.find(p=>p.manifest.id==='generated/neighborhood')!;
    const profile=generated.narrativeProfiles!.find(p=>p.id==='worldgen:profile.observation')!;
    profile.nodeIds!.push(invalid==='missing'?'worldgen:node.missing':profile.nodeIds![0]!);
    await assert.rejects(loadPacks(packs));
  }
  const packs=structuredClone(registry.contentPacks);
  const competing=packs.flatMap(p=>p.narrativeNodes??[]).find(n=>n.kind==='exploration')!;
  competing.conditions=[];competing.requiresTags=[];competing.excludesTags=[];competing.priority=100;
  const g=await new WorldGenerator().generate({seed:42,registry:await loadPacks(packs),rules,references:[reference],worldProfiles:profiles,worldTag:'worlds:setting.modern'});
  const engine=new ActionExecutor(g.registry,g.state),i=g.world.definition.locations.findIndex(p=>p.id===g.state.world.locationId);
  const result=engine.performAction({actionId:`worldgen:action.observe.${i}`},engine.snapshot().meta.revision,'b-closed-profile');
  assert.equal(result.ok,true,result.message);assert(engine.snapshot().adventure?.story?.nodeId.startsWith('worldgen:node.observe.'));
});
