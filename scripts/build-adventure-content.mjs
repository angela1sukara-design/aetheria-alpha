import { buildPersonalityContent } from './build-personality-content.mjs';
import {proseProblem} from '../src/content/player-prose.ts';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import { loadAtoms, sampleCombos, toEncounterCandidate } from './nsfw-auto-combo/combiner.mjs';
import { mountAllWildDefeatEnemies, applyWildDefeatFills, writeWildDefeatCandidates } from './nsfw-auto-combo/wild-defeat-mount.mjs';
const json=async p=>JSON.parse(await readFile(p,'utf8'));
const index=await json('content/index.json'),base=await Promise.all(index.packs.filter(p=>!p.includes('/adventure/')&&!p.includes('/story-replay/')).map(p=>json('content/'+p)));
const id=s=>'progression:'+s,tag=s=>id('tag.'+s),scoped=(role,s)=>({role,tagId:tag(s)}),has=(role,s,value=true)=>({op:'narrative.tag',role,id:tag(s),value});
const p={manifest:{id:'aetheria/adventure',namespace:'progression',version:'1.0.0',schemaVersion:2,engineApiVersion:'0.1',author:'Aetheria',status:'draft',dependencies:base.map(p=>({id:p.manifest.id,version:p.manifest.version,optional:false})),requiresCapabilities:['foundation.v2','adventure.v1','condition.v1','effect.v1','hook.global.v1','district.v1','body.graph.v1','tf.pipeline.v1'],migrations:[]},variables:[],flags:[],hooks:[{id:id('hook.runtime'),accepts:'action',visibility:'public'}],locations:[],routes:[],actions:[],events:[],texts:{},contributions:[],globalActionHooks:[id('hook.runtime')],tags:[],narrativeNodes:[],narrativeProfiles:[],environmentEnemyRules:[],equipment:[],items:[],enemies:[],locationProfiles:[],bodyPatches:[],transformations:[]};
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
node('defeat.start','defeat','start','交锋之后','你已经失去继续交锋的力气，但仍能辨认周围的声音。你先稳住身体，判断怎样离开眼前的处境。',[choice('检查还能怎样活动','你停下无效的挣扎，检查可活动部位。','assess',[],[],[scoped('player','assessed')])]);
node('defeat.control','defeat','start','被留在原处','{opponent}先收拢现场，阻止你再次贸然行动。你仍保持清醒，可以检查限制的位置，或发声请求协助。',[choice('检查限制位置','你确认了限制所在。','assess',[],[],[scoped('player','assessed')]),choice('发声请求协助','你向公共通道清楚地发出求助。','help',[time(5)],[],[scoped('player','signal')])],{priority:5,requiresTags:[scoped('opponent','goal.control')],tendencies:[{tagId:tag('control'),weight:1}]});
node('defeat.direct','defeat','start','冲突已经结束','{opponent}确认你无法继续交锋，便结束了这次接触。你留在原地喘息，先检查伤势，再决定是否需要协助。',[choice('缓慢检查并处理擦伤','你确认伤处并完成简单处理，随后回到安全通道。',null,[time(15),health(8)]),choice('请求值班协助','你说明自己需要协助。','help',[time(5)],[],[scoped('player','signal')])],{priority:5,requiresTags:[scoped('opponent','goal.leave')],tendencies:[{tagId:tag('direct'),weight:1}]});
node('defeat.repair','defeat','start','提出检查方案','{opponent}把维护工具放在一旁，提出检查装备的方案。你仍可以拒绝，或先要求对方说明检查范围。此时尚未发生任何身体改造。',[choice('先听检查范围','对方说明检查范围，等待你的下一步决定。','repair'),choice('拒绝检查，请求离开','你拒绝这次检查，停止接触并离开。')],{priority:5,requiresTags:[scoped('opponent','goal.repair'),scoped('opponent','tools')],tendencies:[{tagId:tag('repair'),weight:1}]});
node('defeat.assess','defeat','assess','检查处境','你把注意力放回可活动部位。身体的真实结构仍然保留，眼前的限制需要分别处理；你可以继续求助，也可以沿安全路线离开。',[choice('发声请求协助','你发出求助信号。','help',[time(5)],[],[scoped('player','signal')]),choice('沿安全路线缓慢离开','你沿安全路线离开危险位置，休息后再决定下一步。',null,[time(20),health(5)])]);
node('defeat.coat','defeat','assess','找到黏附位置','外衣的下摆粘在低处【外衣黏附】，身体本身没有因此变成黑胶。你确认手边仍有可用的抓握部位，可以尝试松开外衣，或请求协助。',[choice('松开被牵住的外衣','你松开外衣的牵扯，沿台阶回到安全位置。',null,[time(15),health(5)],[grasp],[],[scoped('player','coat.stuck')]),choice('发声请求协助','你报出所在位置，请求协助。','help',[time(5)],[],[scoped('player','signal')])],{priority:5,requiresTags:[scoped('player','coat.stuck')],conditions:[grasp]});
node('defeat.hands','defeat','assess','双手暂时受限','你发现双手暂时不便取用工具。你不再强行够取物件，转而用声音说明自己所在的位置。',[choice('清楚报出位置并等待协助','你清楚报出位置。','help',[time(5)],[],[scoped('player','signal')])],{priority:6,requiresTags:[scoped('player','hands.restricted')]});
node('defeat.help','defeat','help','回应来自通道','通道里传来回应。值班人员根据你刚才报出的信息找到现场，先确认你的意识与伤处，再询问你希望接受哪些帮助。',[choice('接受脱困与基础护理','对方帮助你脱离现场，并处理了擦伤。事故情况已经记入本次经历。',null,[time(20),health(12),change('safety',1)]),choice('只请求离开危险位置','对方协助你离开危险位置，你保留之后自行处理伤势的选择。',null,[time(10),health(3)])],{requiresTags:[scoped('player','signal')]});
node('defeat.repair.scope','defeat','repair','保留自己的决定','检查范围已经说明。你可以结束检查，或要求先处理现场安全。没有相应设备与已确认身体条件的项目不会自动执行。',[choice('先处理现场安全','现场得到整理，你离开危险位置。',null,[time(10),health(3),change('safety',1)])]);
node('defeat.repair.tail','defeat','repair','机械尾的维护提议','你的尾部确为机械结构。对方提出把尾部外伸长度调整到650毫米，说明需要十五分钟。这一项只会在你明确接受后开始。',[choice('接受这一次长度调整','你明确接受本次长度调整；维护完成，尾部的真实长度记录为650毫米。',null,[{op:'tf.enqueue',id:id('tf.tail-maintenance')},time(15),health(5)],[],[scoped('player','repair.accepted')]),choice('拒绝改装，离开现场','你拒绝改装，沿安全路线离开。',null,[time(10),health(3)])],{priority:6,requiresTags:[{role:'player',tagId:'foundation:body.mechanical-tail'},scoped('opponent','tools')],conditions:[{op:'body.matches',target:{kind:'player'},part:{kind:'tail',materialFamily:'mechanical'}},{op:'tf.state',id:id('tf.tail-maintenance'),state:'idle'},{op:'not',condition:{op:'body.matches',target:{kind:'player'},part:{kind:'tail',lengthMm:650}}}]});
p.tags.push(...['surrender','giveup'].map(key=>({id:tag(key),label:key==='surrender'?'主动投降':'放弃抵抗',definition:'本次交锋主动结束时记录的应对方式。',facets:['context'],status:'active',aliases:[]})));
node('defeat.surrender','defeat','start','你选择投降','你向{opponent}示意不再交战，收起进攻的动作。对方停在你面前，等你说明接下来的打算。你仍可以开口求助，或结束这段接触。',[
 choice('等待对方回应','你停下争辩，等待{opponent}处理眼前的局面。','yielded',[time(5)]),
 choice('发声请求协助','你报出{place}的位置，请求协助。','help',[],[],[scoped('player','signal')]),
],{priority:30,requiresTags:[scoped('player','surrender')]});
node('defeat.giveup','defeat','start','停止抵抗','你放下防备，不再尝试反击或挣脱。{opponent}看见你停下，开始接手处理现场。你留在原处，等待事态继续。',[
 choice('不再干预，等待后续','你不再与{opponent}争执，任由对方接手眼前的安排。','yielded',[time(5)]),
],{priority:30,requiresTags:[scoped('player','giveup')]});
node('defeat.yielded','defeat','yielded','交锋后的安排','{opponent}把冲突留在原处，为你让出离开的位置。通道里恢复了走动声，你可以先去休息。',[
 choice('沿通道离开','你离开{place}的冲突现场，在公共通道停下来喘息。',null,[time(10)]),
]);
node('defeat.yielded.control','defeat','yielded','对方接手现场','{opponent}先把现场稳住，阻止冲突继续扩大，随后带你走向公共通道。你没有再次抵抗。',[
 choice('跟随安排，离开冲突','你随{opponent}离开冲突所在的位置，回到能够休息的通道。',null,[time(10)]),
],{priority:5,requiresTags:[scoped('opponent','goal.control')]});
node('defeat.yielded.repair','defeat','yielded','处理受损的装备','{opponent}收起工具，先查看现场有没有松脱的物件，随后把能带走的装备放在你手边。',[
 choice('等对方收拾完，再离开','你等待{opponent}清理完现场，带着自己的物品回到公共通道。',null,[time(10)]),
],{priority:5,requiresTags:[scoped('opponent','goal.repair')]});
for(const kind of ['encounter','exploration','daily','conversation','quest','transformation','ending']){
 const messages={encounter:['眼前的遭遇','你在{place}停下，留意眼前正在发生的小事。先观察当前处境，再决定是否参与。'],exploration:['查看周围','你沿{place}的可见通道查看路面与告示。已经走过的路线可以核对，尚未进入的地方仍保留未知。'],daily:['安排一段日常','你在{place}检查手边的事情，衡量当前体力与精力。可以选择一段公共协作，也可以留出时间休息。'],conversation:['与眼前的人交谈','你与已经在场的{opponent}谈起眼前的事务。你先听对方把话说完，再决定是否参与。'],quest:['核对当前事务','你把已经发生的进展与眼前的安排核对。需要进一步处理的事项仍要通过实际行动完成。'],transformation:['适应当前身体','你放慢动作，检查身体目前的支撑与活动方式。已经完成的变化以真实身体记录为准，尚在推进的项目仍需等待。'],ending:['回顾已经留下的结果','你回顾已完成的契约、协作与交锋。当前的经营份额、组织影响和街区安全仍然保留，之后的行动会继续改变它们。']};
 const [title,text]=messages[kind];
 // encounter：无「继续核对细节」；正文／选项由 encounter-prose 与地点链覆盖（见下）。
 const choices=kind==='daily'?[choice('完成一次公共协作','你完成了当前可用的公共协作。',null,[{op:'progression.act',move:'aid'}],[{op:'progression.available',move:'aid'}])]:kind==='conversation'?[choice('交换今天的近况','你们谈起已经知道的近况，这次交谈按原居民规则记录。',null,[{op:'resident.talk'}],[{op:'resident.available'}])]:kind==='exploration'?[choice('看看附近正在发生的事','你沿{place}的通道走去，留意居民和当地事务。',null,[time(5),{op:'world.encounter'}])]:kind==='transformation'?[choice('练习转身与平衡（10分钟）','你在{place}练习转身与平衡。{tfState}',null,[time(10)])]:[];
 node(kind+'.start',kind,'start',title,text,choices);
 // Keep old stage IDs readable for saved games, but no new choices lead to empty detail stages.
 if(!['daily','conversation','encounter'].includes(kind))node(kind+'.detail',kind,'detail','返回实际行动','你回到{place}的公共通道。{nearby}',[]);
}
node('exploration.night','exploration','start','夜间的通道','真实时钟已经进入夜间。你在{place}核对照明和公开告示，先确认可见的安全路线。',[choice('记下照明明确的通道','你核对并记录了当前可见的路线。',null,[time(5),change('safety',1)])],{priority:4,requiresTags:[{role:'environment',tagId:'foundation:time.night'}]});
node('transformation.tail','transformation','start','尾部动作练习','你确实拥有尾部。你放慢转身速度，确认尾部的位置和当前支撑方式；这次练习不会自动增加身体能力。',[choice('完成这一次适应练习','你完成动作练习，真实身体结构与转化进度保持一致。',null,[time(5)])],{priority:4,requiresTags:[{role:'player',tagId:'foundation:body.has-tail'}]});
node('defeat.control.cautious','defeat','start','先核对风险','{opponent}没有立刻改变现场，而是先核对周围的风险。对方要求你停止贸然发力，留出检查限制位置的时间。你可以配合检查，也可以直接提出离开。',[choice('先核对自己的处境','你用几分钟确认了限制所在。','assess',[time(5)],[],[scoped('player','assessed')]),choice('请求值班协助','你清楚说明位置，请求协助。','help',[time(5)],[],[scoped('player','signal')])],{priority:5,requiresTags:[scoped('opponent','goal.control')],tendencies:[{tagId:tag('control'),weight:1},{tagId:tag('cautious'),weight:3}]});
node('defeat.repair.cautious','defeat','start','先说明维护范围','{opponent}先把工具留在你能看见的位置，逐项说明维护范围，再等待你的决定。任何实际调整都需要你接下来的明确选择。',[choice('听清范围后再决定','你听清维护范围，保留接受或拒绝的选择。','repair',[time(5)]),choice('拒绝这次维护','你拒绝这次维护，沿安全通道离开。',null,[time(5),health(3)])],{priority:5,requiresTags:[scoped('opponent','goal.repair'),scoped('opponent','tools')],tendencies:[{tagId:tag('repair'),weight:1},{tagId:tag('cautious'),weight:3}]});
node('exploration.workshop','exploration','start','工坊里的工作','{period}，{place}的工作台旁留着一块空位。{nearby}你可以帮忙{localWork}，或认识在场的人。',[choice('参与整理工作','你把{place}的工具分门别类放好。',null,[{op:'progression.act',move:'aid'}],[{op:'progression.available',move:'aid'}]),choice('认识在场的人','你走到工作台旁，与在场的人打招呼。',null,[{op:'world.encounter',events:false}])],{priority:4,requiresTags:[{role:'environment',tagId:'foundation:service.workshop'}]});
node('daily.tired','daily','start','先恢复一些力气','你当前的体力不足以安排强度较高的工作。你可以先找个安全位置休息，恢复之后再处理当天事务。',[choice('休息半小时','你休息了半小时，体力与精力恢复。',null,[time(30),{op:'var.change',id:'core:stamina',amount:12},{op:'var.change',id:'core:energy',amount:12}])],{priority:4,conditions:[{op:'var.compare',id:'core:stamina',comparison:'lte',value:19}]});
node('conversation.progress','conversation','start','谈谈已经留下的进展','你可以向在场的{opponent}讲述已经登记的街区进展。对方的具体反应仍取决于当下的交谈，这次说明不会替对方接受新的约定。',[choice('说明近况并听取回应','你们完成这次近况交谈，原居民记忆规则记录实际发生的交流。',null,[{op:'resident.talk'}],[{op:'resident.available'}])],{priority:4,conditions:[{op:'adventure.compare',field:'reputation',comparison:'gte',value:4}]});
node('ending.resource','ending','start','核对经营成果','你逐项核对当前登记的经营份额、订单与契约。这些记录会继续参与跨日结算和终局条件，已经完成的事项不会因查看而再次奖励。',[choice('保留当前安排','你保留当前经营安排，接下来的结算仍依据实际份额。')],{priority:4,conditions:[{op:'adventure.compare',field:'assets',comparison:'gte',value:6}]});
node('ending.security','ending','start','核对交锋与巡查记录','你核对已经记录的有效胜利和街区安全。组织影响来自实际任务、协作与交锋，后续是否继续行动仍由你决定。',[choice('结束回顾，继续生活','你结束这次回顾，实际胜利与安全记录继续保留。')],{priority:4,conditions:[{op:'adventure.compare',field:'victories',comparison:'gte',value:2},{op:'adventure.compare',field:'safety',comparison:'gte',value:5}]});
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
const priceOf=slot=>slot==='held'||slot==='weapon'?25:slot==='accessory'||slot==='cosmetic'?12:30;
const part=(kind)=>({op:'body.matches',target:{kind:'player'},part:{kind}});
for(const [name,label,slot,bonuses,requires]of [
 ['blade','工坊制式工具刃','held',{attack:3},[grasp]],
 ['staff','平衡练习杖','held',{attack:2},[grasp]],
 ['vest','加固巡查背心','body',{defense:3,evasion:3},[grasp]],
 ['coat','轻型防护外套','body',{defense:2,evasion:5},[grasp]],
 ['helm','巡查护额','head',{defense:1,evasion:1},[part('head')]],
 ['gloves','工坊防护手套','hands',{defense:1},[grasp]],
 ['greaves','轻型护胫','legs',{defense:1,evasion:2},[part('leg')]],
 ['charm','街区通行挂件','accessory',{},[]],
 ['probe','工坊测量探针','held',{},[grasp]],
 ['tailguard','尾部护套','tail',{defense:1},[part('tail')]],
]){
 const eid=id('equipment.'+name);p.equipment.push({id:eid,name:label,slot,bonuses,description:label+'已穿戴；战斗时叠加装备属性，基础属性保持。',requires});
 action('buy.'+name,'购买'+label,[{op:'progression.act',move:'buy',id:eid}],[{op:'progression.available',move:'buy',id:eid}],`10分钟 · 零钱−${priceOf(slot)}`);
 action('wear.'+name,'装备'+label,[{op:'equipment.wear',id:eid}],[],'已购装备；同槽替换');
}
// 消耗品样本：恢复 / 战斗辅助 / 探索（仅已有 core 变量）；成人门类跳过
for(const [name,label,category,effects,price,usableInCombat,desc]of [
 ['salve','夜光创口胶','recovery',[{op:'var.change',id:'core:health',amount:12}],8,false,'涂抹后即时恢复生命。'],
 ['ration','电解口粮','recovery',[{op:'var.change',id:'core:energy',amount:10}],6,false,'短时补充精力。'],
 ['tonic','净水冲剂','recovery',[{op:'var.change',id:'core:stamina',amount:10}],6,false,'恢复体力。'],
 ['cell','脉冲蓄能片','combat',[{op:'var.change',id:'core:skillResource',amount:12}],10,true,'战斗中补充技能资源。'],
 ['candy','战术高糖软片','combat',[{op:'var.change',id:'core:stamina',amount:8}],8,true,'战斗中补充体力。'],
 ['calm','暗巷冷静贴','explore',[{op:'var.change',id:'core:sanity',amount:15}],15,false,'镇定药水（小）：回升理智 +15；不清除崩溃标记。'],
 ['calm.strong','深井清心饮','explore',[{op:'var.change',id:'core:sanity',amount:25}],35,false,'镇定药水（大）：回升理智 +25；不清除崩溃标记。'],
]){
 const iid=id('item.'+name);
 p.items.push({id:iid,name:label,description:desc,category,effects,price,maxStack:20,usableInCombat});
 action('buy.item.'+name,'购买'+label,[{op:'progression.act',move:'buy',id:iid}],[{op:'progression.available',move:'buy',id:iid}],`10分钟 · 零钱−${price}`);
 action('use.item.'+name,'使用'+label,[{op:'item.use',id:iid}],[{op:'item.has',id:iid,comparison:'gte',value:1}],'5分钟 · 消耗1个');
 if(usableInCombat) action('combat.item.'+name,'战内使用：'+label,[{op:'combat.turn',move:'item',id:iid}],[{op:'item.has',id:iid,comparison:'gte',value:1}],'行动点1 · 消耗1个');
}
action('combat.skill','技能击',[{op:'combat.turn',move:'skill'}],[],'技能资源−15 · 体力−4 · 行动点2');
action('combat.surrender','投降',[{op:'combat.turn',move:'surrender'}],[],'立即结束交锋，进入战败后续；不额外损失生命或体力');
action('combat.giveup','彻底放弃',[{op:'combat.turn',move:'giveup'}],[],'放弃抵抗，交由当前对手处理后续；保留本局进度');
for(const result of ['victory','escape','defeat']){
 const eid=id('event.'+result),aid=id('action.event.'+result),prompt=id('text.event.'+result),end=id('text.event.'+result+'.end');p.texts[prompt]=({victory:'交锋已经结束。实际奖励、胜利记录与街区后果已经结算。',escape:'你已经撤离这次交锋，没有获得战斗奖励。',defeat:'你暂时失去继续交锋的能力，仍可以离开并恢复。'})[result];p.texts[end]='你回到当前地点，可以休息、处理伤势或继续行动。';p.actions.push({id:aid,label:'返回安全位置',hint:'免费退出',group:'event',context:{eventId:eid,nodeId:'start'},conditions:[],effects:[{op:'event.advance',nodeId:'end'}],resultText:end});p.events.push({id:eid,startNode:'start',rating:'general',nodes:[{id:'start',type:'choice',textVariants:[prompt],actionIds:[aid],onEnter:[]},{id:'end',type:'exit',textVariants:[end],actionIds:[],onEnter:[{op:'event.exit'}]}]});
}
for(const [name,label,tier,hp,attack,defense,speed,reward,actions]of [['raider','抢占通道的游荡者','S',45,9,5,9,12,1],['sentinel','封锁通道的重装哨卫','L',90,16,12,12,28,2],['overseer','维护核心的失控监理','boss',160,18,14,11,50,2]]){
 const enemyId=id('enemy.'+name);p.enemies.push({id:enemyId,name:label,hp,reward,tier,combat:{attack,defense,speed,skillPower:attack,hit:75,evasion:8,crit:5,actionsPerTurn:actions,skillResource:0},...(tier==='boss'?{phases:[{hpRatio:0.5,defenseBonus:4,extraActions:1}]}:{}),intents:[{label:'逼近并试探',damage:5,guard:2,drain:0},{label:'稳住防护',damage:2,guard:5,drain:0},{label:'集中力量攻击',damage:12,guard:0,drain:1}],victoryEventId:id('event.victory'),defeatEventId:id('event.defeat'),escapeEventId:id('event.escape')});
 action('challenge.'+name,'挑战：'+label,[{op:'combat.start',id:enemyId}],[service(['commons','workshop']),...(tier==='L'?[{op:'adventure.compare',field:'victories',comparison:'gte',value:2}]:tier==='boss'?[{op:'adventure.compare',field:'victories',comparison:'gte',value:4},{op:'adventure.compare',field:'influence',comparison:'gte',value:4}]:[])],'观察属性后交锋；可以撤离','explore');
}
for(const [name,eid]of [['gel','district:enemy.gel'],['collector','district:enemy.collector']])action('challenge.'+name,'调查危险：'+(name==='gel'?'渠底黑胶群落':'拦路收债客'),[{op:'combat.start',id:eid}],[service(['commons','market'])],'交锋、撤离或战后恢复','explore');
for(const kind of ['encounter','exploration','daily','conversation','quest','transformation','ending']){
  const labels={encounter:'留意一次当地遭遇',exploration:'仔细查看当前环境',daily:'安排一段日常事务',conversation:'与在场居民继续交谈',quest:'核对当前进展',transformation:'练习适应当前身体',ending:'回顾已经留下的结果'};
  // 当地遭遇不强制 nsfwcombo 档案：优先地点链（城门旅馆 inn.gate）与有正文的 start；组合遭遇走专用 action。
  const effects=[{op:'narrative.start',kind}];
  const conditions=kind==='conversation'?[{op:'resident.available'}]:kind==='ending'?[{op:'adventure.compare',field:'reputation',comparison:'gte',value:1}]:[];
  const hint=kind==='encounter'?'地点场面优先（城门旅馆多拍／可读 start）；无空壳核对':'根据当前状态展开；可以免费结束';
  action('narrative.'+kind,labels[kind],effects,conditions,hint,'explore');
}
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
// —— fantasy 遭遇场面：通用回退 + 地点特化 + 城门旅馆 3 拍 ——
const encounterProse = await json('content/adventure/encounter-prose.json');
if (encounterProse.format !== 'aetheria-encounter-location-prose' || encounterProse.schemaVersion !== 1) {
  throw new Error('encounter-prose.json 格式无效。');
}
const ep = encounterProse.texts ?? {};
const takeEp = (key, fallback = '') => {
  const body = ep[key] ?? fallback;
  if (typeof body !== 'string' || !body.trim()) throw new Error('遭遇正文空槽：' + key);
  p.texts[key] = body;
  return key;
};
const freeExit = (resultKey, body = '你停下这次接触，回到可以继续行动的位置。') => {
  p.texts[resultKey] = body;
  return { label: '结束当前经历，回到安全位置', resultText: resultKey, next: null, effects: [], conditions: [], setTags: [], unsetTags: [] };
};
const sceneChoice = (label, resultKey, next = null, effects = [], conditions = []) => ({
  label, resultText: resultKey, next, effects, conditions, setTags: [], unsetTags: [],
});
takeEp(id('text.node.encounter.start'));
takeEp(id('text.choice.encounter.generic.engage'));
takeEp(id('text.choice.encounter.generic.avoid'));
takeEp(id('text.choice.encounter.generic.alt'));
{
  const startNode = p.narrativeNodes.find((n) => n.id === id('node.encounter.start'));
  if (!startNode) throw new Error('missing encounter.start');
  startNode.title = '当地的动静';
  startNode.choices = [
    sceneChoice('上前参与眼下这一幕', id('text.choice.encounter.generic.engage'), null, [time(5)]),
    sceneChoice('先退开，从安全距离观望', id('text.choice.encounter.generic.avoid'), null, [time(5)]),
    sceneChoice('换一条路绕开', id('text.choice.encounter.generic.alt'), null, [time(5)]),
    freeExit(id('text.choice.encounter.generic.exit')),
  ];
}
takeEp(id('text.node.encounter.start.street'));
p.narrativeNodes.push({
  id: id('node.encounter.start.street'), kind: 'encounter', stage: 'start', title: '公会外的动静',
  textKey: id('text.node.encounter.start.street'), requiresTags: [], excludesTags: [scoped('opponent', 'nsfwcombo.active')],
  conditions: [{ op: 'any', conditions: [{ op: 'environment.service', value: 'commons' }, { op: 'environment.service', value: 'market' }] }],
  tendencies: [], weight: 12, priority: 4, maxVisits: 1,
  choices: [
    sceneChoice('上前拦住黏液', id('text.choice.encounter.generic.engage'), null, [time(5)]),
    sceneChoice('退回公会门口观望', id('text.choice.encounter.generic.avoid'), null, [time(5)]),
    sceneChoice('改从侧巷绕开', id('text.choice.encounter.generic.alt'), null, [time(5)]),
    freeExit(id('text.choice.encounter.street.exit'), '你离开巷口，回到可以继续行动的位置。'),
  ],
});
takeEp(id('text.node.encounter.start.canal'));
p.narrativeNodes.push({
  id: id('node.encounter.start.canal'), kind: 'encounter', stage: 'start', title: '运河边的动静',
  textKey: id('text.node.encounter.start.canal'),
  requiresTags: [{ role: 'environment', tagId: 'foundation:context.waterways' }],
  excludesTags: [scoped('opponent', 'nsfwcombo.active')], conditions: [], tendencies: [], weight: 14, priority: 5, maxVisits: 1,
  choices: [
    sceneChoice('上前察看', id('text.choice.encounter.generic.engage'), null, [time(5)]),
    sceneChoice('退到桥墩后观望', id('text.choice.encounter.generic.avoid'), null, [time(5)]),
    sceneChoice('改走市场内廊绕开', id('text.choice.encounter.generic.alt'), null, [time(5)]),
    freeExit(id('text.choice.encounter.canal.exit'), '你离开缆桩边，回到可以继续行动的位置。'),
  ],
});
for (const key of [
  'text.node.encounter.inn.gate.capture','text.node.encounter.inn.gate.press','text.node.encounter.inn.gate.press.adult',
  'text.node.encounter.inn.gate.resolve','text.node.encounter.inn.gate.detail',
  'text.choice.encounter.inn.gate.engage','text.choice.encounter.inn.gate.avoid','text.choice.encounter.inn.gate.alt',
  'text.choice.encounter.inn.gate.exit','text.choice.encounter.inn.gate.press.engage','text.choice.encounter.inn.gate.press.avoid',
  'text.choice.encounter.inn.gate.press.alt','text.choice.encounter.inn.gate.resolve.detail','text.choice.encounter.inn.gate.resolve.ask',
  'text.choice.encounter.inn.gate.resolve.leave','text.choice.encounter.inn.gate.detail.poke','text.choice.encounter.inn.gate.detail.back',
  'text.choice.encounter.inn.gate.detail.ask',
]) takeEp(id(key));
const innExit = freeExit(id('text.choice.encounter.inn.gate.exit'), ep[id('text.choice.encounter.inn.gate.exit')]);
p.narrativeNodes.push({
  id: id('node.encounter.inn.gate.capture'), kind: 'encounter', stage: 'start', title: '城门旅馆的水痕',
  textKey: id('text.node.encounter.inn.gate.capture'), requiresTags: [], excludesTags: [scoped('opponent', 'nsfwcombo.active')],
  conditions: [{ op: 'environment.service', value: 'home' }], tendencies: [], weight: 20, priority: 8, maxVisits: 1,
  choices: [
    sceneChoice('上前拦住黏液', id('text.choice.encounter.inn.gate.engage'), 'inn-gate-press', [time(5)]),
    sceneChoice('退到门口观望', id('text.choice.encounter.inn.gate.avoid'), 'inn-gate-press', [time(5)]),
    sceneChoice('改走侧廊绕开', id('text.choice.encounter.inn.gate.alt'), 'inn-gate-resolve', [time(5)]),
    innExit,
  ],
});
p.narrativeNodes.push({
  id: id('node.encounter.inn.gate.press'), kind: 'encounter', stage: 'inn-gate-press', title: '黏液贴上靴尖',
  textKey: id('text.node.encounter.inn.gate.press'), requiresTags: [], excludesTags: [], conditions: [], tendencies: [],
  weight: 10, priority: 5, maxVisits: 1,
  choices: [
    sceneChoice('伸手拨开', id('text.choice.encounter.inn.gate.press.engage'), 'inn-gate-resolve', [time(5)]),
    sceneChoice('退回门廊', id('text.choice.encounter.inn.gate.press.avoid'), 'inn-gate-resolve', [time(5)]),
    sceneChoice('用桌布隔开', id('text.choice.encounter.inn.gate.press.alt'), 'inn-gate-resolve', [time(5)]),
    innExit,
  ],
});
p.narrativeNodes.push({
  id: id('node.encounter.inn.gate.press.adult'), kind: 'encounter', stage: 'inn-gate-press', title: '黏液沿腿上爬',
  textKey: id('text.node.encounter.inn.gate.press.adult'), requiresTags: [], excludesTags: [], conditions: adultGate, tendencies: [],
  weight: 10, priority: 6, maxVisits: 1,
  choices: [
    sceneChoice('并拢腿根挡住', id('text.choice.encounter.inn.gate.press.avoid'), 'inn-gate-resolve', [time(5)]),
    sceneChoice('退开', id('text.choice.encounter.inn.gate.press.avoid'), 'inn-gate-resolve', [time(5)]),
    sceneChoice('用桌布隔开接触', id('text.choice.encounter.inn.gate.press.alt'), 'inn-gate-resolve', [time(5)]),
    innExit,
  ],
});
p.narrativeNodes.push({
  id: id('node.encounter.inn.gate.resolve'), kind: 'encounter', stage: 'inn-gate-resolve', title: '水痕停住之后',
  textKey: id('text.node.encounter.inn.gate.resolve'), requiresTags: [], excludesTags: [], conditions: [], tendencies: [],
  weight: 10, priority: 5, maxVisits: 1,
  choices: [
    sceneChoice('再看一眼残迹', id('text.choice.encounter.inn.gate.resolve.detail'), 'inn-gate-detail', [time(5)]),
    sceneChoice('向值守询问', id('text.choice.encounter.inn.gate.resolve.ask'), null, [time(5)]),
    sceneChoice('转身离开堂厅', id('text.choice.encounter.inn.gate.resolve.leave'), null, []),
    innExit,
  ],
});
p.narrativeNodes.push({
  id: id('node.encounter.inn.gate.detail'), kind: 'encounter', stage: 'inn-gate-detail', title: '桌腿旁的细节',
  textKey: id('text.node.encounter.inn.gate.detail'), requiresTags: [], excludesTags: [], conditions: [], tendencies: [],
  weight: 10, priority: 5, maxVisits: 1,
  choices: [
    sceneChoice('伸手挑开布条', id('text.choice.encounter.inn.gate.detail.poke'), null, [time(5)]),
    sceneChoice('退回原处', id('text.choice.encounter.inn.gate.detail.back'), null, []),
    sceneChoice('改问值守', id('text.choice.encounter.inn.gate.detail.ask'), null, [time(5)]),
    innExit,
  ],
});

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
  // detail 组合键说明书仅保留在 texts / candidates（制作对照），不挂可玩节点，避免「核对组合原子」二次确认。
  const detailKey = id(`text.node.encounter.nsfwcombo.${slug}.detail`);
  p.texts[detailKey] = cand.texts.detail;
  const startChoices = [];
  let adultKey = null;
  const branchSlugs = new Set(['c6', 'c7']);
  if (branchSlugs.has(slug)) {
    // C6/C7：场面正文 + 参与／回避／换手段；成人槽为更高 priority 的 start 变体（非核对说明书）
    for (const arm of ['engage', 'avoid', 'alt']) {
      const rk = id(`text.choice.nsfwcombo.${slug}.${arm}`);
      takeEp(rk);
    }
    // max 4 choices: engage / avoid / alt / exit
    startChoices.push(
      sceneChoice(slug === 'c6' ? '放松膝弯迎上' : '任封眼收紧', id(`text.choice.nsfwcombo.${slug}.engage`), null, [time(5)]),
      sceneChoice(slug === 'c6' ? '夹紧腿根退开' : '扯开眼前黏液', id(`text.choice.nsfwcombo.${slug}.avoid`), null, [time(5)]),
      sceneChoice(slug === 'c6' ? '用衣角隔开' : '抬手护眼隔开', id(`text.choice.nsfwcombo.${slug}.alt`), null, [time(5)]),
    );
  }
  if (combo.adultRequired) {
    adultKey = id(`text.node.encounter.nsfwcombo.${slug}.adult`);
    p.texts[adultKey] = [
      `【可填成人正文槽 · ${combo.sampleId} · ${combo.comboKey}】`,
      '占位：在此写入同意前提下的成人向遭遇描写（材质×部位×动作）。',
      '关闭 adultOptional 或不满足成年资格时，玩家看不到本选项；主节点中性 fragment 仍可用。',
      '勿写未成年人；勿伪造 foundation:*；勿写物种 TF 专条。',
      `lexiconRefs：${combo.lexiconRefs.join('、')}`,
    ].join('\n');
    if (!branchSlugs.has(slug)) {
      const adultResult = id(`text.choice.nsfwcombo.${slug}.adult`);
      p.texts[adultResult] = '你留意着当下的贴身感官细节，仍可随时抽身离开。';
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
  }
  startChoices.push(exit());
  if (startChoices.length > 4) throw new Error(`nsfwcombo.${slug} choices>${4}`);
  p.narrativeNodes.push({
    ...cand.node,
    choices: startChoices,
  });
  if (adultKey && branchSlugs.has(slug)) {
    // 成人门开启时优先抽成人场面 start（同 requiresTags），选项与中性一致
    p.narrativeNodes.push({
      id: id(`node.encounter.nsfwcombo.${slug}.adult`),
      kind: 'encounter',
      stage: 'start',
      title: `${combo.title} · 成人`,
      textKey: adultKey,
      requiresTags: [scoped('opponent', 'nsfwcombo.active')],
      excludesTags: [],
      conditions: adultGate,
      tendencies: [],
      weight: 10,
      priority: 6,
      maxVisits: 1,
      choices: startChoices.map((c) => ({ ...c })),
    });
  } else if (adultKey) {
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
    detailPlayable: false,
    adultTextKey: adultKey,
    startNodeId: cand.node.id,
    detailNodeId: null,
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
      gameplayFilter: nsfwAtoms.playtestFilter ?? null,
      emptyShellDisabled: true,
      note: '当地遭遇优先地点链／可读 start；nsfwcombo 走专用 action；空壳核对与组合键 detail 不可玩。',
      howToVerifyNoEmptyGateInn: encounterProse.howToVerifyNoEmptyGateInn ?? [
        '一键 fantasy → 城门旅馆 → 留意一次当地遭遇 → 应为 inn.gate capture，无空壳核对。',
      ],
      candidates: nsfwCandidates.map((c) => ({
        sampleId: c.sampleId,
        comboKey: c.comboKey,
        gameplay: c.gameplay ?? null,
        fantasyNpcKind: c.fantasyNpcKind ?? null,
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


// —— fantasy 战败后 8 玩法大类（含敌方属性/性癖、现场态挂载清理、双方反应规则与 escape/marked/tf 三结局）——
p.flags.push({ id: id('flag.aftermath.mark'), initial: false });
(p.materials ??= []).push(
  { id: id('material.slime-mucus'), label: '生物黏液覆层', family: 'organic' },
  { id: id('material.living-latex'), label: '活体黑胶覆层', family: 'organic' },
);
(p.morphologies ??= []).push(
  { id: id('morphology.slime-coated'), label: '黏液包裹态', kinds: ['arm', 'hand', 'leg', 'foot', 'tail'] },
  { id: id('morphology.latex-sheathed'), label: '黑胶紧缚态', kinds: ['arm', 'hand', 'leg', 'foot', 'tail'] },
);
for (const [key, label, definition] of [
  ['attr.mucus', '黏液分泌', '敌方属性：体表或腺体持续分泌高粘度生物黏液。'],
  ['attr.tentacle', '触手附肢', '敌方属性：具备柔韧可延展的触手或软体附肢。'],
  ['attr.vine', '藤蔓缠卷', '敌方属性：具备植物藤蔓、气根与缠绕茎结构。'],
  ['attr.gel-body', '流体胶质躯体', '敌方属性：由半透明史莱姆或活体黑胶构成的流体躯干。'],
  ['attr.chitin', '甲壳外骨骼', '敌方属性：覆盖节肢甲片与细密刚毛的虫巢躯体。'],
  ['attr.pheromone', '感官干扰气息', '敌方属性：散发干扰感官与注意力的甜腥气雾或低频共鸣，不视为自愿同意。'],
  ['attr.pack', '群聚围猎', '敌方属性：习惯多体协同包抄、轮番消耗猎物体力。'],
  ['attr.warm-saliva', '温热涎液', '敌方属性：口腔分泌大量滑腻温热的垂涎。'],
  ['fetish.restraint', '束缚拘禁倾向', '性癖倾向：偏爱缠绕手腕脚踝、悬吊或限制行动自由（对应 G1）。'],
  ['fetish.coating', '材质覆层倾向', '性癖倾向：偏爱用黏液、凝胶或活体黑胶包裹涂覆猎物体表（对应 G2）。'],
  ['fetish.penetration', '贴身侵入倾向', '性癖倾向：偏爱紧密贴合与深入侵入式的压迫接触（对应 G3）。'],
  ['fetish.sensory-deprivation', '感官封夺倾向', '性癖倾向：偏爱遮蔽视线、封堵口鼻与剥夺外部感知（对应 G4）。'],
  ['fetish.oviposition', '温床寄宿倾向', '性癖倾向：偏爱灌注营养液或将猎物作为虫巢温床（对应 G5）。'],
  ['fetish.humiliation', '失态展示倾向', '性癖倾向：偏爱剥除防具衣物、迫使猎物显露狼狈姿态（对应 G6）。'],
  ['fetish.domination', '支配驯服倾向', '性癖倾向：偏爱通过指令低语、节奏控制与姿势引导迫使顺从（对应 G7）。'],
  ['fetish.swarm', '多体合围倾向', '性癖倾向：偏爱从多角度同时纠缠多个部位使其无暇顾及（对应 G8）。'],
  ['defeat.loosened', '挣脱松动', '战败对抗中玩家借力挣松了束缚或牵制。'],
  ['defeat.soaked', '覆层浸染', '战败对抗中玩家体表被异质黏液或黑胶深度浸染。'],
  ['state.bound', '束缚状态', '现场态：四肢或躯干正处于束带、藤蔓或黏丝束缚之中。'],
  ['state.coated', '涂覆状态', '现场态：体表局部正被黏液、垂涎或活体胶层涂覆。'],
  ['state.suspended', '悬吊受制', '现场态：手腕或脚踝被藤蔓或束带拉高，重心悬垂受制。'],
  ['state.gagged', '口封中', '感官现场态：口唇被胶膜、口球、触手或藤条封堵，发声受阻。'],
  ['state.blindfolded', '眼封中', '感官现场态：视线被眼罩、黏液膜、触手或藤条遮蔽。'],
  ['state.ear-sealed', '耳封中', '感官现场态：耳廓被软塞或胶膜覆住，外界声响闷钝。'],
  ['state.sensory-deprived', '感官剥夺中', '感官现场态：视觉、听觉或发声通道处于多重受限状态（≠性癖标签）。'],
  ['state.cocooned', '被茧缚', '现场态：身体被致密丝茧或黏丝包裹固定（E4 茧维）。'],
  ['state.exposed', '衣料敞露', '现场态：外衣或防具被扯开滑落，局部肌肤暴露在外。'],
]) p.tags.push({ id: tag(key), label, definition, facets: ['context'], status: 'active', aliases: [] });

for (const [key, label, definition] of [
  ['body.slime-coated', '黏液化体表', '派生事实：身体部位表面带有生物黏液覆层材质。'],
  ['body.latex-sheathed', '黑胶化体表', '派生事实：身体部位表面带有活体黑胶覆层材质。'],
  ['body.wolf-ears', '狼耳特征', '派生事实：头部具有狼耳部件。'],
]) p.tags.push({ id: tag(key), label, definition, facets: ['body'], status: 'active', aliases: [] });

(p.derivedTags ??= []).push(
  { id: id('derive.slime-coated'), tagId: tag('body.slime-coated'), subject: 'entity', when: { op: 'body.matches', target: { kind: 'player' }, part: { materialId: id('material.slime-mucus') } } },
  { id: id('derive.latex-sheathed'), tagId: tag('body.latex-sheathed'), subject: 'entity', when: { op: 'body.matches', target: { kind: 'player' }, part: { materialId: id('material.living-latex') } } },
  { id: id('derive.wolf-ears'), tagId: tag('body.wolf-ears'), subject: 'entity', when: { op: 'body.hasPart', target: { kind: 'player' }, definitionId: 'aetheria-tf:part.ear.wolf' } },
);

// 可玩 TF 仅保留通用「黏液化 / 黑胶化」与洗净恢复（物种专条甲质/藤膜/兽尾已移除/hold）
p.bodyPatches.push(
  { id: id('patch.slime-legs'), label: '下肢黏液化覆层', summary: '双腿与双足覆上柔滑半透明的生物黏液层', operations: ['leg.left', 'leg.right', 'foot.left', 'foot.right'].map(partId => ({ type: 'attributes', partId, set: { materialId: id('material.slime-mucus'), morphologyId: id('morphology.slime-coated'), color: 'silver' }, unset: [] })) },
  { id: id('patch.slime-arms'), label: '上肢黏液化覆层', summary: '双臂与双手覆上柔滑半透明的生物黏液层', operations: ['arm.left', 'arm.right', 'hand.left', 'hand.right'].map(partId => ({ type: 'attributes', partId, set: { materialId: id('material.slime-mucus'), morphologyId: id('morphology.slime-coated'), color: 'silver' }, unset: [] })) },
  { id: id('patch.latex-legs'), label: '下肢黑胶化包覆', summary: '双腿与双足贴合柔韧光滑的活体黑胶层', operations: ['leg.left', 'leg.right', 'foot.left', 'foot.right'].map(partId => ({ type: 'attributes', partId, set: { materialId: id('material.living-latex'), morphologyId: id('morphology.latex-sheathed'), color: 'black' }, unset: [] })) },
  { id: id('patch.latex-arms'), label: '上肢黑胶化包覆', summary: '双臂与双手贴合柔韧光滑的活体黑胶层', operations: ['arm.left', 'arm.right', 'hand.left', 'hand.right'].map(partId => ({ type: 'attributes', partId, set: { materialId: id('material.living-latex'), morphologyId: id('morphology.latex-sheathed'), color: 'black' }, unset: [] })) },
  { id: id('patch.cleanse-limbs'), label: '洗净体表异质覆层', summary: '四肢与手足恢复原本洁净的肌肤质感', operations: ['arm.left', 'arm.right', 'hand.left', 'hand.right', 'leg.left', 'leg.right', 'foot.left', 'foot.right'].map(partId => ({ type: 'attributes', partId, set: {}, unset: ['materialId', 'morphologyId', 'color'] })) },
);
p.texts[id('text.tf.slime.seep')] = '微凉滑腻的生物黏液顺着肌肤纹理延展，表面渐渐形成一层水润的半透明薄膜。';
p.texts[id('text.tf.slime.legs')] = '双腿与双足完全被柔韧的生物黏液覆层包裹，迈步之间带着温润的回弹质感。';
p.texts[id('text.tf.slime.arms')] = '黏液覆层进一步漫过双臂与掌心，体表呈现均匀莹润的半透明光泽，同时保留自主活动能力。';
p.texts[id('text.tf.latex.adhere')] = '残留的活体黑胶随体温软化延展，顺着四肢轮廓紧密收束贴合。';
p.texts[id('text.tf.latex.legs')] = '双腿与足踝被浑然一体的哑光黑胶覆层包裹，包裹感紧密而富有弹性。';
p.texts[id('text.tf.latex.arms')] = '活体黑胶覆层延伸至双臂与十指，宛如第二层光滑的紧身外肤。';
p.texts[id('text.tf.cleanse.done')] = '你用温水与中和剂仔细洗去四肢表面的异质覆层，肌肤恢复了原本清爽的触感。';
p.transformations.push(
  { id: id('tf.slime-coating'), label: '通用黏液化浸染', source: 'story', stages: [
    { id: 'seep', label: '前兆：黏膜延展', atMinutes: 10, textKey: id('text.tf.slime.seep') },
    { id: 'legs', label: '下肢黏液化覆层', atMinutes: 25, patchId: id('patch.slime-legs'), textKey: id('text.tf.slime.legs') },
    { id: 'arms', label: '四肢黏液化完成', atMinutes: 45, patchId: id('patch.slime-arms'), textKey: id('text.tf.slime.arms') },
  ] },
  { id: id('tf.latex-coating'), label: '通用黑胶化包覆', source: 'story', stages: [
    { id: 'adhere', label: '前兆：黑胶贴合', atMinutes: 10, textKey: id('text.tf.latex.adhere') },
    { id: 'legs', label: '下肢黑胶化包覆', atMinutes: 25, patchId: id('patch.latex-legs'), textKey: id('text.tf.latex.legs') },
    { id: 'arms', label: '四肢黑胶化完成', atMinutes: 45, patchId: id('patch.latex-arms'), textKey: id('text.tf.latex.arms') },
  ] },
  { id: id('tf.cleanse-coatings'), label: '洗净体表异质覆层', source: 'free', stages: [
    { id: 'clean', label: '恢复清爽体表', atMinutes: 0, patchId: id('patch.cleanse-limbs'), textKey: id('text.tf.cleanse.done') },
  ] },
);
const anyCoatingCondition = {
  op: 'any',
  conditions: [
    { op: 'body.matches', target: { kind: 'player' }, part: { materialId: id('material.slime-mucus') } },
    { op: 'body.matches', target: { kind: 'player' }, part: { materialId: id('material.living-latex') } },
  ],
};
const cleanseActionId = action('tf.cleanse-coatings', '洗净体表异质覆层', [{ op: 'tf.apply', id: id('tf.cleanse-coatings') }, { op: 'flag.set', id: id('flag.aftermath.mark'), value: false }], [anyCoatingCondition], '即时清理四肢黏液或黑胶覆层', 'daily');
const cleanseActionDef = p.actions.find(a => a.id === cleanseActionId);
if (cleanseActionDef) cleanseActionDef.surface = 'body';

node('transformation.slime', 'transformation', 'start', '适应黏液化覆层', '你低头审视四肢表面那层半透明的生物黏液覆层。微凉滑腻的薄膜随着你的呼吸微微起伏，你屈伸手指试了试覆层的回弹力道，水润的触感始终贴合着手腕与小腿。', [
  choice('顺应黏液覆层舒展肢体', '你配合着表面黏膜的弹性舒展四肢，动作显得格外柔顺轻巧。', null, [time(10), { op: 'var.change', id: 'core:stamina', amount: 8 }, { op: 'var.change', id: 'core:energy', amount: 6 }]),
  choice('洗去体表的生物黏液覆层', '你取来清水与中和剂洗净四肢，皮肤恢复了原本干爽的触感。', null, [{ op: 'tf.apply', id: id('tf.cleanse-coatings') }, { op: 'flag.set', id: id('flag.aftermath.mark'), value: false }, time(5)]),
], { priority: 6, requiresTags: [scoped('player', 'body.slime-coated')] });
node('transformation.latex', 'transformation', 'start', '适应黑胶化包覆', '你活动着被活体黑胶紧密包裹的四肢。哑光黑胶顺着肌肉线条收束贴合，每一次屈伸都传来清晰的回弹支撑力，手腕边缘的胶层随着脉搏微微收紧。', [
  choice('配合黑胶张力练习发力', '你借着黑胶覆层的回弹张力稳住步态，体能与专注度随之回升。', null, [time(10), { op: 'var.change', id: 'core:stamina', amount: 8 }, { op: 'var.change', id: 'core:skillResource', amount: 8 }]),
  choice('剥离并洗净活体黑胶覆层', '你顺着边缘缓缓卸下黑胶覆层，四肢重新呼吸到清爽的空气。', null, [{ op: 'tf.apply', id: id('tf.cleanse-coatings') }, { op: 'flag.set', id: id('flag.aftermath.mark'), value: false }, time(5)]),
], { priority: 6, requiresTags: [scoped('player', 'body.latex-sheathed')] });

// —— B1 事后体表残迹支线（只保留通用黏液化 / 黑胶化 + 洗净，与恶堕彻底分开）——
p.tags.push(
  {
    id: tag('residue.trace.active'),
    label: '战后体表残迹追查激活',
    definition: '故事局部：玩家在安全状态下主动检视战败留下的体表残迹与覆层感应（独立事后 TF 支线）。',
    facets: ['context'],
    status: 'active',
    aliases: [],
  },
  {
    id: tag('aftermath.corruption.active'),
    label: '事后余韵沉溺支线激活',
    definition: '故事局部：玩家在开启成人偏好且带有战后残迹标记时，主动进入事后余韵与顺从倾向回响（独立 B2 心性支线，与 TF 分开）。',
    facets: ['context'],
    status: 'active',
    aliases: [],
  },
);
p.narrativeProfiles.push(
  {
    id: id('profile.residue.trace'),
    tags: [tag('residue.trace.active')],
    goals: [],
    tendencies: [],
    defeatTags: [],
  },
  {
    id: id('profile.aftermath.corruption'),
    tags: [tag('aftermath.corruption.active')],
    goals: [],
    tendencies: [],
    defeatTags: [],
  },
);
node('transformation.residue.start', 'transformation', 'start', '检视战后体表残迹与转化感应', '你在{place}寻了一处僻静角落，挽起衣袖细看先前交锋留下的体表残迹。腕踝与小腿外侧还留着异质接触后的微凉触感，表层覆膜随着体温微微贴合起伏。你按住手腕边缘，权衡着如何处置这层残迹。', [
  choice('彻底洗净残迹，平复身心', '你仔细擦净衣角与皮肤上的残留痕迹，体表那丝异样的感应随之消散。', null, [{ op: 'flag.set', id: id('flag.aftermath.mark'), value: false }, time(10), health(6), { op: 'var.change', id: 'core:sanity', amount: 6 }]),
  choice('顺应体表感应，引导覆层转化', '你放缓呼吸，任由手腕与脚踝处的异质覆层顺着肌肤纹理继续延展。', 'residue-deepen', [time(10)]),
  choice('静心调息等待覆层演化', '你静下心来调息片刻，体会着体表覆层渐进贴合的变化。{tfState}', null, [time(20), { op: 'var.change', id: 'core:energy', amount: 6 }]),
], { priority: 10, requiresTags: [scoped('opponent', 'residue.trace.active')] });
node('transformation.residue.deepen', 'transformation', 'residue-deepen', '选择体表覆层转化方向', '随着你放松对表层残迹的抵御，四肢肌肤表面泛起清晰的包覆感。微凉的水润黏膜与紧密收束的弹性胶层分别在腕踝处浮现征兆，等待你作出取舍。', [
  choice('接纳通用黏液化覆层', '你顺应水润滑腻的包裹感，任由通用黏液化覆层沿着四肢缓缓延展。', null, [{ op: 'tf.enqueue', id: id('tf.slime-coating') }, time(15)], [{ op: 'tf.state', id: id('tf.slime-coating'), state: 'idle' }]),
  choice('接纳通用黑胶化包覆', '你顺应紧密收束的弹性张力，任由通用黑胶化包覆顺着四肢渐渐成型。', null, [{ op: 'tf.enqueue', id: id('tf.latex-coating') }, time(15)], [{ op: 'tf.state', id: id('tf.latex-coating'), state: 'idle' }]),
  choice('取水洗去体表残迹', '你取来清水将四肢表层的残迹洗净，皮肤重归清爽。', null, [{ op: 'flag.set', id: id('flag.aftermath.mark'), value: false }, time(10), health(4)]),
], { priority: 8, requiresTags: [scoped('opponent', 'residue.trace.active')] });
action('residue.trace', '检视战后体表残迹与转化感应', [{ op: 'narrative.start', kind: 'transformation', profileId: id('profile.residue.trace') }], [{ op: 'flag.has', id: id('flag.aftermath.mark'), value: true }], '战后体表留痕可自主洗净，或引导黏液化/黑胶化覆层', 'explore');

// —— B2 独立恶堕入口：事后余韵与支配回响（只做心性和叙事，与 TF 彻底分开）——
node('transformation.corruption.start', 'transformation', 'start', '回味战后余韵与支配回响', '你在{place}寻了一处无人打扰的角落坐下，呼吸渐渐平缓，先前受制时腕踝被死死箍紧的压迫感却仍在皮肤表层隐隐发烫。耳畔似乎还回荡着交锋落败那刻急促的喘息与近在咫尺的声响，胸口随之泛起一阵陌生而细密的悸动。你垂下目光按住手腕上的压痕，指尖在微凉的衣袖边缘停住。', [
  choice('闭目沉入受制时的悸动余韵', '你闭上双目，任由那股被压制时的悸动在胸口漫开，身体对束缚与支配的适应随之加深。', null, [time(15), { op: 'var.change', id: 'core:submissionTendency', amount: 6 }, { op: 'var.change', id: 'core:desire', amount: 6 }, { op: 'var.change', id: 'core:aftertaste', amount: 8 }]),
  choice('定神敛息，拂去脑海中的支配回响', '你用冷水拍了拍面颊，将残留的杂念与体表残迹一并清理干净，心神重新恢复清明。', null, [{ op: 'flag.set', id: id('flag.aftermath.mark'), value: false }, time(10), { op: 'var.change', id: 'core:sanity', amount: 8 }, { op: 'var.change', id: 'core:confidence', amount: 4 }]),
], { priority: 10, requiresTags: [scoped('opponent', 'aftermath.corruption.active')], conditions: [{ op: 'preference.adultOptional', value: true }] });
action('aftermath.corruption', '回味战后余韵与支配回响', [{ op: 'narrative.start', kind: 'transformation', profileId: id('profile.aftermath.corruption') }], [{ op: 'flag.has', id: id('flag.aftermath.mark'), value: true }, { op: 'preference.adultOptional', value: true }], '独立事后心性支线 · 可自选加深顺从余韵或彻底平复', 'explore');

// 为已有基础档案、敌人与环境选敌规则补齐属性/性癖与组合池配置
const baseProfileExtras = {
  gel: { speciesKind: 'slime', attributeTags: [tag('attr.gel-body'), tag('attr.mucus')], fetishTags: [tag('fetish.coating'), tag('fetish.restraint')], fetishTendencies: [{ tagId: tag('fetish.coating'), weight: 85 }, { tagId: tag('fetish.restraint'), weight: 65 }], defeatCombo: { materials: ['M5', 'M6'], parts: ['脚踝', '手腕', '腰侧'], plays: ['G2', 'G1'], tfs: ['黑胶化'] } },
  collector: { speciesKind: 'human', attributeTags: [], fetishTags: [tag('fetish.restraint'), tag('fetish.humiliation')], fetishTendencies: [{ tagId: tag('fetish.restraint'), weight: 60 }, { tagId: tag('fetish.humiliation'), weight: 55 }], defeatCombo: { materials: ['M5'], parts: ['手腕', '脖颈'], plays: ['G1', 'G6'], tfs: ['黑胶化'] } },
  scavenger: { speciesKind: 'construct', attributeTags: [tag('attr.tentacle')], fetishTags: [tag('fetish.restraint'), tag('fetish.domination')], fetishTendencies: [{ tagId: tag('fetish.restraint'), weight: 75 }, { tagId: tag('fetish.domination'), weight: 60 }], defeatCombo: { materials: ['M5', 'M6'], parts: ['手腕', '脚踝', '腰侧'], plays: ['G1', 'G7'], tfs: ['黑胶化'] } },
  raider: { speciesKind: 'human', attributeTags: [tag('attr.pack')], fetishTags: [tag('fetish.restraint'), tag('fetish.humiliation')], fetishTendencies: [{ tagId: tag('fetish.restraint'), weight: 65 }, { tagId: tag('fetish.humiliation'), weight: 60 }], defeatCombo: { materials: ['M4', 'M5'], parts: ['手腕', '腰侧', '大腿内侧'], plays: ['G1', 'G6'], tfs: ['黏液化'] } },
  sentinel: { speciesKind: 'construct', attributeTags: [tag('attr.tentacle')], fetishTags: [tag('fetish.restraint'), tag('fetish.sensory-deprivation')], fetishTendencies: [{ tagId: tag('fetish.restraint'), weight: 90 }, { tagId: tag('fetish.sensory-deprivation'), weight: 70 }], defeatCombo: { materials: ['M5', 'M6'], parts: ['手腕', '脚踝', '脖颈'], plays: ['G1', 'G4'], tfs: ['黑胶化'] } },
  overseer: { speciesKind: 'construct', attributeTags: [tag('attr.tentacle'), tag('attr.pheromone')], fetishTags: [tag('fetish.domination'), tag('fetish.coating'), tag('fetish.restraint')], fetishTendencies: [{ tagId: tag('fetish.domination'), weight: 90 }, { tagId: tag('fetish.coating'), weight: 80 }, { tagId: tag('fetish.restraint'), weight: 75 }], defeatCombo: { materials: ['M5', 'M6'], parts: ['手腕', '脖颈', '腰侧', '大腿内侧'], plays: ['G7', 'G2', 'G1'], tfs: ['黑胶化'] } },
};
for (const [k, extra] of Object.entries(baseProfileExtras)) {
  const prof = p.narrativeProfiles.find(x => x.id === id('profile.' + k));
  if (prof) Object.assign(prof, extra);
  const en = p.enemies.find(x => x.id === id('enemy.' + k));
  if (en) Object.assign(en, extra);
}
const baseEnvRuleExtras = {
  'gel.canal': { speciesKind: 'slime', attributeTags: [tag('attr.gel-body'), tag('attr.mucus')], fetishTags: [tag('fetish.coating'), tag('fetish.restraint')] },
  'scavenger.canal': { speciesKind: 'construct', attributeTags: [tag('attr.tentacle')], fetishTags: [tag('fetish.restraint')] },
  'scavenger.workshop': { speciesKind: 'construct', attributeTags: [tag('attr.tentacle')], fetishTags: [tag('fetish.restraint'), tag('fetish.domination')] },
  'collector.station': { speciesKind: 'human', fetishTags: [tag('fetish.restraint')] },
  'collector.market': { speciesKind: 'human', fetishTags: [tag('fetish.humiliation')] },
};
for (const [k, extra] of Object.entries(baseEnvRuleExtras)) {
  const r = p.environmentEnemyRules.find(x => x.id === id('env-enemy.' + k));
  if (r) Object.assign(r, extra);
}

const ALL_LIVE_STATE_KEYS = [
  'state.bound',
  'state.coated',
  'state.suspended',
  'state.gagged',
  'state.blindfolded',
  'state.ear-sealed',
  'state.sensory-deprived',
  'state.cocooned',
  'state.exposed',
];
const ALL_LIVE_STATE_TAGS = ALL_LIVE_STATE_KEYS.map(k => scoped('player', k));
const ALL_DEFEAT_CLEANUP_TAGS = [
  ...ALL_LIVE_STATE_TAGS,
  scoped('player', 'defeat.loosened'),
  scoped('player', 'defeat.soaked'),
];
const defeatExit = () => ({
  ...exit(),
  unsetTags: ALL_DEFEAT_CLEANUP_TAGS,
});

const defeatPlayStageChain = ['capture', 'press', 'peak', 'resolve'];
const defeatPlayMeta = [
  { n: 1, key: 'G1', name: '束缚制服', multiBeat: true, fetishTag: 'fetish.restraint', entryStates: ['state.bound'], pressStates: ['state.bound', 'state.suspended'], peakStates: ['state.bound', 'state.suspended'] },
  { n: 2, key: 'G2', name: '材质覆层转化', multiBeat: true, fetishTag: 'fetish.coating', entryStates: ['state.coated'], pressStates: ['state.coated', 'state.bound'], peakStates: ['state.coated', 'state.bound'] },
  { n: 3, key: 'G3', name: '侵犯插入', multiBeat: true, fetishTag: 'fetish.penetration', entryStates: ['state.bound', 'state.exposed'], pressStates: ['state.bound', 'state.exposed'], peakStates: ['state.bound', 'state.exposed', 'state.coated'] },
  { n: 4, key: 'G4', name: '口封感官剥夺', multiBeat: true, fetishTag: 'fetish.sensory-deprivation', entryStates: ['state.gagged', 'state.blindfolded'], pressStates: ['state.gagged', 'state.blindfolded', 'state.ear-sealed'], peakStates: ['state.gagged', 'state.blindfolded', 'state.ear-sealed', 'state.sensory-deprived'] },
  { n: 5, key: 'G5', name: '产卵灌注', multiBeat: true, fetishTag: 'fetish.oviposition', entryStates: ['state.bound', 'state.cocooned'], pressStates: ['state.bound', 'state.cocooned'], peakStates: ['state.cocooned', 'state.coated'] },
  { n: 6, key: 'G6', name: '公开羞辱', multiBeat: true, fetishTag: 'fetish.humiliation', entryStates: ['state.exposed', 'state.bound'], pressStates: ['state.exposed', 'state.suspended'], peakStates: ['state.exposed', 'state.suspended'] },
  { n: 7, key: 'G7', name: '主从调教', multiBeat: true, fetishTag: 'fetish.domination', entryStates: ['state.bound', 'state.gagged'], pressStates: ['state.bound', 'state.blindfolded'], peakStates: ['state.sensory-deprived', 'state.gagged'] },
  { n: 8, key: 'G8', name: '多体围攻', multiBeat: true, fetishTag: 'fetish.swarm', entryStates: ['state.bound', 'state.coated'], pressStates: ['state.exposed', 'state.cocooned'], peakStates: ['state.ear-sealed', 'state.sensory-deprived'] },
];
const defeatStageTitle = { capture: '捕捉', press: '加压', peak: '高峰', resolve: '收束' };
const defeatContinueLabel = {
  capture: '继续：加压收紧',
  press: '继续：推向高峰',
  peak: '继续：收束脱困',
};
p.tags.push({
  id: tag('defeat.play.active'),
  label: '战败玩法入口激活',
  definition: '故事局部：本次进入 fantasy 战败后 8 玩法大类入口；不等于词库审定，不授予身体能力，不表示脱困/转化/催眠已结算。',
  facets: ['context'],
  status: 'active',
  aliases: [],
});
for (const play of defeatPlayMeta) {
  p.tags.push({
    id: tag(`defeat.play.${play.key.toLowerCase()}`),
    label: play.name,
    definition: `故事局部：战败后玩法大类「${play.name}」选材入口；词条≠玩法≠数值；不表示该玩法效果已结算。`,
    facets: ['context'],
    status: 'active',
    aliases: [],
  });
}
p.narrativeProfiles.push({
  id: id('profile.defeat.play'),
  tags: [tag('defeat.play.active')],
  goals: [],
  tendencies: [],
  defeatTags: [],
});
const playHubChoices = [];
const defeatStageId = (n, stage, adult = false) => {
  const pad = String(n).padStart(2, '0');
  if (stage === 'capture' && !adult) return `play-${pad}`;
  return adult ? `play-${pad}-${stage}-adult` : `play-${pad}-${stage}`;
};
const tailGrip = { op: 'body.hasCapability', capability: 'tailGrip', count: 1 };
const canCounterBreak = {
  op: 'any',
  conditions: [
    grasp,
    tailGrip,
    { op: 'var.compare', id: 'core:stamina', comparison: 'gte', value: 25 },
  ],
};
const hasPlayableTfCondition = {
  op: 'any',
  conditions: [
    { op: 'opponent.matches', tf: '黏液化' },
    { op: 'opponent.matches', tf: '黑胶化' },
  ],
};

for (const play of defeatPlayMeta) {
  const g = `g${play.n}`;
  const pad = String(play.n).padStart(2, '0');
  const stages = play.multiBeat ? defeatPlayStageChain : ['capture'];
  const toPlay = id(`text.choice.defeat.${g}.enter`);
  p.texts[toPlay] = '{opponent}逼近身侧，{part}处的{material}随之收紧，你仍可随时设法中断并抽身离开。';
  playHubChoices.push({
    label: `进入：${play.name}`,
    resultText: toPlay,
    next: defeatStageId(play.n, 'capture'),
    effects: [time(5)],
    conditions: [],
    setTags: [
      scoped('player', `defeat.play.${play.key.toLowerCase()}`),
      ...play.entryStates.map(s => scoped('player', s)),
    ],
    unsetTags: [],
  });
  for (let si = 0; si < stages.length; si++) {
    const stage = stages[si];
    const nextStage = stages[si + 1];
    const textKey = id(`text.node.defeat.${g}.${stage}`);
    const adultKey = id(`text.node.defeat.${g}.${stage}.adult`);
    const nodeId = id(`node.defeat.${g}.${stage}`);
    const adultNodeId = id(`node.defeat.${g}.${stage}.adult`);
    const stageId = defeatStageId(play.n, stage);
    const adultStageId = defeatStageId(play.n, stage, true);
    p.texts[textKey] = `【可填中性槽·${defeatStageTitle[stage]} ${stage} · ${play.name}】战败后，{opponent}靠近；{material}（定词挂前）贴向{part}。关闭成人偏好时使用本槽。通用转化仅「{tf}」占位，未写入。`;
    p.texts[adultKey] = `【可填成人正文槽 · ${play.name} · ${stage}】占位：同意前提下的成人向战败玩法描写。{opponent} / {material} / {part}。勿写未成年人；勿伪造 foundation:*。`;
    const adultChoiceText = id(`text.choice.defeat.${g}.${stage}.adult`);
    p.texts[adultChoiceText] = '你留意着当下的贴身感官细节，仍可随时抽身离开。';
    const stageTransitionTags = nextStage === 'press'
      ? play.pressStates.map(s => scoped('player', s))
      : nextStage === 'peak'
      ? play.peakStates.map(s => scoped('player', s))
      : [];
    const choices = [];
    if (nextStage) {
      const contKey = id(`text.choice.defeat.${g}.${stage}.continue`);
      p.texts[contKey] = `处境进一步向「${defeatStageTitle[nextStage]}」阶段推进，你仍可随时中断离开。`;
      choices.push({
        label: defeatContinueLabel[stage],
        resultText: contKey,
        next: defeatStageId(play.n, nextStage),
        effects: [time(5)],
        conditions: [],
        setTags: stageTransitionTags,
        unsetTags: [],
      });
    }
    if (stage === 'peak') {
      const breakKey = id(`text.choice.defeat.${g}.peak.break`);
      p.texts[breakKey] = '你趁{opponent}攻势收拢到顶点的一瞬，借着肢体支撑猛然挣开{part}处的{material}牵制。';
      choices.push({
        label: '借力挣脱反制',
        resultText: breakKey,
        next: `play-${pad}-resolve-escape`,
        effects: [time(5), { op: 'var.change', id: 'core:stamina', amount: -4 }],
        conditions: [canCounterBreak],
        setTags: [scoped('player', 'defeat.loosened')],
        unsetTags: [],
      });
    }
    if (stage === 'resolve') {
      const soakKey = id(`text.choice.defeat.${g}.resolve.soak`);
      p.texts[soakKey] = '你感到{part}处的{material}正渗入表皮纹理，四肢浮现出覆层转化的前兆感应。';
      choices.push({
        label: '检视体表覆层与转化感应',
        resultText: soakKey,
        next: `play-${pad}-resolve-tf`,
        effects: [time(5)],
        conditions: [hasPlayableTfCondition],
        setTags: [scoped('player', 'defeat.soaked'), scoped('player', 'state.coated')],
        unsetTags: [],
      });
      const markKey = id(`text.choice.defeat.${g}.resolve.mark`);
      p.texts[markKey] = '你带着{part}残留的{material}痕迹退向安全通道，拉开与{opponent}的距离。';
      choices.push({
        label: '带着残迹退回安全位置',
        resultText: markKey,
        next: `play-${pad}-resolve-marked`,
        effects: [time(5)],
        conditions: [],
        setTags: [scoped('player', 'state.coated')],
        unsetTags: [],
      });
    }
    choices.push({
      label: '阅读成人向补充描写',
      resultText: adultChoiceText,
      next: adultStageId,
      effects: [time(5)],
      conditions: adultGate,
      setTags: stage === 'capture' ? play.entryStates.map(s => scoped('player', s)) : [],
      unsetTags: [],
    });
    choices.push(defeatExit());
    p.narrativeNodes.push({
      id: nodeId,
      kind: 'defeat',
      stage: stageId,
      title: `战败 · ${play.name} · ${defeatStageTitle[stage]}`,
      textKey,
      requiresTags: [scoped('opponent', 'defeat.play.active')],
      excludesTags: [],
      conditions: [],
      tendencies: [{ tagId: tag(play.fetishTag), weight: 2 }],
      weight: 10,
      priority: 6,
      maxVisits: 1,
      choices,
      ...(['capture','press'].includes(stage)?{skipChoiceIndex:0}:{}),
    });
    const adultChoices = [];
    if (nextStage) {
      const contAdultKey = id(`text.choice.defeat.${g}.${stage}.adult.continue`);
      p.texts[contAdultKey] = `处境进一步向「${defeatStageTitle[nextStage]}」阶段推进，你仍可随时中断离开。`;
      adultChoices.push({
        label: defeatContinueLabel[stage],
        resultText: contAdultKey,
        next: defeatStageId(play.n, nextStage),
        effects: [time(5)],
        conditions: [],
        setTags: stageTransitionTags,
        unsetTags: [],
      });
    }
    if (stage === 'peak') {
      const breakAdultKey = id(`text.choice.defeat.${g}.peak.adult.break`);
      p.texts[breakAdultKey] = '你在感官压迫的顶点稳住呼吸，寻得空隙挣开了{opponent}在{part}处的纠缠。';
      adultChoices.push({
        label: '借力挣脱反制',
        resultText: breakAdultKey,
        next: `play-${pad}-resolve-escape`,
        effects: [time(5), { op: 'var.change', id: 'core:stamina', amount: -4 }],
        conditions: [canCounterBreak],
        setTags: [scoped('player', 'defeat.loosened')],
        unsetTags: [],
      });
      const soakAdultKey = id(`text.choice.defeat.${g}.peak.adult.soak`);
      p.texts[soakAdultKey] = '浓稠的{material}顺着{part}漫延四肢，体表浮现出明显的覆层浸染征兆。';
      adultChoices.push({
        label: '任由异质覆层浸染',
        resultText: soakAdultKey,
        next: `play-${pad}-resolve-tf`,
        effects: [time(5)],
        conditions: [hasPlayableTfCondition],
        setTags: [scoped('player', 'defeat.soaked'), scoped('player', 'state.coated')],
        unsetTags: [],
      });
    }
    if (stage === 'resolve') {
      const soakResAdultKey = id(`text.choice.defeat.${g}.resolve.adult.soak`);
      p.texts[soakResAdultKey] = '你低头察看{part}上尚未退去的{material}覆层，四肢肌肤传来清晰的转化脉动。';
      adultChoices.push({
        label: '检视体表覆层与转化感应',
        resultText: soakResAdultKey,
        next: `play-${pad}-resolve-tf`,
        effects: [time(5)],
        conditions: [hasPlayableTfCondition],
        setTags: [scoped('player', 'defeat.soaked'), scoped('player', 'state.coated')],
        unsetTags: [],
      });
      const markResAdultKey = id(`text.choice.defeat.${g}.resolve.adult.mark`);
      p.texts[markResAdultKey] = '你拢起散乱的衣襟，带着{part}上的{material}残迹退向安全通道。';
      adultChoices.push({
        label: '带着残迹退回安全位置',
        resultText: markResAdultKey,
        next: `play-${pad}-resolve-marked`,
        effects: [time(5)],
        conditions: [],
        setTags: [scoped('player', 'state.coated')],
        unsetTags: [],
      });
    }
    adultChoices.push(defeatExit());
    p.narrativeNodes.push({
      id: adultNodeId,
      kind: 'defeat',
      stage: adultStageId,
      title: `战败 · ${play.name} · ${defeatStageTitle[stage]} · 成人补充`,
      textKey: adultKey,
      requiresTags: [scoped('opponent', 'defeat.play.active')],
      excludesTags: [],
      conditions: adultGate,
      tendencies: [{ tagId: tag(play.fetishTag), weight: 2 }],
      weight: 10,
      priority: 6,
      maxVisits: 1,
      choices: adultChoices,
    });
  }

  // 分支结局节点 A：挣脱抽身 (resolve.escape) —— 无玩法内部名，出口清掉全部现场态
  const escapeNodeText = id(`text.node.defeat.${g}.resolve.escape`);
  p.texts[escapeNodeText] = '你在周遭压制彻底合拢前找准支点，发力震开了{opponent}缠在{part}上的{material}。趁对方攻势一滞，你迅速拉开距离退到通道安全处，扶着墙沿平复急促的呼吸，拍去衣袖上的擦痕。';
  const escapeCleanKey = id(`text.choice.defeat.${g}.resolve.escape.clean`);
  p.texts[escapeCleanKey] = '你拍净衣袖上的零星擦痕，稳住呼吸回到安全地点。';
  p.narrativeNodes.push({
    id: id(`node.defeat.${g}.resolve.escape`),
    kind: 'defeat',
    stage: `play-${pad}-resolve-escape`,
    title: `战败 · ${play.name} · 挣脱抽身`,
    textKey: escapeNodeText,
    requiresTags: [scoped('opponent', 'defeat.play.active')],
    excludesTags: [],
    conditions: [],
    tendencies: [],
    weight: 10,
    priority: 7,
    maxVisits: 1,
    choices: [
      {
        label: '趁势整顿衣装，清爽脱身',
        resultText: escapeCleanKey,
        next: null,
        effects: [time(5), health(6), { op: 'flag.set', id: id('flag.aftermath.mark'), value: false }],
        conditions: [],
        setTags: [],
        unsetTags: ALL_DEFEAT_CLEANUP_TAGS,
      },
      defeatExit(),
    ],
  });

  // 分支结局节点 B：带痕脱身 (resolve.marked) —— 按 materialTrace 区分藤类/丝茧/胶质，不含玩法内部名或工程解释，选项不含括号元说明
  const markedNodeText = id(`text.node.defeat.${g}.resolve.marked`);
  p.texts[markedNodeText] = '你趁{opponent}攻势收拢的空档抽身退开，脱离了当场的贴身压制，但{part}与衣料内侧仍留有{material}缠附擦过后的清晰残迹与紧束压痕。你扶住通道边缘稳住步伐，低头察看腕踝与衣襟上的残留痕迹。';
  const markedLeaveKey = id(`text.choice.defeat.${g}.resolve.marked.leave`);
  p.texts[markedLeaveKey] = '你拢紧外衣遮住{part}上的{material}残迹，先行退回安全位置。';
  const markedCleanKey = id(`text.choice.defeat.${g}.resolve.marked.clean`);
  p.texts[markedCleanKey] = '你在路边取水匆匆拭去{part}表层的{material}，整理好衣袖回到安全位置。';
  p.narrativeNodes.push({
    id: id(`node.defeat.${g}.resolve.marked`),
    kind: 'defeat',
    stage: `play-${pad}-resolve-marked`,
    title: `战败 · ${play.name} · 带痕脱身`,
    textKey: markedNodeText,
    requiresTags: [scoped('opponent', 'defeat.play.active')],
    excludesTags: [],
    conditions: [],
    tendencies: [{ tagId: tag(play.fetishTag), weight: 1 }],
    weight: 10,
    priority: 7,
    maxVisits: 1,
    choices: [
      {
        label: '拢紧衣襟护住手腕先退开',
        resultText: markedLeaveKey,
        next: null,
        effects: [{ op: 'flag.set', id: id('flag.aftermath.mark'), value: true }, time(5), health(4)],
        conditions: [],
        setTags: [],
        unsetTags: ALL_DEFEAT_CLEANUP_TAGS,
      },
      {
        label: '当场拭去表层残迹后离开',
        resultText: markedCleanKey,
        next: null,
        effects: [{ op: 'flag.set', id: id('flag.aftermath.mark'), value: false }, time(10), health(4)],
        conditions: [],
        setTags: [],
        unsetTags: ALL_DEFEAT_CLEANUP_TAGS,
      },
      defeatExit(),
    ],
  });

  // 分支结局节点 C：覆层浸染与转化结算 (resolve.tf) —— 仅保留通用黏液化与黑胶化
  const tfNodeText = id(`text.node.defeat.${g}.resolve.tf`);
  p.texts[tfNodeText] = '交锋余波渐息，{opponent}留在你{part}与四肢表面的{material}随着体温化作一层贴合肌肤的异质薄膜。手腕与小腿表层传来清晰的包裹感，你停在通道边缘审视着这层覆膜的变化。';
  const tfSlimeKey = id(`text.choice.defeat.${g}.resolve.tf.slime`);
  p.texts[tfSlimeKey] = '你顺应体表水润滑腻的触感，任由通用黏液化覆层沿着四肢缓缓成型。';
  const tfLatexKey = id(`text.choice.defeat.${g}.resolve.tf.latex`);
  p.texts[tfLatexKey] = '你顺应体表紧密收束的弹性张力，任由通用黑胶化包覆沿着四肢渐渐定型。';
  const tfDeferKey = id(`text.choice.defeat.${g}.resolve.tf.defer`);
  p.texts[tfDeferKey] = '你暂且拢紧外衣压下体表的微麻感应，先退向安全通道。';
  p.narrativeNodes.push({
    id: id(`node.defeat.${g}.resolve.tf`),
    kind: 'defeat',
    stage: `play-${pad}-resolve-tf`,
    title: `战败 · ${play.name} · 覆层浸染`,
    textKey: tfNodeText,
    requiresTags: [scoped('opponent', 'defeat.play.active')],
    excludesTags: [],
    conditions: [],
    tendencies: [{ tagId: tag(play.fetishTag), weight: 2 }],
    weight: 10,
    priority: 7,
    maxVisits: 1,
    choices: [
      {
        label: '接纳黏液化覆层转化',
        resultText: tfSlimeKey,
        next: null,
        effects: [{ op: 'tf.enqueue', id: id('tf.slime-coating') }, { op: 'flag.set', id: id('flag.aftermath.mark'), value: true }, time(10), health(5)],
        conditions: [
          { op: 'tf.state', id: id('tf.slime-coating'), state: 'idle' },
        ],
        setTags: [],
        unsetTags: ALL_DEFEAT_CLEANUP_TAGS,
      },
      {
        label: '接纳黑胶化包覆转化',
        resultText: tfLatexKey,
        next: null,
        effects: [{ op: 'tf.enqueue', id: id('tf.latex-coating') }, { op: 'flag.set', id: id('flag.aftermath.mark'), value: true }, time(10), health(5)],
        conditions: [
          { op: 'tf.state', id: id('tf.latex-coating'), state: 'idle' },
        ],
        setTags: [],
        unsetTags: ALL_DEFEAT_CLEANUP_TAGS,
      },
      {
        label: '拢起外衣先行退开',
        resultText: tfDeferKey,
        next: `play-${pad}-resolve-marked`,
        effects: [time(5)],
        conditions: [],
        setTags: [],
        unsetTags: [scoped('player', 'defeat.soaked')],
      },
      defeatExit(),
    ],
  });
}

// —— 野外六敌（E2 触手藤不带黏液化 TF 且真实挂 state.suspended + state.bound；E4 虫巢爬者结茧拍挂 state.cocooned；选项全部去括号元说明）——
const wildEnemies = [
  {
    slug: 'saliva-wolf',
    name: '涎狼',
    tier: 'S',
    hp: 48,
    attack: 11,
    defense: 6,
    speed: 12,
    reward: 14,
    actions: 1,
    speciesKind: 'beast',
    attributeTags: [tag('attr.warm-saliva'), tag('attr.pack')],
    fetishTags: [tag('fetish.restraint'), tag('fetish.coating')],
    fetishTendencies: [{ tagId: tag('fetish.restraint'), weight: 85 }, { tagId: tag('fetish.coating'), weight: 70 }],
    defeatCombo: { materials: ['M1', 'M4'], parts: ['脖颈', '手腕', '脚踝'], plays: ['G1', 'G2'], tfs: ['黏液化'], autoCombo: true },
    primaryPlay: 1,
    secondaryPlay: 2,
    primaryLabel: '架住前爪抵挡扑压',
    secondaryLabel: '侧身拨开滴落的垂涎',
    primaryStates: ['state.bound'],
    secondaryStates: ['state.coated'],
    introText: '你力竭跌坐在林缘草地上，{opponent}低伏着前躯逼近，温热湿滑的垂涎滴落在你的{part}附近。沉重的前爪按住你的肩侧与手腕，将你压制在草甸原处。',
  },
  {
    slug: 'slug-beast',
    name: '林缘蛞蝓兽',
    tier: 'M',
    hp: 62,
    attack: 10,
    defense: 9,
    speed: 7,
    reward: 18,
    actions: 1,
    speciesKind: 'slime',
    attributeTags: [tag('attr.mucus'), tag('attr.gel-body')],
    fetishTags: [tag('fetish.coating'), tag('fetish.sensory-deprivation')],
    fetishTendencies: [{ tagId: tag('fetish.coating'), weight: 95 }, { tagId: tag('fetish.sensory-deprivation'), weight: 65 }],
    defeatCombo: { materials: ['M1', 'M6'], parts: ['脚踝', '腰侧', '大腿内侧'], plays: ['G2', 'G4'], tfs: ['黏液化'], autoCombo: true },
    primaryPlay: 2,
    secondaryPlay: 4,
    primaryLabel: '拔脚挣动陷入腹足的靴尖',
    secondaryLabel: '偏头避开漫向面颊的胶膜',
    primaryStates: ['state.coated'],
    secondaryStates: ['state.gagged', 'state.blindfolded'],
    introText: '失去平衡后，{opponent}柔软沉重的腹足缓缓漫过你的靴尖，浓稠拉丝的{material}顺着{part}迅速向上涂覆，每一次蠕动都带来沉甸甸的吸附力。',
  },
  {
    slug: 'tentacle-vine',
    name: '兽径触手藤',
    tier: 'M',
    hp: 68,
    attack: 13,
    defense: 8,
    speed: 10,
    reward: 20,
    actions: 2,
    speciesKind: 'plant',
    attributeTags: [tag('attr.vine'), tag('attr.tentacle')],
    fetishTags: [tag('fetish.restraint'), tag('fetish.sensory-deprivation'), tag('fetish.humiliation')],
    fetishTendencies: [{ tagId: tag('fetish.restraint'), weight: 95 }, { tagId: tag('fetish.sensory-deprivation'), weight: 80 }, { tagId: tag('fetish.humiliation'), weight: 65 }],
    defeatCombo: { materials: ['M7', 'M8', 'M9'], parts: ['手腕', '脚踝', '大腿内侧', '腰侧', '眼周'], plays: ['G1', 'G4', 'G6'], tfs: [], autoCombo: true },
    primaryPlay: 1,
    secondaryPlay: 4,
    primaryLabel: '扣住缠紧腕踝倒吊的活藤',
    secondaryLabel: '仰颈避开压向眼周与口唇的藤条',
    primaryStates: ['state.bound', 'state.suspended'],
    secondaryStates: ['state.bound', 'state.suspended', 'state.blindfolded', 'state.gagged'],
    introText: '数条柔韧的翠暗活藤趁你脱力时倏然收紧，带有细微气根的{material}顺着藤身在你的{part}处绕出数道紧实的环扣，勒紧脚踝与手腕将你的重心倒挂拉高。',
  },
  {
    slug: 'mire-slime',
    name: '泥沼史莱姆',
    tier: 'M',
    hp: 72,
    attack: 12,
    defense: 10,
    speed: 8,
    reward: 22,
    actions: 1,
    speciesKind: 'slime',
    attributeTags: [tag('attr.gel-body'), tag('attr.mucus'), tag('attr.pack')],
    fetishTags: [tag('fetish.coating'), tag('fetish.swarm'), tag('fetish.sensory-deprivation')],
    fetishTendencies: [{ tagId: tag('fetish.coating'), weight: 95 }, { tagId: tag('fetish.swarm'), weight: 85 }, { tagId: tag('fetish.sensory-deprivation'), weight: 70 }],
    defeatCombo: { materials: ['M4', 'M6'], parts: ['腰侧', '大腿内侧', '嘴唇', '锁骨窝'], plays: ['G2', 'G8', 'G4'], tfs: ['黏液化'], autoCombo: true },
    primaryPlay: 2,
    secondaryPlay: 8,
    primaryLabel: '撑起双臂阻挡合拢的胶浪',
    secondaryLabel: '屏息护住口鼻间的空隙',
    primaryStates: ['state.coated', 'state.bound'],
    secondaryStates: ['state.coated', 'state.ear-sealed', 'state.sensory-deprived'],
    introText: '半透明的胶质浪涌从四面合拢，{opponent}将富有弹性的{material}层层裹上你的{part}，温凉的胶体不断挤压着你的活动空间。',
  },
  {
    slug: 'hive-crawler',
    name: '虫巢爬者',
    tier: 'L',
    hp: 86,
    attack: 15,
    defense: 11,
    speed: 11,
    reward: 26,
    actions: 2,
    speciesKind: 'insect',
    attributeTags: [tag('attr.chitin'), tag('attr.mucus'), tag('attr.pack')],
    fetishTags: [tag('fetish.oviposition'), tag('fetish.swarm'), tag('fetish.restraint')],
    fetishTendencies: [{ tagId: tag('fetish.oviposition'), weight: 95 }, { tagId: tag('fetish.swarm'), weight: 85 }, { tagId: tag('fetish.restraint'), weight: 70 }],
    defeatCombo: { materials: ['M3', 'M10'], parts: ['腰侧', '大腿内侧', '手腕', '小腿'], plays: ['G5', 'G8', 'G1'], tfs: ['黏液化'], autoCombo: true },
    primaryPlay: 5,
    secondaryPlay: 8,
    primaryLabel: '曲肘格开钳向腰侧的节肢与丝茧',
    secondaryLabel: '挣动小腿扯开层层缠绕的茧丝',
    primaryStates: ['state.cocooned', 'state.bound'],
    secondaryStates: ['state.cocooned', 'state.bound', 'state.coated'],
    introText: '甲片摩挲的细密声响在耳畔收拢，{opponent}用节肢钳制住你的四肢，致密的{material}贴着{part}层层缠裹结茧，将你的躯干固定在原地。',
  },
  {
    slug: 'latex-warden',
    name: '黑胶林地看守',
    tier: 'L',
    hp: 96,
    attack: 16,
    defense: 12,
    speed: 11,
    reward: 30,
    actions: 2,
    speciesKind: 'monster',
    attributeTags: [tag('attr.gel-body'), tag('attr.pheromone'), tag('attr.tentacle')],
    fetishTags: [tag('fetish.domination'), tag('fetish.coating'), tag('fetish.restraint')],
    fetishTendencies: [{ tagId: tag('fetish.domination'), weight: 95 }, { tagId: tag('fetish.coating'), weight: 90 }, { tagId: tag('fetish.restraint'), weight: 75 }],
    defeatCombo: { materials: ['M5', 'M6'], parts: ['脖颈', '锁骨窝', '手腕', '大腿内侧'], plays: ['G7', 'G2', 'G1'], tfs: ['黑胶化'], autoCombo: true },
    primaryPlay: 7,
    secondaryPlay: 2,
    primaryLabel: '稳住步态抗衡逼近的压迫',
    secondaryLabel: '抬手扯动漫过手腕的黑胶',
    primaryStates: ['state.bound', 'state.gagged'],
    secondaryStates: ['state.coated', 'state.bound'],
    introText: '{opponent}迈着沉稳的步伐停在你身前，富有光泽的{material}顺着你的{part}漫延收束，空气中回荡着令人思绪发沉的低频指令声。你按住手腕稳住呼吸，审视着眼前的处境。',
  },
];
for (const w of wildEnemies) {
  const enemyId = id('enemy.' + w.slug);
  p.enemies.push({
    id: enemyId,
    name: w.name,
    hp: w.hp,
    reward: w.reward,
    tier: w.tier,
    combat: {
      attack: w.attack,
      defense: w.defense,
      speed: w.speed,
      skillPower: w.attack,
      hit: 78,
      evasion: 9,
      crit: 6,
      actionsPerTurn: w.actions,
      skillResource: 0,
    },
    intents: [
      { label: '逼近缠绕试探', damage: 5, guard: 2, drain: 1 },
      { label: '收紧覆层压迫', damage: 8, guard: 4, drain: 2 },
      { label: '全力扑压制服', damage: 12, guard: 0, drain: 2 },
    ],
    victoryEventId: id('event.victory'),
    defeatEventId: id('event.defeat'),
    escapeEventId: id('event.escape'),
    speciesKind: w.speciesKind,
    attributeTags: w.attributeTags,
    fetishTags: w.fetishTags,
    fetishTendencies: w.fetishTendencies,
    defeatCombo: w.defeatCombo,
  });
  p.narrativeProfiles.push({
    id: id('profile.' + w.slug),
    enemyId,
    tags: [tag('control'), tag('defeat.play.active')],
    goals: [tag('goal.control')],
    tendencies: [{ tagId: tag('control'), weight: 80 }],
    defeatTags: [scoped('player', 'clear'), scoped('player', 'injured'), scoped('opponent', 'defeat.play.active')],
    speciesKind: w.speciesKind,
    attributeTags: w.attributeTags,
    fetishTags: w.fetishTags,
    fetishTendencies: w.fetishTendencies,
    defeatCombo: w.defeatCombo,
  });
  p.environmentEnemyRules.push({
    id: id('env-enemy.wild.' + w.slug),
    enemyId,
    requiresTags: ['foundation:service.commons', 'foundation:theme.exploration'],
    weight: 14,
    priority: 0,
    name: w.name,
    hp: w.hp,
    reward: w.reward,
    defeatTags: [scoped('player', 'clear'), scoped('player', 'injured'), scoped('opponent', 'defeat.play.active')],
    speciesKind: w.speciesKind,
    attributeTags: w.attributeTags,
    fetishTags: w.fetishTags,
    fetishTendencies: w.fetishTendencies,
    defeatCombo: w.defeatCombo,
  });
  const p1 = defeatPlayMeta.find(m => m.n === w.primaryPlay);
  const p2 = defeatPlayMeta.find(m => m.n === w.secondaryPlay);
  const wildExit = defeatExit();
  const wildChoices = [
    choice(
      w.primaryLabel,
      `{opponent}顺势收紧了在{part}处的{material}，将你拖入更深的束缚与压制之中。`,
      defeatStageId(p1.n, 'capture'),
      [time(5)],
      [],
      [
        scoped('player', `defeat.play.${p1.key.toLowerCase()}`),
        ...w.primaryStates.map(s => scoped('player', s)),
      ],
    ),
    choice(
      w.secondaryLabel,
      `你在拉扯间触动了{opponent}的另一重攻势，{material}顺着{part}再次缠紧。`,
      defeatStageId(p2.n, 'capture'),
      [time(5)],
      [],
      [
        scoped('player', `defeat.play.${p2.key.toLowerCase()}`),
        ...w.secondaryStates.map(s => scoped('player', s)),
      ],
    ),
    choice(
      '借地形支点挣脱抽身',
      '你利用手边支点猛然发力，在{opponent}彻底合围前挣开{material}退回安全处。',
      `play-0${p1.n}-resolve-escape`,
      [time(5), { op: 'var.change', id: 'core:stamina', amount: -4 }],
      [canCounterBreak],
      [scoped('player', 'defeat.loosened')],
      ALL_LIVE_STATE_TAGS,
    ),
    wildExit,
  ];
  const wildNid = id('node.defeat.wild.' + w.slug);
  const wildTkey = id('text.node.defeat.wild.' + w.slug);
  p.texts[wildTkey] = w.introText;
  p.narrativeNodes.push({
    id: wildNid,
    kind: 'defeat',
    stage: 'start',
    title: `战败 · ${w.name}的压制`,
    textKey: wildTkey,
    requiresTags: [scoped('opponent', 'defeat.play.active')],
    excludesTags: [],
    conditions: [{ op: 'opponent.matches', enemyId }],
    tendencies: w.fetishTendencies,
    weight: 10,
    priority: 10,
    maxVisits: 1,
    choices: wildChoices,
  });
}

const hubText = id('text.node.defeat.play.hub');
p.texts[hubText] = '交锋结束后，{opponent}仍在{place}。你还没有离开现场。你可以选择下一步应对，也可以立即结束这段经历。';
// hub 分页：每页 ≤3 玩法 + exit（shape 上限 4）。G5 必须从 hub3 路径可达。
// hub: G1 G2 | hub2: G3 G4 | hub3: G5 G6 | hub4: G7 G8
p.narrativeNodes.push({
  id: id('node.defeat.play.hub'),
  kind: 'defeat',
  stage: 'start',
  title: '战败后的玩法入口',
  textKey: hubText,
  requiresTags: [scoped('opponent', 'defeat.play.active')],
  excludesTags: [],
  conditions: [],
  tendencies: [],
  weight: 10,
  priority: 8,
  maxVisits: 1,
  choices: [
    playHubChoices[0],
    playHubChoices[1],
    { label: '查看更多玩法…', resultText: id('text.choice.defeat.play.more'), next: 'play-hub-more', effects: [], conditions: [], setTags: [], unsetTags: [] },
    defeatExit(),
  ],
});
p.texts[id('text.choice.defeat.play.more')] = '你继续浏览其余战败玩法入口。';
p.texts[id('text.node.defeat.play.hub2')] = '还有其他战败分支可选。选择一类进入，或结束回到安全位置。';
p.narrativeNodes.push({
  id: id('node.defeat.play.hub2'),
  kind: 'defeat',
  stage: 'play-hub-more',
  title: '战败玩法 · 更多',
  textKey: id('text.node.defeat.play.hub2'),
  requiresTags: [scoped('opponent', 'defeat.play.active')],
  excludesTags: [],
  conditions: [],
  tendencies: [],
  weight: 10,
  priority: 6,
  maxVisits: 1,
  choices: [
    playHubChoices[2],
    playHubChoices[3],
    { label: '查看其余玩法…', resultText: id('text.choice.defeat.play.more2'), next: 'play-hub-rest', effects: [], conditions: [], setTags: [], unsetTags: [] },
    defeatExit(),
  ],
});
p.texts[id('text.choice.defeat.play.more2')] = '你继续浏览剩余战败玩法入口。';
p.texts[id('text.node.defeat.play.hub3')] = '其余战败分支可选。选择一类进入，或查看最后两类。';
p.narrativeNodes.push({
  id: id('node.defeat.play.hub3'),
  kind: 'defeat',
  stage: 'play-hub-rest',
  title: '战败玩法 · 其余',
  textKey: id('text.node.defeat.play.hub3'),
  requiresTags: [scoped('opponent', 'defeat.play.active')],
  excludesTags: [],
  conditions: [],
  tendencies: [],
  weight: 10,
  priority: 6,
  maxVisits: 1,
  choices: [
    playHubChoices[4],
    playHubChoices[5],
    { label: '查看最后玩法…', resultText: id('text.choice.defeat.play.more3'), next: 'play-hub-last', effects: [], conditions: [], setTags: [], unsetTags: [] },
    defeatExit(),
  ],
});
p.texts[id('text.choice.defeat.play.more3')] = '你查看最后的战败玩法入口。';
p.texts[id('text.node.defeat.play.hub4')] = '最后两类战败分支可选。选择一类进入，或结束回到安全位置。';
p.narrativeNodes.push({
  id: id('node.defeat.play.hub4'),
  kind: 'defeat',
  stage: 'play-hub-last',
  title: '战败玩法 · 最后',
  textKey: id('text.node.defeat.play.hub4'),
  requiresTags: [scoped('opponent', 'defeat.play.active')],
  excludesTags: [],
  conditions: [],
  tendencies: [],
  weight: 10,
  priority: 6,
  maxVisits: 1,
  choices: [
    playHubChoices[6],
    playHubChoices[7],
    defeatExit(),
  ],
});
action(
  'defeat.play',
  '试跑战败后 8 玩法',
  [{ op: 'narrative.start', kind: 'defeat', profileId: id('profile.defeat.play') }],
  [],
  'fantasy 战败后按 8 玩法大类进入；成人正文须 adultOptional；不改审定',
  'explore',
);

// 回填战败玩法正文（G1–G8 四拍；不装 peakSamplesNotInstalled）
const defeatPlayFillsPath = 'content/nsfw-auto-combo/defeat-play-fills.json';
let defeatPlayFillCount = 0;
try {
  const fills = await json(defeatPlayFillsPath);
  if (fills.format !== 'aetheria-defeat-play-prose-fills' || ![1, 2].includes(fills.schemaVersion)) throw new Error('defeat-play-fills 格式无效。');
  for (const [key, body] of Object.entries(fills.texts ?? {})) {
    if (typeof body !== 'string' || !body.trim()) throw new Error(`战败玩法散文空槽：${key}`);
    if (!(key in p.texts)) throw new Error(`战败玩法散文目标不存在：${key}`);
    p.texts[key] = body;
    defeatPlayFillCount += 1;
  }
} catch (err) {
  if (err && err.code === 'ENOENT') {
    // 无回填时保留占位
  } else {
    throw err;
  }
}
await writeFile(
  'content/nsfw-auto-combo/defeat-play-candidates.json',
  JSON.stringify({
    format: 'aetheria-defeat-play-candidates',
    schemaVersion: 3,
    worldTag: 'worlds:setting.fantasy',
    proseFillsApplied: defeatPlayFillCount,
    entryAction: id('action.defeat.play'),
    hubNodeId: id('node.defeat.play.hub'),
    stageChain: defeatPlayStageChain,
    stageNote: 'G1–G8 实装 capture→press→peak→resolve（含 resolve.escape / resolve.marked / resolve.tf 多结局分流）。escalate/aftermath 已弃用。',
    hubPages: {
      hub: ['G1', 'G2'],
      hub2: ['G3', 'G4'],
      hub3: ['G5', 'G6'],
      hub4: ['G7', 'G8'],
    },
    howToTestRandom: [
      'UI：新开档（不同世界种子）→ 打开「试跑战败后 8 玩法」→ 读 hub 正文中的 {opponent}/{material}/{part}/{tf} 实填。',
      '或 node --test tests/defeat-play.test.ts（含双种子可见填充差异断言）。',
      '控制台：执行 action 后查看 adventure.story.opponentName 与 adventure.story.fills。',
      '同一 transactionId 流固定；换种子或换 transactionId 即重抽。',
    ],
    plays: defeatPlayMeta.map((play) => {
      const g = `g${play.n}`;
      const stages = play.multiBeat ? defeatPlayStageChain : ['capture'];
      const stageMap = {};
      for (const stage of stages) {
        stageMap[stage] = {
          stage: defeatStageId(play.n, stage),
          nodeId: id(`node.defeat.${g}.${stage}`),
          editNodeId: `edit:node.defeat.${g}.${stage}`,
          textKey: id(`text.node.defeat.${g}.${stage}`),
          adultNodeId: id(`node.defeat.${g}.${stage}.adult`),
          editAdultNodeId: `edit:node.defeat.${g}.adult`,
          adultTextKey: id(`text.node.defeat.${g}.${stage}.adult`),
        };
      }
      return {
        gameplay: play.key,
        name: play.name,
        multiBeat: play.multiBeat,
        nodeId: id(`node.defeat.${g}.capture`),
        editNodeId: `edit:node.defeat.${g}.capture`,
        adultNodeId: id(`node.defeat.${g}.capture.adult`),
        editAdultNodeId: `edit:node.defeat.${g}.capture.adult`,
        textKey: id(`text.node.defeat.${g}.capture`),
        adultTextKey: id(`text.node.defeat.${g}.capture.adult`),
        stages: stageMap,
      };
    }),
  }, null, 2) + '\n',
);

// —— 一等公民双方属性反应规则表 (DefeatReactionRule：含玩家脱身反应与敌方压制反应) ——
p.defeatReactionRules = [];
const reactionDefinitions = [
  {
    slug: 'tail-counter',
    label: '机械尾支点撬解',
    stages: ['press', 'peak'],
    playerConditions: [tailGrip],
    opponentConditions: [],
    choiceLabel: '借机械尾支点撬开束缚',
    resultProse: '你利用身后已校准的机械尾扣住地面棱角作为第三支点，猛然发力撬开了{opponent}在{part}处的{material}牵制。',
    targetStage: '{playPrefix}-resolve-escape',
    effects: [time(5), { op: 'var.change', id: 'core:stamina', amount: -3 }],
    setTags: [scoped('player', 'defeat.loosened')],
    unsetTags: ALL_LIVE_STATE_TAGS,
    priority: 20,
  },
  {
    slug: 'vine-slip',
    label: '藤蔓收拢间隙滑步',
    stages: ['capture', 'press'],
    playerConditions: [{ op: 'var.compare', id: 'core:speed', comparison: 'gte', value: 12 }],
    opponentConditions: [{ op: 'opponent.matches', attributeTag: tag('attr.vine') }],
    choiceLabel: '趁活藤收拢间隙滑步脱身',
    resultProse: '你预判了{opponent}藤蔓盘绕的收束轨迹，在{material}完全勒死{part}之前顺势滑步抽出，仅在衣角留下一抹草木残痕。',
    targetStage: '{playPrefix}-resolve-marked',
    effects: [time(5), { op: 'var.change', id: 'core:stamina', amount: -3 }],
    setTags: [scoped('player', 'defeat.loosened')],
    unsetTags: [scoped('player', 'state.bound'), scoped('player', 'state.suspended')],
    priority: 25,
  },
  {
    slug: 'cocoon-guard',
    label: '虫巢结茧曲肘留隙',
    stages: ['capture', 'press'],
    playerConditions: [{ op: 'var.compare', id: 'core:defense', comparison: 'gte', value: 12 }],
    opponentConditions: [{ op: 'opponent.matches', attributeTag: tag('attr.chitin') }],
    choiceLabel: '曲肘撑开丝茧留出脱身余地',
    resultProse: '面对{opponent}层层缠裹的{material}，你提前曲肘沉肩撑住胸前空隙，在丝茧凝固定型前挣开一道缺口退向安全通道。',
    targetStage: '{playPrefix}-resolve-marked',
    effects: [time(5), { op: 'var.change', id: 'core:stamina', amount: -2 }],
    setTags: [scoped('player', 'defeat.loosened')],
    unsetTags: [scoped('player', 'state.cocooned'), scoped('player', 'state.bound')],
    priority: 22,
  },
  {
    slug: 'coating-slide',
    label: '既有覆层卸力滑脱',
    stages: ['press'],
    playerConditions: [{ op: 'any', conditions: [has('player', 'body.slime-coated'), has('player', 'body.latex-sheathed')] }],
    opponentConditions: [],
    choiceLabel: '借体表既有覆层卸开牵制力道',
    resultProse: '你借着四肢表面既有的滑腻覆层顺势扭腕，让{opponent}压在{part}上的{material}擦滑落空，带着残余痕迹抽身退开。',
    targetStage: '{playPrefix}-resolve-marked',
    effects: [time(5)],
    setTags: [scoped('player', 'defeat.loosened')],
    unsetTags: [scoped('player', 'state.bound')],
    priority: 18,
  },
  // 敌方反应 1：活藤收紧倒挂
  {
    slug: 'enemy-vine-tighten',
    label: '敌方反应：活藤收紧倒挂',
    stages: ['capture', 'press'],
    playerConditions: [{ op: 'var.compare', id: 'core:speed', comparison: 'lte', value: 11 }],
    opponentConditions: [{ op: 'opponent.matches', attributeTag: tag('attr.vine') }],
    choiceLabel: '重心被收紧的活藤强行拉起',
    resultProse: '{opponent}缠在你{part}处的{material}猛然收紧，数条活藤交错勒住腕踝并将你的重心倒挂拉离地面。',
    targetStage: '{playPrefix}-peak',
    effects: [time(5)],
    setTags: [scoped('player', 'state.bound'), scoped('player', 'state.suspended')],
    unsetTags: [scoped('player', 'defeat.loosened')],
    priority: 16,
  },
  // 敌方反应 2：黏液二次涂覆
  {
    slug: 'enemy-mucus-recoat',
    label: '敌方反应：黏液二次涂覆',
    stages: ['press', 'peak'],
    playerConditions: [{ op: 'var.compare', id: 'core:stamina', comparison: 'lte', value: 60 }],
    opponentConditions: [{ op: 'opponent.matches', attributeTag: tag('attr.mucus') }],
    choiceLabel: '被涌来的浓稠黏液二次涂覆',
    resultProse: '{opponent}顺着你的{part}再度涌出一层浓稠的{material}，湿滑覆层迅速漫过四肢关节，阻滞了你的发力节奏。',
    targetStage: '{playPrefix}-resolve-tf',
    effects: [time(5)],
    setTags: [scoped('player', 'state.coated'), scoped('player', 'defeat.soaked')],
    unsetTags: [scoped('player', 'defeat.loosened')],
    priority: 15,
  },
  // 敌方反应 3：虫巢丝茧加厚封裹
  {
    slug: 'enemy-cocoon-wrap',
    label: '敌方反应：丝茧加厚封裹',
    stages: ['capture', 'press'],
    playerConditions: [{ op: 'var.compare', id: 'core:defense', comparison: 'lte', value: 11 }],
    opponentConditions: [{ op: 'opponent.matches', attributeTag: tag('attr.chitin') }],
    choiceLabel: '被虫巢丝缕层层加厚裹紧',
    resultProse: '{opponent}吐出致密的虫巢丝线缠上你的{part}，转眼间将四肢与躯干一并封入紧实的丝茧之中。',
    targetStage: '{playPrefix}-peak',
    effects: [time(5)],
    setTags: [scoped('player', 'state.cocooned'), scoped('player', 'state.bound')],
    unsetTags: [scoped('player', 'defeat.loosened')],
    priority: 14,
  },
];
for (const rDef of reactionDefinitions) {
  const resKey = id(`text.reaction.${rDef.slug}`);
  p.texts[resKey] = rDef.resultProse;
  p.defeatReactionRules.push({
    id: id(`reaction.defeat.${rDef.slug}`),
    label: rDef.label,
    stages: rDef.stages,
    playerConditions: rDef.playerConditions,
    opponentConditions: rDef.opponentConditions,
    choiceLabel: rDef.choiceLabel,
    resultText: resKey,
    targetStage: rDef.targetStage,
    effects: rDef.effects,
    setTags: rDef.setTags,
    unsetTags: rDef.unsetTags,
    priority: rDef.priority,
  });
}

const wildDefeatMetas = mountAllWildDefeatEnemies(p, {
  id,
  tag,
  scoped,
  has,
  choice,
  exit,
  time,
  health,
  adultGate,
  action,
  envRule,
  json,
  readFile,
});
const wildDefeatFills = await applyWildDefeatFills(p, wildDefeatMetas, json);
await writeWildDefeatCandidates('content/nsfw-auto-combo/wild-defeat-candidates.json', writeFile, {
  metas: wildDefeatMetas,
  fillCount: wildDefeatFills.fillCount,
});

await writeFile(
  'content/nsfw-auto-combo/defeat-play-draws.json',
  JSON.stringify({
    format: 'aetheria-defeat-play-draws',
    schemaVersion: 2,
    note: '运行时表在 src/engine/defeat-play-draws.ts；本文件供核对 / 文档。定词挂前；goo TF 仅通用原子。',
    opponents: [
      { kind: 'human', label: '人类对手' },
      { kind: 'beast', label: '野兽' },
      { kind: 'monster', label: '异形生物' },
      { kind: 'plant', label: '妖异藤植' },
      { kind: 'slime', label: '胶质生物' },
      { kind: 'insect', label: '虫巢异虫' },
      { kind: 'construct', label: '失控构装体' },
    ],
    materials: [
      { key: 'M1', dingci: '蛞蝓', base: '黏液', label: '蛞蝓黏液' },
      { key: 'M2', dingci: '触手', base: '黏液', label: '触手黏液' },
      { key: 'M3', dingci: '虫巢', base: '黏液', label: '虫巢黏液' },
      { key: 'M4', dingci: '史莱姆', base: '黏液', label: '史莱姆黏液' },
      { key: 'M5', dingci: null, base: '活体黑胶', label: '活体黑胶' },
      { key: 'M6', dingci: null, base: '凝胶膜', label: '凝胶膜' },
      { key: 'M7', dingci: '兽径', base: '活藤', label: '兽径活藤' },
      { key: 'M8', dingci: '翠暗', base: '缠绕茎', label: '翠暗缠绕茎' },
      { key: 'M9', dingci: '柔韧', base: '藤条', label: '柔韧藤条' },
      { key: 'M10', dingci: '虫巢', base: '丝茧', label: '虫巢丝茧' },
    ],
    parts: ['手腕', '腰侧', '脚踝', '大腿内侧', '脖颈', '锁骨窝', '嘴唇', '小腿', '膝弯', '肩胛', '眼周', '耳廓'],
    tfs: ['黏液化', '黑胶化'],
    wiredToNsfwAutoCombo: true,
    comboRows: 20,
  }, null, 2) + '\n',
);


// Local scenes use the actual map and residents, including the fixed test city.
for(const [suffix,locationId,name]of [['canal','district:location.canal','旧渠步道'],['station','district:location.station','下城检查站']]){
 const eid=id('event.road-threat.'+suffix),prompt=id('text.road-threat.'+suffix),end=id('text.road-threat.'+suffix+'.end');
 p.texts[prompt]=`你走到${name}的通道拐角，前方传来急促的响动。一个敌对身影挡住了道路，尚未逼到你面前。你可以迎战，也可以沿原路退开。`;
 p.texts[end]='你沿原路退回公共通道，避开了这次冲突。';
 const fight=id('action.road-threat.'+suffix+'.fight'),avoid=id('action.road-threat.'+suffix+'.avoid');
 p.actions.push({id:fight,label:'迎战拦路的对手',hint:'进入战斗；可以防守或撤离',group:'event',context:{eventId:eid,nodeId:'start'},conditions:[],effects:[{op:'event.exit'},{op:'combat.encounter'}],resultText:prompt},
 {id:avoid,label:'沿原路退开，避开冲突',hint:'免费避开；可以继续其他探索',group:'event',context:{eventId:eid,nodeId:'start'},conditions:[],effects:[{op:'event.advance',nodeId:'end'}],resultText:end});
 p.events.push({id:eid,startNode:'start',rating:'general',nodes:[{id:'start',type:'choice',textVariants:[prompt],actionIds:[fight,avoid],onEnter:[]},{id:'end',type:'exit',textVariants:[end],actionIds:[],onEnter:[{op:'event.exit'}]}]});
 (p.storylets??=[]).push({id:id('storylet.road-threat.'+suffix),locationId,conditions:[],eventId:eid,weight:10,priority:2,cooldownMinutes:60,cooldownGroup:'road-threat-'+suffix,repeat:'daily',hidden:true,tags:['foundation:theme.risk']});
}
node('encounter.local','encounter','start','{place}的动静','{period}，你在{place}停下脚步。{nearby}\n\n附近的通道通向{routeNames}。你可以参与眼前的事务，也可以先认识这里的人。',[
 choice('看看当地发生的事','你走向{place}的公共通道。',null,[{op:'world.encounter'}]),
 choice('认识此刻在场的人','你在{place}与在场的人打招呼。',null,[{op:'world.encounter',events:false}]),
],{priority:20,conditions:[{op:'any',conditions:base.flatMap(p=>p.locations).map(l=>({op:'location.is',id:l.id}))}],excludesTags:[scoped('opponent','nsfwcombo.active')]});
p.texts[id('text.node.exploration.start')]='{period}，你沿{place}的通道走了一段。路牌通向{routeNames}。{nearby}';
p.texts[id('text.node.transformation.start')]='你在{place}留出一块空地，慢慢活动身体。你目前的结构包括{bodyState}。{tfState}';
// Remove mechanically appended escape buttons from defeat beats. The authored
// actions keep their costs, outcomes and real escape conditions. Process-only
// beats can fast-forward through that same action, stopping at the next choice.
for(const n of p.narrativeNodes.filter(n=>n.kind==='defeat')){
 const remaining=n.choices.filter(c=>c.label!=='结束当前经历，回到安全位置');
 const fallback=n.choices.find(c=>c.label==='结束当前经历，回到安全位置');
 if(fallback&&!remaining.some(c=>!c.conditions.length&&!c.effects.some(e=>e.op==='var.change'&&e.amount<0||e.op==='progression.act'))){
  const resultText=id('text.defeat.settlement.fallback');p.texts[resultText]='你等待现场处置结束，再带着本次留下的痕迹离开。已经发生的身体变化与损失继续保留。';
  remaining.push({...fallback,label:'等待处置结束，承担本次留下的后果',resultText,effects:[time(10),{op:'flag.set',id:id('flag.aftermath.mark'),value:true}]});
 }
 n.choices=remaining;
 if(n.choices.length===1&&n.choices[0].next&&!n.choices[0].conditions.length)n.skipChoiceIndex=0;
 for(const key of [n.textKey,...n.choices.map(c=>c.resultText)])p.texts[key]=p.texts[key].replaceAll('你仍可随时中断离开','你仍可尝试脱身，结果取决于接下来的行动').replaceAll('仍可随时抽身离开','可以寻找脱身的机会');
}
action('story.skip','跳过过程描写，保留后续选择与结算',[{op:'narrative.skip'}]);
p.contributions[0].actionIds=[...new Set(p.contributions.filter(c=>c.hookId===id('hook.runtime')).flatMap(c=>c.actionIds))].filter(a=>!['action.narrative.quest','action.narrative.ending'].map(id).includes(a));p.contributions=p.contributions.slice(0,1);
// Missing prose is a build error, never an instruction shown inside the game.
for(const n of p.narrativeNodes)for(const k of [n.textKey,...n.choices.map(c=>c.resultText)]){
 const problem=proseProblem(p.texts[k]??'',true);if(problem)throw Error('可玩正文未完成：'+k+'，'+problem);
}
await mkdir('content/adventure',{recursive:true});await writeFile('content/adventure/pack.json',JSON.stringify(p,null,2)+'\n');
console.log(`Adventure content: ${p.narrativeNodes.length} narrative nodes, ${p.narrativeProfiles.length} behavior profiles, ${p.environmentEnemyRules.length} env-enemy rules, ${p.equipment.length} gear items, ${p.items.length} consumables, ${p.enemies.length} enemies, nsfw-combo samples ${nsfwCombos.length}, prose fills ${proseFillCount}, defeat-play fills ${defeatPlayFillCount}.`);

await buildPersonalityContent();
