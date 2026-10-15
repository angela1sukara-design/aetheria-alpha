import type { GameState, Id } from '../core/types.ts';
import type { Resident } from '../core/district-types.ts';
import type { Registry } from '../content/registry.ts';
import { TRAIT_TAGS } from '../core/personality-types.ts';
import { adultEntityEligibility } from './eligibility.ts';
import { RuleError } from '../core/errors.ts';

export function validateTraitTags(tags:unknown,r:Registry):asserts tags is Id[] {
  if(!Array.isArray(tags)||tags.length>6||new Set(tags).size!==tags.length)throw Error('性格标签集合无效。');
  for(const id of tags)if(!TRAIT_TAGS.includes(id)||!r.hasTag(id)||r.tag(id).status!=='active'||r.tag(id).facets.length!==1||!r.tag(id).facets.includes('context'))throw Error('只允许六个已注册且有效的共享性格标签。');
}
export function personalityEnabled(s:GameState):boolean{return s.worldInstance?.generation.generatorVersion==='0.10.0';}
export function residentTraits(s:GameState,r:Registry,n:Resident|undefined):Id[]{
  if(!personalityEnabled(s)||!n?.traitTags)return [];
  return n.traitTags.filter(id=>TRAIT_TAGS.includes(id)&&r.hasTag(id)&&r.tag(id).status==='active');
}
export function conversationResident(s:GameState):Resident|undefined {
  const story=s.adventure?.story;
  if(story?.kind!=='conversation'||story.actor?.kind!=='resident')return;
  const id=story.actor.id;return s.district?.residents.find(n=>n.id===id);
}
export function conversationPresent(s:GameState):boolean{return conversationResident(s)?.locationId===s.world.locationId;}
export function structuredConversation(s:GameState,r:Registry):boolean{return residentTraits(s,r,conversationResident(s)).length>0;}
export function conversationAdultEligible(s:GameState,r:Registry):boolean{
  const n=conversationResident(s);return !!n&&conversationPresent(s)&&adultEntityEligibility(s,r,{kind:'player'}).pass&&adultEntityEligibility(s,r,{kind:'resident',id:n.id}).pass;
}
export function conversationMemory(s:GameState,kind:string):string{return `conversation:${kind}:${Math.floor(s.clock.totalMinutes/1440)}`;}
export function respondConversation(s:GameState,r:Registry,reaction:'welcomed'|'offended'|'gift'):{name:string;before:number;after:number}{
  const n=conversationResident(s);if(!n||!structuredConversation(s,r)||!conversationPresent(s))throw new RuleError('CONVERSATION_LEFT','交谈对象已经离开。');
  const kind=reaction==='offended'?'declined':reaction,mark=conversationMemory(s,kind);
  if(reaction==='gift'&&n.memories.includes(mark))throw new RuleError('CONVERSATION_GIFT_LIMIT','今天已经接受过赠礼。');
  const before=n.trust;
  if(!n.memories.includes(mark)){n.memories.push(mark);if(reaction==='offended')n.trust=Math.max(0,n.trust-1);if(reaction==='gift')n.trust++;}
  n.persistent=true;
  return {name:n.name,before,after:n.trust};
}
