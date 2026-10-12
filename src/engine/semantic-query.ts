import type { Registry } from '../content/registry.ts';
import type { GameState, Condition, Id } from '../core/types.ts';
import type { EntityRef } from '../core/query-types.ts';
import { evaluate } from './conditions.ts';
/** 派生集为瞬时视图，不持久化；规则禁止读取派生 Tag，避免隐式循环。 */
export function derivedSemantics(s:GameState,r:Registry,subject:{entity:EntityRef}|{locationId:Id}|{world:true}):Id[]{
  return r.derivedTags.filter(rule=>{
    let c:Condition=rule.when;
    if(rule.subject==='entity'){if(!('entity'in subject))return false;c={...c,target:subject.entity} as Condition;}
    else if(rule.subject==='location'){if(!('locationId'in subject))return false;c={...c,locationId:subject.locationId} as Condition;}
    else if(!('world'in subject))return false;
    return evaluate(c,s,r).pass;
  }).map(d=>d.tagId).sort();
}
/** 素材仅提供正文；适用条件在独立规则侧。未知不入候选，固定排序保证反复读取一致。 */
export function selectReviewedText(s:GameState,r:Registry,materials:{id:string;text:string;review:'approved'|'hold'}[],rules:{entryId:string;when:Condition[]}[]):string|undefined {
  const ids=new Set(rules.filter(rule=>rule.when.every(c=>evaluate(c,s,r).pass)).map(rule=>rule.entryId));
  return materials.filter(m=>m.review==='approved'&&ids.has(m.id)).sort((a,b)=>a.id.localeCompare(b.id,'en'))[0]?.text;
}
