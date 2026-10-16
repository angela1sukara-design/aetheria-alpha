import type {GameState} from '../core/types.ts';
import type {NarrativeNode} from '../core/adventure-types.ts';
import type {Registry} from '../content/registry.ts';
import type {EntityRef} from '../core/query-types.ts';
import type {ProseBinding,ProseContext,ProseLexeme,ProseResult,ProseSnapshot} from '../core/prose-types.ts';
import {assembleProse} from './prose-assembly.generated.ts';
import {proseCatalog} from '../content/prose-schema.ts';
import {entityBody,entityKey,effectivePart} from './query.ts';
import {evaluate} from './conditions.ts';
import {RuleError} from '../core/errors.ts';

/** Capture once when a node is entered; rendering and save reload never re-query. */
export function captureAProse(s:GameState,r:Registry,node:NarrativeNode):ProseSnapshot{
 const assembly=node.proseAssembly!,story=s.adventure!.story!;
 const exitIndex=node.choices.findIndex(c=>c.next===null&&!c.conditions.length&&!c.effects.length&&!c.setTags.length&&!c.unsetTags.length);
 if(exitIndex<0)throw new RuleError('PROSE_EXIT','模板缺少可执行的免费返回。');
 const location=r.location(s.world.locationId),place:ProseBinding={subject:'location/'+location.id,instanceId:location.id};
 const exit:ProseBinding={subject:'player',instanceId:`${story.instanceId}/exit/${exitIndex}`};
 const context:ProseContext={seed:seed(s.worldInstance?.generation.seed??0,node.id+':'+story.steps),revision:s.meta.revision,bindings:{place,exit},facts:{},registeredTags:[],displayValues:[],exitChoice:{actionId:`progression:action.story.${exitIndex}`,label:node.choices[exitIndex]!.label,next:null,conditions:[],effects:[],setTags:[],unsetTags:[]}};
 const lexemes:ProseLexeme[]=[];
 function word(id:string,slot:string,pools:string[],binding:ProseBinding,text?:string):ProseLexeme{
  const e:ProseLexeme={id,allowedSlots:[slot],poolIds:pools,priority:500,review:'approved',status:'active',role:'core',binding,requires:[],excludes:[],exclusive:[],contentTier:'general',tagIds:[],...(text===undefined?{displayRef:{field:'name' as const}}:{text})};lexemes.push(e);return e;
 }
 function name(id:string,slot:string,pools:string[],binding:ProseBinding,value:string):void{word(id,slot,pools,binding);context.displayValues.push({binding,name:value,revision:context.revision,source:'engine-query'});}
 name('runtime:place','place',['place.current'],place,location.name);
 word('runtime:exit','exitChoice',['exit.current'],exit,context.exitChoice.label).actionId=context.exitChoice.actionId;
 const available=(location.proseScenery??[]).filter(o=>o.conditions.every(c=>evaluate(c,s,r).pass));
 for(const kind of ['prop','sense'] as const){
  const objects=available.filter(o=>o.kind===kind).sort((a,b)=>seed(context.seed,a.id)-seed(context.seed,b.id));
  const object=objects[0];if(!object)continue;
  const binding={subject:place.subject,instanceId:object.id};context.bindings[kind]=binding;
  word(object.sourceId,kind==='prop'?'propEnv':'senseMod',[kind==='prop'?'environment.prop':'environment.sense'],binding,object.text);
 }
 let target:EntityRef|null=null;
 if(assembly.mode==='body')target={kind:'player'};
 else if(assembly.mode==='person'){
  if(story.actor?.kind==='resident')target=story.actor;
  else if(!story.steps){const n=s.district?.residents.find(n=>n.id===s.district?.currentResidentId&&n.locationId===location.id)??s.district?.residents.find(n=>n.locationId===location.id);if(n)target={kind:'resident',id:n.id};}
 }
 // A body view always refers to the player; a person view pins its actor at entry.
 if(assembly.mode==='body'||assembly.mode==='person'&&!story.steps)story.actor=target;
 const person=target?.kind==='resident'?s.district?.residents.find(n=>n.id===target.id&&n.locationId===location.id):undefined;
 const present=target?.kind==='player'||!!person;
 if(target&&present){
  const subject=entityKey(target),actor={subject,instanceId:subject};context.bindings.actor=actor;
  const display=person?.name??s.district?.profile.name??'旅人';story.opponentName=display;
  name('runtime:actor.name','opponentForm',['actor.name'],actor,display);
  word('runtime:actor.form','opponentForm',['actor.form'],actor,person?`${person.name}（${person.profession}）`:'自己的身体');
  context.facts['actor.present']={known:true,source:'engine-query',value:true};
  const agent=person?s.worldInstance?.agents.find(a=>a.residentId===person.id):undefined,minute=s.clock.totalMinutes%1440;
  const slot=agent?.schedule.find(t=>t.start<=minute&&minute<t.end&&t.locationId===location.id);
  if(slot){
   // A schedule establishes presence and the current period, not a performed
   // task, pose, prop or attention state. Keep the wording at that precision.
   const description={home:'在居家时段留在这里',work:'在工作时段留在这里',leisure:'在闲暇时段留在这里'}[slot.activity];
   const action=word('runtime:action.schedule','actionCore',['action.observed'],actor,description);
   action.requires=[{fact:'actor.present',comparison:'eq',value:true}];
  }
  const body=entityBody(s,target);
  if(body.known){
   const parts=[...body.value.parts].sort((a,b)=>seed(context.seed,a.instanceId)-seed(context.seed,b.instanceId));
   const part=parts.find(p=>effectivePart(p,r).materialId!==undefined)??parts[0];
   if(part){
    const binding={subject,instanceId:part.instanceId},attributes=effectivePart(part,r);context.bindings.part=binding;
    const rawPartLabel=r.bodyPart(part.definitionId).label,cleanPartLabel=rawPartLabel==='人类耳'?'双耳':rawPartLabel.replace(/^人类(?=.{2,})/,'');word('runtime:part.'+part.instanceId,'bodyPart',['actor.bodyPart'],binding,person?`${display}的${cleanPartLabel}`:cleanPartLabel);
    // Legacy parts explicitly declare only a material family. Keep that precision;
    // organic is not evidence for skin, fur, scales or any specific substance.
    context.bindings.material=binding;word('runtime:material.'+part.instanceId,'materialFluid',['body.material','material.current'],binding,attributes.materialId?r.material(attributes.materialId).label:attributes.materialFamily==='organic'?'有机材质':'机械材质');
    if(attributes.color){const color={black:'黑色',white:'白色',grey:'灰色',brown:'棕色',silver:'银色'}[attributes.color];const q=word('runtime:color.'+part.instanceId,'materialFluid',['body.material.qualifier'],binding,color);q.role='qualifier';}
   }
  }
 }
 const result=assembleProse({catalog:proseCatalog(assembly.rule),assemblyRuleId:assembly.rule.id,lexemes,context}) as ProseResult;
 if(result.mode!=='assembled'&&result.mode!=='fallback')throw new RuleError('PROSE_ASSEMBLY','当前模板无法提供完整正文和免费返回。');
 return {version:1,nodeId:node.id,ruleId:assembly.rule.id,mode:result.mode,text:result.text,lexemes,context};
}
export function replayAProse(node:NarrativeNode,snapshot:ProseSnapshot):ProseResult{return assembleProse({catalog:proseCatalog(node.proseAssembly!.rule),assemblyRuleId:snapshot.ruleId,lexemes:snapshot.lexemes,context:snapshot.context}) as ProseResult;}
function seed(base:number,text:string):number{let h=(base^2166136261)>>>0;for(const c of text)h=Math.imul(h^c.charCodeAt(0),16777619)>>>0;return h;}
