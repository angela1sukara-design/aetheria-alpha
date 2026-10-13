import {readFile,writeFile,mkdir} from 'node:fs/promises';
import { loadAtoms, sampleCombos, toEncounterCandidate } from './nsfw-auto-combo/combiner.mjs';
const json=async p=>JSON.parse(await readFile(p,'utf8'));
const index=await json('content/index.json'),base=await Promise.all(index.packs.filter(p=>!p.includes('/adventure/')).map(p=>json('content/'+p)));
const id=s=>'progression:'+s,tag=s=>id('tag.'+s),scoped=(role,s)=>({role,tagId:tag(s)}),has=(role,s,value=true)=>({op:'narrative.tag',role,id:tag(s),value});
const p={manifest:{id:'aetheria/adventure',namespace:'progression',version:'1.0.0',schemaVersion:2,engineApiVersion:'0.1',author:'Aetheria',status:'draft',dependencies:base.map(p=>({id:p.manifest.id,version:p.manifest.version,optional:false})),requiresCapabilities:['foundation.v2','adventure.v1','condition.v1','effect.v1','hook.global.v1','district.v1','body.graph.v1','tf.pipeline.v1'],migrations:[]},variables:[],flags:[],hooks:[{id:id('hook.runtime'),accepts:'action',visibility:'public'}],locations:[],routes:[],actions:[],events:[],texts:{},contributions:[],globalActionHooks:[id('hook.runtime')],tags:[],narrativeNodes:[],narrativeProfiles:[],environmentEnemyRules:[],equipment:[],enemies:[],locationProfiles:[],bodyPatches:[],transformations:[]};
for(const [key,label,definition]of [
 ['control','控制倾向','偏爱先稳定现场和限制危险行动的行为倾向，不授予身体能力。'],['direct','直接倾向','偏爱尽快结束当前事务的行为倾向。'],['repair','改造与修理倾向','偏爱提出检查与改装方案，不代表实际执行或取得同意。'],['cautious','谨慎','优先核对条件和风险的倾向；对应离线概念general-taxonomy:disposition.caution。'],['tools','携带维护工具','行为档案确认对方携带维护工具，工具不替代玩家的选择。'],['goal.control','控制现场目标','本次主要目标为稳定现场。'],['goal.leave','结束接触目标','本次主要目标为结束接触并离开。'],['goal.repair','检查改装目标','本次主要目标为提出检查或修理方案。'],['coat.stuck','外衣黏附','战败结算明确写入的玩家外衣暂时黏附事实，不等于身体黑胶化。'],['hands.restricted','双手受限','故事局部事实：玩家双手暂时不便取用工具，不移除BodyGraph中的手。'],['clear','保持清醒','当前战败规则确认玩家仍可清楚回应。'],['injured','伤后乏力','战败结算留下的局部状态。'],['signal','已发出求助','实际选择求助后记录的本次信号事实。'],['assessed','已检查处境','玩家已通过选择检查现场。'],['aid','公共协作','发生的公共协作行动题材。'],['route','路线发现','本次探索确认了可使用的通道信息。'],['repair.accepted','接受本次修理','本次选择明确接受指定修理，不能用于其他范围。']])p.tags.push({id:tag(key),label,definition,facets:['context'],status:'active',aliases:[]});
