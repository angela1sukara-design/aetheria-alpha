import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {loadBundle} from '../production/collaboration-pack/load-source.mjs';
import {validateDelivery,convertTemplate} from '../production/collaboration-pack/tools/authoring.mjs';
import {assembleProse} from '../production/tag-matrices/assembly.mjs';
import {proseProblem} from '../src/content/player-prose.ts';

const source=process.argv[2];if(!source)throw Error('Supply the original A delivery directory.');
const out=path.resolve('deliverables/A-templates-reviewed-2026-10-15');
const bundle=await loadBundle();
const digest=x=>createHash('sha256').update(typeof x==='string'||Buffer.isBuffer(x)?x:JSON.stringify(x)).digest('hex');
const names=['A1-templates-v1','A2-templates-v1','A3-templates-v1'];
const originals=await Promise.all(names.map(async name=>({name,json:await fs.readFile(path.join(source,name+'.json')),md:await fs.readFile(path.join(source,name+'.md'))})));
const bSourceBytes=await fs.readFile('content/prose/b-authoring-v2.json');
const bSource=JSON.parse(bSourceBytes),bWords=new Map(bSource.deliveries.flatMap(d=>d.entries).map(e=>[e.id,e]));
const changes=[],notes=new Map(),originalAudit=[];
const token=(key,slot,poolId,bindTo,prefix,suffix='。',required=true,extra={})=>({key,slot,poolId,bindTo,required,prefix,suffix,...extra});
function annotate(id,note){notes.set(id,[...(notes.get(id)??[]),note]);}
const safePropPrefixes={
 'assembly.01.variant.firstsight':'你注意到','assembly.01.variant.senselead':'目光落在',
 'assembly.01.variant.propfirst':'入眼的是','assembly.01.variant.trailend':'你注意到',
 'assembly.01.variant.stillstand':'你留意到','assembly.01.variant.bare':'你看见',
 'assembly.03.variant.facility':'你注意到','assembly.03.variant.handover':'你看见',
 'assembly.03.variant.handoff':'你留意到','assembly.03.variant.locate':'你注意到',
 'assembly.03.variant.serve':'你看见','assembly.03.variant.bare':'你留意到',
 'assembly.05.variant.nocturnal':'你看见','assembly.05.variant.omen':'你留意到',
 'assembly.05.variant.routine':'你留意到','assembly.05.variant.trail':'你看见',
 'assembly.05.variant.wait':'你注意到',
};
const revised=originals.map(({name,json})=>{
  const old=JSON.parse(json);let initialValidation;try{validateDelivery(old,bundle);initialValidation='passed';}catch(e){initialValidation=e.message;}
  originalAudit.push({task:old.task,entries:old.entries.length,specVersion:old.specVersion,theme:old.theme,
    currentValidator:initialValidation,missingQualifierPlans:old.entries.filter(e=>!Array.isArray(e.qualifierPlan)).length,
    invalidBindingTokens:old.entries.flatMap(e=>e.proseTemplate.filter(t=>!Object.hasOwn(bundle.pools.bindingRoles,t.bindTo)).map(t=>({templateId:e.id,key:t.key,bindTo:t.bindTo}))),
    standaloneQualifierTokens:old.entries.flatMap(e=>e.proseTemplate.filter(t=>t.poolId.endsWith('.qualifier')).map(t=>({templateId:e.id,key:t.key}))),
    channelSpecificGeneralSenseTokens:old.entries.flatMap(e=>e.proseTemplate.filter(t=>t.poolId==='environment.sense'&&/空气|闻|听|气息|扑面/.test(t.prefix)).map(t=>({templateId:e.id,key:t.key,prefix:t.prefix}))) });
  const data={format:'aetheria-authoring-delivery',specVersion:'1.3',task:old.task,theme:'generic',author:old.author+'；Codex 编辑修订',batchId:old.task.toLowerCase()+'-templates-reviewed-v2',revision:2,entries:structuredClone(old.entries),handPreviews:[],suggestedTags:[],notes:'保留原54条模板ID，按v1.3修订槽位、绑定、定词挂前、通道中性连接语和普通回退。预览来自显式synthetic场景的参考拼装器，不代表游戏实时事实或安装。双部位、历史变化、服务可用性、伤情、对话和任务状态均不由模板常量推定；未支持的语义见说明。'};
  for(const e of data.entries){
    const before=structuredClone(e);e.qualifierPlan=[];e.prose='你可以结束观察，继续自己的安排。';
    if(data.task==='A1')for(const t of e.proseTemplate){
      if(t.slot==='propEnv')t.prefix=safePropPrefixes[e.id]??'你注意到';
      if(t.slot==='materialFluid'){t.bindTo='material';t.prefix='你还注意到';}
      if(t.slot==='senseMod')t.prefix=e.id.endsWith('.trailend')?'也察觉到':'你察觉到';
      if(e.id.endsWith('.trailend')&&t.slot==='place')t.prefix='这里是';
    }
    if(data.task==='A2'){
      if(!e.proseTemplate.some(t=>t.slot==='opponentForm')){
        const index=e.proseTemplate.findIndex(t=>t.slot==='actionCore');
        e.proseTemplate.splice(index<0?0:index,0,token('form','opponentForm','actor.form','actor','你留意到'));
        annotate(e.id,'补充必需人物词槽，使可选动作和部件有明确对象。');
      }
      const form=e.proseTemplate.find(t=>t.slot==='opponentForm');
      for(const t of e.proseTemplate){
        if(t.slot==='opponentForm'){t.bindTo='actor';if(!['你看见','那是','你打量的是','你看着的是'].includes(t.prefix))t.prefix='你留意到';}
        if(t.slot==='actionCore'){t.bindTo='actor';t.prefix='你观察到对方的动作：';t.suffix='。';t.sameAs=[form.key];}
        if(t.slot==='bodyPart'){t.bindTo='part';t.prefix='你还留意到';t.subjectAs=[form.key];}
        if(t.slot==='senseMod')t.prefix='你察觉到';
      }
      if(e.id==='assembly.07.variant.disarm'){
        const where=e.proseTemplate.find(t=>t.slot==='place');
        e.proseTemplate=[where,...e.proseTemplate.filter(t=>t!==where)];
        where.prefix='这里是';
        annotate(e.id,'改为地点先行的句式，避免去除缴械断言后与extract完全重复。');
      }
      annotate(e.id,'去掉动作后的意图、对话、任务、伤情及关系推断；这类状态须由实际场景提供。');
    }
    if(data.task==='A3'){
      const actor=token('actor','opponentForm','actor.name','actor','你观察');
      const body=token('part','bodyPart','actor.bodyPart','part','你留意到','。',true,{subjectAs:['actor']});
      const mat=token('mat','materialFluid','body.material','part','这处的表面材质是','。',true,{sameAs:['part']});
      const where=e.proseTemplate.find(t=>t.slot==='place'),sense=e.proseTemplate.find(t=>t.slot==='senseMod');
      const exit=e.proseTemplate.find(t=>t.slot==='exitChoice');
      if(e.id.endsWith('.delta')){actor.prefix='你关注的是';body.prefix='其中一处是';body.suffix='，';mat.prefix='表面材质为';}
      if(e.id.endsWith('.otherview')){body.prefix='目光落在';body.suffix='，';}
      if(e.id.endsWith('.selfcheck')){actor.prefix='你查看的对象是';body.suffix='，';mat.prefix='这一部位的表面材质是';}
      if(e.id.endsWith('.surface')){body.prefix='你查看';mat.prefix='你留意到的表面材质是';}
      if(e.id.endsWith('.pair')){
        actor.prefix='你查看的对象是';body.prefix='对应的部位是';
        e.proseTemplate=[actor,mat,body,exit];
        annotate(e.id,'原partB不在当前绑定键中，且“只有一处”没有比较证据。本版改为同部件材质定位句，保留ID；不再宣称双部位对比。');
      }else e.proseTemplate=[actor,body,mat,...(where?[where]:[]),...(sense?[sense]:[]),exit];
      for(const t of e.proseTemplate)if(t.slot==='senseMod')t.prefix='你察觉到';
      e.qualifierPlan=[{key:'mat',poolId:'body.material.qualifier',required:false,separator:'的'}];
      annotate(e.id,'定词改为qualifierPlan挂在材质主词之前；人物名称、部件归属及同实例材质分别校验。');
      if(e.id.endsWith('.delta'))annotate(e.id,'去掉触摸、最明显及历史比较断言；当前模板仅观察现状。');
      if(e.id.endsWith('.selfcheck'))annotate(e.id,'去掉“自己的”断言；主体由actor.name绑定明确指定，不默认等于玩家。');
      if(e.id.endsWith('.surface'))annotate(e.id,'去掉未执行触摸动作的断言；触感词资格仍由真实事实和词条前置决定。');
    }
    assert.equal(e.proseTemplate.at(-1).slot,'exitChoice');
    changes.push({templateId:e.id,before,after:structuredClone(e),notes:notes.get(e.id)??[]});
    convertTemplate(e,bundle);
  }
  return{name:name.replace('-v1','-reviewed-v2'),old,data};
});
const rules=revised.flatMap(x=>x.data.entries).map(e=>convertTemplate(e,bundle));
const catalog={...structuredClone(bundle.baseCatalog),rules};
assert.equal(rules.length,54);assert.equal(new Set(rules.map(r=>r.id)).size,54);
for(const domain of new Set(rules.map(r=>r.domain))){
  const group=rules.filter(r=>r.domain===domain);
  assert.equal(new Set(group.map(r=>JSON.stringify(r.proseTemplate))).size,group.length,'Duplicate neutral template in domain '+domain);
}
const channels={smell:'word.sense.modern.disinfect.floor',sound:'word.sense.modern.ac.outdoor',light:'word.sense.modern.window.grid',thermal:'word.sense.modern.ac.chill',touch:'word.sense.modern.floor.wax'};
function fixture(channel='smell',variant=0){
  const subject='synthetic:person.'+variant;
  const bindings={place:{subject:'synthetic:place.'+variant,instanceId:'synthetic:location.'+variant},
    actor:{subject,instanceId:subject},part:{subject,instanceId:'synthetic:part.wrist.'+variant},
    prop:{subject:'synthetic:prop.'+variant,instanceId:'synthetic:prop.'+variant},
    material:{subject:'synthetic:water.'+variant,instanceId:'synthetic:water.'+variant},
    sense:{subject:'synthetic:place.'+variant,instanceId:'synthetic:location.'+variant},
    exit:{subject:'player',instanceId:'synthetic:exit.'+variant}};
  const context={fixtureId:`synthetic-a-review-${channel}-${variant}`,seed:42+variant,revision:2,bindings,
    facts:{'actor.present':{known:true,value:true,source:'snapshot'},'sense.available':{known:true,value:true,source:'snapshot'},'sense.channel':{known:true,value:channel,source:'snapshot'}},
    displayValues:[{binding:bindings.place,name:variant?'共享公寓':'维修工坊',revision:2,source:'snapshot'},
      {binding:bindings.actor,name:variant?'许宁':'林川',revision:2,source:'snapshot'}],
    registeredTags:bundle.tags.tags.filter(t=>t.status==='active').map(t=>({id:t.canonicalId,status:'active'})),
    exitChoice:{actionId:'synthetic:action.exit',label:'结束观察',next:null,conditions:[],effects:[],setTags:[],unsetTags:[]}};
  const ids=['word.prop.modern.wrench.greasy','word.material.common.water',channels[channel],
    variant?'word.form.modern.swim.wethair':'word.form.modern.mechanic.crouch',
    variant?'word.action.modern.phone.flick':'word.action.modern.screw.back',
    'word.bodypart.common.wrist.cuff','word.bodymaterial.common.skin','word.bodymatqual.common.smooth'];
  const lexemes=ids.map(id=>{
    const original=bWords.get(id);assert(original,id);const e=structuredClone(original);delete e.pendingFacts;
    const role=e.binding.subjectType;const key=role==='person'?'actor':role==='part'?'part':role==='location'?'sense':e.poolIds[0]==='environment.prop'?'prop':'material';
    e.binding=structuredClone(bindings[key]);e.review='approved';
    if(e.poolIds[0].startsWith('environment.sense.'))e.poolIds.push('environment.sense');
    return e;
  });
  const dynamic=(id,slot,pool,key,extra)=>({id,allowedSlots:[slot],poolIds:[pool],priority:500,review:'approved',status:'active',role:'core',binding:structuredClone(bindings[key]),requires:[],excludes:[],exclusive:[],contentTier:'general',tagIds:[],...extra});
  lexemes.push(dynamic('runtime:display.place','place','place.current','place',{displayRef:{field:'name'}}),
    dynamic('runtime:display.actor','opponentForm','actor.name','actor',{displayRef:{field:'name'}}),
    dynamic('runtime:display.exit','exitChoice','exit.current','exit',{text:'结束观察',actionId:context.exitChoice.actionId}));
  // Temporary approved copies below are synthetic test inputs only; source B holds are unchanged.
  const usedTags=new Set(lexemes.flatMap(e=>e.tagIds));context.registeredTags=context.registeredTags.filter(t=>usedTags.has(t.id));
  return {context,lexemes,disclaimer:'synthetic hypothetical scene, not a game export or production approval'};
}
const fixtures=Object.fromEntries([...Object.keys(channels).map(c=>[c,fixture(c)]),['alternate',fixture('sound',1)]]);
const results=[],replayInputs=[];
function runCase(rule,f,label,expected='assembled',extraCheck=()=>{}){
  const input={catalog,assemblyRuleId:rule.id,lexemes:f.lexemes,context:f.context};
  const before=digest({context:f.context,lexemes:f.lexemes});
  const result=assembleProse(input);assert.equal(result.mode,expected,rule.id+' '+label+' '+JSON.stringify(result));
  assert.equal(digest({context:f.context,lexemes:f.lexemes}),before,'Reference assembler changed inputs.');
  if(expected==='assembled'){
    assert.equal(proseProblem(result.text),undefined);assert(!/的的|，，|，。|。。|：。|undefined/.test(result.text),result.text);
    assert(result.text.endsWith('你可以结束观察。'),result.text);
    assert.deepEqual(result,assembleProse(input),'Same snapshot must reproduce exactly.');
  }
  if(expected==='fallback')assert.equal(result.text,rule.prose);
  extraCheck(result);
  const record={caseId:results.length+1,templateId:rule.id,scenario:label,mode:result.mode,text:result.text,reason:result.reason??null};results.push(record);
  replayInputs.push({caseId:record.caseId,assemblyRuleId:rule.id,lexemes:f.lexemes,context:f.context,expected:{mode:result.mode,text:result.text,reason:result.reason??null}});
  return result;
}
function minimal(rule,f){
  const copy=structuredClone(f),optional=new Set(rule.proseTemplate.filter(t=>!t.required).map(t=>t.poolId));
  copy.lexemes=copy.lexemes.filter(e=>e.role!=='qualifier'&&!e.poolIds.some(p=>optional.has(p)));return copy;
}
for(const item of revised){
  for(const e of item.data.entries){
    const rule=rules.find(r=>r.id===e.id),full=runCase(rule,structuredClone(fixtures.smell),'full');
    const short=runCase(rule,minimal(rule,fixtures.alternate),'all-optional-empty');
    for(const [result,fixtureName]of [[full,'smell'],[short,'alternate']]){
      item.data.handPreviews.push({templateId:e.id,entryIds:[...new Set(result.selected.map(s=>s.entryId))],fixtureId:fixtures[fixtureName].context.fixtureId,seed:fixtures[fixtureName].context.seed,revision:2,mode:'reference-assembler',text:result.text,evidenceStatus:'fixture-verified'});
    }
    const optional=rule.proseTemplate.filter(t=>!t.required);assert(optional.length<=4);
    for(let mask=0;mask<(1<<optional.length);mask++){
      const f=structuredClone(fixtures.smell),omit=new Set(optional.filter((_,i)=>mask&(1<<i)).map(t=>t.poolId));
      f.lexemes=f.lexemes.filter(w=>!w.poolIds.some(p=>omit.has(p)));runCase(rule,f,'optional-mask-'+mask);
    }
    if(rule.proseTemplate.some(t=>t.slot==='senseMod'))for(const channel of Object.keys(channels))runCase(rule,structuredClone(fixtures[channel]),'sense-'+channel);
    if(rule.proseTemplate.some(t=>t.slot==='actionCore')){
      const f=structuredClone(fixtures.smell),action=structuredClone(bWords.get('word.action.modern.doze.nod'));
      delete action.pendingFacts;action.review='approved';action.binding=structuredClone(f.context.bindings.actor);
      f.lexemes=f.lexemes.filter(w=>!w.poolIds.includes('action.observed'));f.lexemes.push(action);
      runCase(rule,f,'noun-leading-action');
    }
    for(const required of rule.proseTemplate.filter(t=>t.required)){
      const f=structuredClone(fixtures.smell);f.lexemes=f.lexemes.filter(w=>!w.allowedSlots.includes(required.slot)||!w.poolIds.includes(required.poolId));
      runCase(rule,f,'missing-'+required.key,'fallback');
    }
    const noExit=structuredClone(fixtures.smell);delete noExit.context.exitChoice;runCase(rule,noExit,'no-verified-free-exit','blocked');
    if(rule.proseTemplate.some(t=>t.slot==='bodyPart')){
      const foreign=structuredClone(fixtures.smell);foreign.context.bindings.part.subject='synthetic:other-person';
      for(const w of foreign.lexemes)if(w.binding.instanceId===foreign.context.bindings.part.instanceId)w.binding.subject='synthetic:other-person';
      const requiredPart=rule.proseTemplate.some(t=>t.slot==='bodyPart'&&t.required);
      runCase(rule,foreign,'foreign-part-owner',requiredPart?'fallback':'assembled',result=>{if(!requiredPart)assert(!result.selected.some(s=>s.slot==='bodyPart'));});
    }
    if(e.qualifierPlan.length){
      const wrongMaterial=structuredClone(fixtures.smell);wrongMaterial.lexemes.find(w=>w.poolIds.includes('body.material')).binding.instanceId='synthetic:other-part';
      runCase(rule,wrongMaterial,'wrong-material-instance','fallback');
      const wrongQualifier=structuredClone(fixtures.smell);wrongQualifier.lexemes.find(w=>w.role==='qualifier').binding.instanceId='synthetic:other-part';
      runCase(rule,wrongQualifier,'wrong-qualifier-instance','assembled',r=>assert(!r.selected.some(s=>s.key.includes('.prefix.'))));
      const emptyQualifier=structuredClone(fixtures.smell);emptyQualifier.lexemes=emptyQualifier.lexemes.filter(w=>w.role!=='qualifier');
      runCase(rule,emptyQualifier,'no-qualifier','assembled',r=>assert(!r.text.includes('光滑的')));
    }
  }
  validateDelivery(item.data,bundle);
}
await fs.mkdir(path.join(out,'fixtures'),{recursive:true});
const outputHashes=[];
for(const {name,data,old}of revised){
  const json=JSON.stringify(data,null,2)+'\n';await fs.writeFile(path.join(out,name+'.json'),json);outputHashes.push({file:name+'.json',sha256:digest(json)});
  const counts={};for(const e of data.entries)counts[e.domain]=(counts[e.domain]??0)+1;
  const rows=Object.entries(counts).map(([domain,count])=>`| ${domain} | ${count} |`).join('\n');
  const perTemplate=data.entries.map(e=>{
    const previews=data.handPreviews.filter(p=>p.templateId===e.id);
    return `### ${e.id}\n\n槽顺序：${e.proseTemplate.map(t=>t.slot+(t.required?'':'（可选）')).join(' → ')}。\n\n${(notes.get(e.id)??[]).map(n=>'- '+n).join('\n')}\n\n1. 满槽：${previews[0].text}\n2. 可选项全部缺失：${previews[1].text}\n`;
  }).join('\n');
  const md=`# ${name} 修订说明\n\n日期：2026-10-15。来源：${old.author} 的 v${old.specVersion} 模板。当前规范：v1.3；主题：generic；修订：2。\n\n本批 ${data.entries.length} 条模板，保留原ID与大类，附 ${data.handPreviews.length} 条由真实参考拼装器生成的预览。预览输入是显式构造的synthetic场景，不是游戏导出，不授予B批原稿生产审批。\n\n## 分类统计\n\n| 大类 | 数量 |\n|---|---:|\n${rows}\n\n## 修正内容\n\n- 补format、batchId、revision、suggestedTags与qualifierPlan，迁移1.2/common为1.3/generic。\n- 感官通用池只用通道中性连接语，声音、光线、温度、触感都不再写成气味。\n- 人物/动作统一绑定actor，动作sameAs人物；部件subjectAs人物，材质sameAs部件。物件材质使用material绑定，不冒充物件包含或表面关系。\n- 定词只由qualifierPlan挂前，不作为core token；定词缺失时不遗留连接词。\n- 回退统一为普通、完整的退出提示，不声称已办完事、没有变化、已安全或无人需要帮助。\n- 去掉无证据的递交、触摸、伤情、对话、委托、意图和关系结局断言；槽位只描述绑定实例已有内容，实际业务状态由适配层校验。\n\n${data.task==='A3'?'## 原设计尚不能证明的语义\n\n原pair使用不受支持的partB绑定，并断言“只有一处”；本版改为同一部件的材质定位，保留稳定ID，不宣称完成双部位比较。delta仅观察现状，不证明历史变化；selfcheck由actor.name明确主体，不默认部件属于玩家。真实双部位/历史比较需要正式扩展绑定和事实合同，不能由常量拼接代替。\n\n':''}## 验证\n\n官方作者格式和模板转换通过。每条有满槽、全可选空槽、各可选组合、必需词缺失与真实出口缺失检查；带感官槽的模板测试五种通道；带身体槽的模板测试错误归属和错误材质实例。完整报告和可复跑输入在本目录fixtures及validation-report.json。\n\n## 实际拼装预览\n\n${perTemplate}`;
  await fs.writeFile(path.join(out,name+'.md'),md);
}
await fs.writeFile(path.join(out,'fixtures/catalog.json'),JSON.stringify(catalog,null,2)+'\n');
await fs.writeFile(path.join(out,'fixtures/replay-inputs.json'),JSON.stringify(replayInputs)+'\n');
await fs.writeFile(path.join(out,'fixtures/case-results.json'),JSON.stringify(results,null,2)+'\n');
const replay=`import fs from 'node:fs/promises';\nimport assert from 'node:assert/strict';\nimport {assembleProse} from '../../../production/tag-matrices/assembly.mjs';\nconst read=async name=>JSON.parse(await fs.readFile(new URL(name,import.meta.url),'utf8'));\nconst catalog=await read('catalog.json'),cases=await read('replay-inputs.json');\nfor(const c of cases){const result=assembleProse({catalog,assemblyRuleId:c.assemblyRuleId,lexemes:c.lexemes,context:c.context});assert.deepEqual({mode:result.mode,text:result.text,reason:result.reason??null},c.expected,'case '+c.caseId);}\nconsole.log(JSON.stringify({cases:cases.length,status:'passed',scope:'synthetic-reference-only'}));\n`;
await fs.writeFile(path.join(out,'fixtures/replay.mjs'),replay);
const report={date:'2026-10-15',scope:'authoring-template-review-and-synthetic-reference-validation',runtimeInstalled:false,
  originalAudit,templates:54,byTask:Object.fromEntries(revised.map(x=>[x.data.task,x.data.entries.length])),previews:revised.reduce((n,x)=>n+x.data.handPreviews.length,0),
  validationCases:results.length,byMode:Object.fromEntries(['assembled','fallback','blocked'].map(mode=>[mode,results.filter(r=>r.mode===mode).length])),
  currentSpecVersion:'1.3',officialAuthoringValidation:'passed',sourceBHash:digest(bSourceBytes),sourceBHoldsUnchanged:true,
  originalFiles:originals.flatMap(o=>[{file:o.name+'.json',sha256:digest(o.json)},{file:o.name+'.md',sha256:digest(o.md)}]),outputHashes,
  limitations:['pair is a same-part observation, not an unsupported two-part comparison','delta does not establish historical change','template classifications do not implement services, quests, injuries, combat results or relationship outcomes'],changes};
