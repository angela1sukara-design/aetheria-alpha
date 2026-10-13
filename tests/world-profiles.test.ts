import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { loadPacks } from '../src/content/loader.ts';
import { parseWorldProfiles, chooseWorldProfile } from '../src/world/profiles.ts';
import { WorldGenerator } from '../src/world/generator.ts';
import { SaveCodec, validateState } from '../src/persistence/codec.ts';
import { ActionExecutor } from '../src/engine/executor.ts';
import { advanceClock } from '../src/engine/clock.ts';
import { evaluate } from '../src/engine/conditions.ts';
import type { Id } from '../src/core/types.ts';

const json = async (p: string) => JSON.parse(await readFile(new URL('../' + p, import.meta.url), 'utf8'));
const index = await json('content/index.json');
const base = [...await Promise.all(index.packs.map((p: string) => json('content/' + p))), await json('content/generation/neighborhood-content.json'), await json('content/generation/lexicon-content.json')];
const registry = await loadPacks([...base, await json('content/generation/world-profile-content.json')]);
const reference = await json('content/generation/lexicon-reference.json'), rules = await json('content/generation/rules.json');
const catalog = await json('content/generation/world-profiles.json'), profiles = parseWorldProfiles(catalog, registry);
const generate = (worldTag?: string, seed = 42, ref = reference) => new WorldGenerator().generate({ seed, registry, rules, references: [ref], worldProfiles: catalog, worldTag });
let serial = 0;
function act(engine: ActionExecutor, actionId: Id) {
  const result = engine.performAction({ actionId }, engine.snapshot().meta.revision, 'world-profile-test-' + ++serial);
  assert.equal(result.ok, true, `${actionId}: ${result.message}`); return result;
}

test('17 existing source themes have unique runtime tags; selection is stable and rejects bad configuration', async () => {
  assert.equal(profiles.length, 17); assert.equal(new Set(profiles.map(p => p.sourceTheme)).size, 17);
  for (const seed of [0,7,42,100,0xffffffff]) assert.deepEqual(chooseWorldProfile(profiles,seed), chooseWorldProfile([...profiles].reverse(),seed));
  const a = await generate(), b = await generate(); assert.deepEqual(a.state,b.state); assert.deepEqual(a.world,b.world);
  const alias = await generate('general-taxonomy:setting.cyberpunk'); assert.equal(alias.world.definition.setting!.tag,'worlds:setting.cyberpunk');
  await assert.rejects(() => generate('worlds:setting.unknown'));
  const invalid = structuredClone(catalog); invalid.profiles[0].locations.unknown = invalid.profiles[0].locations.home; assert.throws(() => parseWorldProfiles(invalid,registry));
  const duplicate = structuredClone(catalog); duplicate.profiles.push(duplicate.profiles[0]); assert.throws(() => parseWorldProfiles(duplicate,registry));
  const mismatched = structuredClone(catalog); mismatched.profiles[0].tag = 'worlds:setting.other'; assert.throws(() => parseWorldProfiles(mismatched));
  await assert.rejects(() => new WorldGenerator().generate({seed:42,registry,rules,references:[reference],worldTag:profiles[0]!.tag}));
  await assert.rejects(() => new WorldGenerator().generate({seed:42,registry,rules,references:[reference],worldProfiles:catalog,questContent:profiles[0]!.quests}));
});

test('world theme and six ecologies are independent; extra references can filter by world Tag', async () => {
  const cyber = profiles.find(p=>p.id==='world.cyberpunk')!, fantasy=profiles.find(p=>p.id==='world.fantasy')!;
  for (const ecology of ['wet','dry','garden','frost','forge','tidal']) {
    const ref={...reference,templates:reference.templates.filter((t:{kind:string;id:string})=>t.kind!=='environment'||t.id.endsWith('.'+ecology))};
    const a=await generate(cyber.tag,42,ref), b=await generate(fantasy.tag,42,ref);
    assert.equal(a.world.definition.setting!.ecologyTag,b.world.definition.setting!.ecologyTag);
    assert.equal(a.world.definition.setting!.ecologyTag,`foundation:setting.${ecology}`);
    assert.deepEqual(a.world.generation.selectedTemplateIds,b.world.generation.selectedTemplateIds);
    assert.deepEqual(a.state.rng,b.state.rng);
    assert.notEqual(a.registry.location(a.world.definition.locations[0]!.id).name,b.registry.location(b.world.definition.locations[0]!.id).name);
    validateState(a.state,a.registry); validateState(b.state,b.registry);
  }
  const filtered=structuredClone(reference);
  for(const t of filtered.templates)if(t.kind==='environment')t.requiresTags.push(cyber.tag);
  await generate(cyber.tag,42,filtered); await assert.rejects(()=>generate(fantasy.tag,42,filtered));
});

