import {readFile,writeFile}from'node:fs/promises';import{kit}from'./content-kit.mjs';
const p=JSON.parse(await readFile('content/district/pack.json','utf8'));
if(p.enemies.length)throw Error('B content already exists');
const {id,text,has,set,change,time,hooks,action,graph,go}=kit(p),loc=k=>id('location.'+k),clinic='aetheria-tf:location.clinic';
p.variables.push({id:id('health'),label:'体力',initial:40,min:0,max:40,unit:''});
for(const [move,label]of [['attack','进攻 · 精力−3'],['guard','防守 · 减伤8、精力+4'],['recover','临时包扎 · 精力−6、体力+10'],['flee','寻找出口撤离']])action('combat.'+move,label,'你根据对方的意图行动。',[{op:'combat.turn',move}],[],id('hook.runtime'));
for(const [key,name,hp,reward,intents,location,defeatIntro]of [
 ['scavenger','失控搬运机',30,12,[{label:'转动机械臂横扫',damage:9,guard:0,drain:0},{label:'收拢装甲蓄力',damage:3,guard:7,drain:0},{label:'向前撞击',damage:14,guard:0,drain:1}],loc('canal'),'搬运机将你的退路推到排水栏杆边。你失去力气，却仍能发出求助信号。'],
 ['collector','拦路收债客',38,16,[{label:'观察并护住要害',damage:4,guard:9,drain:0},{label:'逼近，试图耗尽你的精力',damage:8,guard:1,drain:5},{label:'抢先重击',damage:12,guard:0,drain:0}],loc('station'),'收债客没有得到合法凭据，转身避开巡查。你坐在检查站外，衣物与力气都需要整理。'],
 ['gel','渠底黑胶群落',26,10,[{label:'缓慢靠近，堵住低处',damage:5,guard:3,drain:3},{label:'回缩并凝成坚硬外层',damage:2,guard:11,drain:0},{label:'甩出黏性外层',damage:11,guard:0,drain:2}],loc('canal'),'黑胶外层粘住了外衣，你暂时无法起身。你仍然保持清醒；这不是自动的永久共生或人格变化。']]){
 const defeat=graph('defeat.'+key,[
 {id:'start',text:defeatIntro+'\n\n你摸到应急呼叫器。可以呼叫值班员，也能先检查自己的伤处。没有图像时，这段正式文字承担完整演出。',choices:[go('发出求助信号','help',[set('injury'),time(10)]),go('先检查可活动部位','assess',[set('injury'),time(5)]),go('沿安全绳缓慢退出','end',[set('injury'),change('district:health',8),change('energy',10),time(45)],[],'你沿安全线抵达休息处，保留伤后恢复记录。')]},
 {id:'help',text:'值班员找到你，先问你能否清楚回应。你说明现场情况，对方确认安全后才扶你离开危险位置。你可以接受完整处理，也可以仅要求脱离现场。',choices:[go('接受基础护理，留下事故记录','end',[change('district:health',25),change('energy',25),set('defeat.reported'),time(60)],[],'护理员处理了擦伤，事故记入道路通报。'),go('只接受脱离危险的协助','end',[change('district:health',10),change('energy',15),time(30)],[],'你在安全位置休息，后续仍可前往诊室。')]},
 {id:'assess',text:'你确认自己仍能控制身体。最糟的疼痛来自疲劳和擦伤；需要恢复，却没有任何未经选择的永久变形。求助器还在手边。',choices:[go('呼叫值班员','help',[time(5)]),go('自行转移到安全休息区','end',[change('district:health',12),change('energy',15),time(60)],[],'你用更慢的方式回到安全区，记下以后要避开的路线。')]},
 {id:'end',exit:true,text:'危险已经结束。你的伤后经历留在记录中；可以休息、去诊室，或按自己的节奏继续生活。你回到所在地点的安全入口。'}]);
 const victory=graph('victory.'+key,[{id:'start',text:`${name}失去了继续交锋的能力。你检查退路，确认周围的人没有受伤。报酬只在战斗结束时结算一次。`,choices:[go('记下现场，回到安全入口','end',[set('victory.'+key),time(5)])]},{id:'end',exit:true,text:'你离开交锋区域，街区的日常仍在继续。'}]);
 const escape=graph('escape.'+key,[{id:'start',text:'你离开了敌人的攻击范围。出口灯还亮着，前方是能歇脚的安全区域。没有胜利报酬，但你保住了继续生活的机会。',choices:[go('确认没有追击后离开','end',[time(10),change('district:health',5)])]},{id:'end',exit:true,text:'你回到安全入口。接下来可以休息或重新规划路线。'}]);
 p.enemies.push({id:id('enemy.'+key),name,hp,reward,intents,victoryEventId:victory,defeatEventId:defeat,escapeEventId:escape});
 action('battle.'+key,'调查危险：'+name,`你进入标有风险警示的区域，遇到了${name}。`,[{op:'combat.start',id:id('enemy.'+key)}],[],hooks.get(location),null,'explore');
}
for(const l of p.locations)action('heal.'+l.id.split('.')[1],'在安全区处理伤势','你清洁擦伤，喝水，等身体恢复到能继续赶路的状态。伤后经历依然存在，体力恢复不会删去已经发生的事。',[time(60),change('district:health',40),change('energy',25)],[],l.actionHook);
// Material changes remain actual BodyGraph replacements, independently of identity.
const hand={id:id('part.hand.gel'),label:'稳定的黑胶共生手部',kind:'hand',material:'organic',capabilities:['grasp'],anchors:[]};p.bodyParts=[hand];
p.bodyPatches=[{id:id('patch.gel'),label:'黑胶共生手部适应',summary:'双手表层与黑胶共生，保留自主控制',operations:['left','right'].map(side=>({type:'replace',partId:'hand.'+side,definitionId:hand.id}))},{id:id('patch.hands.restore'),label:'恢复有机手部',summary:'手部恢复有机结构',operations:['left','right'].map(side=>({type:'replace',partId:'hand.'+side,definitionId:'aetheria-tf:part.hand'}))}];
p.transformations=[{id:id('tf.gel'),label:'受控黑胶共生适应',source:'story',stages:[{id:'premonition',atMinutes:10,label:'前兆：表层温度开始均匀',textKey:text('tf.gel.premonition','你感到掌面多了一层轻微弹性。护理记录里的停用条件仍在，变化还没有替你做出任何决定。')},{id:'change',atMinutes:30,label:'变化：共生外层稳定',patchId:id('patch.gel'),textKey:text('tf.gel.change','黑亮的外层沿原有手部轮廓稳定下来。你逐一尝试松开与握紧，动作依然来自自己的意愿。')},{id:'adapt',atMinutes:60,label:'适应：重新掌握抓握分寸',textKey:text('tf.gel.adapt','纸杯起初容易滑脱。你放轻力度，让触觉沿新的表层重新建立，终于能稳稳拿起水杯。')} ]},{id:id('tf.wolf'),label:'受控兽耳渐进适应',source:'story',stages:[{id:'premonition',atMinutes:10,label:'前兆：声音的层次变清楚',textKey:text('tf.wolf.premonition','远处轮轴的轻响第一次分出高低层次。你先找安静的位置，给变化留出余地。')},{id:'change',atMinutes:25,label:'变化：耳部结构重塑',patchId:'aetheria-tf:patch.ears.wolf',textKey:text('tf.wolf.change','耳侧的轮廓缓慢向上延展。你听见衣领擦过发梢的声音，没有急着回到吵闹街道。')},{id:'adapt',atMinutes:50,label:'适应：学会筛去背景噪声',textKey:text('tf.wolf.adapt','你让注意力停在茶壶的水声，再慢慢放开。新感官终于不再把每个声音都推到眼前。')}]},{id:id('tf.hands.restore'),label:'恢复有机手部',source:'free',stages:[{id:'done',atMinutes:0,label:'手部恢复',patchId:id('patch.hands.restore')}]}];
const clinicHook='aetheria-tf:hook.clinic';
for(const [key,title,prose]of [['gel','了解受控黑胶共生','护士将可逆护理、可能的不适和自主停止写在同一张卡上。“变化不会替你决定身份。先读完，再说愿不愿意。”'],['wolf','了解渐进式兽耳适应','护士先降低室内广播。“新的感官要慢慢适应，今天不要把自己放进最吵的工作环境里。”']]){
 const e=graph('tfconsult.'+key,[{id:'start',text:prose,choices:[go('确认风险并接受适应过程','end',[change('money',-10),{op:'tf.enqueue',id:id('tf.'+key)},set('tf.'+key+'.accepted')],[{op:'var.compare',id:'core:money',comparison:'gte',value:10}], '你确认自主接受，并把护理卡收好。'),go('今天先不开始','end',[],[],'你保留咨询资料，变化没有开始。')]},{id:'end',exit:true,text:'咨询结束。你可以在诊室等候，也可以在安全的生活行动中让时间推进；任何改造阶段都保留来源与进度。'}]);
 action('tfconsult.'+key,title,'你提出一次正式咨询。',[{op:'event.start',id:e}],[],clinicHook);
}
action('restore.hands','按护理卡恢复有机手部','你按已经了解的流程解除共生表层，逐步恢复原有抓握感。',[{op:'tf.apply',id:id('tf.hands.restore')}],[{op:'body.hasPart',definitionId:hand.id}],clinicHook);
action('gel.work','用共生手部清理顽固污层','你使用适合共生表层的清洁剂，按护理卡确认温度与接触时间。工作完成后先检查自己，再领取报酬。',[change('energy',-8),change('money',12),time(45)],[{op:'body.hasPart',definitionId:hand.id}],hooks.get(loc('workshop')));
for(const [location,prose]of [[loc('cafe'),'店员递来带防滑套的杯子，没有擅自触碰你的手。“新的表层也值得有合适的日用品。”'],[loc('workshop'),'莱克把共生结构与机械触点的清洁剂分开放好。“材质会变，保养要跟着变。你说停，我们就停。”']])p.sceneTexts.push({id:id('scene.gel.'+location.split('.')[1]),locationId:location,conditions:[{op:'body.hasPart',definitionId:hand.id}],priority:10,textKey:text('gel.reaction.'+location.split('.')[1],prose)});
// A cross-location, cross-day public works chain with two lasting policies.
const task=graph('canal.task',[{id:'start',text:'档案室的公开工单记着一扇反复卡住的排水门。问题不是单纯缺零件：旧渠水位、工坊维护记录与检查站的通行安排没有对上。你可以做一次独立核查。',choices:[go('接下核查工单','end',[set('canal.accepted')]),go('暂不承担','end')]},{id:'end',exit:true,text:'你离开窗口。接下工单后，可先到旧渠核查水位，再去机械工坊对照零件，次日回来选择公开方案。'}]);
action('canal.accept','查看排水门核查工单','你来到公开工单窗口。',[{op:'event.start',id:task}],[has('canal.accepted',false)],hooks.get(loc('archive')));
action('canal.inspect','核查排水门与水位','你在安全线内读出水位和齿轮编号。门不是完全损坏，而是旧调度仍按已经变化的水位工作。',[time(30),set('canal.inspected')],[has('canal.accepted'),has('canal.inspected',false)],hooks.get(loc('canal')));
action('canal.parts','核对工坊维护记录','莱克把旧齿轮编号对上工单，建议留出整夜观察周期。他不愿为了赶工让夜班居民冒险。',[time(30),set('canal.parts')],[has('canal.inspected'),has('canal.parts',false)],hooks.get(loc('workshop')));
const decision=graph('canal.decision',[{id:'start',text:'一个游戏日的观察记录已齐。短期封路能尽快换掉调度器；分段维护更慢，却能保留夜班通行。两种方案都有人承担代价。',choices:[go('公开封路，集中维护','end',[set('canal.closed'),set('canal.done'),change('money',18)],[],'你把封路日期公开，集中维护很快结束，夜班绕行仍会留在居民记忆中。'),go('选择分段维护，保留夜路','end',[set('canal.open'),set('canal.done'),change('money',10),time(90)],[],'你为分段交接多花时间。信使仍有夜路可走，报酬因此较少。'),go('先离开，再考虑方案','end')]},{id:'end',exit:true,text:'窗口保留了你提交的事实与选择。道路的日常反馈会反映最终方案；工单没有因为关闭页面而消失。'}]);
action('canal.decide','提交跨日观察，选择维护方案','你带着核查材料回到档案室。',[{op:'event.start',id:decision}],[has('canal.parts'),has('canal.done',false),{op:'day.after',flagId:id('flag.canal.parts'),days:1}],hooks.get(loc('archive')));
for(const [key,tx]of [['closed','新告示写着集中维护已经结束。夜班绕行的痕迹仍在，居民谈到这次处理时会提起少走的一段与多绕的一圈。'],['open','分段维护后，旧渠夜间仍留着通道。信使在新的路标旁等同伴，把这次公开交接当作可以信任的承诺。']])p.sceneTexts.push({id:id('scene.canal.'+key),locationId:loc('canal'),conditions:[has('canal.'+key)],priority:20,textKey:text('canal.feedback.'+key,tx)});
await writeFile('content/district/pack.json',JSON.stringify(p,null,2));
