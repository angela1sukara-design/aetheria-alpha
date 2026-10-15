/** 每个实际来源一格，保持职责与边界覆盖；不乘开 Tag 维度生成写作任务。 */
const proseKinds=new Set(['locations','residentTemplates','npcs','events','narrativeNodes','interactions','textSlots','sceneTexts','proseMaterials','worldProfile','environment','place','event','activity','npc']);
const boundaries={
 '01':[['unknown-place','地点未知，不借用其他地点'],['missing-prop','缺必需环境对象走整段回退'],['optional-sense','感官词缺失时连连接词一起省略']],
 '02':[['stable-identity','读档/刷新不换人物'],['body-owner','部位属于实际绑定对象'],['unknown-trait','未知性格保留普通交谈']],
 '03':[['unsupported-service','没有服务不显示功能'],['resource-shortage','真实服务缺资源时禁用并说明'],['no-effects-from-text','拼装不买物品或给收益']],
 '04':[['departed-actor','离场只保留免费退出或正确收尾'],['declined','拒绝不汇合到正收益深入'],['daily-receipt','反复浏览/交谈不重发每日收益']],
 '05':[['no-event','无事件不强塞无关对象'],['cooldown','冷却/重复规则仍由执行器检查'],['missing-word','缺词回退完整普通正文']],
 '06':[['stable-provider','提交不转移到其他居民'],['reward-once','正文不能重发奖励'],['unknown-lifecycle','缺接口不伪造任务状态']],
 '07':[['bound-opponent','战后不换对手'],['non-enemy-profile','无enemyId的profile不计敌人'],['ordinary-animal','动物仅普通流程，T34不得绕过']],
 '08':[['same-part','材质与部位绑定同一真实实例'],['prefix-placement','定词挂前且不得单独留下'],['tf-authority','文字不执行TF，未完成不写完成']],
 '09':[['explicit-route','阈值只给候选，不自动换终路线'],['declined-route','拒绝和退出不推进亲近'],['missing-affinity','缺状态机仍走原关系行为']],
};
export function coverageCells(matrix,sharedRules,gaps,questRows=[],questSources=[]){
 const cells=matrix.sourceItems.map(s=>({key:'source:'+s.key,family:'实际来源覆盖',source:s.key,sourceKind:s.kind,status:s.status??'已有来源；仍需入口/词条审定',assemblyRuleId:proseKinds.has(s.kind)&&!s.status?.startsWith('范围外')?'assembly.domain.'+matrix.id:'assembly.reference-only'}));
 for(const r of sharedRules.filter(r=>r.domains.includes(matrix.id)))cells.push({key:'rule:'+r.id,family:'组合规则职责',ruleId:r.id,status:'按共享规则验证，不逐组合写正文',assemblyRuleId:'assembly.reference-only'});
 for(const [id,expected]of boundaries[matrix.id])cells.push({key:'boundary:'+id,family:'独立边界',expected,status:'必须核查',assemblyRuleId:'assembly.domain.'+matrix.id});
 for(const g of gaps.filter(g=>g.domains.includes(matrix.id)))cells.push({key:'gap:'+g.id,family:'接口与制作缺口',gapId:g.id,status:g.status,assemblyRuleId:'assembly.reference-only'});
 if(matrix.id==='06')for(const q of questRows){const source=questSources.find(s=>s.id===q.questSource);if(!source)throw Error('任务来源缺失：'+q.questSource);cells.push({key:'quest:'+q.key,family:'任务源覆盖',source:source.key,questSource:q.questSource,stageId:q.id,stageType:q.type,status:'实际任务阶段；细节在sourceItems，奖励仍由执行器处理',assemblyRuleId:'assembly.domain.06'});}
 return cells;
}