for (const profile of profiles) test(`${profile.name}: shared services, world-specific text, routes, sides and saved identity`, async () => {
  const g=await generate(profile.tag), def=g.world.definition;
  assert.equal(def.name,profile.name); assert.equal(def.setting!.tag,profile.tag); assert.equal(def.quests!.id,profile.quests.id);
  assert.equal(def.quests!.stages.length,8); assert.equal(def.quests!.sides.length,18);
  for(const place of def.locations){ assert.ok(place.tags.includes(profile.tag)); assert.ok(profile.locations[place.service].names.some(n=>g.registry.location(place.id).name.startsWith(n))); }
  assert.deepEqual(new Set(def.factions.map(f=>f.name)),new Set(profile.factions.map(f=>f.name)));
  assert.ok(g.state.district!.residents.every(r=>profile.residentNames.some(n=>r.name.startsWith(n))));
  assert.doesNotMatch(JSON.stringify(g.registry.contentPacks.filter(p=>p.manifest.id==='generated/neighborhood'||p.manifest.namespace==='main'||p.manifest.namespace==='side')),/百渠总管|雨棚盟首|种源总藏主|百炉总匠|工联执印人|工联落印/);
  for(const route of profile.quests.source.mainQuest.paths){
    let state=structuredClone(g.state); state.player.variables['core:energy']=0; state.player.variables['core:money']=0;
    for(const stage of route.stages){
      const binding=def.quests!.stages.find(b=>b.id===stage.id)!;
      state.world.locationId=binding.locationId;if(!state.world.knownLocationIds.includes(binding.locationId))state.world.knownLocationIds.push(binding.locationId);
      const engine=new ActionExecutor(g.registry,state);act(engine,binding.entryActionId);act(engine,`main:action.${stage.id}.b`);state=structuredClone(engine.snapshot());
      assert.equal(state.player.flags[stage.flag],true);
      if(stage.next.length){
        const next=route.stages.find(s=>s.id===stage.next[0])!;
        const journal=def.quests!.journal.find(j=>j.id===route.id)!;
        const step=journal.steps.filter(s=>s.conditions.every(c=>evaluate(c,state,g.registry).pass)).at(-1)!;
        assert.ok(step.text.includes(next.name));assert.ok(step.text.includes(next.objective));
      }
    }
    const journal=state.worldInstance!.definition.quests!.journal.find(j=>j.id===route.id)!;
    const active=journal.steps.filter(s=>s.conditions.every(c=>evaluate(c,state,g.registry).pass)).at(-1)!;
    assert.equal(active.text,'已完成：'+profile.quests.execution.stages[route.stages.at(-1)!.id]![1]!.result);
    const codec=new SaveCodec(g.registry),loaded=await codec.decode(await codec.encode(state));assert.equal(loaded.status,'ready');
    if(loaded.status==='ready')assert.deepEqual(loaded.state,state);
    assert.deepEqual(state.rng,g.state.rng);
  }
  for(const type of ['main-related','character','atmosphere']){
    const side=profile.quests.source.sideQuests.find(s=>s.type===type)!,binding=def.quests!.sides.find(b=>b.id===side.id)!;
    for(const option of profile.quests.execution.sides[side.id]!.choices){
      const state=structuredClone(g.state);state.world.locationId=binding.locationId;if(!state.world.knownLocationIds.includes(binding.locationId))state.world.knownLocationIds.push(binding.locationId);
      if(binding.residentId){const slot=state.worldInstance!.agents.find(a=>a.residentId===binding.residentId)!.schedule.find(s=>s.locationId===binding.locationId)!;advanceClock(state,(slot.start-state.clock.totalMinutes%1440+1440)%1440);}
      const engine=new ActionExecutor(g.registry,state);act(engine,binding.entryActionId);act(engine,`side:action.${side.id}.${option.id}`);
      assert.equal(engine.snapshot().player.flags[side.flag],true);
      if(binding.residentId)assert.ok(engine.snapshot().district!.residents.find(r=>r.id===binding.residentId)!.memories.includes(`side:memory.${side.id}.${option.id}`));
      if(type==='main-related'){
        const stage=def.quests!.stages.find(b=>b.id==='resource_s1')!,next=structuredClone(engine.snapshot());next.world.locationId=stage.locationId;
        const main=new ActionExecutor(g.registry,next);act(main,stage.entryActionId);act(main,'main:action.resource_s1.supported');assert.equal(main.snapshot().player.flags[stage.flag],true);
      }
      const codec=new SaveCodec(g.registry);assert.equal((await codec.decode(await codec.encode(engine.snapshot()))).status,'ready');
    }
  }
  const forged=structuredClone(g.state);forged.worldInstance!.definition.setting!.tag='worlds:setting.unknown';assert.throws(()=>validateState(forged,g.registry));
  const stripped=structuredClone(g.state);delete stripped.worldInstance!.definition.setting;assert.throws(()=>validateState(stripped,g.registry));
});

test('old ecology-only worlds and their original quest snapshots restore without acquiring a world theme', async()=>{
  const oldRegistry=await loadPacks(base),questContent=await json('content/generation/neighborhood-quests.json');
  const g=await new WorldGenerator().generate({seed:42,registry:oldRegistry,rules,references:[reference],questContent});
  const state=structuredClone(g.state);state.worldInstance!.generation.generatorVersion='0.4.1';
  delete state.worldInstance!.definition.relationshipTree;
  for(const agent of state.worldInstance!.agents)for(const edge of agent.relationships!)if(edge.kind==='ally'||edge.kind==='rival')edge.kind='acquaintance';
  const codec=new SaveCodec(g.registry),loaded=await codec.decode(await codec.encode(state));assert.equal(loaded.status,'ready');
  if(loaded.status==='ready'){assert.equal(loaded.state.worldInstance!.definition.setting,undefined);assert.equal(loaded.state.worldInstance!.definition.quests!.id,g.world.definition.quests!.id);}
});
