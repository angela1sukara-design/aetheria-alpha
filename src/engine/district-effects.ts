import type { ActionDef, Effect, GameState } from '../core/types.ts';
import type { Registry } from '../content/registry.ts';
import type { DistrictEffect } from '../core/district-types.ts';
import type { EffectContext } from './effects.ts';
import { district } from './district.ts';
import { evaluate } from './conditions.ts';
import { RuleError } from '../core/errors.ts';
export function applyDistrictEffect(e:DistrictEffect,s:GameState,_r:Registry,c:EffectContext,_apply:(e:Effect[],s:GameState,r:Registry,c:EffectContext)=>void):void {
 const d=district(s);
 if(e.op==='player.create') {if(d.profile.created)throw new RuleError('CREATED','角色已经创建。');d.profile={name:e.name,ageYears:e.ageYears,created:true,adultOptional:false};c.resolvedTexts.push(`${e.name}，${e.ageYears}岁。你在租约上签下名字，把这座城市当作新的起点。`);}
 else if(e.op==='preference.set')d.profile.adultOptional=e.value;
 else throw new RuleError('MODULE_PENDING','该模块尚未接入。');
}
export function districtOptions(_s:GameState,_r:Registry,actions:ActionDef[]):ActionDef[] {return actions;}
export function districtText(s:GameState,r:Registry,base:string):string {
 if(!s.district)return base;
 const variants=r.sceneTexts.filter(v=>v.locationId===s.world.locationId&&v.conditions.every(c=>evaluate(c,s,r).pass)).sort((a,b)=>b.priority-a.priority||a.id.localeCompare(b.id,'en'));
 return base+(variants[0]?'\n\n'+r.text(variants[0].textKey):'');
}
