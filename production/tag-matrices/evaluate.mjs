/** 离线制作核查，纯函数；不修改 GameState，不执行正文或游戏效果。 */
const unknown=reason=>({known:false,reason});
const known=value=>({known:true,value});
export function logic(op, values) {
 if(op==='not')return values[0].known?known(!values[0].value):values[0];
 if(op==='all')return values.some(v=>v.known&&!v.value)?known(false):values.some(v=>!v.known)?unknown('存在未知条件'):known(true);
 if(op==='any')return values.some(v=>v.known&&v.value)?known(true):values.some(v=>!v.known)?unknown('存在未知条件'):known(false);
 throw Error('未知逻辑操作');
}
export function samePartMatch(entity, predicate) {
 if(!entity||!Array.isArray(entity.parts))return unknown('身体未知');
 return known(entity.parts.some(part=>Object.entries(predicate).every(([k,v])=>k==='minLengthMm'?typeof part.lengthMm==='number'&&part.lengthMm>=v:part[k]===v)));
}
export function resolveTag(tags,value,scope){
 const matches=tags.filter(t=>t.id===value||t.aliases?.some(a=>a.scope===scope&&a.value===value));
 if(matches.length!==1)throw Error('未知或歧义 Tag: '+value);
 if(matches[0].status!=='active')throw Error('非 active Tag: '+value);
 return matches[0].id;
}
export function generationEligibility(template,context){
 const tags=new Set(context.tags),selected=new Set(context.templates),packs=new Set(context.packs);
 const failures=[];
 if(template.environmentTags?.length&&!template.environmentTags.some(x=>(context.environmentTags??context.tags).includes(x)))failures.push('无匹配全局环境');
 for(const x of template.requiresTags??[])if(!tags.has(x))failures.push('缺必需Tag:'+x);
 for(const x of template.excludesTags??[])if(tags.has(x))failures.push('互斥Tag:'+x);
 if(template.compatibleTags?.length&&!template.compatibleTags.some(x=>tags.has(x)))failures.push('无兼容Tag');
 for(const x of template.requiresPacks??[])if(!packs.has(x))failures.push('缺内容包:'+x);
 for(const x of template.combination?.requiresTemplates??[])if(!selected.has(x))failures.push('缺模板:'+x);
 for(const x of template.combination?.excludesTemplates??[])if(selected.has(x))failures.push('互斥模板:'+x);
 for(const t of context.selectedDefinitions??[])if(t.combination?.excludesTemplates?.includes(template.id))failures.push('已选模板反向排斥:'+t.id);
 return {eligible:!failures.length,failures};
}
export function checkExclusive(facts){
 const values=new Map(),conflicts=[];
 for(const f of facts){const key=JSON.stringify([f.subject,f.instance,f.field,f.at]);if(values.has(key)&&values.get(key)!==f.value)conflicts.push(key);values.set(key,f.value);}
 return [...new Set(conflicts)];
}
export function locationService(service,fs,stamina=100){
 if(!fs)return service==='wait';
 return ({rest:()=>fs.includes('seat')||fs.includes('bed')||stamina<8,sleep:()=>fs.includes('bed'),care:()=>fs.includes('care'),work:()=>fs.includes('workplace'),train:()=>fs.includes('training'),publicDesk:()=>fs.includes('publicDesk'),light:()=>fs.includes('lightSwitch'),wait:()=>true})[service]?.()??false;
}
export function validateTraits(ids,tags,allowed){
 return Array.isArray(ids)&&new Set(ids).size===ids.length&&ids.every(id=>allowed.includes(id)&&tags.some(t=>t.id===id&&t.status==='active'&&t.facets.length===1&&t.facets[0]==='context'));
}
export function safeExit(choice){return choice.next===null&&['conditions','effects','setTags','unsetTags'].every(k=>Array.isArray(choice[k])&&choice[k].length===0);}
export function rankCandidates(candidates){
 const pool=candidates.filter(c=>c.eligible===true&&Number.isFinite(c.weight)&&c.weight>0&&Number.isFinite(c.priority??0));
 const priority=Math.max(...pool.map(c=>c.priority??0));
 return pool.filter(c=>(c.priority??0)===priority).sort((a,b)=>b.weight-a.weight||a.id.localeCompare(b.id,'en'));
}
export function conversationActor(story,residents,locationId){
 if(story?.kind!=='conversation'||story.actor?.kind!=='resident')return undefined;
 return residents.find(r=>r.id===story.actor.id&&r.locationId===locationId);
}
export function relationshipCandidates(values){
 if(!values||!['affection','submission','corruption','trust','visits'].every(k=>Number.isFinite(values[k])))return unknown('关系数值未知，保留普通交谈');
 if(['affection','submission','corruption'].some(k=>values[k]<0||values[k]>100))throw Error('关系字段越界');
 const {affection:a,submission:s,corruption:c,trust:t,visits:v}=values,stages=[v>=1?'acquaintance':'stranger'];
 if(Math.max(a,s,c)>=30)stages.push('close');
 if(a>=70&&t>=10&&c<50)stages.push('lover');
 if(s>=70)stages.push('submissive');
 if(c>=70)stages.push('corrupted');
 return known(stages);
}
export function checkEditorialHint(hint,input){
 if(input.attemptEffects)return {known:true,value:false,reason:'编辑规则不允许执行效果'};
 if(!hint.allowedSubjectKinds.includes(input.subjectKind))return {known:true,value:false,reason:'对象种类不支持'};
 if(hint.requiredBindings.some(k=>typeof input.bindings?.[k]!=='string'||!input.bindings[k]))return unknown('缺实例绑定');
 if(input.value===undefined||input.value===null)return unknown('属性未知；无默认值');
 if(hint.value.type==='number'&&(typeof input.value!=='number'||!Number.isFinite(input.value)||input.unit!==hint.value.unit))return {known:true,value:false,reason:'数值或显式单位不匹配'};
 return known(true); // 仅制作选材条件；永远不执行游戏效果。
}
