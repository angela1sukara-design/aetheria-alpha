import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { gunzipSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { collection, duplicateReport, validateDelivery } from '../scripts/lexicon/library.mjs';
import { compileNeighborhood } from '../scripts/lexicon/neighborhood.mjs';
import { loadPacks } from '../src/content/loader.ts';
import { WorldGenerator } from '../src/world/generator.ts';
import { SaveCodec, validateState } from '../src/persistence/codec.ts';
import { ActionExecutor } from '../src/engine/executor.ts';
import { bodyTraits } from '../src/engine/body.ts';
import type { Id } from '../src/core/types.ts';
import type { ReferenceTemplate } from '../src/world/types.ts';
const read = async (p: string) => JSON.parse(await readFile(new URL('../'+p,import.meta.url),'utf8'));
const root = fileURLToPath(new URL('../production/lexicon-authoring/',import.meta.url));
const stored = await collection(root);
const selection = await read('production/lexicon-authoring/adapters/neighborhood-v0.1.json');
const reviews = await read('production/lexicon-authoring/management/reviews.json') as Record<string,{status:string}>;
const reference = await read('content/generation/reference.json'), content = await read('content/generation/neighborhood-content.json');
const input = {reference,content,entries:stored.entries,reviews,selection};
const compiled = compileNeighborhood(input);
const index = await read('content/index.json');
const fixedPacks = await Promise.all(index.packs.map((p: string) => read('content/'+p)));
const sourcePacks = [...fixedPacks,content,compiled.content], registry = await loadPacks(sourcePacks);
const rules = await read('content/generation/rules.json');
const generate = (seed=42) => new WorldGenerator().generate({seed,registry,rules,references:[compiled.reference]});
function atPointer(value:unknown,pointer:string):unknown {
  for(const key of pointer.slice(1).split('/')) {
    assert(value!==null&&typeof value==='object');
    value=(value as Record<string,unknown>)[key];
  }
  return value;
}

test('real delivery has 214 valid batches, 10700 entries and a preserved source archive',async()=>{
  validateDelivery({format:'aetheria-lexicon-delivery',schemaVersion:1,scope:'all',batches:stored.batches});
  assert.equal(stored.entries.length,10700); assert.equal(new Set(stored.entries.map(e=>e.category)).size,58);
  const dup = duplicateReport(stored.entries);
  assert.equal(dup.exact.length,0);
  assert.equal(Object.values(reviews).filter(r=>r.status==='approved').length,108);
  assert.equal(Object.values(reviews).filter(r=>r.status==='hold').length,12);
});

test('only approved unchanged text can be compiled; editing prose revokes build eligibility',()=>{
  for (const status of ['hold','unreviewed','rejected']) {
    const changed = structuredClone(input); changed.reviews[selection.names[0]].status = status;
    assert.throws(()=>compileNeighborhood(changed),/未审定/);
  }
  const changed = structuredClone(input); changed.entries.find(e=>e.id===selection.names[0]).name += '改';
  assert.throws(()=>compileNeighborhood(changed),/重新审稿/);
  const wrongBody = structuredClone(input); wrongBody.content.residentTemplates[0].bodyTemplateId='unknown:body.other';
  assert.throws(()=>compileNeighborhood(wrongBody),/人形/);
  const wrongCategory = structuredClone(input); wrongCategory.selection.outfits=[selection.names[0]];
  assert.throws(()=>compileNeighborhood(wrongCategory),/分类不符/);
});

test('each recorded use resolves to real compiled text; the archive and held entries are not runtime packs',async()=>{
  assert.deepEqual(compiled.content,await read('content/generation/lexicon-content.json'));
  assert.deepEqual(compiled.reference,await read('content/generation/lexicon-reference.json'));
  assert.deepEqual(compiled.usage,await read('production/lexicon-authoring/management/usage.json'));
  const byId = new Map(stored.entries.map(e=>[e.id,e]));
  for(const b of compiled.usage.bindings) {
    const target = b.targetFile.endsWith('/lexicon-content.json') ? compiled.content : compiled.reference;
    const value = atPointer(target,b.targetPointer);
    const e=byId.get(b.entryId); assert(typeof value==='string');assert(e);
    assert.ok([e.name,e.text,e.description].filter(Boolean).some(s=>value.includes(s)),b.entryId);
    assert.equal(reviews[b.entryId].status,'approved');
  }
  assert.equal(new Set(compiled.usage.bindings.map(b=>b.entryId)).size,108);
  assert.ok(!JSON.stringify(compiled).includes('颧骨夕照暖'));
  assert.deepEqual(index.packs, ['./core/pack.json','./world/pack.json','./reshaping/pack.json','./social/pack.json','./recovery/pack.json','./district/pack.json','./foundation/pack.json','./general-lexicon/pack.json','./adventure/pack.json']);
});

test('adaptation changes text without changing occupations, schedules, body recipes or activity effects',()=>{
  for(let i=0;i<content.residentTemplates.length;i++) {
    const original=structuredClone(content.residentTemplates[i]), adapted=structuredClone(compiled.content.residentTemplates[i]);
    for(const key of ['id','names','personality','attire','dialogue']){delete original[key];delete adapted[key];}
    assert.deepEqual(adapted,original);
  }
  for(const original of reference.templates.filter((t:ReferenceTemplate)=>t.kind==='activity'||t.kind==='event')) {
    const adapted=compiled.reference.templates.find((t:ReferenceTemplate)=>t.id===original.id.replace(/^base\./,'lexicon.'));
    assert.deepEqual(adapted.data,original.data);
  }
});

test('lexicon neighborhoods reproduce from seed, differ across seeds and use actual body structure plus saved attire',async()=>{
  const a=await generate(42), repeat=await generate(42), b=await generate(7);
  assert(a.state.district&&b.state.district);assert.deepEqual(a.state,repeat.state); assert.notDeepEqual(a.state.district.residents,b.state.district.residents);
  assert.notDeepEqual(a.world.definition.regions[0].environmentTags,b.world.definition.regions[0].environmentTags);
  assert.ok(a.world.generation.contentPacks.some(p=>p.id==='aetheria/neighborhood-lexicon'));
  assert.equal(a.world.generation.references[0].version,'1.0.0');
  const names = new Set(selection.names.map((id:string)=>{const entry=stored.entries.find(e=>e.id===id);assert(entry);return entry.name;}));
  for(const world of [a,b]){assert(world.state.district);for(const resident of world.state.district.residents) {
    assert.ok(names.has(resident.name.split('·')[0]));
    const t=world.registry.residentTemplates.find(t=>t.id===resident.templateId)!;
    assert.equal(t.attire!.length,1); assert.ok(resident.appearance.includes(t.attire![0]));
    assert.ok(bodyTraits(resident.body,world.registry).grasp>=1);
    assert.ok(bodyTraits(resident.body,world.registry).walk>=1);
    validateState(world.state,world.registry);
  }}
});

test('meeting, helping, existing TF and save restore work with reviewed text and stable resident memories',async()=>{
  const g=await generate(), engine=new ActionExecutor(g.registry,g.state);
  const act=(id: Id)=>{const r=engine.performAction({actionId:id},engine.snapshot().meta.revision,crypto.randomUUID());assert.equal(r.ok,true,r.message);return r;};
  act('worldgen:action.meet.0');
  const talk=act('worldgen:action.talk.0');assert.match(talk.text,/性情：/);assert.doesNotMatch(talk.text,/。。/);
  act('worldgen:action.help.0');
  act('aetheria-tf:action.free.ears.cat');
  const state=engine.snapshot();assert(state.district);const district=state.district,r=district.residents.find(r=>r.id===district.currentResidentId)!;
  assert.ok(r.persistent);assert.ok(r.memories.length>=2);
  const save=await new SaveCodec(g.registry).encode(state);
  // 模拟下一版词库更换名称；读取存档必须使用世界原快照，而非最新候选文字。
  const future=structuredClone(sourcePacks);future.at(-1).residentTemplates[0].names=['下一版候选姓名'];
  const loaded=await new SaveCodec(await loadPacks(future)).decode(save);
  assert.equal(loaded.status,'ready');assert.deepEqual(loaded.state,state);
});

test('actual published v0.2 save remains unchanged after installing the lexicon adapter',async()=>{
  const text=gunzipSync(await readFile(new URL('fixtures/worldgen-v0.2.json.gz',import.meta.url))).toString('utf8');
  const original=JSON.parse(text).payload.state;
  const restored=await new SaveCodec(registry).decode(text);
  assert.equal(restored.status,'ready');assert.deepEqual(restored.state,original);
  assert.equal(restored.state!.worldInstance!.generation.generatorVersion,'0.2.0');
  const engine=new ActionExecutor(restored.registry!,restored.state!);
  assert.equal(engine.performAction({actionId:'worldgen:action.rest.0'},engine.snapshot().meta.revision,'old-v02-continue').ok,true);
});

test('outfit field rejects effects or empty pools in content validation',async()=>{
  for(const attire of [[],[{op:'var.change',id:'core:money',amount:100}]]) {
    const bad=structuredClone(sourcePacks);bad.at(-1).residentTemplates[0].attire=attire;
    await assert.rejects(loadPacks(bad));
  }
});
