import type { Registry } from '../content/registry.ts';
import type { GameState, Id } from '../core/types.ts';
import type { EntityRef, PartAttributes, PartPredicate, QueryResult } from '../core/query-types.ts';
import type { BodyCapability, BodyGraph, BodyPartInstance } from '../core/body-types.ts';
import { bodyTraits } from './body.ts';
export const PLAYER: EntityRef = Object.freeze({kind:'player'});
export const known = <T>(value:T):QueryResult<T> => ({known:true,value});
export const unknown = (reason:string):QueryResult<never> => ({known:false,reason});
export function entityKey(ref:EntityRef = PLAYER): string {return ref.kind==='player'?'player':`${ref.kind}/${ref.id}`;}
/** 返回所属实体的权威图；调用者只能读取，写入只走事务中的 replaceEntityBody。 */
export function entityBody(s:GameState,ref:EntityRef = PLAYER):QueryResult<BodyGraph> {
  const body=ref.kind==='player'?s.player.body:ref.kind==='npc'?s.npcs.find(n=>n.definitionId===ref.id)?.body:s.district?.residents.find(n=>n.id===ref.id)?.body;
  return body?known(body):unknown(`${entityKey(ref)} 未声明或缺少真实身体。`);
}
export function replaceEntityBody(s:GameState,ref:EntityRef,body:BodyGraph):void {
  if(ref.kind==='player')s.player.body=body;
  else if(ref.kind==='npc'){const npc=s.npcs.find(n=>n.definitionId===ref.id);if(!npc?.body)throw Error('NPC 身体未知。');npc.body=body;}
  else {const npc=s.district?.residents.find(n=>n.id===ref.id);if(!npc)throw Error('居民不存在。');npc.body=body;}
}
export function effectivePart(part:BodyPartInstance,r:Registry):PartAttributes & {materialFamily:'organic'|'mechanical'} {
  const d=r.bodyPart(part.definitionId), a={...r.partDefaults(d.id),...part.overrides};
  return {...a,materialFamily:a.materialId?r.material(a.materialId).family:d.material};
}
export function capabilityCount(s:GameState,r:Registry,ref:EntityRef,cap:BodyCapability):QueryResult<number>{const b=entityBody(s,ref);return b.known?known(bodyTraits(b.value,r)[cap]):b;}
/** 同一部件内做合取；参数缺失传播未知，不能用 not(未知) 获得资格。 */
export function matchesPart(p:BodyPartInstance,r:Registry,predicate:PartPredicate):QueryResult<boolean>{
  const d=r.bodyPart(p.definitionId),a=effectivePart(p,r);let missing=false;
  for(const [key,value]of Object.entries(predicate)){
    if(key==='kind'){if(d.kind!==value)return known(false);}
    else if(key==='instanceId'){if(p.instanceId!==value)return known(false);}
    else if(key==='minLengthMm'){if(a.lengthMm===undefined)missing=true;else if(a.lengthMm<Number(value))return known(false);}
    else {const actual=a[key as keyof typeof a];if(actual===undefined)missing=true;else if(actual!==value)return known(false);}
  }
  return missing?unknown('部件参数尚未定义。'):known(true);
}
export function bodyMatches(s:GameState,r:Registry,ref:EntityRef,p:PartPredicate):QueryResult<boolean>{
  const body=entityBody(s,ref);if(!body.known)return body;const results=body.value.parts.map(part=>matchesPart(part,r,p));
  return results.some(q=>q.known&&q.value)?known(true):results.some(q=>!q.known)?unknown('候选部件参数未知。'):known(false);
}
export function environment(s:GameState,r:Registry,locationId:Id=s.world.locationId):{service:QueryResult<string>;light:QueryResult<'lit'|'dark'>}{
  r.location(locationId);
  const profile=r.locationProfiles.find(p=>p.locationId===locationId),place=s.worldInstance?.definition.locations.find(l=>l.id===locationId);
  const light=s.environment?.[locationId]?.light??profile?.light,service=place?.service??profile?.service;
  return {service:service?known(service):unknown('地点服务未知。'),light:light?known(light):unknown('光照未知。')};
}
export function timeWindow(s:GameState,start:number,end:number):boolean {const now=s.clock.totalMinutes%1440;return start<end?now>=start&&now<end:now>=start||now<end;}
