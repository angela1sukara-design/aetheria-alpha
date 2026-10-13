import type { GameState, Id } from '../core/types.ts';
import { ADVENTURE_FIELDS, NARRATIVE_KINDS } from '../core/adventure-types.ts';
import type { Registry } from '../content/registry.ts';
import { shape, entityRef } from '../content/foundation-schema.ts';
export function validateAdventure(s:GameState,r:Registry):void {
  const a=s.adventure;if(!a)return;
  const bad=():never=>{throw Error('故事与成长存档无效。');};
  const int=(v:unknown,min=0,max=1000000)=>{if(!Number.isSafeInteger(v)||(v as number)<min||(v as number)>max)bad();};
  const text=(v:unknown,max=10000)=>{if(typeof v!=='string'||!v.trim()||v.length>max)bad();};
  shape(a,['version',...ADVENTURE_FIELDS,'victories','daily','equipment','story','journal','lastCombat'],['items']);if(a.version!==1)bad();
  for(const field of ADVENTURE_FIELDS)int(a[field]);
  shape(a.victories,[],Object.keys(a.victories));for(const [id,v]of Object.entries(a.victories)){if(!r.enemies.some(e=>e.id===id))bad();int(v);}
  shape(a.daily,[],Object.keys(a.daily));if(Object.keys(a.daily).length>4096)bad();for(const [key,v]of Object.entries(a.daily)){if(!/^(world\.day|\d+:[a-zA-Z0-9:_.-]+)$/.test(key)||key.length>200)bad();int(v);}
  shape(a.equipment,[],['held','head','body','hands','legs','accessory','weapon','armor','cosmetic','wings','tail','other']);for(const [slot,id]of Object.entries(a.equipment)){const item=r.equipment.find(e=>e.id===id);if(!item||!s.district?.inventory.includes(item.id)||(item.slot??'cosmetic')!==slot)bad();}
  if(a.items){shape(a.items,[],Object.keys(a.items));if(Object.keys(a.items).length>200)bad();for(const [id,qty]of Object.entries(a.items)){if(!r.items.some(i=>i.id===id))bad();int(qty,1,99);}}
  const tags=(items:unknown)=>{if(!Array.isArray(items)||items.length>100)bad();const seen=new Set<string>();for(const tag of items as {role:string;tagId:Id}[]){shape(tag,['role','tagId']);if(!['player','opponent','environment'].includes(tag.role)||r.tag(tag.tagId).status!=='active'||seen.has(tag.role+'/'+tag.tagId))bad();seen.add(tag.role+'/'+tag.tagId);}};
  if(a.story){const story=a.story;shape(story,['instanceId','kind','stage','nodeId','profileId','opponentName','actor','tags','visits','log','steps'],['fills']);if(story.fills){shape(story.fills,[],Object.keys(story.fills));if(Object.keys(story.fills).length>32)bad();for(const [k,v]of Object.entries(story.fills)){if(typeof k!=='string'||k.length>40||typeof v!=='string'||v.length>80)bad();}}text(story.instanceId,128);text(story.opponentName,100);text(story.stage,100);int(story.steps,0,11);if(!NARRATIVE_KINDS.includes(story.kind))bad();const node=r.narrativeNodes.find(n=>n.id===story.nodeId);if(!node||node.kind!==story.kind||node.stage!==story.stage||s.district?.combat||s.district?.scene||s.activeEventStack.length)bad();if(story.profileId&&!r.narrativeProfiles.some(p=>p.id===story.profileId))bad();if(story.actor){entityRef(story.actor);if(story.actor.kind==='npc')r.npc(story.actor.id);if(story.actor.kind==='resident'&&!s.district?.residents.some(n=>n.id===(story.actor as {id:string}).id))bad();}tags(story.tags);shape(story.visits,[],Object.keys(story.visits));let count=0;for(const [id,v]of Object.entries(story.visits)){const n=r.narrativeNodes.find(n=>n.id===id);if(!n||n.kind!==story.kind)bad();int(v,1,n!.maxVisits);count+=v;}if(count!==story.steps+1||s.rng.streams['narrative:'+story.instanceId]?.draws!==count)bad();if(!Array.isArray(story.log)||story.log.length!==story.steps)bad();story.log.forEach(v=>text(v));}
  if(!Array.isArray(a.journal)||a.journal.length>64)bad();for(const row of a.journal){shape(row,['at','title','text']);int(row.at,0,s.clock.totalMinutes);text(row.title,200);text(row.text,100000);}
  if(a.lastCombat){shape(a.lastCombat,['enemyId','enemyName','result','turn','tags']);if(!r.enemies.some(e=>e.id===a.lastCombat!.enemyId)||!['victory','defeat','escape'].includes(a.lastCombat.result))bad();text(a.lastCombat.enemyName,100);int(a.lastCombat.turn);tags(a.lastCombat.tags);}
}
