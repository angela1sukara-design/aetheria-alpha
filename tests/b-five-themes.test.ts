import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {loadPacks} from '../src/content/loader.ts';
import {WorldGenerator} from '../src/world/generator.ts';
import {B_FIVE_THEME_OBSERVATIONS} from '../src/world/b-five-theme-data.ts';
import {OBSERVATION_CATALOG} from '../src/world/b-observations.ts';
import {ActionExecutor} from '../src/engine/executor.ts';
import {SaveCodec,validateState} from '../src/persistence/codec.ts';
import {evaluate} from '../src/engine/conditions.ts';
import {advanceClock} from '../src/engine/clock.ts';
import type {Id} from '../src/core/types.ts';

const read=async(p:string)=>JSON.parse(await readFile(new URL('../'+p,import.meta.url),'utf8'));
const index=await read('content/index.json');
const registry=await loadPacks([...await Promise.all(index.packs.map((p:string)=>read('content/'+p))),
  await read('content/personality/pack.json'),
  ...await Promise.all(['neighborhood-content','lexicon-content','world-profile-content','fantasy-content'].map(p=>read('content/generation/'+p+'.json')))]);
const rules=await read('content/generation/rules.json'),reference=await read('content/generation/lexicon-reference.json'),fantasy=await read('content/generation/fantasy-reference.json'),profiles=await read('content/generation/world-profiles.json');
const themes=['modern','cyberpunk','fantasy','xianxia','post-apocalypse'];
const generate=(theme:string,ecology?:string)=>{
  const refs=structuredClone([reference,fantasy]);
  if(ecology)for(const ref of refs)ref.templates=ref.templates.filter((t:{kind:string;data:{tags?:string[]}})=>t.kind!=='environment'||t.data.tags?.some(tag=>tag==='foundation:setting.'+ecology||tag==='climate.'+ecology));
  return new WorldGenerator().generate({seed:42,registry,rules,references:refs,worldProfiles:profiles,worldTag:'worlds:setting.'+theme});
};

test('all 675 source phrases are installed once with explicit theme qualification and frozen review evidence',async()=>{
  const source=await read('content/prose/b-five-themes-v2.json'),plan=await read('production/text-slot-integration/b-five-themes-v2.json');
  assert.equal(plan.sourceHash,createHash('sha256').update(JSON.stringify(source)).digest('hex'));
  assert.equal(B_FIVE_THEME_OBSERVATIONS.length,675);assert.equal(new Set(OBSERVATION_CATALOG.map(r=>r.id)).size,945);
  for(const d of source.deliveries){
    assert.equal(d.entries.length,d.task==='B1'?65:70);assert.equal(d.handPreviews.length,4);
    for(const e of d.entries){
      assert(e.requires.some((c:{fact:string;value:string})=>c.fact==='scene.setting'&&c.value===d.theme));
      const r=B_FIVE_THEME_OBSERVATIONS.find(r=>r.id===e.id)!;assert(r);assert.equal(r.theme,d.theme);assert(r.fragments.includes(e.text));
      assert.equal(plan.recipes.find((r:{id:string})=>r.id===e.id).sourceHash,createHash('sha256').update(JSON.stringify(e)).digest('hex'));
      if(!e.id.endsWith('.present-person')&&!e.id.endsWith('.nearby-figure'))assert.equal(e.review,'hold');
    }
  }
  for(const theme of themes)assert.equal(B_FIVE_THEME_OBSERVATIONS.filter(r=>r.theme===theme).length,135);
  const text=(id:string)=>B_FIVE_THEME_OBSERVATIONS.find(r=>r.id===id)!.fragments.join('');
  assert.match(text('word.prop.fantasy.ceramic-medicine-jar'),/陶制药罐/);
  assert.match(text('word.action.post-apocalypse.scrape-rust-with-file'),/锉去/);
  assert.match(text('word.prop.xianxia.celadon-porridge-bowl'),/青瓷碗/);
  assert(!B_FIVE_THEME_OBSERVATIONS.some(r=>r.fragments.join('').includes('其中盛着过滤水')));
});

