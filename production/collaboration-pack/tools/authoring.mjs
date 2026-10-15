import {createHash} from 'node:crypto';
import {validateLexeme,validateAssemblyCatalog} from '../../tag-matrices/assembly.mjs';
import {proseProblem} from '../../../src/content/player-prose.ts';
export const digest=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const same=(a,b)=>a?.subject===b?.subject&&a?.instanceId===b?.instanceId;
export function assertSchema(value,root){
 const fail=(at,msg)=>{throw Error(at+': '+msg);};
 function check(v,s,at){
  if(s.$ref){let target=root;for(const key of s.$ref.replace(/^#\//,'').split('/'))target=target?.[key];if(!target)fail(at,'未知Schema引用');return check(v,target,at);}
  if(s.anyOf){if(!s.anyOf.some(branch=>{try{check(v,branch,at);return true;}catch{return false;}}))fail(at,'不符合任一允许格式');return;}
  if('const'in s&&v!==s.const)fail(at,'常量不符');if(s.enum&&!s.enum.includes(v))fail(at,'枚举值无效');
  const type=Array.isArray(v)?'array':v===null?'null':typeof v==='number'&&Number.isInteger(v)?'integer':typeof v;
  if(s.type&&![].concat(s.type).some(t=>t===type||t==='number'&&type==='integer'))fail(at,'类型无效');
  if(typeof v==='string'){if(s.minLength!==undefined&&v.trim().length<s.minLength)fail(at,'空文字');if(s.maxLength!==undefined&&v.length>s.maxLength)fail(at,'文字过长');if(s.pattern&&!new RegExp(s.pattern).test(v))fail(at,'格式无效');}
  if(typeof v==='number'&&(!Number.isFinite(v)||s.minimum!==undefined&&v<s.minimum||s.maximum!==undefined&&v>s.maximum))fail(at,'数值超界');
  if(Array.isArray(v)){if(s.minItems!==undefined&&v.length<s.minItems||s.maxItems!==undefined&&v.length>s.maxItems)fail(at,'数量无效');if(s.uniqueItems&&new Set(v.map(x=>JSON.stringify(x))).size!==v.length)fail(at,'重复值');if(s.items)v.forEach((x,i)=>check(x,s.items,at+'/'+i));}
  if(type==='object'){for(const k of s.required??[])if(!Object.hasOwn(v,k))fail(at+'/'+k,'缺字段');for(const [k,x]of Object.entries(v)){if(s.additionalProperties===false&&!Object.hasOwn(s.properties??{},k))fail(at+'/'+k,'未知字段');if(s.properties?.[k])check(x,s.properties[k],at+'/'+k);}}
 }
 check(value,root,'$');return value;
}
export function validateWord(entry,bundle){
 assertSchema(entry,bundle.schemas.word);
 if(entry.text.length>80||proseProblem(entry.text)||/[<>\r\n]/.test(entry.text))throw Error('词条文字过长或含制作标记/代码边界');
 const p=bundle.pools.pools.find(p=>p.id===entry.poolIds[0]);
 if(!p?.authoringTarget||p.slot!==entry.allowedSlots[0]||p.subjectType!==entry.binding.subjectType||p.role!==entry.role)throw Error('词池/槽/主体/角色不符');
 if(entry.review==='draft'&&(!entry.requires.length||entry.pendingFacts.length))throw Error('draft 必须有已登记查询前置且没有待补语义事实');
 if(entry.review==='hold'&&!entry.pendingFacts.length)throw Error('hold 必须列出待补语义事实');
 if(entry.role==='qualifier'&&entry.text.endsWith('的'))throw Error('定词不带结尾“的”，由qualifierPlan连接符决定');
 for(const c of entry.requires){const f=bundle.facts.facts.find(f=>f.id===c.fact);if(!f)throw Error('未知事实键；按hold列语义需求，不猜事实名');if(c.comparison==='exists'){if(Object.hasOwn(c,'value'))throw Error('exists 不携带 value');}else {if(!Object.hasOwn(c,'value')||typeof c.value!==f.valueType)throw Error('事实值类型不符');if(f.values&&!f.values.includes(c.value))throw Error('事实枚举不符');if(['gte','lte'].includes(c.comparison)&&f.valueType!=='number')throw Error('数值比较不能用于非数值事实');}}
 for(const id of entry.tagIds)if(!bundle.tags.tags.some(t=>t.canonicalId===id&&t.status==='active'))throw Error('Tag未登记或未启用');
 return entry;
}
export function convertTemplate(entry,bundle){
 assertSchema(entry,bundle.schemas.template);const rule=structuredClone(entry);delete rule.qualifierPlan;
 if(entry.proseTemplate.some(t=>/昨天|刚才|记忆中|角落里|还没散去|袖口|手套|靴尖/.test(t.prefix+t.suffix)))throw Error('连接文字夹带未证明的场景/历史/身体事实');
 const keys=new Set();for(const token of rule.proseTemplate){if(keys.has(token.key))throw Error('重复出现位');keys.add(token.key);const p=bundle.pools.pools.find(p=>p.id===token.poolId);if(!p||p.slot!==token.slot||p.subjectType!==bundle.pools.bindingRoles[token.bindTo]||p.role!=='core')throw Error('模板池/绑定类型不符');}
 const seen=new Set(),count=new Map();for(const q of entry.qualifierPlan){const t=rule.proseTemplate.find(t=>t.key===q.key),p=bundle.pools.pools.find(p=>p.id===q.poolId);if(!t||t.slot!=='materialFluid'||!p||p.role!=='qualifier'||p.subjectType!==bundle.pools.bindingRoles[t.bindTo])throw Error('定词必须属于同一材料槽的同类型实例');const expected=t.poolId==='body.material'?'body.material.qualifier':t.poolId==='material.current'?'material.qualifier':null;if(q.poolId!==expected)throw Error('定词池与主名池不配套');const key=q.key+':'+q.poolId;if(seen.has(key))throw Error('同一主名不得重复挂同一定词池');seen.add(key);count.set(q.key,(count.get(q.key)??0)+1);if(count.get(q.key)>2)throw Error('定词至多两组');(t.prefixPools??=[]).push({poolId:q.poolId,required:q.required,separator:q.separator});}
 rule.checks=['T32','T33','T34','T35','T36','T37'];const catalog={...bundle.baseCatalog,rules:[rule]};validateAssemblyCatalog(catalog);return rule;
}
export function validateDelivery(data,bundle){
 assertSchema(data,bundle.schemas.delivery);if(![...bundle.pools.themes.list,'generic'].includes(data.theme))throw Error('未知主题');
 const ids=new Set();for(const e of data.entries){if(ids.has(e.id))throw Error('本批ID重复');ids.add(e.id);if(e.id.startsWith('word.'))validateWord(e,bundle);else convertTemplate(e,bundle);if(data.task.startsWith('A')&&!e.id.startsWith('assembly.')||data.task.startsWith('B')&&!e.id.startsWith('word.'))throw Error('任务与条目类型不符');}
 const domains={A1:['01','03','05'],A2:['02','04','06','07','09'],A3:['08']};if(domains[data.task]&&data.entries.some(e=>!domains[data.task].includes(e.domain)))throw Error('任务大类不符');
 if(data.handPreviews.length<(data.task==='P0'?2:3))throw Error('手工预览数量不足');
 for(const p of data.handPreviews)if(p.mode==='manual'&&p.evidenceStatus!=='hypothetical-only'||p.mode==='reference-assembler'&&p.evidenceStatus!=='fixture-verified')throw Error('预览执行方式与证据状态不符');
 if(data.task.startsWith('A')&&data.entries.some(e=>data.handPreviews.filter(p=>p.templateId===e.id).length<2))throw Error('每条模板至少两条预览');
 for(const proposal of data.suggestedTags)validateProposal(proposal,bundle,data.entries);
 return data;
}
export function validateProposal(data,bundle,entries=[]){
 assertSchema(data,bundle.schemas.proposal);if(bundle.tags.tags.some(t=>t.canonicalId===data.proposedId||t.aliases.includes(data.proposedId)))throw Error('提案已存在');
 if(!/^general-taxonomy:(?:appearance|sound|weather|material|part|color|shape|surface|common\.(?:object|env|action|job|tool|facility)|expanded\.scent)\./.test(data.proposedId))throw Error('不在开放增量前缀内');
 if(data.closestExisting!=='none'&&!bundle.tags.tags.some(t=>t.canonicalId===data.closestExisting))throw Error('closestExisting不存在');
 if(data.mode==='attached'){if(data.neededByPools||data.themes||!data.neededByLexemes||data.neededByLexemes.length<3||data.neededByLexemes.some(id=>!entries.some(e=>e.id===id)))throw Error('随批模式必须引用本批至少3条真实词条');}
 else if(data.neededByLexemes||!data.neededByPools?.length||!data.themes||data.themes.length<2||data.neededByPools.some(id=>!bundle.pools.pools.some(p=>p.id===id))||data.themes.some(t=>!bundle.pools.themes.list.includes(t)))throw Error('先行模式需要合法词池和至少2个主题');
 return data;
}
export function validateTagBatch(data,bundle){assertSchema(data,bundle.schemas.tagBatch);const ids=new Set();for(const p of data.suggestedTags){if(p.mode!=='advance')throw Error('T1只收advance；attached随B系列交付');if(ids.has(p.proposedId))throw Error('本批提案ID重复');ids.add(p.proposedId);validateProposal(p,bundle);}return data;}
/** 只为给定中性测试快照转换；不创建人物、物件、动作或生产批准记录。 */
export function convertFixture(deliveries,plan,context,bundle){
 if(plan.authority!=='fixture-review-only'||plan.runtimeIntegrated!==false)throw Error('工具只接受明确的测试整合计划');
 const lexemes=[],rules=[],held=[],seen=new Set();
 for(const data of deliveries){validateDelivery(data,bundle);for(const e of data.entries){if(seen.has(e.id))throw Error('跨批ID冲突');seen.add(e.id);if(e.id.startsWith('assembly.')){rules.push(convertTemplate(e,bundle));continue;}if(e.review==='hold'||e.status!=='active'){held.push(e.id);continue;}
  const approval=plan.approvals.find(a=>a.entryId===e.id);if(!approval||approval.sha256!==digest(e))throw Error('缺少匹配当前稿件的独立测试审稿记录');
  const binding=context.bindings[approval.bindingKey];if(!binding||context.bindingTypes[approval.bindingKey]!==e.binding.subjectType)throw Error('精确实例/类型缺失');
  for(const c of e.requires){const definition=bundle.facts.facts.find(f=>f.id===c.fact);if(!approval.semanticFacts.includes(c.fact))throw Error('语义前置未审查');const f=context.facts[c.fact];if(f&&!same(f.binding,context.bindings[definition.bindingKey]))throw Error('事实记录绑定串线');if(definition.bindingKey!==approval.bindingKey){const other=context.bindings[definition.bindingKey];if(!approval.relatedBindings?.includes(definition.bindingKey)||!other)throw Error('跨对象事实缺少明确关系审查');}}
  const word=structuredClone(e);delete word.pendingFacts;word.binding=structuredClone(binding);word.review='approved';const p=bundle.pools.pools.find(p=>p.id===word.poolIds[0]);word.poolIds.push(...p.runtimeAlsoIn??[]);validateLexeme(word);lexemes.push(word);
 }}
 for(const [key,poolId,slot]of [['place','place.current','place'],['actor','actor.name','opponentForm'],['exit','exit.current','exitChoice']]){const binding=context.bindings[key];if(!binding)continue;const common={id:'runtime:display.'+key,allowedSlots:[slot],poolIds:[poolId],priority:500,review:'approved',status:'active',role:'core',binding:structuredClone(binding),requires:[],excludes:[],exclusive:[],contentTier:'general',tagIds:[]};lexemes.push(key==='exit'?{...common,text:context.exitChoice?.label??'无出口',actionId:context.exitChoice?.actionId??'invalid'}:{...common,displayRef:{field:'name'}});}
 const catalog={...structuredClone(bundle.baseCatalog),rules};validateAssemblyCatalog(catalog);return {catalog,lexemes,held,scope:'fixture-only',runtimeIntegrated:false};
}
