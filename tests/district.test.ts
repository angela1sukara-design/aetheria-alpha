import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {packs} from './helpers.ts';
import {loadPacks} from '../src/content/loader.ts';
import {createGameState} from '../src/engine/state.ts';
import {ActionExecutor} from '../src/engine/executor.ts';
import {SaveCodec} from '../src/persistence/codec.ts';
import type {Id, ContentPack} from '../src/core/types.ts';
export async function districtGame(seed=52){const extra=JSON.parse(await readFile(new URL('../content/district/pack.json',import.meta.url),'utf8')) as ContentPack;const registry=await loadPacks([...await packs(),extra]);return {registry,engine:new ActionExecutor(registry,createGameState(registry,seed))};}
export function must(e:ActionExecutor,id:Id){const result=e.performAction({actionId:id},e.snapshot().meta.revision,crypto.randomUUID());assert.equal(result.ok,true,`${id}: ${result.message}`);return result;}
export function da(e:ActionExecutor,key:string){return must(e,`district:action.${key}`);}
test('A: ten useful places and thirty distinct storylets load through one added pack',async()=>{const {registry}=await districtGame();assert.equal(registry.locations.length,10);assert.equal(registry.storylets.length,30);assert.equal(new Set(registry.storylets.map(s=>s.eventId)).size,30);});
test('A: creation, work, resident persistence, storylet, cross day and save round trip',async()=>{const {engine:e,registry:r}=await districtGame();da(e,'create');must(e,'aetheria:action.travel.apartment_street');must(e,'aetheria:action.travel.street_market');must(e,'aetheria:action.market.work');da(e,'observe.location.market');if(e.snapshot().activeEventStack.length){const option=e.view().actions.find(a=>a.available&&a.definition.label==='暂时离开')!;must(e,option.definition.id);}da(e,'resident.talk.location.market');da(e,'resident.help.location.market');const resident=e.snapshot().district!.residents[0]!;assert.ok(resident.persistent);const before=e.snapshot();for(let i=0;i<20;i++)e.view();assert.deepEqual(e.snapshot(),before);const codec=new SaveCodec(r);assert.deepEqual((await codec.decode(await codec.encode(before))).status,'ready');da(e,'waitday.location.market');da(e,'resident.talk.location.market');assert.equal(e.snapshot().district!.residents[0]!.name,resident.name);assert.ok(e.snapshot().district!.residents[0]!.visits>resident.visits);});
test('A: exact Alpha 0.1.3.1 fixture appends district without changing old ledger',async()=>{const {registry}=await districtGame();const result=await new SaveCodec(registry).decode(await readFile(new URL('./fixtures/stage3-npc-save.json',import.meta.url),'utf8'));assert.equal(result.status,'ready');if(result.status==='ready'){assert.ok(result.state.district);assert.equal(result.state.npcs[0]!.relationship.trust,7);}});