const profiles=[['gel','district:enemy.gel',['control'],['goal.control'],[['control',80],['cautious',30]],[scoped('player','coat.stuck')]],['collector','district:enemy.collector',['direct'],['goal.leave'],[['direct',90]],[]],['scavenger','district:enemy.scavenger',['repair','tools'],['goal.repair'],[['repair',80],['cautious',50]],[]],['raider',id('enemy.raider'),['direct'],['goal.leave'],[['direct',70]],[]],['sentinel',id('enemy.sentinel'),['control'],['goal.control'],[['control',85]],[scoped('player','hands.restricted')]],['overseer',id('enemy.overseer'),['repair','tools'],['goal.repair'],[['repair',90],['control',30]],[]]];
for(const [name,enemyId,tags,goals,tendencies,defeatTags]of profiles)p.narrativeProfiles.push({id:id('profile.'+name),enemyId,tags:tags.map(tag),goals:goals.map(tag),tendencies:tendencies.map(([s,weight])=>({tagId:tag(s),weight})),defeatTags:[scoped('player','clear'),scoped('player','injured'),...defeatTags]});
const action=(name,label,effects,conditions=[],hint='按当前条件执行',group='daily')=>{const aid=id('action.'+name),textKey=id('text.action.'+name);p.texts[textKey]=label+'。';p.actions.push({id:aid,label,hint,group,conditions,effects,resultText:textKey});p.contributions.push({hookId:id('hook.runtime'),actionIds:[aid]});return aid;};
for(let i=0;i<4;i++)action('story.'+i,'继续当前经历',[{op:'narrative.choose',index:i}]);
const choice=(label,result,next=null,effects=[],conditions=[],setTags=[],unsetTags=[])=>{const resultText=id('text.choice.'+Object.keys(p.texts).length);p.texts[resultText]=result;return{label,resultText,next,effects,conditions,setTags,unsetTags};};
const exit=()=>choice('结束当前经历，回到安全位置','你停止这次接触，回到可以继续行动的位置。');
const node=(name,kind,stage,title,text,choices,extra={})=>{const nid=id('node.'+name),textKey=id('text.node.'+name);p.texts[textKey]=text;p.narrativeNodes.push({id:nid,kind,stage,title,textKey,requiresTags:[],excludesTags:[],conditions:[],tendencies:[],weight:10,priority:0,maxVisits:1,choices:[...choices,exit()],...extra});};
const time=minutes=>({op:'clock.advance',minutes}),health=amount=>({op:'var.change',id:'core:health',amount}),change=(field,amount)=>({op:'adventure.change',field,amount}),grasp={op:'body.hasCapability',capability:'grasp',count:1};
node('defeat.start','defeat','start','交锋之后','你已经失去继续交锋的力气【伤后乏力】，但仍能辨认周围的声音【保持清醒】。你先稳住身体，判断怎样离开眼前的处境。',[choice('检查还能怎样活动','你停下无效的挣扎，检查可活动部位【已检查处境】。','assess',[],[],[scoped('player','assessed')])]);
node('defeat.control','defeat','start','被留在原处','{opponent}先收拢现场，阻止你再次贸然行动【控制现场目标】。你仍保持清醒【保持清醒】，可以检查限制的位置，或发声请求协助。',[choice('检查限制位置','你确认了限制所在【已检查处境】。','assess',[],[],[scoped('player','assessed')]),choice('发声请求协助','你向公共通道清楚地发出求助【已发出求助】。','help',[time(5)],[],[scoped('player','signal')])],{priority:5,requiresTags:[scoped('opponent','goal.control')],tendencies:[{tagId:tag('control'),weight:1}]});
node('defeat.direct','defeat','start','冲突已经结束','{opponent}确认你无法继续交锋，便结束了这次接触【结束接触目标】。你留在原地喘息，先检查伤势，再决定是否需要协助【伤后乏力】。',[choice('缓慢检查并处理擦伤','你确认伤处并完成简单处理，随后回到安全通道。',null,[time(15),health(8)]),choice('请求值班协助','你说明自己需要协助【已发出求助】。','help',[time(5)],[],[scoped('player','signal')])],{priority:5,requiresTags:[scoped('opponent','goal.leave')],tendencies:[{tagId:tag('direct'),weight:1}]});
node('defeat.repair','defeat','start','提出检查方案','{opponent}把维护工具放在一旁【携带维护工具】，提出检查装备的方案【检查改装目标】。你仍可以拒绝，或先要求对方说明检查范围。此时尚未发生任何身体改造。',[choice('先听检查范围','对方说明检查范围，等待你的下一步决定。','repair'),choice('拒绝检查，请求离开','你拒绝这次检查，停止接触并离开。')],{priority:5,requiresTags:[scoped('opponent','goal.repair'),scoped('opponent','tools')],tendencies:[{tagId:tag('repair'),weight:1}]});
node('defeat.assess','defeat','assess','检查处境','你把注意力放回可活动部位。身体的真实结构仍然保留，眼前的限制需要分别处理；你可以继续求助，也可以沿安全路线离开【已检查处境】。',[choice('发声请求协助','你发出求助信号【已发出求助】。','help',[time(5)],[],[scoped('player','signal')]),choice('沿安全路线缓慢离开','你沿安全路线离开危险位置，休息后再决定下一步。',null,[time(20),health(5)])]);
node('defeat.coat','defeat','assess','找到黏附位置','外衣的下摆粘在低处【外衣黏附】，身体本身没有因此变成黑胶。你确认手边仍有可用的抓握部位，可以尝试松开外衣，或请求协助。',[choice('松开被牵住的外衣','你松开外衣的牵扯，沿台阶回到安全位置。',null,[time(15),health(5)],[grasp],[],[scoped('player','coat.stuck')]),choice('发声请求协助','你报出所在位置，请求协助【已发出求助】。','help',[time(5)],[],[scoped('player','signal')])],{priority:5,requiresTags:[scoped('player','coat.stuck')],conditions:[grasp]});
node('defeat.hands','defeat','assess','双手暂时受限','你发现双手暂时不便取用工具【双手受限】。你不再强行够取物件，转而用声音说明自己所在的位置。',[choice('清楚报出位置并等待协助','你清楚报出位置【已发出求助】。','help',[time(5)],[],[scoped('player','signal')])],{priority:6,requiresTags:[scoped('player','hands.restricted')]});
node('defeat.help','defeat','help','回应来自通道','通道里传来回应。值班人员根据你刚才报出的信息找到现场【已发出求助】，先确认你的意识与伤处，再询问你希望接受哪些帮助。',[choice('接受脱困与基础护理','对方帮助你脱离现场，并处理了擦伤。事故情况已经记入本次经历。',null,[time(20),health(12),change('safety',1)]),choice('只请求离开危险位置','对方协助你离开危险位置，你保留之后自行处理伤势的选择。',null,[time(10),health(3)])],{requiresTags:[scoped('player','signal')]});
node('defeat.repair.scope','defeat','repair','保留自己的决定','检查范围已经说明。你可以结束检查，或要求先处理现场安全。没有相应设备与已确认身体条件的项目不会自动执行【检查改装目标】。',[choice('先处理现场安全','现场得到整理，你离开危险位置。',null,[time(10),health(3),change('safety',1)])]);
node('defeat.repair.tail','defeat','repair','机械尾的维护提议','你的尾部确为机械结构【机械尾】。对方提出把尾部外伸长度调整到650毫米，说明需要十五分钟【检查改装目标】。这一项只会在你明确接受后开始。',[choice('接受这一次长度调整','你明确接受本次长度调整【接受本次修理】；维护完成，尾部的真实长度记录为650毫米。',null,[{op:'tf.enqueue',id:id('tf.tail-maintenance')},time(15),health(5)],[],[scoped('player','repair.accepted')]),choice('拒绝改装，离开现场','你拒绝改装，沿安全路线离开。',null,[time(10),health(3)])],{priority:6,requiresTags:[{role:'player',tagId:'foundation:body.mechanical-tail'},scoped('opponent','tools')],conditions:[{op:'body.matches',target:{kind:'player'},part:{kind:'tail',materialFamily:'mechanical'}},{op:'tf.state',id:id('tf.tail-maintenance'),state:'idle'},{op:'not',condition:{op:'body.matches',target:{kind:'player'},part:{kind:'tail',lengthMm:650}}}]});
for(const kind of ['encounter','exploration','daily','conversation','quest','transformation','ending']){
 const messages={encounter:['眼前的遭遇','你在{place}停下，留意眼前正在发生的小事。先观察当前处境，再决定是否参与【探索】。'],exploration:['查看周围','你沿{place}的可见通道查看路面与告示。已经走过的路线可以核对，尚未进入的地方仍保留未知【调查】。'],daily:['安排一段日常','你在{place}检查手边的事情，衡量当前体力与精力。可以选择一段公共协作，也可以留出时间休息【生活】。'],conversation:['与眼前的人交谈','你与已经在场的{opponent}谈起眼前的事务。你先听对方把话说完，再决定是否参与【社交】。'],quest:['核对当前事务','你把已经发生的进展与眼前的安排核对。需要进一步处理的事项仍要通过实际行动完成【工作】。'],transformation:['适应当前身体','你放慢动作，检查身体目前的支撑与活动方式。已经完成的变化以真实身体记录为准，尚在推进的项目仍需等待【适应】。'],ending:['回顾已经留下的结果','你回顾已完成的契约、协作与交锋。当前的经营份额、组织影响和街区安全仍然保留，之后的行动会继续改变它们【身份】。']};
 const [title,text]=messages[kind];const choices=kind==='daily'?[choice('完成一次公共协作','你完成了当前可用的公共协作【公共协作】。',null,[{op:'progression.act',move:'aid'}],[{op:'progression.available',move:'aid'}])]:kind==='conversation'?[choice('交换今天的近况','你们谈起已经知道的近况，这次交谈按原居民规则记录。',null,[{op:'resident.talk'}],[{op:'resident.available'}])]:[choice('继续核对细节','你完成这一次观察，记录实际看见的内容。','detail',[time(5)])];
 node(kind+'.start',kind,'start',title,text,choices);
 if(!['daily','conversation'].includes(kind))node(kind+'.detail',kind,'detail','这一次的新发现','你已经核对了眼前的细节，没有把尚未发生的事情记成结果。你可以结束这次查看，回到实际行动【发现】。',[]);
}
node('exploration.night','exploration','start','夜间的通道','真实时钟已经进入夜间【夜间】。你在{place}核对照明和公开告示，先确认可见的安全路线。',[choice('记下照明明确的通道','你核对并记录了当前可见的路线【路线发现】。',null,[time(5),change('safety',1)])],{priority:4,requiresTags:[{role:'environment',tagId:'foundation:time.night'}]});
node('transformation.tail','transformation','start','尾部动作练习','你确实拥有尾部【有尾】。你放慢转身速度，确认尾部的位置和当前支撑方式；这次练习不会自动增加身体能力。',[choice('完成这一次适应练习','你完成动作练习，真实身体结构与转化进度保持一致。',null,[time(5)])],{priority:4,requiresTags:[{role:'player',tagId:'foundation:body.has-tail'}]});
node('defeat.control.cautious','defeat','start','先核对风险','{opponent}没有立刻改变现场，而是先核对周围的风险【谨慎】。对方要求你停止贸然发力【控制现场目标】，留出检查限制位置的时间。你可以配合检查，也可以直接提出离开。',[choice('先核对自己的处境','你用几分钟确认了限制所在【已检查处境】。','assess',[time(5)],[],[scoped('player','assessed')]),choice('请求值班协助','你清楚说明位置，请求协助【已发出求助】。','help',[time(5)],[],[scoped('player','signal')])],{priority:5,requiresTags:[scoped('opponent','goal.control')],tendencies:[{tagId:tag('control'),weight:1},{tagId:tag('cautious'),weight:3}]});
node('defeat.repair.cautious','defeat','start','先说明维护范围','{opponent}先把工具留在你能看见的位置【携带维护工具】，逐项说明维护范围，再等待你的决定【谨慎】。任何实际调整都需要你接下来的明确选择。',[choice('听清范围后再决定','你听清维护范围，保留接受或拒绝的选择。','repair',[time(5)]),choice('拒绝这次维护','你拒绝这次维护，沿安全通道离开。',null,[time(5),health(3)])],{priority:5,requiresTags:[scoped('opponent','goal.repair'),scoped('opponent','tools')],tendencies:[{tagId:tag('repair'),weight:1},{tagId:tag('cautious'),weight:3}]});
node('exploration.workshop','exploration','start','查看工坊的工作区','这里实际提供工坊服务【工坊服务】。你核对公开的设备时段与通道，寻找能够参与的工作；工具和设备的实际使用仍需满足对应条件。',[choice('记录可用工作区','你核对了可用工作区，记录在本次经历中【发现】。',null,[time(5)]),choice('继续查看其他细节','你把注意力转向通道和告示。','detail',[time(5)])],{priority:4,requiresTags:[{role:'environment',tagId:'foundation:service.workshop'}]});
node('daily.tired','daily','start','先恢复一些力气','你当前的体力不足以安排强度较高的工作【体力≤19】。你可以先找个安全位置休息，恢复之后再处理当天事务。',[choice('休息半小时','你休息了半小时，体力与精力恢复。',null,[time(30),{op:'var.change',id:'core:stamina',amount:12},{op:'var.change',id:'core:energy',amount:12}])],{priority:4,conditions:[{op:'var.compare',id:'core:stamina',comparison:'lte',value:19}]});
node('conversation.progress','conversation','start','谈谈已经留下的进展','你可以向在场的{opponent}讲述已经登记的街区进展【社交】。对方的具体反应仍取决于当下的交谈，这次说明不会替对方接受新的约定。',[choice('说明近况并听取回应','你们完成这次近况交谈，原居民记忆规则记录实际发生的交流。',null,[{op:'resident.talk'}],[{op:'resident.available'}])],{priority:4,conditions:[{op:'adventure.compare',field:'reputation',comparison:'gte',value:4}]});
node('ending.resource','ending','start','核对经营成果','你逐项核对当前登记的经营份额、订单与契约【交易】。这些记录会继续参与跨日结算和终局条件，已经完成的事项不会因查看而再次奖励。',[choice('保留当前安排','你保留当前经营安排，接下来的结算仍依据实际份额。')],{priority:4,conditions:[{op:'adventure.compare',field:'assets',comparison:'gte',value:6}]});
node('ending.security','ending','start','核对交锋与巡查记录','你核对已经记录的有效胜利和街区安全【恢复】。组织影响来自实际任务、协作与交锋，后续是否继续行动仍由你决定。',[choice('结束回顾，继续生活','你结束这次回顾，实际胜利与安全记录继续保留。')],{priority:4,conditions:[{op:'adventure.compare',field:'victories',comparison:'gte',value:2},{op:'adventure.compare',field:'safety',comparison:'gte',value:5}]});
p.bodyPatches.push({id:id('patch.tail-maintenance'),label:'机械尾外伸长度调整',summary:'尾部外伸长度调整至650毫米',operations:[{type:'attributes',partId:'tail',set:{lengthMm:650},unset:[]}]});
p.transformations.push({id:id('tf.tail-maintenance'),label:'机械尾长度维护',source:'story',stages:[{id:'adjusted',label:'长度调整完成',atMinutes:15,patchId:id('patch.tail-maintenance'),textKey:id('text.tail-maintenance')}]});p.texts[id('text.tail-maintenance')]='本次确认的长度调整已经完成，真实尾部参数更新为650毫米。';
const existingProfiles=new Set(base.flatMap(p=>p.locationProfiles??[]).map(l=>l.locationId));
const locationEnv={
 canal:['foundation:context.waterways','foundation:theme.gel','foundation:theme.risk'],
 station:['foundation:theme.boundary','foundation:theme.risk'],
 workshop:['foundation:theme.mechanical','foundation:theme.equipment'],
 market:['foundation:theme.trade','foundation:theme.economy'],
 cafe:['foundation:theme.social'],
 archive:['foundation:theme.investigation'],
 street:['foundation:theme.exploration'],
 apartment:['foundation:theme.rest'],
 clinic:['foundation:theme.care'],
 salon:['foundation:theme.social']
};
for(const loc of base.flatMap(p=>p.locations)){if(existingProfiles.has(loc.id))continue;const suffix=loc.id.split('.').at(-1);const service=({apartment:'home',market:'market',clinic:'clinic',workshop:'workshop',salon:'commons',cafe:'commons',canal:'commons',archive:'commons',station:'commons',street:'commons'})[suffix]??'commons';p.locationProfiles.push({id:id('location-profile.'+suffix),locationId:loc.id,service,light:'lit',tags:locationEnv[suffix]??[]});}
const service=values=>({op:'any',conditions:values.map(value=>({op:'environment.service',value}))});
action('rest','安全休息半小时',[time(30),{op:'var.change',id:'core:stamina',amount:12},{op:'var.change',id:'core:energy',amount:12}],[],'30分钟 · 体力+12 · 精力+12');
action('sleep','休息到次日同一时刻',[time(1440),{op:'var.change',id:'core:stamina',amount:50},{op:'var.change',id:'core:energy',amount:70}],[],'24小时 · 体力+50 · 精力+70');
action('care','接受基础伤势处理',[time(30),health(12)],[],'30分钟 · 生命+12');
for(const [stat,label]of [['attack','攻击'],['defense','防御'],['speed','速度'],['skillPower','技能强度'],['hit','命中'],['evasion','闪避'],['crit','暴击']])action('train.'+stat,'训练'+label,[{op:'progression.act',move:'train',id:'core:'+stat}],[{op:'progression.available',move:'train',id:'core:'+stat}],'45分钟 · 零钱−8 · 体力−8 · 精力−4 · '+label+'+1');
for(const [move,label,hint]of [['order','完成一份公开订单','30分钟 · 体力−8 · 精力−5 · 报酬与经营份额'],['invest','登记经营份额','45分钟 · 零钱−30 · 经营份额+2 · 契约+1'],['patrol','完成一次街区巡查','45分钟 · 体力−10 · 安全+2 · 组织影响+1'],['aid','参与公共协作','30分钟 · 体力−4 · 声望+2 · 安全+1'],['reconcile','调解一项当地分歧','30分钟 · 精力−4 · 组织影响+1']])action(move,label,[{op:'progression.act',move}],[{op:'progression.available',move}],hint);
for(const [name,label,slot,bonuses]of [['blade','工坊制式工具刃','weapon',{attack:3}],['vest','加固巡查背心','armor',{defense:3,evasion:3}],['staff','平衡练习杖','weapon',{attack:2}],['coat','轻型防护外套','armor',{defense:2,evasion:5}]]){
 const eid=id('equipment.'+name);p.equipment.push({id:eid,name:label,slot,bonuses,description:label+'已穿戴；战斗时叠加装备属性，基础属性保持。',requires:[grasp]});action('buy.'+name,'购买'+label,[{op:'progression.act',move:'buy',id:eid}],[{op:'progression.available',move:'buy',id:eid}],`10分钟 · 零钱−${slot==='weapon'?25:30}`);action('wear.'+name,'装备'+label,[{op:'equipment.wear',id:eid}],[],'已购装备；同槽替换');
}
action('combat.skill','技能击',[{op:'combat.turn',move:'skill'}],[],'技能资源−15 · 体力−4 · 行动点2');
for(const result of ['victory','escape','defeat']){
 const eid=id('event.'+result),aid=id('action.event.'+result),prompt=id('text.event.'+result),end=id('text.event.'+result+'.end');p.texts[prompt]=({victory:'交锋已经结束。实际奖励、胜利记录与街区后果已经结算【恢复】。',escape:'你已经撤离这次交锋，没有获得战斗奖励【边界】。',defeat:'你暂时失去继续交锋的能力，仍可以离开并恢复【恢复】。'})[result];p.texts[end]='你回到当前地点，可以休息、处理伤势或继续行动。';p.actions.push({id:aid,label:'返回安全位置',hint:'免费退出',group:'event',context:{eventId:eid,nodeId:'start'},conditions:[],effects:[{op:'event.advance',nodeId:'end'}],resultText:end});p.events.push({id:eid,startNode:'start',rating:'general',nodes:[{id:'start',type:'choice',textVariants:[prompt],actionIds:[aid],onEnter:[]},{id:'end',type:'exit',textVariants:[end],actionIds:[],onEnter:[{op:'event.exit'}]}]});
}
for(const [name,label,tier,hp,attack,defense,speed,reward,actions]of [['raider','抢占通道的游荡者','S',45,9,5,9,12,1],['sentinel','封锁通道的重装哨卫','L',90,16,12,12,28,2],['overseer','维护核心的失控监理','boss',160,18,14,11,50,2]]){
 const enemyId=id('enemy.'+name);p.enemies.push({id:enemyId,name:label,hp,reward,tier,combat:{attack,defense,speed,skillPower:attack,hit:75,evasion:8,crit:5,actionsPerTurn:actions,skillResource:0},...(tier==='boss'?{phases:[{hpRatio:0.5,defenseBonus:4,extraActions:1}]}:{}),intents:[{label:'逼近并试探',damage:5,guard:2,drain:0},{label:'稳住防护',damage:2,guard:5,drain:0},{label:'集中力量攻击',damage:12,guard:0,drain:1}],victoryEventId:id('event.victory'),defeatEventId:id('event.defeat'),escapeEventId:id('event.escape')});
 action('challenge.'+name,'挑战：'+label,[{op:'combat.start',id:enemyId}],[service(['commons','workshop']),...(tier==='L'?[{op:'adventure.compare',field:'victories',comparison:'gte',value:2}]:tier==='boss'?[{op:'adventure.compare',field:'victories',comparison:'gte',value:4},{op:'adventure.compare',field:'influence',comparison:'gte',value:4}]:[])],'观察属性后交锋；可以撤离','explore');
}
for(const [name,eid]of [['gel','district:enemy.gel'],['collector','district:enemy.collector']])action('challenge.'+name,'调查危险：'+(name==='gel'?'渠底黑胶群落':'拦路收债客'),[{op:'combat.start',id:eid}],[service(['commons','market'])],'交锋、撤离或战后恢复','explore');
for(const kind of ['encounter','exploration','daily','conversation','quest','transformation','ending'])action('narrative.'+kind,({encounter:'留意一次当地遭遇',exploration:'仔细查看当前环境',daily:'安排一段日常事务',conversation:'与在场居民继续交谈',quest:'核对当前进展',transformation:'练习适应当前身体',ending:'回顾已经留下的结果'})[kind],[{op:'narrative.start',kind}],kind==='conversation'?[{op:'resident.available'}]:kind==='ending'?[{op:'adventure.compare',field:'reputation',comparison:'gte',value:1}]:[],'根据当前状态展开；可以免费结束','explore');
const scopedDefeat=(...keys)=>keys.map(k=>scoped('player',k));
const envRule=(name,enemyId,requires,extra={})=>p.environmentEnemyRules.push({id:id('env-enemy.'+name),enemyId,requiresTags:requires,weight:extra.weight??10,priority:extra.priority??0,...(extra.excludes?{excludesTags:extra.excludes}:{}),...(extra.name?{name:extra.name}:{}),...(extra.hp?{hp:extra.hp}:{}),...(extra.reward!==undefined?{reward:extra.reward}:{}),...(extra.combat?{combat:extra.combat}:{}),...(extra.defeatTags?{defeatTags:extra.defeatTags}:{})});
// 地点层挂接：环境 tag 组合 → scavenger / collector / gel；可覆盖数值与 defeatTags。
envRule('gel.canal','district:enemy.gel',['foundation:service.commons','foundation:context.waterways','foundation:theme.gel'],{weight:20,name:'渠底黑胶群落（湿滑）',hp:38,combat:{defense:6,speed:7,attack:8},defeatTags:scopedDefeat('clear','injured','coat.stuck')});
envRule('scavenger.canal','district:enemy.scavenger',['foundation:service.commons','foundation:context.waterways','foundation:theme.risk'],{weight:12,name:'失控搬运机（渠道）',combat:{attack:10,defense:6},defeatTags:scopedDefeat('clear','injured')});
envRule('scavenger.workshop','district:enemy.scavenger',['foundation:service.workshop','foundation:theme.mechanical'],{weight:18,name:'失控搬运机（工坊）',hp:44,combat:{attack:11,defense:7,speed:8},defeatTags:scopedDefeat('clear','injured','hands.restricted')});
envRule('collector.station','district:enemy.collector',['foundation:service.commons','foundation:theme.boundary'],{weight:16,name:'拦路收债客（检查站）',combat:{attack:13,speed:11},defeatTags:scopedDefeat('clear','injured')});
envRule('collector.market','district:enemy.collector',['foundation:service.market','foundation:theme.trade'],{weight:16,name:'拦路收债客（市集）',hp:65,reward:18,combat:{attack:12,defense:9},defeatTags:scopedDefeat('clear','injured')});
action('encounter.env','调查危险环境',[{op:'combat.encounter'}],[],'按当前地点环境 tag 匹配敌人；可覆盖数值与战败节点','explore');

