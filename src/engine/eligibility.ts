import type { GameState } from '../core/types.ts';
import type { EntityRef } from '../core/query-types.ts';
import type { Registry } from '../content/registry.ts';
export function ageEligibility(age:number|null|undefined,intelligent:boolean,threshold:number):{pass:boolean;reason:string}{
  if(age===null||age===undefined||!Number.isSafeInteger(age))return {pass:false,reason:'人物年龄尚未确认。'};
  return intelligent&&age>=Math.max(18,threshold)?{pass:true,reason:''}:{pass:false,reason:'未通过成年智慧人物资格。'};
}
/** 偏好与分级由调用者另查；成年门槛不依赖身体、种族名称或 adult Tag。 */
export function adultEntityEligibility(s:GameState,r:Registry,ref:EntityRef):{pass:boolean;reason:string}{
  // 玩家角色统一设定为成年人，不再把年龄作为可编辑属性；偏好仍由调用方检查。
  if(ref.kind==='player')return s.district?.profile.created?{pass:true,reason:''}:{pass:false,reason:'请先创建角色。'};
  const n=ref.kind==='npc'?r.npcs.find(n=>n.id===ref.id):s.district?.residents.find(n=>n.id===ref.id);
  if(!n)return {pass:false,reason:'人物身份未知。'};
  const species=r.species(n.speciesId);return ageEligibility(n.ageYears,species.intelligent,species.adultAgeYears);
}
