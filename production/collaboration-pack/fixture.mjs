import {createHash} from 'node:crypto';
const digest=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const condition=(fact,value)=>({fact,comparison:'eq',value});
const word=(key,text,pool,slot,type,requires,extra={})=>({id:'word.'+key,text,allowedSlots:[slot],poolIds:[pool],priority:500,review:'draft',status:'active',role:'core',binding:{subjectType:type},requires,pendingFacts:[],excludes:[],exclusive:[],contentTier:'general',tagIds:[],...extra});
const token=(key,slot,poolId,bindTo,prefix,suffix,extra={})=>({key,slot,poolId,bindTo,required:true,prefix,suffix,...extra});
const rule=(id,domain,proseTemplate,qualifierPlan=[])=>({id,domain,mode:'prose',contentTier:'general',fallbackTier:'general',proseTemplate,qualifierPlan,prose:'你可以结束观察，继续自己的安排。'});
export function createExample(original,bundle){
 const context=structuredClone(original.context);context.fixtureId='neutral-workshop-v1';context.syntheticTestSnapshot=true;context.bindingTypes={place:'location',actor:'person',part:'part',prop:'object',material:'object',sense:'location',exit:'event'};
 const set=(id,value,key,source='snapshot')=>{context.facts[id]={known:true,value,source,binding:structuredClone(context.bindings[key]),provenance:'人工构造的中性测试快照，不是游戏查询结果'};};
 context.facts={};set('actor.present',true,'actor');set('part.kind','hand','part','engine-query');set('part.changed',false,'part');set('part.material','brass','part','engine-query');set('part.finish','fine-grain','part','engine-query');set('action.observed','tool-returned','actor');set('prop.kind','measuring-cup','prop');set('prop.contains',context.bindings.material.instanceId,'prop');set('material.kind','water','material');set('water.filtered',true,'material');set('sense.available',true,'sense');set('sense.channel','smell','sense');set('sense.sample','herbal','sense');set('scene.setting','worlds:setting.fantasy','place');
 const lexemes=[
  word('part.generic.hand','手','actor.bodyPart','bodyPart','part',[condition('part.kind','hand'),condition('actor.present',true)]),
  word('prop.generic.cup','一只量杯','environment.prop','propEnv','object',[condition('prop.kind','measuring-cup')]),
  word('action.generic.return-tools','将工具放回原处','action.observed','actionCore','person',[condition('actor.present',true),condition('action.observed','tool-returned')]),
  word('action.generic.store-tools','把工具归回原位','action.observed','actionCore','person',[condition('actor.present',true),condition('action.observed','tool-returned')]),
  word('sense.generic.herbal','草木的清香','environment.sense.smell','senseMod','location',[condition('sense.available',true),condition('sense.channel','smell'),condition('sense.sample','herbal')]),
  word('material.generic.water','水','material.current','materialFluid','object',[condition('material.kind','water'),condition('prop.contains',context.bindings.material.instanceId)]),
  word('qualifier.generic.filtered','过滤','material.qualifier','materialFluid','object',[condition('water.filtered',true)],{role:'qualifier'}),
  word('material.generic.brass','黄铜','body.material','materialFluid','part',[condition('part.material','brass')]),
  word('qualifier.generic.fine-grain','带细纹','body.material.qualifier','materialFluid','part',[condition('part.finish','fine-grain')],{role:'qualifier'}),
  word('form.modern.doorframe','靠在门框上的短发人物','actor.form','opponentForm','person',[],{review:'hold',pendingFacts:['确认同一人物正倚靠真实门框，且短发特征已知。']}),
  word('action.modern.ticket-rub','用拇指反复蹭着票据边缘','action.observed','actionCore','person',[],{review:'hold',pendingFacts:['确认该人物有适用部件、持有真实票据，且正在做该动作。']}),
  word('part.generic.open-palm','摊开的手掌','actor.bodyPart','bodyPart','part',[],{review:'hold',pendingFacts:['确认该部件有对应手掌结构且处于张开姿态，不能仅凭hand kind推断。']}),
 ];
 const templates=[
  rule('assembly.05.demo.observation','05',[
   token('where','place','place.current','place','在','，'),token('actor','opponentForm','actor.name','actor','你留意到',''),
   token('part','bodyPart','actor.bodyPart','part','的','。',{subjectAs:['actor']}),
   token('act','actionCore','action.observed','actor','对方','。'),token('prop','propEnv','environment.prop','prop','你注意到','，'),
   token('material','materialFluid','material.current','material','其中盛着','。'),token('sense','senseMod','environment.sense','sense','你察觉到','。',{required:false}),token('exit','exitChoice','exit.current','exit','你可以','。'),
  ],[{key:'material',poolId:'material.qualifier',required:false,separator:''}]),
  rule('assembly.08.demo.body','08',[
   token('actor','opponentForm','actor.name','actor','你留意到',''),token('part','bodyPart','actor.bodyPart','part','的','。',{subjectAs:['actor']}),
   token('material','materialFluid','body.material','part','该部件的表面呈现','质感。',{sameAs:['part']}),token('exit','exitChoice','exit.current','exit','你可以','。'),
  ],[{key:'material',poolId:'body.material.qualifier',required:false,separator:'的'}]),
  rule('assembly.05.demo.sense','05',[token('where','place','place.current','place','在','，'),token('sense','senseMod','environment.sense','sense','你察觉到','。',{required:false}),token('exit','exitChoice','exit.current','exit','你可以','。')]),
 ];
 const preview={templateId:templates[0].id,entryIds:[lexemes[1].id,lexemes[4].id],fixtureId:context.fixtureId,seed:context.seed,revision:context.revision,mode:'manual',text:'示例预览须按本包实际模板和已给定中性测试快照填写，不代表游戏生效。',evidenceStatus:'hypothetical-only'};
 const delivery=(task,entries)=>{const targets=task.startsWith('A')?entries.map(e=>e.id):[preview.templateId],handPreviews=targets.flatMap(templateId=>Array.from({length:targets.length===1?3:2},(_,i)=>({...structuredClone(preview),templateId,seed:context.seed+i})));return {format:'aetheria-authoring-delivery',specVersion:'1.3',task,theme:'generic',author:'协作包中性参考稿',batchId:'demo-'+task.toLowerCase(),revision:1,entries,handPreviews,suggestedTags:[],notes:'演示批，未达到正式任务配额；只有离线测试用途。'};};
 const deliveries=[delivery('A1',[templates[0],templates[2]]),delivery('A3',[templates[1]]),delivery('B1',[lexemes[1],lexemes[4]]),delivery('B2',[lexemes[2],lexemes[3],lexemes[9],lexemes[10]]),delivery('B3',[lexemes[0],...lexemes.slice(5,9),lexemes[11]])];
 const keyFor=e=>e.binding.subjectType==='part'?'part':e.binding.subjectType==='person'?'actor':e.poolIds[0].startsWith('environment.sense')?'sense':e.poolIds[0]==='environment.prop'?'prop':'material';
 const plan={authority:'fixture-review-only',runtimeIntegrated:false,approvals:lexemes.filter(e=>e.review==='draft').map(e=>({entryId:e.id,sha256:digest(e),bindingKey:keyFor(e),semanticFacts:e.requires.map(c=>c.fact),relatedBindings:e.id==='word.material.generic.water'?['prop']:e.id==='word.part.generic.hand'?['actor']:[]})),warning:'这些审稿记录仅授权中性测试快照；不是真实游戏批准、不会保存approved记录。'};
 return {format:'aetheria-authoring-examples',specVersion:'1.3',fixtureOnly:true,templates,lexemes,deliveries,context,plan,manualMethod:['先选择模板和已声明测试快照，不按文字编造物件或身体。','每个出现位按合法词池/精确实例/已知事实选择；无条件的高优先级不会因低优先级条件为真而失效。','按qualifierPlan顺序挂前；连接符由plan提供，定词文本不带末尾的。','可选槽为空时一起删除连接词。','记录templateId、entryIds、fixtureId、seed、revision，标manual/hypothetical-only。','手工轮换用于语感检查；运行能否生成以真实拼装结果为准。'],scope:'独立构造的普通观察快照；游戏引擎接入仍待实施。'};
}
