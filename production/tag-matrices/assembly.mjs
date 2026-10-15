import {proseProblem} from '../../src/content/player-prose.ts';
import {rules as sharedRules} from './spec.mjs';

export const SLOT_TYPES=Object.freeze(['place','propEnv','bodyPart','senseMod','actionCore','materialFluid','opponentForm','exitChoice']);
const TIERS=['general','adult_optional'];
const own=(o,k)=>Object.prototype.hasOwnProperty.call(o,k);
const object=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
function shape(value,keys,name){if(!object(value)||Object.keys(value).some(k=>!keys.includes(k)))throw Error('无效字段：'+name);}
function text(value,name){if(typeof value!=='string'||!value.trim()||proseProblem(value))throw Error('无效文字：'+name);}
function integer(value,min,max,name){if(!Number.isInteger(value)||value<min||value>max)throw Error('无效数值：'+name);}
function strings(values,name){if(!Array.isArray(values)||values.some(x=>typeof x!=='string'||!x.trim())||new Set(values).size!==values.length)throw Error('无效列表：'+name);}
const bindingEqual=(a,b)=>object(a)&&object(b)&&a.subject===b.subject&&a.instanceId===b.instanceId;
function binding(value){shape(value,['subject','instanceId'],'binding');text(value.subject,'subject');text(value.instanceId,'instanceId');}
const freeExit=choice=>object(choice)&&typeof choice.actionId==='string'&&choice.actionId.length>0&&typeof choice.label==='string'&&!proseProblem(choice.label)&&choice.next===null&&['conditions','effects','setTags','unsetTags'].every(k=>Array.isArray(choice[k])&&!choice[k].length);
export function validateAssemblyCatalog(catalog){
 shape(catalog,['format','schemaVersion','version','runtimeIntegrated','slots','selection','rules'],'catalog');
 if(catalog.format!=='aetheria-prose-assembly-rules'||catalog.schemaVersion!==1||catalog.runtimeIntegrated!==false)throw Error('制作格式或实施边界无效');
 if(JSON.stringify(catalog.slots)!==JSON.stringify(SLOT_TYPES))throw Error('八类槽必须保持冻结顺序与名称');
 shape(catalog.selection,['strategy','maxCandidatesPerSlot','maxSteps','tieBreak','cartesianEnumeration'],'selection');
 if(catalog.selection.strategy!=='bounded-lazy-search'||catalog.selection.cartesianEnumeration!==false||catalog.selection.tieBreak!=='seed-and-entry-id')throw Error('禁止笛卡尔穷举或未定义的抽样方式');
 integer(catalog.selection.maxCandidatesPerSlot,1,8,'maxCandidatesPerSlot');integer(catalog.selection.maxSteps,1,128,'maxSteps');
 if(!Array.isArray(catalog.rules)||!catalog.rules.length)throw Error('规则为空');
 const ids=new Set();
 for(const r of catalog.rules){
  shape(r,['id','domain','mode','contentTier','fallbackTier','proseTemplate','prose','checks'],'rule');text(r.id,'id');if(ids.has(r.id))throw Error('重复规则');ids.add(r.id);
  if(!['prose','auditOnly'].includes(r.mode)||!TIERS.includes(r.contentTier)||r.fallbackTier!=='general')throw Error('无效规则模式或回退分级');
  if(!Array.isArray(r.proseTemplate)||r.proseTemplate.length>16)throw Error('模板必须是有序槽数组，最多16个出现位');
  strings(r.checks,'checks');
  if(r.checks.some(id=>!sharedRules.some(rule=>rule.id===id)))throw Error('未知复核规则ID');
  if(r.mode==='auditOnly'){if(r.proseTemplate.length||r.prose!=='')throw Error('审计项不得伪造正文');continue;}
  text(r.prose,'prose fallback');if(!r.proseTemplate.length)throw Error('正文规则默认必须有proseTemplate');
  for(const id of ['T32','T33','T34','T35','T36','T37'])if(!r.checks.includes(id))throw Error('缺拼装复核：'+id);
  const keys=new Set();
  for(const t of r.proseTemplate){
   shape(t,['key','slot','poolId','bindTo','required','prefix','suffix','prefixPools','sameAs','subjectAs'],'token');
   for(const k of ['key','poolId','bindTo'])text(t[k],k);if(!/^[A-Za-z][\w-]*$/.test(t.key)||keys.has(t.key)||!SLOT_TYPES.includes(t.slot)||typeof t.required!=='boolean')throw Error('重复/保留出现位或未知槽');keys.add(t.key);
   for(const k of ['prefix','suffix'])if(typeof t[k]!=='string'||proseProblem(t[k]||' ' )&&t[k].trim())throw Error('无效连接文字');
   if(t.sameAs!==undefined)strings(t.sameAs,'sameAs');
   if(t.subjectAs!==undefined)strings(t.subjectAs,'subjectAs');
   if(t.prefixPools!==undefined){if(t.slot!=='materialFluid'||!Array.isArray(t.prefixPools)||t.prefixPools.length>2)throw Error('定词只能在materialFluid槽内挂前');for(const p of t.prefixPools){shape(p,['poolId','required','separator'],'prefixPool');text(p.poolId,'prefix poolId');if(typeof p.required!=='boolean'||!['','的'].includes(p.separator))throw Error('定词连接无效');}}
  }
  for(const t of r.proseTemplate)for(const key of [...t.sameAs??[],...t.subjectAs??[]])if(!keys.has(key)||key===t.key)throw Error('对象引用无效');
  if(!r.proseTemplate.some(t=>t.slot==='exitChoice'&&t.required))throw Error('缺必需免费退出槽');
 }
 return catalog;
}
export function validateLexeme(entry){
 shape(entry,['id','text','displayRef','allowedSlots','poolIds','priority','review','status','role','binding','requires','excludes','exclusive','contentTier','tagIds','actionId'],'lexeme');
 text(entry.id,'lexeme id');strings(entry.allowedSlots,'allowedSlots');strings(entry.poolIds,'poolIds');
 if(own(entry,'text')===own(entry,'displayRef'))throw Error('text 与 displayRef 必须二选一');
 if(entry.displayRef!==undefined){shape(entry.displayRef,['field'],'displayRef');if(entry.displayRef.field!=='name'||entry.role!=='core'||!entry.allowedSlots.length||entry.allowedSlots.some(s=>!['place','opponentForm'].includes(s)))throw Error('名称引用仅供地点或人物主词');}else text(entry.text,'lexeme text');
 if(entry.allowedSlots.some(s=>!SLOT_TYPES.includes(s)))throw Error('词条含未知槽');
 integer(entry.priority,-1000,1000,'priority');if(!['approved','hold'].includes(entry.review)||!['active','inactive'].includes(entry.status)||!['core','qualifier'].includes(entry.role)||!TIERS.includes(entry.contentTier))throw Error('词条审核/角色/分级无效');
 if(entry.role==='qualifier'&&(entry.allowedSlots.length!==1||entry.allowedSlots[0]!=='materialFluid'))throw Error('定词不新增第九槽');
 binding(entry.binding);if(!Array.isArray(entry.requires)||!Array.isArray(entry.exclusive))throw Error('必须声明前置与互斥');
 for(const c of entry.requires){shape(c,['fact','comparison','value'],'condition');text(c.fact,'fact');if(!['eq','gte','lte','exists'].includes(c.comparison))throw Error('条件操作无效');if(c.comparison!=='exists'&&!own(c,'value'))throw Error('缺条件参数');}
 strings(entry.excludes,'excludes');strings(entry.tagIds,'tagIds');
 for(const e of entry.exclusive){shape(e,['group','value'],'exclusive');text(e.group,'exclusive group');text(e.value,'exclusive value');}
 if(entry.actionId!==undefined)text(entry.actionId,'actionId');
 return entry;
}
function fact(context,key){const f=context.facts?.[key];return object(f)&&f.known===true&&['snapshot','engine-query','runtime'].includes(f.source)?f.value:undefined;}
function displayText(entry,context){
 if(!entry.displayRef)return entry.text;
 // 名称仅来自当前快照的精确实例，不解析任意属性路径或执行二次插值。
 const values=context.displayValues;if(!Array.isArray(values))return undefined;
 const matches=values.filter(v=>object(v)&&bindingEqual(v.binding,entry.binding));if(matches.length!==1)return undefined;
 const v=matches[0];if(v.revision!==context.revision||!['snapshot','engine-query'].includes(v.source)||typeof v.name!=='string'||!v.name.trim()||v.name.length>100||proseProblem(v.name)||/[<>\r\n]/.test(v.name))return undefined;
 return v.name;
}
function checks(entry,context){return entry.requires.every(c=>{const v=fact(context,c.fact);return v!==undefined&&(c.comparison==='exists'||c.comparison==='eq'&&v===c.value||c.comparison==='gte'&&typeof v==='number'&&v>=c.value||c.comparison==='lte'&&typeof v==='number'&&v<=c.value);});}
function gate(tier,context){
 if(tier==='general')return {pass:true};
 const subjects=new Set(['player',...Object.values(context.bindings??{}).map(b=>b.subject)]);
 if(context.policy?.adultOptional!==true||!Array.isArray(context.participants)||!context.participants.length||context.participants.some(p=>!subjects.has(p.id)||p.present!==true||context.policy?.consentBySubject?.[p.id]?.value!==true||context.policy.consentBySubject[p.id].revision!==context.revision||context.policy.consentBySubject[p.id].source!=='event-choice'))return {pass:false,reason:'T32：偏好、在场或绑定对象的当次意愿未确认'};
 if(!Array.isArray(context.participants)||!context.participants.length||context.participants.some(p=>p.classification!=='sapient'||p.intelligent!==true))return {pass:false,reason:'T34：普通动物或未知对象不能进入成人可选流程'};
 return {pass:true};
}
function hash(value){let h=2166136261;for(let i=0;i<value.length;i++)h=Math.imul(h^value.charCodeAt(i),16777619)>>>0;return h;}
function compatible(a,b){
 if(a.id!==b.id&&(a.excludes.includes(b.id)||b.excludes.includes(a.id)))return false;
 return !bindingEqual(a.binding,b.binding)||!a.exclusive.some(x=>b.exclusive.some(y=>x.group===y.group&&x.value!==y.value));
}
export function parseSlotOrder(slashOrder){
 if(typeof slashOrder!=='string'||!slashOrder.trim())throw Error('槽顺序为空');
 const slots=slashOrder.split('/').map(x=>x.trim());if(slots.some(s=>!SLOT_TYPES.includes(s)))throw Error('斜杠只分隔八种槽名，不解析自然语言或多选词');
 return slots;
}
export function assembleProse({catalog,assemblyRuleId,lexemes,context}){
 const trace=[];let steps=0,exhausted=false;
 const result=(mode,text,extra={})=>({mode,text,trace,steps,...extra});
 try{validateAssemblyCatalog(catalog);}catch(e){return result('blocked','',{reason:'INVALID_CATALOG:'+e.message});}
 const rule=catalog.rules.find(r=>r.id===assemblyRuleId);if(!rule)return result('blocked','',{reason:'UNKNOWN_RULE'});
 if(rule.mode==='auditOnly')return result('auditOnly','');
 // 退出独立于选词；若适配器没有提供真实免费出口，不能伪造一个按钮。
 if(!freeExit(context?.exitChoice))return result('blocked','',{reason:'NO_VERIFIED_FREE_EXIT'});
 const fallback=reason=>result('fallback',rule.prose,{reason,exitChoice:{actionId:context.exitChoice.actionId,label:context.exitChoice.label},assemblyRuleId});
 const initialGate=gate(rule.contentTier,context);if(!initialGate.pass)return fallback(initialGate.reason);
 if(!Number.isSafeInteger(context.revision)||context.revision<0||!Number.isInteger(context.seed)||context.seed<0||context.seed>0xffffffff||!object(context.bindings))return fallback('UNKNOWN_CONTEXT');
 if(!Array.isArray(lexemes))return fallback('INVALID_LEXEME_SET');
 const valid=[],ids=new Set();
 for(const entry of lexemes){try{validateLexeme(entry);if(ids.has(entry.id))return fallback('DUPLICATE_LEXEME_ID');ids.add(entry.id);valid.push(entry);}catch(e){trace.push({entryId:entry?.id??null,reason:'INVALID_LEXEME:'+e.message});}}
 const cache=new Map(),resolved=new Map();for(const e of valid)resolved.set(e.id,displayText(e,context));
 const candidates=(token,poolId,role)=>{const cacheKey=token.key+':'+poolId+':'+role;if(cache.has(cacheKey))return [...cache.get(cacheKey)];const pool=valid.filter(e=>{
  let reason;
  if(e.review!=='approved'||e.status!=='active')reason='UNREVIEWED_OR_INACTIVE';
  else if(!e.allowedSlots.includes(token.slot)||!e.poolIds.includes(poolId)||e.role!==role)reason='WRONG_SLOT_POOL_OR_ROLE';
  else if(!bindingEqual(e.binding,context.bindings[token.bindTo]))reason='WRONG_BOUND_INSTANCE';
  else if(resolved.get(e.id)===undefined)reason='UNKNOWN_BOUND_NAME';
  else if(e.tagIds.some(id=>!context.registeredTags?.some(t=>t.id===id&&t.status==='active')))reason='UNKNOWN_OR_INACTIVE_TAG';
  else if(!checks(e,context))reason='FACT_UNKNOWN_OR_FALSE';
  else if(rule.contentTier==='general'&&e.contentTier!=='general')reason='T32:TIER_ESCALATION';
  else if(!gate(e.contentTier,context).pass)reason='T32_OR_T34';
  else if(token.slot==='exitChoice'&&(e.actionId!==context.exitChoice.actionId||e.text!==context.exitChoice.label))reason='EXIT_MISMATCH';
  if(reason){if(e.poolIds.includes(poolId))trace.push({entryId:e.id,key:token.key,reason});return false;}return true;
 }).map(e=>({...e,text:resolved.get(e.id)})).sort((a,b)=>b.priority-a.priority||hash(context.seed+':'+assemblyRuleId+':'+token.key+':'+a.id)-hash(context.seed+':'+assemblyRuleId+':'+token.key+':'+b.id)||a.id.localeCompare(b.id,'en')).slice(0,catalog.selection.maxCandidatesPerSlot);cache.set(cacheKey,pool);return [...pool];};
 // 单次只检查一个候选，失败有限回溯；从不生成各槽组合的笛卡尔数组。
 const tasks=[];
 for(const token of rule.proseTemplate){
  for(const [i,p]of(token.prefixPools??[]).entries())tasks.push({token,poolId:p.poolId,key:token.key+'.prefix.'+i,required:p.required,role:'qualifier',separator:p.separator});
  tasks.push({token,poolId:token.poolId,key:token.key,required:token.required,role:'core',separator:''});
 }
 let final;
 function search(index,selected){
  if(exhausted)return false;
  if(index===tasks.length){
   const chosen=new Map(selected.map(s=>[s.task.key,s.entry]));
   if(selected.some(s=>s.entry&&s.task.role==='qualifier'&&!chosen.get(s.task.token.key)))return false;
   for(const token of rule.proseTemplate){const entry=chosen.get(token.key);if(!entry)continue;for(const key of token.sameAs??[]){const other=chosen.get(key);if(!other||!bindingEqual(entry.binding,other.binding))return false;}for(const key of token.subjectAs??[]){const other=chosen.get(key);if(!other||entry.binding.subject!==other.binding.subject)return false;}for(const [i]of(token.prefixPools??[]).entries()){const q=chosen.get(token.key+'.prefix.'+i);if(q&&entry.text.startsWith(q.text)){trace.push({key:token.key,reason:'DUPLICATE_PREFIX'});return false;}}}
   const parts=rule.proseTemplate.map(token=>{const core=chosen.get(token.key);if(!core)return '';const prefix=(token.prefixPools??[]).map((p,i)=>{const q=chosen.get(token.key+'.prefix.'+i);return q?q.text+p.separator:'';}).join('');return token.prefix+prefix+core.text+token.suffix;});
   const text=parts.join('');if(proseProblem(text)){trace.push({reason:'FINAL_PROSE_INVALID'});return false;}
   if(!gate(rule.contentTier,context).pass)return false;
   final={text,selected:selected.filter(s=>s.entry).map(s=>({key:s.task.key,slot:s.task.token.slot,entryId:s.entry.id,binding:s.entry.binding})),parts};return true;
  }
  const task=tasks[index],pool=candidates(task.token,task.poolId,task.role);
  if(!task.required)pool.push(null);
  for(const entry of pool){if(steps>=catalog.selection.maxSteps){exhausted=true;return false;}steps++;if(entry&&selected.some(s=>s.entry&&!compatible(entry,s.entry))){trace.push({entryId:entry.id,key:task.key,reason:'MUTUAL_EXCLUSION'});continue;}if(search(index+1,[...selected,{task,entry}]))return true;}
  return false;
 }
 if(!search(0,[]))return fallback(exhausted?'SEARCH_BUDGET_EXHAUSTED':'NO_VALID_ASSEMBLY');
 return result('assembled',final.text,{selected:final.selected,parts:final.parts,assemblyRuleId,revision:context.revision,exitChoice:{actionId:context.exitChoice.actionId,label:context.exitChoice.label}});
}
