import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {logic,samePartMatch,resolveTag,generationEligibility,checkExclusive,locationService,validateTraits,safeExit,rankCandidates,conversationActor,relationshipCandidates,checkEditorialHint} from '../production/tag-matrices/evaluate.mjs';
import {traits,facilities,domains} from '../production/tag-matrices/spec.mjs';
import {checkTagMatrices} from '../scripts/check-tag-matrices.mjs';
import {serviceAvailable} from '../src/engine/entity-functions.ts';
const yes={known:true,value:true},no={known:true,value:false},unknown={known:false,reason:'未知'};
test('三值逻辑九组合与否定：unknown 不开门',()=>{
 const vals=[yes,no,unknown];for(const a of vals)for(const b of vals){const all=logic('all',[a,b]),any=logic('any',[a,b]);assert.deepEqual(all,a===no||b===no?no:a===unknown||b===unknown?{known:false,reason:'存在未知条件'}:yes);assert.deepEqual(any,a===yes||b===yes?yes:a===unknown||b===unknown?{known:false,reason:'存在未知条件'}:no);}assert.deepEqual(logic('not',[unknown]),unknown);assert.deepEqual(logic('not',[yes]),no);
});
test('同一部件和目标绑定：机械臂不能拼有机尾巴',()=>{
 const entity={parts:[{kind:'arm',materialId:'metal',lengthMm:900},{kind:'tail',materialId:'organic',lengthMm:1200}]};
 assert.equal(samePartMatch(entity,{kind:'tail',materialId:'metal'}).value,false);assert.equal(samePartMatch(entity,{kind:'arm',materialId:'metal',minLengthMm:800}).value,true);assert.equal(samePartMatch(undefined,{kind:'tail'}).known,false);
});
test('作用域内互斥允许跨对象/时刻共存',()=>{
 const a={subject:'resident:a',instance:'tail',field:'material',at:10,value:'metal'};
 assert.equal(checkExclusive([a,{...a,value:'organic'}]).length,1);assert.equal(checkExclusive([a,{...a,subject:'resident:b',value:'organic'},{...a,at:11,value:'organic'}]).length,0);
});
test('Tag 别名精确范围、未知、歧义与废弃拒绝',()=>{
 const tags=[{id:'x:a',status:'active',aliases:[{scope:'generation.v1',value:'old'}]},{id:'x:b',status:'deprecated',aliases:[]}];assert.equal(resolveTag(tags,'old','generation.v1'),'x:a');assert.throws(()=>resolveTag(tags,'old','story.v1'));assert.throws(()=>resolveTag(tags,'x:b','story.v1'));assert.throws(()=>resolveTag([...tags,{...tags[0],id:'x:c'}],'old','generation.v1'));
});
test('生成硬条件、局部/全局、依赖及双向模板排斥',()=>{
 const t={id:'place',environmentTags:['wet'],requiresTags:['market'],excludesTags:['risk'],compatibleTags:['trade'],requiresPacks:['pack'],combination:{requiresTemplates:['env'],excludesTemplates:['hostile']}};
 const c={environmentTags:['wet'],tags:['market','trade'],templates:['env'],packs:['pack']};assert.equal(generationEligibility(t,c).eligible,true);
 for(const changed of [{environmentTags:['dry']},{tags:['trade']},{tags:['market','trade','risk']},{tags:['market']},{templates:[]},{packs:[]},{templates:['env','hostile']},{selectedDefinitions:[{id:'other',combination:{excludesTemplates:['place']}}]}])assert.equal(generationEligibility(t,{...c,...changed}).eligible,false,JSON.stringify(changed));
});
test('权重与 priority 不救回非法/未知候选，输入不变',()=>{
 const candidates=[{id:'bad',eligible:false,weight:1e9,priority:1e9},{id:'unknown',weight:1e9},{id:'zero',eligible:true,weight:0},{id:'b',eligible:true,weight:1,priority:1},{id:'a',eligible:true,weight:1,priority:1}];const before=structuredClone(candidates);assert.deepEqual(rankCandidates(candidates).map(c=>c.id),['a','b']);assert.deepEqual(candidates,before);
});
test('128设施组合×2体力×8服务与实际执行器完全一致',()=>{
 let checks=0;for(let mask=0;mask<2**facilities.length;mask++){const fs=facilities.filter((_,i)=>mask&(1<<i));for(const stamina of [100,7])for(const service of ['rest','sleep','care','work','train','publicDesk','light','wait']){const state={world:{locationId:'test:place'},player:{variables:{'core:stamina':stamina}}},registry={location:()=>({facilities:fs})};assert.equal(locationService(service,fs,stamina),serviceAvailable(state,registry,{subject:'location',service}));checks++;}}assert.equal(checks,2048);
});
test('六性格集合校验不允许身体标签、重复或废弃',async()=>{
 const tags=JSON.parse(await readFile('content/personality/pack.json','utf8')).tags;assert.equal(validateTraits(traits,tags,traits),true);assert.equal(validateTraits([],tags,traits),true);assert.equal(validateTraits([traits[0],traits[0]],tags,traits),false);assert.equal(validateTraits(['foundation:body.has-tail'],tags,traits),false);assert.equal(validateTraits([traits[0]],tags.map(t=>({...t,status:'deprecated'})),traits),false);
});
test('conversation 仅绑定原居民，离场/战败不读选中人',()=>{
 const residents=[{id:'a',locationId:'here'},{id:'b',locationId:'there'}];assert.equal(conversationActor({kind:'conversation',actor:{kind:'resident',id:'a'}},residents,'here')?.id,'a');assert.equal(conversationActor({kind:'conversation',actor:{kind:'resident',id:'b'}},residents,'here'),undefined);assert.equal(conversationActor({kind:'defeat',actor:{kind:'resident',id:'a'}},residents,'here'),undefined);
});
test('免费退出必须无条件无效果且终止，收费/有门槛均拒绝',()=>{
 const c={conditions:[],effects:[],setTags:[],unsetTags:[],next:null};assert.equal(safeExit(c),true);assert.equal(safeExit({...c,effects:[{op:'clock.advance',minutes:1}]}),false);assert.equal(safeExit({...c,conditions:[{op:'conversation.present'}]}),false);assert.equal(safeExit({...c,next:'deepen'}),false);
});
test('九大类依赖 DAG 无悬空或循环，P0在前',()=>{
 const seen=new Set();for(const d of domains){for(const dep of d.dependencies)assert.ok(seen.has(dep),d.id+':'+dep);seen.add(d.id);}assert.equal(domains.slice(0,3).every(d=>d.priority==='P0'),true);
});
test('关系详细门槛1152边界组合，候选并存但不修改stage',()=>{
 let checked=0;for(const affection of [0,29,30,69,70,100])for(const submission of [0,29,30,69,70,100])for(const corruption of [0,29,30,49,50,69,70,100])for(const trust of [9,10])for(const visits of [0,1]){const input={affection,submission,corruption,trust,visits},before=structuredClone(input),result=relationshipCandidates(input);assert.equal(result.known,true);assert.equal(result.value.includes('lover'),affection>=70&&trust>=10&&corruption<50);assert.equal(result.value.includes('submissive'),submission>=70);assert.equal(result.value.includes('corrupted'),corruption>=70);assert.equal(result.value.includes('close'),Math.max(affection,submission,corruption)>=30);assert.equal(result.value.includes('acquaintance'),visits>=1);assert.deepEqual(input,before);checked++;}assert.equal(checked,1152);assert.equal(relationshipCandidates({}).known,false);assert.throws(()=>relationshipCandidates({affection:101,submission:0,corruption:0,trust:0,visits:0}));
});
test('全部787细分提示：对象绑定、未知、效果隔离和20个参数单位',async()=>{
 const hints=JSON.parse(await readFile('production/tag-deliveries/2026-10-12/general-expansion-v2/rule-hints.json','utf8'));let numeric=0;
 for(const hint of hints){const input={subjectKind:hint.allowedSubjectKinds[0],bindings:Object.fromEntries(hint.requiredBindings.map(k=>[k,'instance:'+k])),value:hint.value.type==='number'?10:'known',unit:hint.value.unit};assert.equal(hint.runtimeExecutable,false);assert.equal(checkEditorialHint(hint,input).value,true);assert.equal(checkEditorialHint(hint,{...input,bindings:{}}).known,false);assert.equal(checkEditorialHint(hint,{...input,value:null}).known,false);assert.equal(checkEditorialHint(hint,{...input,subjectKind:'unsupported-kind'}).value,false);assert.equal(checkEditorialHint(hint,{...input,attemptEffects:true}).value,false);if(hint.value.type==='number'){numeric++;assert.equal(checkEditorialHint(hint,{...input,unit:'wrong'}).value,false);assert.equal(checkEditorialHint(hint,{...input,value:'10'}).value,false);}}
 assert.equal(hints.length,787);assert.equal(numeric,20);
});
test('全部交付读回：源项、Tag、矩阵、内嵌全文和ZIP一致',async()=>{const report=await checkTagMatrices();assert.equal(report.status,'passed');assert.equal(report.matrices,9);assert.ok(report.cells>5000);assert.ok(report.embeddedFiles>300);});