// —— NSFW 定词材质×部位×动作 自动组合（制作卡 proposed-nodes / U6）——
// 合载：运行 tag + profile + encounter 候选节点；不改词库审定；不伪造 foundation:*。
const nsfwAtoms = await loadAtoms();
const nsfwCombos = sampleCombos(nsfwAtoms);
p.tags.push({
  id: tag('nsfwcombo.active'),
  label: 'NSFW组合遭遇激活',
  definition: '故事局部：本次遭遇由 NSFW 自动组合器（材质×部位×动作）选中；不等于词库审定，不授予身体能力，不表示 TF 已完成。',
  facets: ['context'],
  status: 'active',
  aliases: [],
});
p.narrativeProfiles.push({
  id: id('profile.nsfwcombo.matrix'),
  tags: [tag('nsfwcombo.active')],
  goals: [],
  tendencies: [],
  defeatTags: [],
});
const adultGate = [{ op: 'preference.adultOptional', value: true }];
const nsfwCandidates = [];
for (const combo of nsfwCombos) {
  const slug = (combo.sampleId ?? 'x').toLowerCase();
  const cand = toEncounterCandidate(combo, {
    nodeId: id(`node.encounter.nsfwcombo.${slug}`),
    textKey: id(`text.node.encounter.nsfwcombo.${slug}`),
    requireTagId: tag('nsfwcombo.active'),
    priority: 5,
    weight: 10,
  });
  nsfwCandidates.push(cand);
  p.texts[cand.node.textKey] = cand.fragment;
  const detailKey = id(`text.node.encounter.nsfwcombo.${slug}.detail`);
  p.texts[detailKey] = cand.texts.detail;
  const resultKey = id(`text.choice.nsfwcombo.${slug}.detail`);
  p.texts[resultKey] = `你记下组合键「${combo.comboKey}」，确认尚未写入战败或转化结算。`;
  const startChoices = [
    {
      label: '核对组合原子与挂接提示',
      resultText: resultKey,
      next: 'nsfwcombo-detail',
      effects: [time(5)],
      conditions: [],
      setTags: [],
      unsetTags: [],
    },
  ];
  // 成人样例：可填 adult 正文槽 + 偏好门选项（中性 fragment 仍可无偏好阅读）
  let adultKey = null;
  if (combo.adultRequired) {
    adultKey = id(`text.node.encounter.nsfwcombo.${slug}.adult`);
    p.texts[adultKey] = [
      `【可填成人正文槽 · ${combo.sampleId} · ${combo.comboKey}】`,
      '占位：在此写入同意前提下的成人向遭遇描写（材质×部位×动作）。',
      '关闭 adultOptional 或不满足成年资格时，玩家看不到本选项；主节点中性 fragment 仍可用。',
      '勿写未成年人；勿伪造 foundation:*；勿写物种 TF 专条。',
      `lexiconRefs：${combo.lexiconRefs.join('、')}`,
    ].join('\n');
    const adultResult = id(`text.choice.nsfwcombo.${slug}.adult`);
    p.texts[adultResult] = '你读完这段可选成人描写，仍可随时退出；未写入战败或转化结算。';
    startChoices.push({
      label: '阅读成人向补充描写',
      resultText: adultResult,
      next: 'nsfwcombo-adult',
      effects: [time(5)],
      conditions: adultGate,
      setTags: [],
      unsetTags: [],
    });
  }
  startChoices.push(exit());
  p.narrativeNodes.push({
    ...cand.node,
    choices: startChoices,
  });
  p.narrativeNodes.push({
    id: id(`node.encounter.nsfwcombo.${slug}.detail`),
    kind: 'encounter',
    stage: 'nsfwcombo-detail',
    title: '组合键与素材对照',
    textKey: detailKey,
    requiresTags: [scoped('opponent', 'nsfwcombo.active')],
    excludesTags: [],
    conditions: [],
    tendencies: [],
    weight: 10,
    priority: 5,
    maxVisits: 1,
    choices: [exit()],
  });
  if (adultKey) {
    p.narrativeNodes.push({
      id: id(`node.encounter.nsfwcombo.${slug}.adult`),
      kind: 'encounter',
      stage: 'nsfwcombo-adult',
      title: `${combo.title} · 成人补充`,
      textKey: adultKey,
      requiresTags: [scoped('opponent', 'nsfwcombo.active')],
      excludesTags: [],
      conditions: adultGate,
      tendencies: [],
      weight: 10,
      priority: 5,
      maxVisits: 1,
      choices: [exit()],
    });
  }
  cand.adultTextKey = adultKey;
  cand.fillable = {
    neutralTextKey: cand.node.textKey,
    detailTextKey: detailKey,
    choiceDetailTextKey: resultKey,
    adultTextKey: adultKey,
    startNodeId: cand.node.id,
    detailNodeId: id(`node.encounter.nsfwcombo.${slug}.detail`),
    adultNodeId: adultKey ? id(`node.encounter.nsfwcombo.${slug}.adult`) : null,
  };
}
action(
  'nsfwcombo.encounter',
  '试跑 NSFW 材质组合遭遇',
  [{ op: 'narrative.start', kind: 'encounter', profileId: id('profile.nsfwcombo.matrix') }],
  [],
  '定词材质×部位×动作 → 候选遭遇节点；不改审定；成人完整正文另见 adult 门',
  'explore',
);
// existing-prose 回填：覆盖 start 中性槽与已有 .adult 槽（.detail / choice 本批不动）
const proseFillsPath = 'content/nsfw-auto-combo/prose-fills.json';
let proseFillCount = 0;
try {
  const proseFills = await json(proseFillsPath);
  if (proseFills.format !== 'aetheria-nsfw-auto-combo-prose-fills' || proseFills.schemaVersion !== 1) {
    throw new Error('prose-fills.json 格式无效。');
  }
  for (const [key, body] of Object.entries(proseFills.texts ?? {})) {
    if (typeof body !== 'string' || !body.trim()) throw new Error(`散文回填空槽：${key}`);
    if (!(key in p.texts)) throw new Error(`散文回填目标不存在于 pack.texts：${key}`);
    p.texts[key] = body;
    proseFillCount += 1;
    for (const c of nsfwCandidates) {
      if (c.node.textKey === key) c.fragment = body;
      if (c.adultTextKey === key) c.adultFragment = body;
    }
  }
} catch (err) {
  if (err && err.code === 'ENOENT') {
    // 无回填文件时保留组合器 stub
  } else {
    throw err;
  }
}

