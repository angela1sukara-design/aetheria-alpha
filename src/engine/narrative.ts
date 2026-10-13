import type { ActionDef, Effect, GameState, Id } from '../core/types.ts';
import type { AdventureState, NarrativeKind, NarrativeNode, ScopedTag } from '../core/adventure-types.ts';
import type { Registry } from '../content/registry.ts';
import type { EffectContext } from './effects.ts';
import { RuleError } from '../core/errors.ts';
import { evaluate } from './conditions.ts';
import { draw } from './rng.ts';
import { derivedSemantics } from './semantic-query.ts';
import { environment } from './query.ts';

export function initialAdventure(): AdventureState { return {version:1,assets:0,influence:0,safety:0,reputation:0,orders:0,contracts:0,victories:{},daily:{},equipment:{},story:null,journal:[],lastCombat:null}; }
export function adventure(s:GameState):AdventureState { if(!s.adventure){s.adventure=initialAdventure();s.adventure.daily['world.day']=Math.floor(s.clock.totalMinutes/1440);}return s.adventure; }
const key = (t:ScopedTag) => t.role+'/'+t.tagId;
export function narrativeTags(s:GameState,r:Registry):ScopedTag[] {
  const story=s.adventure?.story;
  const tags=[...(story?.tags??[])];
  const derived=new Set(r.derivedTags.map(t=>t.tagId));
  const live=tags.filter(t=>!derived.has(t.tagId));
  live.push(...derivedSemantics(s,r,{entity:{kind:'player'}}).map(tagId=>({role:'player' as const,tagId})));
  live.push(...derivedSemantics(s,r,{world:true}).map(tagId=>({role:'environment' as const,tagId})));
  for(const tag of s.worldInstance?.definition.locations.find(l=>l.id===s.world.locationId)?.tags??[])if(r.tags.some(t=>t.id===tag))live.push({role:'environment',tagId:tag as Id});
  const service=environment(s,r).service;if(service.known&&r.tags.some(t=>t.id===`foundation:service.${service.value}`))live.push({role:'environment',tagId:`foundation:service.${service.value}`});
  return [...new Map(live.map(t=>[key(t),t])).values()];
}
function chooseNode(s:GameState,r:Registry,stage:string):NarrativeNode|undefined {
  const story=adventure(s).story!;story.stage=stage;
  const tags=new Set(narrativeTags(s,r).map(key)),profile=r.narrativeProfiles.find(p=>p.id===story.profileId);
  let pool=r.narrativeNodes.filter(n=>n.kind===story.kind&&n.stage===stage&&(story.visits[n.id]??0)<n.maxVisits&&n.requiresTags.every(t=>tags.has(key(t)))&&!n.excludesTags.some(t=>tags.has(key(t)))&&n.conditions.every(c=>evaluate(c,s,r).pass));
  if(!pool.length)return;
  const priority=Math.max(...pool.map(n=>n.priority));pool=pool.filter(n=>n.priority===priority).sort((a,b)=>a.id.localeCompare(b.id,'en'));
  const weight=(n:NarrativeNode)=>Math.max(1,n.weight+n.tendencies.reduce((sum,t)=>sum+(profile?.tendencies.find(x=>x.tagId===t.tagId)?.weight??0)*t.weight,0));
  let roll=draw(s,`narrative:${story.instanceId}`)*pool.reduce((sum,n)=>sum+weight(n),0);
  const selected=pool.find(n=>(roll-=weight(n))<0)??pool.at(-1)!;story.nodeId=selected.id;story.visits[selected.id]=(story.visits[selected.id]??0)+1;return selected;
}
export function startNarrative(s:GameState,r:Registry,c:EffectContext,kind:NarrativeKind,profileId?:Id):void {
  if(s.district?.combat||s.district?.scene||s.activeEventStack.length||s.adventure?.story)throw new RuleError('NARRATIVE_BUSY','先结束眼前的交锋或故事。');
  const a=adventure(s),profile=profileId?r.narrativeProfiles.find(p=>p.id===profileId):kind==='defeat'?r.narrativeProfiles.find(p=>p.enemyId===a.lastCombat?.enemyId):undefined;
  if(profileId&&!profile)throw new RuleError('NARRATIVE_PROFILE','行为档案不存在。');
  const resident=s.district?.residents.find(n=>n.id===s.district?.currentResidentId&&n.locationId===s.world.locationId);
  const tags:ScopedTag[]=[...(kind==='defeat'?a.lastCombat?.tags??[]:[]),...(profile?.tags??[]).map(tagId=>({role:'opponent' as const,tagId})),...(profile?.goals.slice(0,1)??[]).map(tagId=>({role:'opponent' as const,tagId}))];
  a.story={instanceId:c.transactionId,kind,stage:'start',nodeId:'progression:unselected',profileId:profile?.id??null,opponentName:kind==='defeat'?a.lastCombat?.enemyName??'对方':resident?.name??'当地居民',actor:resident?{kind:'resident',id:resident.id}:profile?.npcId?{kind:'npc',id:profile.npcId}:null,tags,visits:{},log:[],steps:0};
  if(!chooseNode(s,r,'start')){a.story=null;throw new RuleError('NO_NARRATIVE','当前没有适用的故事节点。');}
}
export function narrativeText(s:GameState,r:Registry):string|undefined {
  const story=s.adventure?.story;if(!story)return;
  const node=r.narrativeNodes.find(n=>n.id===story.nodeId)!;
  const replace=(text:string)=>text.replaceAll('{opponent}',story.opponentName).replaceAll('{place}',r.location(s.world.locationId).name).replaceAll('{player}',s.district?.profile.name??'旅人');
  return `${node.title}\n\n${replace(r.text(node.textKey))}${story.log.length?'\n\n'+replace(story.log.at(-1)!):''}`;
}
export function narrativeActions(s:GameState,r:Registry):ActionDef[]|undefined {
  const story=s.adventure?.story;if(!story)return;
  const node=r.narrativeNodes.find(n=>n.id===story.nodeId)!;
  return node.choices.map((choice,index)=>{
    const costs=choice.effects.some(e=>e.op==='progression.act'||e.op==='var.change'&&e.amount<0);
    return {...r.action(`progression:action.story.${index}`),label:choice.label,conditions:choice.conditions,hint:costs?'按选项结算行动消耗':choice.next?'继续当前经历':'结束当前经历；无资源费用'};
  });
}
/** Read the current option's public effects for cost and eligibility checks, without advancing it. */
export function publicActionEffects(action:ActionDef,s:GameState,r:Registry):Effect[] {
  return action.effects.flatMap(e=>e.op==='narrative.choose'
    ? r.narrativeNodes.find(n=>n.id===s.adventure?.story?.nodeId)?.choices[e.index]?.effects??[]
    : [e]);
}
export function advanceNarrative(s:GameState,r:Registry,c:EffectContext,index:number,apply:(effects:import('../core/types.ts').Effect[],s:GameState,r:Registry,c:EffectContext)=>void):void {
  const a=adventure(s),story=a.story,node=r.narrativeNodes.find(n=>n.id===story?.nodeId),choice=node?.choices[index];
  if(!story||!node||!choice||!choice.conditions.every(x=>evaluate(x,s,r).pass))throw new RuleError('NARRATIVE_CHOICE','当前选择不可用。');
  c.narrativeChoice={nodeId:node.id,index};
  apply(choice.effects,s,r,c);
  const unset=new Set(choice.unsetTags.map(key));story.tags=story.tags.filter(t=>!unset.has(key(t)));
  story.tags=[...new Map([...story.tags,...choice.setTags].map(t=>[key(t),t])).values()];story.steps++;
  const line=r.text(choice.resultText).replaceAll('{opponent}',story.opponentName).replaceAll('{place}',r.location(s.world.locationId).name);story.log.push(line);story.log=story.log.slice(-12);c.resolvedTexts.push(line);
  if(choice.next&&story.steps<12&&chooseNode(s,r,choice.next))return;
  if(story.kind==='defeat'&&s.player.variables['core:health']!<1){s.player.variables['core:health']=1;c.changes.push({label:'脱离危险',before:0,after:1});}
  a.journal.push({at:s.clock.totalMinutes,title:node.title,text:story.log.join('\n')});a.journal=a.journal.slice(-64);delete s.rng.streams[`narrative:${story.instanceId}`];a.story=null;
}
