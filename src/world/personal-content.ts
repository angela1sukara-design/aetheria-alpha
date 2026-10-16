import type {Condition,ContentPack,Effect,Id} from '../core/types.ts';
import type {Registry} from '../content/registry.ts';
import type {WorldDef,WorldAgent} from './types.ts';
import {PERSONAL_CONTENT} from './personal-content-data.ts';

type JobPlan={locations:string[];costs:number[][][];money:number[];trust:number[];safety?:number[];reputation?:number[];influence?:number[];matchFirst?:boolean;bonusDraught?:number};
const data=PERSONAL_CONTENT;
const roles:Record<string,string[]>={'铁匠':['铁匠'],'护理员':['神殿护理员','护理员'],'委托文书':['委托文书'],'旅人':['过路信使','旅人']};
const id=(s:string):Id=>`worldgen:${s}`;
const has=(key:Id,value=true):Condition=>({op:'flag.has',id:key,value});

/** New worlds compile author drafts into existing event/flag/memory snapshots.
 * No new mutable story state, no render-time RNG, and no retroactive old-world injection. */
export function compilePersonalContent(pack:ContentPack,world:WorldDef,agents:WorldAgent[],source:Registry,seed:number):void{
 if(world.setting?.tag!=='worlds:setting.fantasy'||!world.quests)return;
 for(const cap of ['resident.story.v1','quest.binding.v1','adventure.v1','hook.global.v1','district.v1'])if(!pack.manifest.requiresCapabilities.includes(cap))pack.manifest.requiresCapabilities.push(cap);
 const flag=(key:string)=>{const f=id('flag.personal.'+key);if(!pack.flags.some(x=>x.id===f))pack.flags.push({id:f,initial:false});return f;};
 const set=(key:Id):Effect=>({op:'flag.set',id:key,value:true});
 const loc=(service:string)=>world.locations.find(l=>l.service===service)!.id;
 const provider=(role:string)=>agents.find(a=>{const t=pack.residentTemplates!.find(t=>a.residentId.endsWith(':'+t.id))!;return roles[role]?.includes(t.profession)&& (role==='旅人'||!!t.services?.work);});
 const template=(a:WorldAgent)=>pack.residentTemplates!.find(t=>a.residentId.endsWith(':'+t.id))!;
 const render=(text:string,a:WorldAgent,where:Id)=>text.replaceAll('【人物】',template(a).names[0]!).replaceAll('【地点】',pack.locations.find(l=>l.id===where)!.name).replace(/（(?:home|market|workshop|clinic|commons)）/g,'')
  .replaceAll('她向你','对方向你').replaceAll('她欣然','对方欣然').replace('并把附赠的打磨膏留作你的分红','并结清了这次分拣的分红').replace('来拆线了','来复诊了');
 const resource=(energy:number,stamina:number):Condition[]=>[...(energy?[{op:'var.compare' as const,id:'core:energy' as Id,comparison:'gte' as const,value:energy}]:[]),...(stamina?[{op:'var.compare' as const,id:'core:stamina' as Id,comparison:'gte' as const,value:stamina}]:[])];
 const costs=(energy:number,stamina:number):Effect[]=>[...(energy?[{op:'var.change' as const,id:'core:energy' as Id,amount:-energy}]:[]),...(stamina?[{op:'var.change' as const,id:'core:stamina' as Id,amount:-stamina}]:[])];
 const memory=(key:string,a:WorldAgent,text:string):Effect=>{const memoryId=id('memory.personal.'+key);pack.texts[memoryId]=text;return {op:'resident.remember',residentId:a.residentId,memoryId};};
 type Pick={label:string;text:string;conditions?:Condition[];effects?:Effect[]};
 function event(key:string,where:Id,a:WorldAgent|undefined,title:string,text:string,conditions:Condition[],picks:Pick[]){
  const eid=id('event.personal.'+key),entry=id('action.personal.'+key+'.enter'),prompt=id('text.personal.'+key+'.prompt'),leave=id('text.personal.'+key+'.leave');
  const prerequisites:Condition[]=[{op:'location.is',id:where},...(a?[{op:'resident.present' as const,residentId:a.residentId}]:[]),...conditions];
  pack.texts[prompt]=text;pack.texts[leave]='你暂时离开，已经完成的进度仍然保留。';
  const actionIds:Id[]=[];
  for(const [i,pick]of picks.entries()){
   const aid=id('action.personal.'+key+'.'+i),result=id('text.personal.'+key+'.'+i);pack.texts[result]=pick.text;
   pack.actions.push({id:aid,label:pick.label,hint:'按本次选择结算，进度会保存',group:'event',context:{eventId:eid,nodeId:'choice'},conditions:[...prerequisites,...(pick.conditions??[])],effects:[...(pick.effects??[]),{op:'event.advance',nodeId:'end'}],resultText:result});actionIds.push(aid);
  }
  const exit=id('action.personal.'+key+'.exit');pack.actions.push({id:exit,label:'暂时离开',hint:'免费退出，保留进度',group:'event',context:{eventId:eid,nodeId:'choice'},conditions:[],effects:[{op:'event.advance',nodeId:'end'}],resultText:leave});actionIds.push(exit);
  pack.events.push({id:eid,startNode:'choice',rating:'general',textMode:'fixed',...(a?{residentIds:[a.residentId]}:{}),nodes:[{id:'choice',type:'choice',textVariants:[prompt],actionIds,onEnter:[]},{id:'end',type:'exit',textVariants:[leave],actionIds:[],onEnter:[{op:'event.exit'}]}]});
  pack.actions.push({id:entry,label:title,hint:a?`${template(a).names[0]} · 查看条件与故事进度`:'前往委托现场 · 进度会保存',group:'daily',conditions:prerequisites,effects:[{op:'event.start',id:eid}],resultText:prompt});
  pack.contributions.push({hookId:pack.locations.find(l=>l.id===where)!.actionHook,actionIds:[entry]});
  return entry;
 }
 const waitText=id('text.personal.waitday');pack.texts[waitText]='你留出一天处理自己的安排，第二天同一时刻再回到眼前的事情。';
 for(const [i,l]of pack.locations.entries()){
  const aid=id('action.personal.waitday.'+i);pack.actions.push({id:aid,label:'等到明天同一时刻',hint:'一天 · 不扣资源',group:'daily',conditions:[{op:'location.is',id:l.id},{op:'service.available',subject:'location',service:'wait'}],effects:[{op:'clock.advance',minutes:1440}],resultText:waitText});pack.contributions.push({hookId:l.actionHook,actionIds:[aid]});
 }

 // Keep the six authored work descriptions in the durable source; choose one
 // per generated provider without consuming any of the existing RNG streams.
 for(const role of ['铁匠','护理员','委托文书']){
  const a=provider(role);if(!a)continue;const variants=data.workTexts.filter(w=>w.role===role),t=template(a);
  const selected=variants[(seed+agents.indexOf(a))%variants.length]!;
  t.services!.work={label:`协助${t.profession}处理当日工作`,text:render(selected.successText,a,a.originLocationId)};
 }

 for(const [si,story]of data.stories.entries()){
  const a=provider(story.role);if(!a)continue;
  const key='story.'+si,where=a.originLocationId,title=['同炉旧谱','药庐守望','驿路旧图'][si]!,complete=story.stages.map((_,i)=>flag(key+'.s'+i));
  const journal={id:key,title:`${template(a).names[0]} · ${title}`,unlock:[has(complete[0]!)],steps:[] as {conditions:Condition[];text:string}[]};
  for(const [i,stage]of story.stages.entries()){
   const requirements:Condition[]=[has(complete[i]!,false),{op:'resident.trust',residentId:a.residentId,value:data.plan.storyTrust[i]!},...(i?[has(complete[i-1]!),{op:'day.after' as const,flagId:complete[i-1]!,days:1}]:[])];
   if(story.role==='铁匠')requirements.push({op:'service.available',subject:'location',service:'work'});
   if(story.role==='护理员')requirements.push({op:'service.available',subject:'location',service:'care'});
   const picks=stage.choices.filter(c=>c.next!==null).map((c,j)=>{
    const choiceFlag=flag(key+'.s'+i+'.c'+j),minutes=data.plan.storyMinutes[si]![i]![j]!;
    const ending=story.endings.find(e=>e.id===c.next);
    const result=render(c.resultText,a,where)+(ending?'\n\n'+render(ending.text,a,where):'');
    const effects:Effect[]=[...costs(data.plan.storyEnergy,data.plan.storyStamina),{op:'resident.trust.change',residentId:a.residentId,amount:data.plan.storyGain[i]!},memory(key+'.s'+i+'.c'+j,a,result),{op:'clock.advance',minutes},set(choiceFlag),set(complete[i]!)];
    if(ending){
     journal.steps.push({conditions:[has(choiceFlag)],text:render(ending.text,a,where)});
     event(key+'.ending.'+j,where,a,`后续：${title}`,render(ending.text,a,where),[has(choiceFlag)],[]);
    }
    return {label:render(c.label,a,where),text:result,conditions:[...resource(data.plan.storyEnergy,data.plan.storyStamina),{op:'body.hasCapability' as const,capability:'grasp' as const,count:1}],effects};
   });
   event(key+'.s'+i,where,a,`${title} · 第${i+1}章`,render(stage.text,a,where),requirements,picks);
   if(i>0)for(const [j,previous]of story.stages[i-1]!.choices.filter(c=>c.next!==null).entries()){
    const textKey=id(`text.personal.${key}.s${i}.recall${j}`);pack.texts[textKey]=`${template(a).names[0]}还记得你上一次「${render(previous.label,a,where)}」的选择。\n\n${render(stage.text,a,where)}`;
    (pack.sceneTexts??=[]).push({id:id(`scene.personal.${key}.s${i}.recall${j}`),locationId:where,conditions:[has(flag(`${key}.s${i-1}.c${j}`))],priority:100,textKey,owner:{eventId:id(`event.personal.${key}.s${i}`),nodeId:'choice'}});
   }
   journal.steps.unshift({conditions:[...(i?[has(complete[i-1]!)]:[]),has(complete[i]!,false)],text:`下一步：到${pack.locations.find(l=>l.id===where)!.name}找${template(a).names[0]}继续第${i+1}章；信任至少${data.plan.storyTrust[i]}，章节之间需跨过一个自然日。`});
  }
  world.quests.journal.push(journal);
 }

 for(const [ji,job]of data.commissions.entries()){
  const a=provider(job.role);if(!a)continue;
  const p=(data.plan.jobs as Record<string,JobPlan>)[job.id]!,key='job.'+ji,origin=a.originLocationId;
  const accepted=flag(key+'.accepted'),done=flag(key+'.done'),steps=job.steps.map((_,i)=>flag(key+'.step'+i)),branches=job.steps.map((_,i)=>[flag(key+'.step'+i+'.c0'),flag(key+'.step'+i+'.c1')]);
  const outcomes=[flag(key+'.outcome0'),flag(key+'.outcome1')];
  event(key+'.offer',origin,a,`接洽委托：${job.title}`,render(job.offerText,a,origin),[has(accepted,false),has(done,false),{op:'service.available',subject:'location',service:'work'}],[{label:'接下这项委托',text:`你和${template(a).names[0]}确认了委托内容。${render(job.objective,a,origin)}`,effects:[set(accepted)]}]);
  for(const [i,step]of job.steps.entries()){
   const where=loc(p.locations[i]!),requirements=[has(accepted),has(done,false),has(steps[i]!,false),...(i?[has(steps[i-1]!)]:[])];
   const picks=step.choices.map((c,j)=>{const [minutes,energy,stamina]=p.costs[i]![j]!;
    return {label:render(c.label,a,where),text:render(c.resultText,a,where),conditions:[...resource(energy!,stamina!),{op:'body.hasCapability' as const,capability:'grasp' as const,count:1},...(p.matchFirst&&i===1?[has(branches[0]![j]!)]:[])],effects:[...costs(energy!,stamina!),{op:'clock.advance' as const,minutes:minutes!},set(branches[i]![j]!),set(steps[i]!)]};});
   event(key+'.step'+i,where,undefined,`${job.title} · 执行${i+1}`,render(step.text,a,where),requirements,picks);
  }
  const submitPrereqs=[has(accepted),has(done,false),...steps.map(f=>has(f))];
  const settlement=job.outcomes.map((outcome,j)=>{
   const result=render(outcome.text,a,origin),effects:Effect[]=[{op:'var.change',id:'core:money',amount:p.money[j]!},{op:'resident.trust.change',residentId:a.residentId,amount:p.trust[j]!},memory(key+'.outcome'+j,a,result)];
   for(const field of ['safety','reputation','influence'] as const)if(p[field]?.[j])effects.push({op:'adventure.change',field,amount:p[field]![j]!});
   if(p.bonusDraught===j)effects.push({op:'item.gain',id:'fantasy:item.draught',amount:1});
   effects.push(set(outcomes[j]!),set(done));
   event(key+'.follow'+j,origin,a,`后续：${job.title}`,render(job.followUpTexts[j]!,a,origin),[has(done),has(outcomes[j]!)],[]);
   return {label:`提交：${job.steps.at(-1)!.choices[j]!.label}`,text:result,conditions:[has(branches.at(-1)![j]!)],effects};
  });
  event(key+'.submit',origin,a,`提交委托：${job.title}`,render(job.submitText,a,origin),submitPrereqs,settlement);
  world.quests.journal.push({id:key,title:job.title,unlock:[has(accepted)],steps:[...job.steps.map((_,i)=>({conditions:[has(steps[i]!,false),...(i?[has(steps[i-1]!)]:[])],text:`到${pack.locations.find(l=>l.id===loc(p.locations[i]!))!.name}完成执行${i+1}；接洽人是${template(a).names[0]}。`})),{conditions:[...steps.map(f=>has(f)),has(done,false)],text:`已可提交：回${pack.locations.find(l=>l.id===origin)!.name}找${template(a).names[0]}结算。`},{conditions:[has(done)],text:'委托已结算，可再次拜访原接洽人听取后续。'}]});
 }

 // Approved versions of six proposals. No durability, passage privilege or new
 // skill is implied by their names. Existing ration retains its original ID.
 const goods:[string,string,'item'|'gear',string,number,Id?][]=[['铁匠','精锻便携磨刀石','item','stamina',8],['铁匠','铆钉加固护腕','gear','hands',1],['护理员','苦艾温经饮','item','health',8],['护理员','安神熏香囊','item','sanity',15],['委托文书','街区通行火漆凭条','gear','accessory',0],['委托文书','近郊行商干粮包','item','energy',10,'fantasy:item.ration']];
 const hook=id('hook.personal.goods'),actions:Id[]=[];
 pack.hooks.push({id:hook,accepts:'action',visibility:'public'});(pack.globalActionHooks??=[]).push(hook);
 for(const [i,[role,name,kind,field,amount,existing]]of goods.entries()){
  const a=provider(role);if(!a)continue;const t=template(a),gid=existing??id((kind==='item'?'item':'equipment')+'.personal.'+i);
  (t.services!.trade??=[]).push(gid);
  if(!existing&&kind==='item')(pack.items??=[]).push({id:gid,name,description:`${name}用于日常整备与休息。最多恢复${amount}点${field==='sanity'?'理智':field==='health'?'生命':'体力'}。`,category:'recovery',price:8,maxStack:20,usableInCombat:false,effects:[{op:'var.change',id:`core:${field}`,amount},...(i===2?[{op:'var.change' as const,id:'core:stamina' as Id,amount:10}]:[])]});
  if(!existing&&kind==='gear')(pack.equipment??=[]).push({id:gid,name,description:i===4?'盖有当地柜台印记的纪念凭条。':'厚革衬里的铆钉护腕，提供1点防御。',slot:field as 'hands'|'accessory',bonuses:amount?{defense:amount}:{},requires:i===1?[{op:'body.hasCapability',capability:'grasp',count:1}]:[]});
  const existingBuy=[...pack.actions,...source.globalActions()].some(a=>a.effects.some(e=>e.op==='progression.act'&&e.move==='buy'&&e.id===gid));
  if(existingBuy)continue;
  const price=kind==='item'?8:field==='accessory'?12:30;
  const add=(key:string,label:string,effects:Effect[],conditions:Condition[],result:string)=>{const aid=id('action.'+key),text=id('text.'+key);pack.texts[text]=result;pack.actions.push({id:aid,label,hint:label.startsWith('购买')?`${price}币 · 10分钟`:'使用已有物品',group:'daily',conditions,effects,resultText:text});actions.push(aid);};
  add('buy.personal.'+i,'购买'+name,[{op:'progression.act',move:'buy',id:gid}],[{op:'service.available',subject:'resident',service:'trade',id:gid},{op:'progression.available',move:'buy',id:gid}],`你按标价买下${name}。`);
  if(kind==='item')add('use.item.personal.'+i,'使用'+name,[{op:'item.use',id:gid}],[{op:'item.has',id:gid,comparison:'gte',value:1}],`你使用了一份${name}。`);
  else add('wear.personal.'+i,'装备'+name,[{op:'equipment.wear',id:gid}],[],`你佩戴好${name}。`);
 }
 pack.contributions.push({hookId:hook,actionIds:actions});
}