for(const theme of themes)test(`${theme}: actual worlds contain matching new scenes, work at night, and round-trip saves`,async()=>{
  const g=await generate(theme);validateState(g.state,g.registry);
  const ecology=g.world.definition.setting!.ecologyTag.replace('foundation:setting.','');
  const nodes=g.registry.narrativeNodes.filter(n=>n.id.startsWith('worldgen:node.observe.'));
  for(const [i,place]of g.world.definition.locations.entries()){
    const at=nodes.filter(n=>n.conditions.some(c=>c.op==='location.is'&&c.id===place.id));assert(at.length>0&&at.length<=8);
    assert(at.some(n=>B_FIVE_THEME_OBSERVATIONS.some(r=>r.theme===theme&&g.registry.text(n.textKey).includes(r.context+'。'+r.fragments.join('')))&&!n.conditions.some(c=>c.op==='time.window')),'each location has a newly installed anytime scene');
    for(const n of at){
      const text=g.registry.text(n.textKey),r=OBSERVATION_CATALOG.find(r=>text.includes(r.context+'。'+r.fragments.join('')))!;
      assert(r);assert(r.theme==='generic'||r.theme===theme);assert(!r.allowedEcologies||r.allowedEcologies.includes(ecology));
      if(r.timeWindow)assert(n.conditions.some(c=>c.op==='time.window'&&c.start===r.timeWindow!.start&&c.end===r.timeWindow!.end));
    }
    assert(g.registry.action(`worldgen:action.observe.${i}`));
  }
  for(const hour of [9,23]){
    const state=structuredClone(g.state);advanceClock(state,(hour*60-state.clock.totalMinutes%1440+1440)%1440);
    const engine=new ActionExecutor(g.registry,state),before=engine.snapshot();let serial=0;
    const act=(id:Id)=>{const res=engine.performAction({actionId:id},engine.snapshot().meta.revision,`five-${theme}-${hour}-${++serial}`);assert(res.ok,res.message);};
    const i=g.world.definition.locations.findIndex(p=>p.id===state.world.locationId);
    act(`worldgen:action.observe.${i}`);
    let live=engine.snapshot();const node=g.registry.narrativeNodes.find(n=>n.id===live.adventure!.story!.nodeId)!;
    assert(node.id.startsWith('worldgen:node.observe.'));assert(node.conditions.every(c=>evaluate(c,live,g.registry).pass));
    const codec=new SaveCodec(g.registry),restored=await codec.decode(await codec.encode(live));assert.equal(restored.status,'ready');assert.deepEqual(restored.state,live);
    assert.equal(restored.registry!.text(node.textKey),g.registry.text(node.textKey));
    act('progression:action.story.0');live=engine.snapshot();assert(live.adventure!.story!.nodeId.startsWith('worldgen:node.observe.'));
    act('progression:action.story.1');live=engine.snapshot();assert.equal(live.adventure!.story,null);
    assert.deepEqual(live.player,before.player);assert.deepEqual(live.district,before.district);assert.deepEqual(live.clock,before.clock);validateState(live,g.registry);
  }
});

test('snow, mist, midday and moonlight stay qualified in dry and frost worlds',async()=>{
  let gated=0;
  for(const climate of ['dry','frost']){
    const g=await generate('xianxia',climate);assert.equal(g.world.definition.setting!.ecologyTag,'foundation:setting.'+climate);
    const engine=new ActionExecutor(g.registry,g.state),i=g.world.definition.locations.findIndex(p=>p.id===g.state.world.locationId);
    assert(engine.performAction({actionId:`worldgen:action.observe.${i}`},engine.snapshot().meta.revision,'climate-'+climate).ok);
    const live=engine.snapshot();
    for(const n of g.registry.narrativeNodes.filter(n=>n.id.startsWith('worldgen:node.observe.'))){
      const r=OBSERVATION_CATALOG.find(r=>g.registry.text(n.textKey).includes(r.context+'。'+r.fragments.join('')))!;
      if(r.allowedEcologies){gated++;assert(r.allowedEcologies.includes(climate));const c=n.conditions.find(c=>c.op==='any')!;assert(c);assert(evaluate(c,live,g.registry).pass);}
      if(r.timeWindow){const c=n.conditions.find(c=>c.op==='time.window')!;const day=structuredClone(live);day.clock.totalMinutes=9*60;const night=structuredClone(live);night.clock.totalMinutes=23*60;
        if(r.timeWindow.end===360){assert(!evaluate(c,day,g.registry).pass);assert(evaluate(c,night,g.registry).pass);}else assert(!evaluate(c,night,g.registry).pass);
      }
    }
  }
  assert(gated>0,'the frost fixture exercises real environmental conditions');
});
