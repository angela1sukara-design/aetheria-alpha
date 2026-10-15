import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {assembleProse,SLOT_TYPES,validateAssemblyCatalog,validateLexeme,parseSlotOrder} from '../production/tag-matrices/assembly.mjs';
const read=async name=>JSON.parse(await readFile('production/tag-matrices/'+name,'utf8'));
const base=await read('assembly-rules.json'),example=await read('assembly-example.json');
function fixture(){const c=structuredClone(base);c.rules.push(structuredClone(example.rule));return {catalog:c,assemblyRuleId:example.rule.id,lexemes:structuredClone(example.lexemes),context:structuredClone(example.context)};}
const run=change=>{const f=fixture();change?.(f);return assembleProse(f);};
const word=(f,id)=>f.lexemes.find(e=>e.id==='example:word.'+id);
test('八槽有序拼装与斜杠顺序，中性完整正文含实际免费出口',()=>{
 const r=run();assert.equal(r.mode,'assembled');assert.equal(new Set(r.selected.map(s=>s.slot)).size,8);assert.ok(r.text.startsWith('在工坊，阿洛·灰谷的手仍保持原状。'));assert.ok(r.text.includes('旁边放着一只量杯，里面盛着过滤水，空气中带着草木的清香。'));assert.ok(r.text.endsWith('你可以结束观察。'));assert.equal(r.exitChoice.actionId,'example:exit');assert.deepEqual(parseSlotOrder(example.slashOrder),example.rule.proseTemplate.map(t=>t.slot));assert.throws(()=>parseSlotOrder('place//actionCore'));assert.throws(()=>parseSlotOrder('手/爪/触手'));assert.throws(()=>parseSlotOrder('place/unknown'));
});
test('冻结槽名、重复key、正文回退及词条元数据严格校验',()=>{
 const f=fixture();validateAssemblyCatalog(f.catalog);for(const e of f.lexemes)validateLexeme(e);
 for(const change of [c=>c.slots.push('clothing'),c=>c.rules.at(-1).proseTemplate[0].key='actor',c=>c.rules.at(-1).prose='',c=>c.rules.at(-1).proseTemplate[0].slot='unknown',c=>c.selection.cartesianEnumeration=true,c=>c.selection.maxSteps=129]){const c=structuredClone(f.catalog);change(c);assert.throws(()=>validateAssemblyCatalog(c));}
 assert.throws(()=>validateLexeme({...f.lexemes[0],allowedSlots:['unknown']}));assert.throws(()=>validateLexeme({...f.lexemes[0],priority:Infinity}));
});
test('九类共享规则均可由同一快照选择各自所需槽；结构审计无假正文',()=>{
 for(const r of base.rules){const f=fixture();f.assemblyRuleId=r.id;const result=assembleProse(f);assert.equal(result.mode,r.mode==='auditOnly'?'auditOnly':'assembled',r.id);if(r.mode==='prose')assert.ok(result.exitChoice);}
});
test('必需词缺失整段回退，禁止漏槽、半句或非法词条占位',()=>{
 const r=run(f=>{f.lexemes=f.lexemes.filter(e=>!e.allowedSlots.includes('bodyPart'));});assert.equal(r.mode,'fallback');assert.equal(r.text,example.rule.prose);assert.deepEqual(r.exitChoice,{actionId:'example:exit',label:'结束观察'});
 const bad=run(f=>{word(f,'hand').text='{part}';});assert.equal(bad.mode,'fallback');assert.ok(bad.trace.some(t=>t.reason.startsWith('INVALID_LEXEME')));
});
test('可选槽连同连接词和标点整体省略',()=>{
 const r=run(f=>{word(f,'scent').review='hold';});assert.equal(r.mode,'assembled');assert.ok(!r.text.includes('空气中带着'));assert.ok(!r.text.includes('空气中带着。'));assert.ok(r.text.endsWith('你可以结束观察。'));
});
test('事实未知或来自正文不入候选，关键信息不足走回退',()=>{
 for(const source of ['prose','lexeme']){const r=run(f=>{f.context.facts['part.kind'].source=source;});assert.equal(r.mode,'fallback');}
 assert.equal(run(f=>{f.context.facts['part.kind'].known=false;}).mode,'fallback');
});
test('词条错槽/未审定/停用/未知Tag不能靠优先级挤入',()=>{
 for(const change of [e=>e.allowedSlots=['propEnv'],e=>e.review='hold',e=>e.status='inactive',e=>e.tagIds=['unknown:tag']]){const r=run(f=>{const e=word(f,'place');e.priority=1000;change(e);});assert.equal(r.mode,'fallback');}
});
test('不能使用其他实例的部件；身体所有者与绑定对象一致',()=>{
 assert.equal(run(f=>{word(f,'hand').binding.instanceId='someone-else-hand';}).mode,'fallback');
 const r=run(f=>{f.context.bindings.part.subject='resident:other';word(f,'hand').binding.subject='resident:other';});assert.equal(r.mode,'fallback');
});
test('双向互斥在后续槽发现后有限回溯到真正合法候选',()=>{
 for(const direction of ['early','late']){const r=run(f=>{word(f,'action.a').priority=1000;word(f,'action.b').priority=1;if(direction==='early')word(f,'action.a').excludes=[word(f,'prop').id];else word(f,'prop').excludes=[word(f,'action.a').id];});assert.equal(r.mode,'assembled');assert.ok(r.selected.some(s=>s.entryId==='example:word.action.b'));assert.ok(r.trace.some(t=>t.reason==='MUTUAL_EXCLUSION'));}
});
test('定词挂前、实例一致、缺失回退与防重复前缀',()=>{
 assert.ok(run().text.includes('过滤水'));assert.ok(!run().text.includes('水过滤'));
 const bare=run(f=>{word(f,'filtered').binding.instanceId='other-water';});assert.equal(bare.mode,'assembled');assert.ok(!bare.text.includes('过滤水'));
 const required=run(f=>{f.catalog.rules.at(-1).proseTemplate.find(t=>t.slot==='materialFluid').prefixPools[0].required=true;word(f,'filtered').review='hold';});assert.equal(required.mode,'fallback');
 const duplicate=run(f=>{word(f,'water').text='过滤水';});assert.equal(duplicate.mode,'assembled');assert.ok(!duplicate.text.includes('过滤过滤水'));assert.ok(duplicate.trace.some(t=>t.reason==='DUPLICATE_PREFIX'));
});
test('同实例同组异值不能同时入槽，跨实例互斥不串线',()=>{
 const r=run(f=>{word(f,'water').exclusive=[{group:'word-form',value:'plain'}];word(f,'filtered').exclusive=[{group:'word-form',value:'qualified'}];});assert.equal(r.mode,'assembled');assert.ok(!r.selected.some(s=>s.entryId==='example:word.filtered'));
});
test('身体材料与部位同实例，不借用环境流体；重复出现位不能覆盖内部定词key',()=>{
 const f=fixture();f.assemblyRuleId='assembly.domain.08';let r=assembleProse(f);assert.equal(r.mode,'assembled');assert.ok(!r.text.includes('水'));
 const material={...structuredClone(word(f,'water')),id:'example:word.body-material',text:'黄铜',poolIds:['body.material'],binding:structuredClone(f.context.bindings.part),requires:[{fact:'part.material',comparison:'eq',value:'brass'}]};f.context.facts['part.material']={known:true,value:'brass',source:'engine-query'};f.lexemes.push(material);r=assembleProse(f);assert.equal(r.mode,'assembled');assert.ok(r.text.includes('其表面呈现黄铜的质感。'));
 material.binding.instanceId='other-hand';r=assembleProse(f);assert.ok(!r.text.includes('黄铜'));
 const c=structuredClone(base);c.rules[1].proseTemplate[0].key='material.prefix.0';assert.throws(()=>validateAssemblyCatalog(c));
});
test('搜索预算有硬上限，耗尽使用完整普通回退',()=>{
 const f=fixture();f.catalog.selection.maxSteps=1;const r=assembleProse(f);assert.equal(r.mode,'fallback');assert.equal(r.reason,'SEARCH_BUDGET_EXHAUSTED');assert.equal(r.steps,1);
});
test('相同输入稳定且不改任何状态，等优先级词在不同seed下有变化',()=>{
 const f=fixture(),before=structuredClone(f),a=assembleProse(f),b=assembleProse(f);assert.deepEqual(a,b);assert.deepEqual(f,before);const texts=new Set();for(let seed=0;seed<32;seed++)texts.add(run(f=>{f.context.seed=seed;}).text);assert.ok(texts.size>1);
});
function optional(f){f.catalog.rules.at(-1).contentTier='adult_optional';f.context.policy.adultOptional=true;f.context.policy.consentBySubject={'resident:alo':{value:true,revision:f.context.revision,source:'event-choice'}};}
test('T32按绑定对象及revision核对意愿，未通过仅普通回退',()=>{
 assert.equal(run(optional).mode,'assembled');
 for(const change of [f=>{f.context.policy.adultOptional=false;},f=>{f.context.policy.consentBySubject={};},f=>{f.context.policy.consentBySubject['resident:alo'].revision--;},f=>{f.context.participants[0].present=false;}]){const r=run(f=>{optional(f);change(f);});assert.equal(r.mode,'fallback');assert.ok(r.reason.startsWith('T32'));assert.equal(r.text,example.rule.prose);}
});
test('T34普通动物仅普通流程；未知或非智慧对象不得进入可选成人流程',()=>{
 const ordinary=run(f=>{f.context.participants[0].classification='animal';f.context.participants[0].intelligent=false;});assert.equal(ordinary.mode,'assembled');
 for(const classification of ['animal','unknown']){const r=run(f=>{optional(f);f.context.participants[0].classification=classification;f.context.participants[0].intelligent=false;});assert.equal(r.mode,'fallback');assert.ok(r.reason.startsWith('T34'));}
});
test('普通模板不能混进其他分级词，回退不能标成成人',()=>{
 assert.equal(run(f=>{word(f,'place').contentTier='adult_optional';}).mode,'fallback');
 assert.throws(()=>{const c=structuredClone(base);c.rules[1].fallbackTier='adult_optional';validateAssemblyCatalog(c);});
});
test('免费出口须真实且零条件零费用，正文层不能凭空发明按钮',()=>{
 for(const change of [f=>{f.context.exitChoice.conditions=[{op:'item.has'}];},f=>{f.context.exitChoice.effects=[{op:'clock.advance',minutes:1}];},f=>{delete f.context.exitChoice;}])assert.equal(run(change).mode,'blocked');
 assert.equal(run(f=>{word(f,'exit').actionId='example:other';}).mode,'fallback');
});
test('人物/地名从绑定快照动态读取，重名仍依实例ID区分且不改输入',()=>{
 const f=fixture(),before=structuredClone(f);assert.ok(assembleProse(f).text.includes('阿洛·灰谷'));assert.deepEqual(f,before);
 f.context.displayValues[0].name='河岸集市';f.context.displayValues[1].name='林清岚';assert.ok(assembleProse(f).text.startsWith('在河岸集市，林清岚的手'));
 f.context.displayValues.push({...structuredClone(f.context.displayValues[1]),binding:{subject:'resident:other',instanceId:'resident:other'},name:'同名者'});assert.ok(assembleProse(f).text.includes('林清岚'));assert.ok(!assembleProse(f).text.includes('同名者'));
});
test('名称缺失、过期、同实例重复、来自正文或模板标记时整段回退',()=>{
 for(const change of [f=>{f.context.displayValues=[];},f=>{f.context.displayValues[1].revision--;},f=>{f.context.displayValues.push(structuredClone(f.context.displayValues[1]));},f=>{f.context.displayValues[1].source='prose';},f=>{f.context.displayValues[1].name='{other.name}';},f=>{f.context.displayValues[1].binding.instanceId='wrong';}]){const r=run(change);assert.equal(r.mode,'fallback');assert.equal(r.text,example.rule.prose);assert.ok(r.trace.some(t=>t.reason==='UNKNOWN_BOUND_NAME'));}
});
test('动态名称仅允许place/opponentForm主词，拒绝任意路径与双重定义',()=>{
 const f=fixture(),actor=word(f,'actor');assert.throws(()=>validateLexeme({...actor,text:'写死姓名'}));assert.throws(()=>validateLexeme({...actor,displayRef:{field:'state.currentResident.name'}}));assert.throws(()=>validateLexeme({...actor,allowedSlots:['bodyPart']}));
});