await fs.writeFile(path.join(out,'validation-report.json'),JSON.stringify(report,null,2)+'\n');
await fs.writeFile(path.join(out,'README.md'),`# A系列模板修订版\n\n2026-10-15。A1 18条、A2 30条、A3 6条，共54条，全部保留稳定ID并通过v1.3作者格式校验。\n\n已修复通道混用、无效绑定、独立定词主槽、对象归属、无证据的动作/业务状态推断及回退语义。六份JSON/MD为修订交付，108条预览均由参考拼装器生成。共${results.length}项验证，输入与输出记录在fixtures。\n\n原pair的双部位比较缺少当前规范支持，本版改为同部件材质定位；delta不证明历史变化，selfcheck不默认等于玩家身体。这些限制已在A3说明列明。\n\n本次是模板检查和修订，没有安装到游戏。B批原稿仍保留hold，测试仅使用一次性synthetic假设副本，没有改变原始稿件、现有游戏接入或存档。原六份文件未覆盖。\n\n在项目根目录用Node24运行：node deliverables/A-templates-reviewed-2026-10-15/fixtures/replay.mjs，可独立复跑全部参考拼装测试。\n`);
for(const o of originals){assert.equal(digest(await fs.readFile(path.join(source,o.name+'.json'))),digest(o.json));assert.equal(digest(await fs.readFile(path.join(source,o.name+'.md'))),digest(o.md));}
assert.equal(digest(await fs.readFile('content/prose/b-authoring-v2.json')),digest(bSourceBytes));
console.log(JSON.stringify({out,templates:54,previews:report.previews,validationCases:report.validationCases,byMode:report.byMode,officialValidation:'passed',originalFilesUnchanged:true},null,2));
