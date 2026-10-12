import type { ReferenceTemplate } from './types.ts';
/** 只拒绝静态可证明的矛盾和顺序不可达；候选环境组合仍在实际生成时明确报错。 */
export function validateReferenceOrder(templates:ReferenceTemplate[]):void {
  // 地点、活动和事件按每个地点交错生成：后一个地点可能依赖前一个地点的活动。
  // 将它们视为同一阶段，只拒绝跨向确定尚未开始的阶段，实际无候选时由生成器报告。
  const order={environment:0,faction:1,place:2,activity:2,event:2,npc:3};
  for(const t of templates){
    if(t.requiresTags.some(x=>t.excludesTags.includes(x)))throw Error(`规则矛盾：${t.id} 同时要求和排除 Tag。`);
    if(t.compatibleTags.length&&t.compatibleTags.every(x=>t.excludesTags.includes(x)))throw Error(`规则矛盾：${t.id} 所有兼容 Tag 被排除。`);
    if(t.combination.requiresTemplates.some(x=>t.combination.excludesTemplates.includes(x)))throw Error(`规则矛盾：${t.id} 同时要求和排除模板。`);
    for(const id of [...t.combination.requiresTemplates,...t.combination.excludesTemplates])if(!templates.some(x=>x.id===id))throw Error(`组合规则引用未知模板 ${id}。`);
    for(const id of t.combination.requiresTemplates){const dependency=templates.find(x=>x.id===id)!;if(id===t.id||order[dependency.kind]>order[t.kind]||t.kind==='environment'&&dependency.kind==='environment')throw Error(`生成顺序不可达：${t.id} 依赖 ${id}。`);}
  }
  const marks=new Map<string,number>();const byId=new Map(templates.map(t=>[t.id,t]));
  const visit=(t:ReferenceTemplate):void=>{if(marks.get(t.id)===1)throw Error(`生成依赖循环：${t.id}`);if(marks.get(t.id)===2)return;marks.set(t.id,1);for(const id of t.combination.requiresTemplates)visit(byId.get(id)!);marks.set(t.id,2);};
  templates.forEach(t=>visit(t));
}