await mkdir('content/nsfw-auto-combo', { recursive: true });
await writeFile(
  'content/nsfw-auto-combo/candidates.json',
  JSON.stringify(
    {
      format: 'aetheria-nsfw-auto-combo-candidates',
      schemaVersion: 1,
      generatedFrom: nsfwAtoms.sourceCard,
      count: nsfwCandidates.length,
      proseFillsApplied: proseFillCount,
      candidates: nsfwCandidates.map((c) => ({
        sampleId: c.sampleId,
        comboKey: c.comboKey,
        adultRequired: c.adultRequired,
        lexiconRefs: c.lexiconRefs,
        proposedRuntimeTags: c.proposedRuntimeTags,
        nodeId: c.node.id,
        fragment: c.fragment,
        adultFragment: c.adultFragment ?? null,
        fillable: c.fillable,
        adultTextKey: c.adultTextKey,
      })),
    },
    null,
    2,
  ) + '\n',
);

p.contributions[0].actionIds=[...new Set(p.contributions.filter(c=>c.hookId===id('hook.runtime')).flatMap(c=>c.actionIds))];p.contributions=p.contributions.slice(0,1);
await mkdir('content/adventure',{recursive:true});await writeFile('content/adventure/pack.json',JSON.stringify(p,null,2)+'\n');
console.log(`Adventure content: ${p.narrativeNodes.length} narrative nodes, ${p.narrativeProfiles.length} behavior profiles, ${p.environmentEnemyRules.length} env-enemy rules, ${p.equipment.length} gear items, ${p.enemies.length} enemies, nsfw-combo samples ${nsfwCombos.length}, prose fills ${proseFillCount}.`);
